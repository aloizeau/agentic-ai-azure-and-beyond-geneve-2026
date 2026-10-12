# Self-hosted models on AKS (KAITO) behind agentgateway

> **Optional, off by default** (`enable_self_hosted_models = false`): a GPU node
> costs by the hour. Turn it on for the demo, turn it off afterwards.

The platform already routes to Microsoft Foundry. This folder adds a third kind
of provider: a model served **inside the cluster**, by the AKS **AI toolchain
operator** add-on ([KAITO](https://learn.microsoft.com/azure/aks/ai-toolchain-operator),
CNCF Sandbox, vLLM runtime, OpenAI-compatible API).

```
LibreChat / kagent ─► agentgateway (JWT · regex · token ceiling · NeMo webhook)
                         ├─ /v1      ─► Microsoft Foundry (+ Foundry content filters)
                         └─ /aks/v1  ─► workspace-phi-4-mini.models  (vLLM on a GPU node)
```

Agents do not change: they call the gateway. The only difference is which route
their `ModelConfig` points to.

## What gets deployed

| File | Kind | Why |
|---|---|---|
| `workspace-phi-4-mini.yaml` | `ConfigMap` + KAITO `Workspace` | `microsoft/Phi-4-mini-instruct` (MIT), tool calling on, 1× A10 GPU provisioned on demand |
| `gateway.yaml` | `AgentgatewayBackend` (`custom` provider) + 2 `HTTPRoute` | same gateway: `/aks/v1` (people, Entra JWT) and `/agents/aks/v1` (agents, team key); `providerOverride: kaito` for Grafana |
| `policies.yaml` | `AgentgatewayPolicy` ×2 | Entra JWT or team key, token ceiling (content rules: gateway-wide `garde-fous-llm`) |
| `network-policy.yaml` | `NetworkPolicy` | only the gateway proxies (and Prometheus) reach vLLM |
| `observability.yaml` | `PodMonitor` | vLLM metrics: time to first token, queue, KV cache |
| `kagent-modelconfig.yaml` | kagent `ModelConfig` | example, not applied: point an agent at the in-cluster model (`/agents/aks/v1`, platform key) |

Content rules come from the gateway-wide policy `garde-fous-llm`, which targets both routes (regex only, or regex + NeMo webhook when `guardrails/` is enabled).

**Why the gateway guardrails matter more here:** a self-hosted model has no
Foundry content filter in front of it. The gateway is the only place the rules
can live, and they are the same ones as on the Foundry route.

## Prerequisites

1. AKS with the add-on: `ai_toolchain_operator_enabled = true` (Terraform sets it
   when `enable_self_hosted_models = true`). Standard clusters only, Linux only.
2. **GPU quota** in the cluster's region for the `instanceType` family.
   Default `Standard_NV36ads_A10_v5` → family `StandardNVADSA10v5Family`, 36 vCPU.
   `scripts/preflight.sh` checks it. KAITO needs Ampere or newer (no T4 / V100).
3. Time: the GPU node takes up to ~10 min, the workspace up to ~20 min
   (image pull). **For a live demo, apply the Workspace before going on stage.**

## Cost (Sweden Central, pay-as-you-go, Linux, checked 2026-09-23)

| instanceType | GPU | $/hour | 24/7 month |
|---|---|---|---|
| `Standard_NV36ads_A10_v5` (default) | 1× A10 24 GB | 4.16 | ≈ 3,040 |
| `Standard_NC24ads_A100_v4` (upstream example) | 1× A100 80 GB | 4.78 | ≈ 3,490 |

Compare with ≈ 18 $/month of Foundry inference for this PoC. Self-hosting pays
off with sustained volume, data that must not leave your cluster, or a
fine-tuned model — not for a handful of chats. The token cost panel shows 0 for
`gen_ai_system="kaito"`: the cost moved from per token to per hour.

## Clean up

```bash
kubectl delete workspace workspace-phi-4-mini -n models
az aks nodepool list -g <rg> --cluster-name <aks> -o table   # the GPU pool KAITO created
az aks nodepool delete -g <rg> --cluster-name <aks> -n <pool>
```

Microsoft documents that the GPU node pool must be deleted manually, and that
`az aks stop/start` is not fully supported while Workspaces are active.

## Going further

For several replicas, agentgateway can target a Gateway API Inference Extension
`InferencePool` (endpoint picker, KV-cache aware routing) through the same
`custom` provider (`backendRef.kind: InferencePool`). KAITO creates the pool
with its `InferenceSet` resource and the `gatewayAPIInferenceExtension` feature
gate, which needs the Helm-installed KAITO rather than the managed add-on.
