# Démo A — stopper l'usage illimité d'un LLM

Two Kubernetes objects, applied live: an `HTTPRoute` and an `AgentgatewayPolicy`.

| Step | What the audience sees | File |
|---|---|---|
| 0 | An open route `/demo/v1` on the platform's model backend, no policy | [1-route-ouverte.yaml](1-route-ouverte.yaml) |
| 1 | Three anonymous calls: 200, 200, 200 — nobody knows who consumes | — |
| 2 | Entra ID token required: 401 without it, 200 with it — the gateway knows WHO | [2-jeton-entra.yaml](2-jeton-entra.yaml) |
| 3 | Same policy + 400 LLM tokens per minute: 429 after a few calls | [3-plafond.yaml](3-plafond.yaml) |
| 4 | Grafana « Usage IA »: per-person cost, the 401s and the 429 | — |

```powershell
./demos/A-ratelimit-entra/run.ps1     # $env:NO_PAUSE = "1" for rehearsals
./demos/A-ratelimit-entra/reset.ps1
```

The issuer, audience and JWKS URL are copied at run time from the platform policy
`acces-llm` (same tenant, same API app); the token comes from
`az account get-access-token --scope <gateway_scope>` (Azure CLI pre-authorized on
the gateway API app). Validated against the agentgateway v1.5.0 and Gateway API CRD
schemas.

Honest limit: the local ceiling is per route and per proxy replica. A budget per team
or per person needs the global rate limit (external service).
