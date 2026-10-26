# Guardrails — NeMo Guardrails behind agentgateway

> **Status: R&D — target architecture, not in production yet.**
> In production today, guardrails are the **Microsoft Foundry content filters**
> attached to each model deployment. They work, but they are Azure-specific and do
> not follow a change of model provider. This folder is the target: one rule set at
> the gateway, identical for Foundry, Bedrock or OVHcloud. It is built and tested
> alongside client work. Enable it in the Terraform sample with
> `enable_nemo_guardrails = true` once the adapter image is built (the webhook
> is fail-closed: no adapter, no LLM traffic).

One rule set, applied at the gateway, whatever the model provider behind it
(Microsoft Foundry, Amazon Bedrock, OVHcloud…).

```
client ─► agentgateway ──(1) native regex guard ──(2) webhook ─► guardrail-adapter ─► NeMo Guardrails
             │                                                        │ (strict profile only)
             ▼                                                        ▼
        model provider                                   agentgateway-internal (unguarded, metered)
```

| Layer | Where | What | Cost |
|---|---|---|---|
| 1 | `AgentgatewayPolicy` `regex` | card numbers | µs, no dependency |
| 2 | `AgentgatewayPolicy` `webhook` → adapter (`app/dlp.py`: card numbers with Luhn, secrets in `tool` messages) → NeMo | secrets, IBAN, NIR, YARA injection (code, SQLi, XSS, template), LLM self-checks | < 10 ms without LLM rails |

## Layout

```
adapter/                  FastAPI service implementing the agentgateway webhook contract
  app/                    HTTP layer, NeMo backends (library | microservice), settings
  contract/               vendored webhook OpenAPI spec (responses are validated against it in tests)
  tests/                  behaviour + contract tests (mock OpenAI server for LLM rails)
deploy/                   kustomize base — library mode, Apache-2.0 only
  rails/default           deterministic rails: regex + YARA injection, no LLM call
  rails/strict            default + `self check input/output` through the internal gateway
  base/                   Deployment, Service, PDB, ServiceMonitor, PrometheusRule, NetworkPolicies
  gateway/                Gateway (internal), AgentgatewayBackend, HTTPRoute, AgentgatewayPolicy ×3
overlays/nvidia-microservice   NemoGuardrail CR (NVIDIA NIM Operator) + adapter switched to BACKEND=microservice
```

## Vendor CRDs used

| CRD | Vendor | Purpose |
|---|---|---|
| `AgentgatewayPolicy` (`agentgateway.dev/v1alpha1`) | Solo.io / AAIF | regex guard + webhook guard per route, rail profile chosen by CEL header, `failureMode: FailClosed`, webhook timeout |
| `AgentgatewayBackend` | Solo.io / AAIF | Foundry backend for the rails' own LLM calls, keyless (`auth.azure.workloadIdentity`) |
| `Gateway`, `HTTPRoute` | Gateway API | dedicated internal listener — avoids the guard-calls-guard loop |
| `NemoGuardrail` (`apps.nvidia.com/v1alpha1`) | NVIDIA NIM Operator | enterprise overlay: the NeMo Guardrails microservice |
| `ServiceMonitor`, `PrometheusRule` | Prometheus Operator | decisions, latency, block ratio, alerts |

Validated with kustomize 5.7.1 and against the published CRD schemas
(agentgateway `v1.5.0`, k8s-nim-operator main as of Sept 2026), unknown fields rejected.

## Library vs microservice

| | `library` (default) | `microservice` (overlay) |
|---|---|---|
| Engine | `nemoguardrails==0.24.1` in-process (`Guardrails.check_async`) | NeMo Guardrails microservice, `POST /v1/guardrail/checks` |
| Licence | Apache-2.0 | NVIDIA AI Enterprise ("available for the NVIDIA AI Enterprise plan") |
| Extra infra | none | NIM Operator, PostgreSQL, NGC pull secret |
| Mask (transform) | yes | no — the checks API returns no rewritten content |

