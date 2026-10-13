#!/usr/bin/env bash
# Démo B — a team adds its agent, no ticket. Live.
source "$(dirname "$0")/../../lib.sh"
NS=equipe-produit

step "Ce que l'équipe a déjà : un namespace et une clé virtuelle (créés à l'onboarding)"
kubectl get ns "$NS" && kubectl -n "$NS" get secret gateway-key -o name

if ! kubectl -n "$NS" get secret jira-credentials >/dev/null 2>&1; then
  : "${JIRA_URL:?export JIRA_URL, JIRA_USERNAME and JIRA_API_TOKEN (Jira Cloud) before the demo}"
  : "${JIRA_USERNAME:?}" "${JIRA_API_TOKEN:?}"
  # --from-env-file + substitution de processus : les valeurs ne passent jamais
  # sur la ligne de commande de kubectl (visible dans `ps`). printf est un builtin.
  kubectl -n "$NS" create secret generic jira-credentials \
    --from-env-file=<(printf 'JIRA_URL=%s\nJIRA_USERNAME=%s\nJIRA_API_TOKEN=%s\n' \
                        "$JIRA_URL" "$JIRA_USERNAME" "$JIRA_API_TOKEN") >/dev/null
  ok "Secret jira-credentials créé (hors dépôt)"
fi
pause

step "Le manifeste de l'agent — c'est tout ce que l'équipe écrit"
sed -n '1,40p' "$(dirname "$0")/agent.yaml"
pause

step "kubectl apply"
kubectl apply -k "$(dirname "$0")"
kubectl -n "$NS" wait mcpserver/jira-mcp --for=condition=Ready --timeout=180s || true
kubectl -n "$NS" wait agent/assistant-tickets --for=condition=Ready --timeout=180s
ok "Agent prêt"
kubectl -n "$NS" get agents,mcpservers

step "Il apparaît dans le catalogue kagent et dans LibreChat (serveur MCP « agents »)"
echo "  kagent UI : kubectl -n kagent port-forward svc/kagent-ui 8081:8080  → http://localhost:8081"
echo "  LibreChat : outil MCP « agents » → assistant-tickets, ex. « Quels tickets bloquants cette semaine ? »"
