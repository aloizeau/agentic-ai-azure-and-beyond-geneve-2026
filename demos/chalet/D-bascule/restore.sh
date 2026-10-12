#!/usr/bin/env bash
set -euo pipefail
kubectl -n agentgateway-system patch agentgatewaybackend llm --type=json \
  -p '[{"op":"replace","path":"/spec/ai/groups/0/providers/0/azure/model","value":"gpt-56-terra-eu"}]'
echo "Primary restored. The evicted provider comes back after the eviction window (60 s)."