## Decision mapping

| NeMo `RailsResult.status` | `/request` | `/response` |
|---|---|---|
| `passed` | `PassAction` | `PassAction` |
| `modified` | `MaskAction` (newest user message rewritten) | `MaskAction` |
| `blocked` | `RejectAction` (`REJECT_STATUS`, default 403) | `MaskAction` with the refusal text — the response contract has no Reject |
| engine error | `FAIL_MODE=closed` → 503 reject · `open` → pass | same |

`FAIL_MODE` covers the engine failing; the gateway's `failureMode` covers the adapter being unreachable or exceeding its 3 s timeout.

## Run the tests

```bash
cd adapter
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
```

## Deploy

With the Terraform sample (default): phase 2 (`deploy_platform = true`) renders an
overlay in `terraform/.generated/guardrails` (adapter image + Foundry account name)
and applies it with `kubectl apply -k`. Set `enable_nemo_guardrails = false` to
keep only the Foundry content filters.

Standalone:

```bash
kustomize edit set image nemo-guardrail-adapter=ghcr.io/<owner>/nemo-guardrail-adapter:0.1.0   # in deploy/
kubectl apply -k deploy                        # library mode
kubectl apply -k overlays/nvidia-microservice  # enterprise mode
```

Set `resourceName` in `deploy/gateway/internal-gateway.yaml` to the `foundry_account_name` Terraform output.

## Claude models in Foundry: no Foundry content filtering

The Foundry content filters do **not** cover Anthropic models. Microsoft Learn,
*Claude models in Microsoft Foundry*, Responsible AI section: "Foundry doesn't
provide built-in content filtering for Claude models at deployment time" —
configure content safety at inference yourself. Claude models are partner
Marketplace offerings (Anthropic is the seller, operator and data processor);
only Anthropic's own safety systems apply, while the Foundry guardrail system
covers the "Foundry Models sold by Azure".

Consequences for this platform:

- A Claude deployment consumed through Foundry must go through agentgateway to
  get the same rules (regex, NeMo webhook, ceilings, metering). agentgateway's
  `azure` provider with `resourceType: Foundry` sends Messages-API requests
  for a `claude*` model to Foundry's Anthropic-native endpoint
  (`/anthropic/v1/messages`, agentgateway v1.5.0 source) — not wired in
  `gateway/deploy` yet, to validate before relying on it.
- Data residency: Anthropic-hosted deployments may process data outside Azure;
  Azure-hosted ones offer Global Standard and Data Zone Standard **US** only —
  no EU data zone.

## Observability — who triggers which rule

The adapter exposes `guardrail_adapter_decisions_total{direction,action,rail,profile,team,model}`
(`team` ← `x-team`, `model` ← `x-model`, both set by the webhook policy and bounded to 64 characters),
`guardrail_adapter_errors_total` and `guardrail_adapter_check_duration_seconds`. Every non-`pass`
decision (and every engine failure) also writes one log line with the caller (`user`, from `x-user`)
and no prompt content: per-person detail lives in the logs, not in metric labels.
The Grafana dashboard « Garde-fous » (`monitoring/`) reads them; use it to decide whether to adapt the
rails for one application or agent (dedicated profile or route) rather than loosen `default` for everyone.
Header names: `TEAM_HEADER`, `USER_HEADER`, `MODEL_HEADER`.

## Known limitations — validate before the demo

