#!/usr/bin/env bash
# Remove the demo agent between rehearsals (keeps the team namespace, key and Jira secret).
set -euo pipefail
kubectl delete -k "$(dirname "$0")" --ignore-not-found
