"""HTTP layer: implements the agentgateway webhook guardrail contract.

    POST /request   GuardrailsPromptRequest   -> Pass | Mask | Reject
    POST /response  GuardrailsResponseRequest -> Pass | Mask   (no Reject in the contract)

Contract: contract/webhook-openapi.yaml (vendored, see header). The webhook
always answers HTTP 200; a Reject is expressed by `status_code` in the body.
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel

from . import dlp
from .backends import (
    CheckResult,
    Direction,
    LibraryBackend,
    MicroserviceBackend,
    RailBackend,
    UnknownProfile,
    Verdict,
)
from .settings import Settings

log = logging.getLogger("guardrail-adapter")

DECISIONS = Counter(
    "guardrail_adapter_decisions_total",
    "Decisions returned to the gateway.",
    ["direction", "action", "rail", "profile", "team", "model", "source"],
)
ERRORS = Counter("guardrail_adapter_errors_total", "Rail engine failures.", ["direction", "profile"])
LATENCY = Histogram(
    "guardrail_adapter_check_duration_seconds",
    "Time spent in the rail engine.",
    ["direction", "backend"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 4),
)


def source_of(rail: str | None) -> str:
    """Quel mécanisme a décidé, pour lire « qui arrête les requêtes » sans connaître les noms de règles.

    adapter         contrôles Python de l'adaptateur (carte bancaire/Luhn, secrets dans un message d'outil)
    nemo-regex      règles `regex_detection` du profil (clés, IBAN, NIR…)
    nemo-injection  règles YARA (code, SQL, XSS, gabarits)
    nemo-llm        auto-contrôles par un modèle (profil strict)
    moteur          panne du moteur (FAIL_MODE), pas un contenu
    nemo-autre      toute autre règle NeMo
    """
    if not rail:
        return "-"
    if rail in (dlp.CARD_RAIL, dlp.SECRET_RAIL):
        return "adapter"
    r = rail.lower()
    if "engine-error" in r:
        return "moteur"
    if "regex" in r:
        return "nemo-regex"
    if "injection" in r:
        return "nemo-injection"
    if "self check" in r or "self_check" in r:
        return "nemo-llm"
    return "nemo-autre"


# ------------------------------------------------------------- contract models
class Message(BaseModel):
    role: str
    content: str


class PromptMessages(BaseModel):
    messages: list[Message] = []


class ResponseChoice(BaseModel):
    message: Message


class ResponseChoices(BaseModel):
    choices: list[ResponseChoice] = []


class GuardrailsPromptRequest(BaseModel):
    body: PromptMessages


class GuardrailsResponseRequest(BaseModel):
    body: ResponseChoices


# ------------------------------------------------------------- body size limit
class BodySizeLimit:
    """Middleware ASGI : refuse en 413 tout corps > `max_bytes`, AVANT le parsing
    JSON. Content-Length est vérifié d'emblée ; un corps chunked est compté au
    fil de la lecture (on ne fait pas confiance à l'en-tête seul)."""

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def _too_large(self, scope, receive, send) -> None:
        resp = JSONResponse({"detail": f"request body exceeds {self.max_bytes} bytes"}, status_code=413)
        await resp(scope, receive, send)

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        for k, v in scope.get("headers", []):
            if k == b"content-length":
                try:
                    declared = int(v)
                except ValueError:
                    declared = self.max_bytes + 1  # en-tête invalide : refusé
                if declared > self.max_bytes:
                    await self._too_large(scope, receive, send)
                    return
        chunks, size, more = [], 0, True
        while more:
            msg = await receive()
            if msg["type"] == "http.disconnect":
                return
            chunk = msg.get("body", b"")
            size += len(chunk)
            if size > self.max_bytes:
                await self._too_large(scope, receive, send)
                return
            chunks.append(chunk)
            more = msg.get("more_body", False)
        body, replayed = b"".join(chunks), False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


# ------------------------------------------------------------------ app wiring
def build_backend(s: Settings) -> RailBackend:
    if s.backend == "microservice":
        return MicroserviceBackend(s.nemo_url, s.nemo_model, s.nemo_timeout_s)
    return LibraryBackend(s.rails_root)


def create_app(settings: Settings | None = None, backend: RailBackend | None = None) -> FastAPI:
    s = (settings or Settings()).validate()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.backend = backend or build_backend(s)
        log.info("backend=%s profiles=%s fail_mode=%s", app.state.backend.name,
                 app.state.backend.profiles(), s.fail_mode)
        yield

    app = FastAPI(title="nemo-guardrail-adapter", version="0.1.0", lifespan=lifespan)
    app.state.settings = s
    app.add_middleware(BodySizeLimit, max_bytes=s.max_body_bytes)

    def profile_of(req: Request) -> str:
        return (req.headers.get(s.profile_header) or s.default_profile).strip()

    def refusal(rail: str | None) -> str:
        return s.refusal_message.format(rail=rail or "inconnue")

    async def run(req: Request, messages: list[dict], direction: Direction) -> CheckResult | None:
        """Returns None when the engine failed (caller applies FAIL_MODE)."""
        profile = profile_of(req)
        # Le moteur voit le texte normalisé (NFKC, sans caractères invisibles) :
        # « 4111\u200b1111… » ou des chiffres pleine largeur ne contournent pas
        # les regex. Le contenu d'origine n'est remplacé que sur un Mask.
        messages = [{**m, "content": dlp.normalize(str(m.get("content", "")))} for m in messages]
        t0 = time.perf_counter()
        try:
            return await req.app.state.backend.check(profile, messages, direction)
        except UnknownProfile:
            log.warning("unknown profile %r, falling back to %r", profile, s.default_profile)
            return await req.app.state.backend.check(s.default_profile, messages, direction)
        except Exception:  # noqa: BLE001 — any engine failure is a policy decision
            ERRORS.labels(direction.value, profile).inc()
            log.exception("rail engine failure (direction=%s profile=%s)", direction.value, profile)
            return None
        finally:
            LATENCY.labels(direction.value, req.app.state.backend.name).observe(time.perf_counter() - t0)

    def label_of(req: Request, header: str) -> str:
        # Libellé Prometheus : borné en longueur, jamais vide. Les valeurs viennent de la
        # passerelle (CEL), pas du client — mais un en-tête absent ne doit rien casser.
        return (req.headers.get(header) or "-").strip()[:64] or "-"

    def decide(direction: Direction, action: str, rail: str | None, req: Request) -> None:
        team, model = label_of(req, s.team_header), label_of(req, s.model_header)
        source = source_of(rail)
        DECISIONS.labels(direction.value, action, rail or "-", profile_of(req), team, model, source).inc()
        # Une ligne par déclenchement : le détail par personne (`user`) vit ici, pas dans
        # les métriques (cardinalité). Jamais le contenu du prompt.
        if action != "pass" or rail == "engine-error":
            log.info("decision=%s direction=%s source=%s rail=%s profile=%s team=%s user=%s model=%s",
                     action, direction.value, source, rail or "-", profile_of(req), team,
                     label_of(req, s.user_header), model)

    # --------------------------------------------------------------- /request
    @app.post("/request")
    async def process_prompts(payload: GuardrailsPromptRequest, req: Request) -> dict[str, Any]:
        msgs = [m.model_dump() for m in payload.body.messages]
        user_idx = max((i for i, m in enumerate(msgs) if m["role"] == "user"), default=None)
        if user_idx is None:
            decide(Direction.INPUT, "pass", None, req)
            return {"action": {"reason": "no user message to check"}}

        def reject(rail: str, where: str = "", source: str = "NeMo rail") -> dict[str, Any]:
            decide(Direction.INPUT, "reject", rail, req)
            return {"action": {"status_code": s.reject_status, "body": refusal(rail),
                               "reason": f"blocked by {source}: {rail}{where}"}}

        # 1. Carte bancaire sur le dernier message user : contrôle Python
        #    (groupement + préfixe émetteur + Luhn, cf. app/dlp.py), avant tout
        #    appel au moteur — comme les regex, il court-circuite le self check.
        if dlp.find_card(msgs[user_idx]["content"]):
            return reject(dlp.CARD_RAIL, source="adapter rail")

        # 2. Les messages qui suivent le dernier user (role `tool`, résultats
        #    d'appels d'outils…) viennent de sources externes : un outil peut
        #    lire et renvoyer un secret. Les messages `assistant` sont la sortie
        #    du modèle, déjà vue en /response.
        #    TOOL_RAILS=secrets (défaut) : motifs de secrets seulement, en
        #    Python — ni motifs PII (versions, IP, dates d'une doc Learn ne sont
        #    pas une fuite de données personnelles), ni self check LLM (un appel
        #    par résultat d'outil, sous le timeout gateway de 3 s, faisait
        #    refuser en fail-closed les requêtes à plusieurs outils).
        tool_idx = [i for i, m in enumerate(msgs)
                    if i > user_idx and m["role"] != "assistant" and m["content"]]
        for i in tool_idx:
            if dlp.find_secret(msgs[i]["content"]):
                return reject(dlp.SECRET_RAIL, f" ({msgs[i]['role']} message #{i})", "adapter rail")
            # TOOL_RAILS=profile : rails PII complets, carte bancaire comprise
            # (le motif carte n'est plus dans le YAML, il est ici).
            if s.tool_rails == "profile" and dlp.find_card(msgs[i]["content"]):
                return reject(dlp.CARD_RAIL, f" ({msgs[i]['role']} message #{i})", "adapter rail")

        # 3. Rails du profil : la conversation jusqu'au dernier user ; avec
        #    TOOL_RAILS=profile, aussi chaque message tool seul (en tant que
        #    message `user`, les rails d'entrée ne regardent que celui-là).
        #    Tous les contrôles partent EN PARALLÈLE : la latence est celle du
        #    plus lent, pas la somme. Les verdicts sont lus dans l'ordre des
        #    messages, la décision reste déterministe.
        checks = [(user_idx, msgs[: user_idx + 1])]
        if s.tool_rails == "profile":
            checks += [(i, [{"role": "user", "content": msgs[i]["content"]}]) for i in tool_idx]
        results = await asyncio.gather(*(run(req, conv, Direction.INPUT) for _, conv in checks))

        masked: list[dict] | None = None
        mask_rail: str | None = None
        engine_failed = False
        for (idx, _), res in zip(checks, results):
            where = "" if idx == user_idx else f" ({msgs[idx]['role']} message #{idx})"

            if res is None:
                if s.fail_mode == "open":
                    engine_failed = True
                    continue
                decide(Direction.INPUT, "reject", "engine-error", req)
                return {"action": {"status_code": s.error_status,
                                   "body": "Contrôle de sécurité IA indisponible, requête refusée.",
                                   "reason": "guardrail engine unavailable (fail-closed)"}}

            if res.verdict is Verdict.BLOCKED:
                return reject(res.rail, where)

            if res.verdict is Verdict.MODIFIED and res.content != msgs[idx]["content"]:
                masked = masked or [dict(m) for m in msgs]  # message count must stay identical
                masked[idx]["content"] = res.content
                mask_rail = mask_rail or res.rail

        if masked is not None:
            decide(Direction.INPUT, "mask", mask_rail, req)
            return {"action": {"body": {"messages": masked},
                               "reason": f"content transformed by NeMo rail: {mask_rail or 'transform'}"}}

        if engine_failed:  # fail-open : on laisse passer, comme avant
            decide(Direction.INPUT, "pass", "engine-error", req)
            return {"action": {"reason": "guardrail engine unavailable (fail-open)"}}

        decide(Direction.INPUT, "pass", None, req)
        return {"action": {"reason": "all input rails passed"}}

    # -------------------------------------------------------------- /response
    @app.post("/response")
    async def process_responses(payload: GuardrailsResponseRequest, req: Request) -> dict[str, Any]:
        choices = [c.model_dump() for c in payload.body.choices]
        changed, rails, failed = False, [], False
        out = []
        for ch in choices:
            msg = ch["message"]
            res = await run(req, [{"role": "assistant", "content": msg["content"]}], Direction.OUTPUT)
            if res is None:
                failed = True
                content = msg["content"] if s.fail_mode == "open" else refusal("engine-error")
                changed |= s.fail_mode == "closed"
            elif res.verdict is Verdict.BLOCKED:
                # The response contract has no Reject: a blocked answer is
                # replaced by the refusal text (choice count preserved).
                content, changed = refusal(res.rail), True
                rails.append(res.rail)
            elif res.verdict is Verdict.MODIFIED and res.content != msg["content"]:
                content, changed = res.content, True
                rails.append(res.rail or "transform")
            else:
                content = msg["content"]
            out.append({"message": {"role": msg["role"], "content": content}})

        if changed:
            rail = ",".join(r for r in rails if r) or ("engine-error" if failed else None)
            decide(Direction.OUTPUT, "mask", rail, req)
            return {"action": {"body": {"choices": out}, "reason": f"response rewritten by NeMo rails: {rail}"}}
        decide(Direction.OUTPUT, "pass", "engine-error" if failed else None, req)
        return {"action": {"reason": "all output rails passed"}}

    # ------------------------------------------------------------- ops routes
    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz")
    async def readyz(req: Request) -> JSONResponse:
        b = getattr(req.app.state, "backend", None)
        if b is None:
            return JSONResponse({"status": "starting"}, status_code=503)
        return JSONResponse({"status": "ready", "backend": b.name, "profiles": b.profiles()})

    @app.get("/metrics")
    async def metrics() -> PlainTextResponse:
        return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return app


# ASGI entrypoint for uvicorn: `uvicorn app.main:app`
# uvicorn ne configure que ses propres journaux : sans ceci, les lignes INFO de
# l'adaptateur (démarrage, décisions) seraient perdues.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = create_app()
