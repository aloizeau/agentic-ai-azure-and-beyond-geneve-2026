"""HTTP layer: implements the agentgateway webhook guardrail contract.

    POST /request   GuardrailsPromptRequest   -> Pass | Mask | Reject
    POST /response  GuardrailsResponseRequest -> Pass | Mask   (no Reject in the contract)

Contract: contract/webhook-openapi.yaml (vendored, see header). The webhook
always answers HTTP 200; a Reject is expressed by `status_code` in the body.
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel

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
    ["direction", "action", "rail", "profile"],
)
ERRORS = Counter("guardrail_adapter_errors_total", "Rail engine failures.", ["direction", "profile"])
LATENCY = Histogram(
    "guardrail_adapter_check_duration_seconds",
    "Time spent in the rail engine.",
    ["direction", "backend"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 4),
)


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

    def decide(direction: Direction, action: str, rail: str | None, req: Request) -> None:
        DECISIONS.labels(direction.value, action, rail or "-", profile_of(req)).inc()

    # --------------------------------------------------------------- /request
    @app.post("/request")
    async def process_prompts(payload: GuardrailsPromptRequest, req: Request) -> dict[str, Any]:
        msgs = [m.model_dump() for m in payload.body.messages]
        user_idx = max((i for i, m in enumerate(msgs) if m["role"] == "user"), default=None)
        if user_idx is None:
            decide(Direction.INPUT, "pass", None, req)
            return {"action": {"reason": "no user message to check"}}

        # Rails see the conversation up to the newest user message. Les messages
        # qui suivent (role `tool`, résultats d'appels d'outils…) viennent de
        # sources externes : injection indirecte ou secret lu par un outil. On
        # les passe aussi dans les rails d'entrée du même profil, un par un, en
        # tant que message `user` (les rails d'entrée ne regardent que celui-là).
        # Les messages `assistant` sont la sortie du modèle, déjà vue en /response.
        checks = [(user_idx, msgs[: user_idx + 1])]
        checks += [(i, [{"role": "user", "content": m["content"]}])
                   for i, m in enumerate(msgs) if i > user_idx and m["role"] != "assistant" and m["content"]]

        masked: list[dict] | None = None
        mask_rail: str | None = None
        engine_failed = False
        for idx, conv in checks:
            res = await run(req, conv, Direction.INPUT)
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
                decide(Direction.INPUT, "reject", res.rail, req)
                return {"action": {"status_code": s.reject_status, "body": refusal(res.rail),
                                   "reason": f"blocked by NeMo rail: {res.rail}{where}"}}

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
app = create_app()