- Streaming: agentgateway calls `/response` per buffered chunk; masking in streaming mode is not applied by the gateway's native guards (use Reject).
- NetworkPolicies assume proxy pods carry the `gateway.networking.k8s.io/gateway-name` label.
- Microservice mode: the `status` values of a blocked check and the ConfigMap layout expected by `configStore.configMap` are not documented; the mapping is defensive. Only `success`/`passed` pass and `blocked`/`failure`/`failed`/`error` block: a rail reported as `skipped`, or a missing `status`, is treated as an engine failure — with `FAIL_MODE=closed` **every** request is refused, with an explicit `microservice guardrail status skipped|missing|unknown … FAIL_MODE applies` error in the adapter logs. VÉRIFIER (D-7) sur une instance réelle : which statuses the microservice actually returns (does it emit `skipped` for rails not applicable to the direction?).
- `x-team: default(apiKey.team, "collaborateurs")` in the webhook headers reuses the CEL expression of `gateway/deploy/metrics.yaml`: whether `apiKey` is evaluated in webhook headers is untested (VÉRIFIER D-7). If not, the `team` label stays `-` and the dashboard falls back to its gateway view (403 per route × team × user).
- The workload identity of the deployer-created proxy pods (for `auth.azure.workloadIdentity`) must be bound to the `agentgateway` managed identity.
- `llm-assistant-groupe` in `guardrail-policies.yaml` is an **inert example**: no HTTPRoute of that name exists in this repo, so the `guardrails-strict` policy attaches to nothing and no route uses the strict profile today. To move an existing route to strict, switch its `x-guardrail-profile` in `garde-fous-llm` (do not target it from both policies). Whether the LLM self-check fits in the 3 s webhook timeout under load: VÉRIFIER (D-7).
- Regexes are a first line of defence, not a DLP: case-insensitive and tolerant of space / dot / dash separators, they still miss encoded, split or paraphrased data. Text is normalised before matching (NFKC — fullwidth digits, exotic spaces — and zero-width characters U+200B-U+200D, U+2060, U+FEFF, U+00AD removed). Request bodies above `MAX_BODY_BYTES` (default 1 MiB) get a 413 before parsing.
- Card numbers are no longer a YAML regex (it blocked version lists, IPs, dates, French phone numbers, SIRETs, ms timestamps). The adapter (`app/dlp.py`) checks the newest `user` message: digit groups split by any run of space / `.` / `_` / `/` / `-` (zero-width characters count as separators), a card grouping (4-4-4-4, 4-6-5, 4-6-4, 4-4-4-4-3, or no separator), a plausible issuer prefix/length, and a valid Luhn key. Not caught: cards written with other groupings (e.g. pairs of digits, the shape of a phone number) or spelled out. A contiguous 14-digit SIRET starting with 30/36/38/39 can still be taken for a Diners card. The native agentgateway `CreditCard` builtin (layer 1) runs on the whole request, `tool` messages included: whether it checks Luhn and how it reacts to the false positives above, VÉRIFIER (D-7).
- The French NIR now requires its 2-digit key (15 digits): without it a 13-digit ms timestamp had the exact shape of a NIR.
- The `secret: value` rule only fires when the value has 8+ characters, contains a digit or one of `@ # % ^ & + = / \ | ~ _`, and does not start like a reference or mask (`$VAR`, `%VAR%`, `<…>`, `{…}`, `[…]`, `****`): `mot de passe: introuvable` passes, `secret = Azerty12` is blocked. A letters-only password (`password: motdepassesimple`) is no longer caught.
- On `/request`, the newest `user` message is checked with its conversation by the profile's input rails. Every later non-`assistant` message (`tool` results from MCP servers — Azure, Microsoft Learn — in demo D) is handled according to `TOOL_RAILS`:
  - `secrets` (default): only the 5 secret patterns, in Python in the adapter (exact copy of the YAML ones, a test enforces it). No personal-data patterns — versions, IPs, dates in tool output are not user PII — and **no LLM self-check**: on the strict profile, one self-check per tool result under the 3 s gateway timeout with `FailClosed` meant systematic refusals as soon as a turn had several tool results. Trade-off: an indirect prompt injection carried by a tool result is no longer screened on input; it is only seen indirectly, on output (YARA `injection detection`, strict `self check output`).
  - `profile`: the secret patterns, then the full input rails of the profile on each tool message (personal data and LLM self-check included, so indirect injection is screened). All engine checks of a request run concurrently (`asyncio.gather`): latency is the slowest check, not the sum. Engine errors follow `FAIL_MODE`.
