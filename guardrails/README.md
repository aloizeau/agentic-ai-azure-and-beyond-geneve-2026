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
| 2 | `AgentgatewayPolicy` `webhook` → adapter → NeMo | secrets, IBAN, NIR, YARA injection (code, SQLi, XSS, template), LLM self-checks | < 10 ms without LLM rails |

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

## Known limitations — validate before the demo

- Streaming: agentgateway calls `/response` per buffered chunk; masking in streaming mode is not applied by the gateway's native guards (use Reject).
- NetworkPolicies assume proxy pods carry the `gateway.networking.k8s.io/gateway-name` label.
- Microservice mode: the `status` values of a blocked check and the ConfigMap layout expected by `configStore.configMap` are not documented; the mapping is defensive.
- The workload identity of the deployer-created proxy pods (for `auth.azure.workloadIdentity`) must be bound to the `agentgateway` managed identity.
- `llm-assistant-groupe` in `guardrail-policies.yaml` is an example route for the strict profile.
- Regexes are a first line of defence, not a DLP: case-insensitive and tolerant of space / dot / dash separators, they still miss encoded, split or paraphrased data. On `/request`, the newest `user` message is checked with its conversation, and every later non-`assistant` message (`tool` results, etc.) is checked on its own with the same profile — a secret or an indirect prompt injection returned by a tool is rejected like a user prompt (fail-closed on engine error). Request bodies above `MAX_BODY_BYTES` (default 1 MiB) get a 413 before parsing.
