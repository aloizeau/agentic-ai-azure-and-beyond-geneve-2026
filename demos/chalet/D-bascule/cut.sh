#!/usr/bin/env bash
# Simulate the loss of the primary deployment: point group 0 at a deployment
# that does not exist. Foundry answers 404, the gateway evicts it and serves
# from the next group (gpt-5.6-luna). Undo with restore.sh.
set -euo pipefail
kubectl -n agentgateway-system patch agentgatewaybackend llm --type=json \
  -p '[{"op":"replace","path":"/spec/ai/groups/0/providers/0/azure/model","value":"gpt-56-terra-eu-coupe"}]'
