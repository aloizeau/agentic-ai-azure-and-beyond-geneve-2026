"""Runtime settings, all read from the environment (12-factor)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    # Where the rail profiles live. Each sub-folder containing a config.yml is a
    # profile, e.g. /rails/default, /rails/strict. In Kubernetes each folder is
    # a ConfigMap mounted at its own path.
    rails_root: str = field(default_factory=lambda: _env("RAILS_ROOT", "/rails"))
    default_profile: str = field(default_factory=lambda: _env("DEFAULT_PROFILE", "default"))

    # library      -> NeMo Guardrails runs in-process (Apache-2.0, default)
    # microservice -> delegate to a NemoGuardrail CR (NVIDIA NIM Operator,
    #                 NVIDIA AI Enterprise licence) via POST /v1/guardrail/checks
    backend: str = field(default_factory=lambda: _env("BACKEND", "library"))
    nemo_url: str = field(default_factory=lambda: _env("NEMO_URL", "http://nemoguardrails:8000"))
    nemo_model: str = field(default_factory=lambda: _env("NEMO_MODEL", "guardrail-model"))
    nemo_timeout_s: float = field(default_factory=lambda: float(_env("NEMO_TIMEOUT_S", "4")))

    # What to do when the rail engine itself fails (exception, timeout).
    # closed -> reject the request; open -> let it through. Independent from the
    # gateway's own `failureMode`, which covers the adapter being unreachable.
    fail_mode: str = field(default_factory=lambda: _env("FAIL_MODE", "closed"))

    reject_status: int = field(default_factory=lambda: int(_env("REJECT_STATUS", "403")))
    error_status: int = field(default_factory=lambda: int(_env("ERROR_STATUS", "503")))
    refusal_message: str = field(
        default_factory=lambda: _env(
            "REFUSAL_MESSAGE",
            "Requête bloquée par la politique de sécurité IA de l'entreprise (règle : {rail}).",
        )
    )
    # Header the gateway sets (CEL literal) to pick a profile per route/team.
    profile_header: str = field(default_factory=lambda: _env("PROFILE_HEADER", "x-guardrail-profile"))

    def validate(self) -> "Settings":
        if self.backend not in {"library", "microservice"}:
            raise ValueError(f"BACKEND must be 'library' or 'microservice', got {self.backend!r}")
        if self.fail_mode not in {"closed", "open"}:
            raise ValueError(f"FAIL_MODE must be 'closed' or 'open', got {self.fail_mode!r}")
        return self
