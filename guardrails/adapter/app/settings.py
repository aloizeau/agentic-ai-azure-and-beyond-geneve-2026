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
    # Taille maximale d'un corps de requête (octets), refusée en 413 avant tout
    # parsing JSON : un corps géant ne doit pas épuiser la mémoire du pod.
    max_body_bytes: int = field(default_factory=lambda: int(_env("MAX_BODY_BYTES", str(1024 * 1024))))
    # Rails appliqués aux messages non-`assistant` qui suivent le dernier
    # message user (résultats d'outils MCP : docs Learn, sorties Azure…).
    # secrets -> motifs de secrets uniquement, en Python dans l'adaptateur
    #            (pas de motifs PII : versions, IP, dates d'une doc ne sont pas
    #            une fuite de données personnelles ; pas d'appel LLM : avec le
    #            profil strict, un self check par résultat d'outil sous le
    #            timeout gateway de 3 s faisait refuser les requêtes multi-outils)
    # profile -> secrets + carte bancaire + rails d'entrée complets du profil (PII, self check
    #            LLM contre l'injection indirecte), lancés en parallèle.
    tool_rails: str = field(default_factory=lambda: _env("TOOL_RAILS", "secrets"))

    def validate(self) -> "Settings":
        if self.max_body_bytes <= 0:
            raise ValueError(f"MAX_BODY_BYTES must be > 0, got {self.max_body_bytes}")
        if self.backend not in {"library", "microservice"}:
            raise ValueError(f"BACKEND must be 'library' or 'microservice', got {self.backend!r}")
        if self.tool_rails not in {"secrets", "profile"}:
            raise ValueError(f"TOOL_RAILS must be 'secrets' or 'profile', got {self.tool_rails!r}")
        if self.fail_mode not in {"closed", "open"}:
            raise ValueError(f"FAIL_MODE must be 'closed' or 'open', got {self.fail_mode!r}")
        return self
