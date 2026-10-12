# Démo E — Un modèle dans le cluster, les mêmes règles (live)

Everything lives in [`models/`](../../models/README.md). Checklist:

- **D-2 weeks:** GPU quota granted (`standardNVADSA10v5Family`, 36 vCPU) — `scripts/preflight.sh` section 5b.
- **H-30 min:** `kubectl apply -k models/deploy` (or `enable_self_hosted_models = true`), then
  `kubectl -n models get workspace -w` until ResourceReady and InferenceReady are True.
- **On stage:** `./run.sh`, then LibreChat endpoint « Hébergé dans AKS ».
- **After:** `kubectl -n models delete workspace workspace-phi-4-mini` and delete the GPU node pool (≈ 4.16 USD/hour).

Fallback: video E.
