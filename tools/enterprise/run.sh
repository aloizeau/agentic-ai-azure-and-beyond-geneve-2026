#!/usr/bin/env bash
# Outils d'entreprise MCP — crée les secrets (hors dépôt) puis applique.
# GitHub et Microsoft Learn ne sont PAS ici : ils sont branchés directement
# dans LibreChat (GitHub en OAuth par utilisateur, Learn sans auth), sans pod.
#
# Prérequis : exporter les identifiants avant de lancer, par ex.
#   # Grafana : jeton d'un compte de service (rôle Viewer suffit)
#   export GRAFANA_URL="http://kps-grafana.monitoring.svc.cluster.local:80"
#   export GRAFANA_API_KEY="glsa_xxx"
#   # Azure : service principal en lecture (préférer Workload Identity en prod)
#   export AZURE_TENANT_ID="..." AZURE_CLIENT_ID="..." AZURE_CLIENT_SECRET="..."
#   # Microsoft Graph / M365 : app Entra (Graph, consentement admin)
#   export MS365_MCP_TENANT_ID="..." MS365_MCP_CLIENT_ID="..." MS365_MCP_CLIENT_SECRET="..."
set -euo pipefail
NS=outils-entreprise
HERE="$(cd "$(dirname "$0")" && pwd)"

kubectl get ns "$NS" >/dev/null 2>&1 || kubectl create ns "$NS"

# Les valeurs passent par --from-env-file sur une substitution de processus
# (printf est un builtin) : jamais sur la ligne de commande de kubectl, donc
# invisibles dans `ps`. Les noms sont vérifiés d'abord (set -u + :?).
env_file() { local k; for k in "$@"; do printf '%s=%s\n' "$k" "${!k}"; done; }

: "${GRAFANA_URL:?export GRAFANA_URL}" "${GRAFANA_API_KEY:?export GRAFANA_API_KEY}"
kubectl -n "$NS" create secret generic grafana-mcp-credentials \
  --from-env-file=<(env_file GRAFANA_URL GRAFANA_API_KEY) \
  --dry-run=client -o yaml | kubectl apply -f -

: "${AZURE_TENANT_ID:?export AZURE_TENANT_ID}" "${AZURE_CLIENT_ID:?export AZURE_CLIENT_ID}" \
  "${AZURE_CLIENT_SECRET:?export AZURE_CLIENT_SECRET}"
kubectl -n "$NS" create secret generic azure-mcp-credentials \
  --from-env-file=<(env_file AZURE_TENANT_ID AZURE_CLIENT_ID AZURE_CLIENT_SECRET) \
  --dry-run=client -o yaml | kubectl apply -f -

: "${MS365_MCP_TENANT_ID:?export MS365_MCP_TENANT_ID}" "${MS365_MCP_CLIENT_ID:?export MS365_MCP_CLIENT_ID}" \
  "${MS365_MCP_CLIENT_SECRET:?export MS365_MCP_CLIENT_SECRET}"
kubectl -n "$NS" create secret generic graph-mcp-credentials \
  --from-env-file=<(env_file MS365_MCP_TENANT_ID MS365_MCP_CLIENT_ID MS365_MCP_CLIENT_SECRET) \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -k "$HERE/deploy"
kubectl -n "$NS" rollout status deploy/mcp-grafana deploy/mcp-azure deploy/mcp-graph --timeout=180s || true
echo "Outils d'entreprise appliqués. Entrées LibreChat activées par enable_enterprise_tools=true (terraform)."
