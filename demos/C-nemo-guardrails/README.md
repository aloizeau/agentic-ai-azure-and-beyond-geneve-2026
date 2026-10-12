# Démo C — NeMo Guardrails, le socle standard de garde-fous

| Step | What the audience sees |
|---|---|
| 1 | The standard: layer 1 native regex (cards), layer 2 webhook → NeMo Guardrails (secrets, IBAN, NIR, YARA injections), `FailClosed`, 3 s timeout, profiles `default` / `strict` |
| 2 | Before: an API key and a social security number reach the model; only the card is stopped |
| 3 | `kubectl apply` of [`guardrails/deploy`](../../guardrails/deploy) rendered for this cluster (adapter image in the platform registry, Foundry names from the `llm` backend) |
| 4 | After: the same prompts get 403, a normal prompt passes (latency shown) |
| 5 | The adapter's decisions (logs, `guardrail_adapter_decisions_total`) |
| 6 | `-AvecPanne`: adapter scaled to 0, the gateway refuses every LLM call — fail-closed |

```powershell
./demos/C-nemo-guardrails/prepare.ps1    # J-1: az acr build of guardrails/adapter
./demos/C-nemo-guardrails/run.ps1        # -AvecPanne
./demos/C-nemo-guardrails/reset.ps1      # back to the native regex policy only
```

The demo prompts are part of the adapter's test suite
(`guardrails/adapter/tests/test_adapter.py::test_demo_prompts_rejected`): the demo
cannot drift from the rails. Library mode, Apache-2.0; the NVIDIA microservice variant
(`guardrails/overlays/nvidia-microservice`) needs NVIDIA AI Enterprise.
