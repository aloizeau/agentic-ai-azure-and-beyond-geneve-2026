#!/usr/bin/env bash
# Remet la démo cycle de vie à zéro entre deux répétitions : agent, déploiement et entrées
# de catalogue de l'équipe. Garde le namespace, la clé virtuelle, le Secret Jira
# et ce que la plateforme a publié (Runtime, serveurs MCP de la passerelle).
set -uo pipefail
NS=equipe-produit
export ARCTL_API_BASE_URL="http://localhost:${REG_PORT:-12121}"

kubectl -n "$NS" delete agent assistant-tickets --ignore-not-found
kubectl -n "$NS" delete configmap prompt-assistant-tickets --ignore-not-found
arctl delete deployment tickets 2>/dev/null || true
arctl delete prompt assistant-tickets --all-tags 2>/dev/null || true
arctl delete mcp jira-mcp --all-tags 2>/dev/null || true
# Safety net if the registry was unreachable: its resources carry its label.
kubectl -n "$NS" delete mcpserver jira-mcp-tickets --ignore-not-found
echo "Démo cycle de vie remise à zéro."
