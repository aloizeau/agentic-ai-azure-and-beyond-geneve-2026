"""Rail engines. Both return the same neutral verdict so the HTTP layer does not
care whether NeMo runs in-process or behind the NVIDIA microservice."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Protocol

import httpx

log = logging.getLogger("guardrail-adapter")


class Direction(str, Enum):
    INPUT = "input"
    OUTPUT = "output"


class Verdict(str, Enum):
    PASSED = "passed"
    MODIFIED = "modified"
    BLOCKED = "blocked"


@dataclass(frozen=True)
class CheckResult:
    verdict: Verdict
    content: str
    rail: str | None = None


class UnknownProfile(KeyError):
    pass


class RailBackend(Protocol):
    name: str

    def profiles(self) -> list[str]: ...

    async def check(self, profile: str, messages: list[dict], direction: Direction) -> CheckResult: ...


# --------------------------------------------------------------------- library
class LibraryBackend:
    """NeMo Guardrails as a library (IORails engine, `Guardrails.check_async`).

    `check_async` runs input and/or output rails WITHOUT calling the main LLM
    and returns passed / modified / blocked — which maps 1:1 onto the
    agentgateway Pass / Mask / Reject actions.
    """

    name = "library"

    def __init__(self, rails_root: str):
        # Imported lazily so the microservice mode does not need the library.
        from nemoguardrails import Guardrails, RailsConfig

        self._engines: dict = {}
        root = Path(rails_root)
        if not root.is_dir():
            raise FileNotFoundError(f"RAILS_ROOT {root} does not exist")
        for folder in sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith("..")):
            if not any((folder / f).is_file() for f in ("config.yml", "config.yaml")):
                continue
            self._engines[folder.name] = Guardrails(RailsConfig.from_path(str(folder)))
            log.info("loaded rail profile %s (iorails=%s)", folder.name,
                     getattr(self._engines[folder.name], "use_iorails_engine", "?"))
        if not self._engines:
            raise RuntimeError(f"no rail profile found under {root}")

    def profiles(self) -> list[str]:
        return sorted(self._engines)

    async def check(self, profile: str, messages: list[dict], direction: Direction) -> CheckResult:
        from nemoguardrails.guardrails.iorails import RailTypeNotConfiguredError
        from nemoguardrails.rails.llm.options import RailType

        engine = self._engines.get(profile)
        if engine is None:
            raise UnknownProfile(profile)
        rail_type = RailType.INPUT if direction is Direction.INPUT else RailType.OUTPUT
        try:
            res = await engine.check_async(messages, [rail_type])
        except RailTypeNotConfiguredError:
            # The profile simply has no rails in this direction.
            return CheckResult(Verdict.PASSED, _last_content(messages))
        return CheckResult(Verdict(res.status.value), res.content, res.rail)


# ---------------------------------------------------------------- microservice
class MicroserviceBackend:
    """Delegates to the NeMo Guardrails microservice deployed by the NIM
    Operator `NemoGuardrail` CR (POST /v1/guardrail/checks).

    ⚠️ Documented only through success examples: the exact `status` values of a
    blocked check are not published. The mapping below is defensive and must be
    validated against a licensed instance. The checks endpoint returns no
    rewritten content, so this mode cannot emit Mask actions.
    """

    name = "microservice"
    _BLOCKED = {"blocked", "failure", "failed", "error"}

    def __init__(self, base_url: str, model: str, timeout_s: float):
        self._url = base_url.rstrip("/") + "/v1/guardrail/checks"
        self._model = model
        self._client = httpx.AsyncClient(timeout=timeout_s)

    def profiles(self) -> list[str]:
        return []  # config ids live in the microservice config store

    async def check(self, profile: str, messages: list[dict], direction: Direction) -> CheckResult:
        payload = {"model": self._model, "messages": messages, "guardrails": {"config_id": profile}}
        r = await self._client.post(self._url, json=payload)
        r.raise_for_status()
        body = r.json()
        rails = body.get("rails_status") or {}
        for rail, st in rails.items():
            if str((st or {}).get("status", "")).lower() in self._BLOCKED:
                return CheckResult(Verdict.BLOCKED, "", rail)
        if str(body.get("status", "")).lower() in self._BLOCKED:
            return CheckResult(Verdict.BLOCKED, "", None)
        return CheckResult(Verdict.PASSED, _last_content(messages))


def _last_content(messages: list[dict]) -> str:
    return str(messages[-1].get("content", "")) if messages else ""
