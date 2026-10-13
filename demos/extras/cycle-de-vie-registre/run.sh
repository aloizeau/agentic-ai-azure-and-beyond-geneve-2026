#!/usr/bin/env bash
# Démo « cycle de vie » (extra) — le cycle de vie d'un agent : publier, découvrir, déployer,
# faire évoluer, revenir en arrière, retirer. agentregistry + kagent. Live.
source "$(dirname "$0")/../../lib.sh"
HERE="$(cd "$(dirname "$0")" && pwd)"
NS=equipe-produit
REG_PORT="${REG_PORT:-12121}"
export ARCTL_API_BASE_URL="http://localhost:${REG_PORT}"

command -v arctl >/dev/null || { ko "arctl absent — voir demos/extras/cycle-de-vie-registre/README.md (v0.4.0)"; exit 1; }

# The registry is ClusterIP only (no authentication in the open-source edition).
registry_up() {
  if ! curl -s -o /dev/null --max-time 2 "$ARCTL_API_BASE_URL/v0/runtimes"; then
    # pid/log dans le répertoire d'état privé de lib.sh (survit au script).
    kubectl -n agentregistry port-forward svc/agentregistry "${REG_PORT}:12121" >"$DEMO_STATE/pf-registry.log" 2>&1 &
    echo $! >"$DEMO_STATE/pf-registry.pid"
    for _ in $(seq 1 20); do curl -s -o /dev/null --max-time 1 "$ARCTL_API_BASE_URL/v0/runtimes" && break; sleep 0.5; done
  fi
}

# Writes the prompt of a catalogue tag into the ConfigMap the agent reads.
prompt_to_configmap() {
  local tag="$1"
  arctl get prompt assistant-tickets --tag "$tag" -o json \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["spec"]["content"], end="")' >"$DEMO_TMP/prompt.txt"
  kubectl -n "$NS" create configmap prompt-assistant-tickets --from-file=prompt="$DEMO_TMP/prompt.txt" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  kubectl -n "$NS" annotate configmap prompt-assistant-tickets agentic.io/prompt-tag="$tag" --overwrite >/dev/null
  ok "prompt assistant-tickets@$tag → ConfigMap prompt-assistant-tickets"
}

registry_up

step "0 · La plateforme a déclaré où une équipe peut déployer, et ce qu'elle publie déjà"
arctl apply -f "$HERE/catalogue/plateforme.yaml" >/dev/null
arctl get runtimes
arctl get mcps
if kubectl -n "$NS" get mcpserver jira-mcp >/dev/null 2>&1; then
  ko "le MCPServer jira-mcp de la démo self-service (Chalet) est encore là : ./demos/chalet/B-self-service/reset.sh d'abord"; exit 1
fi
pause

step "1 · PUBLIER — l'équipe publie son serveur MCP et son prompt, versionnés"
sed -n '/^kind: MCPServer/,/^---/p' "$HERE/catalogue/equipe-produit.yaml" | head -30
arctl apply -f "$HERE/catalogue/equipe-produit.yaml"
pause

step "2 · DÉCOUVRIR — n'importe quelle équipe trouve ce qui existe, qui l'a publié, quelle version"
arctl get mcps
arctl get prompts
echo "  UI : http://localhost:${REG_PORT}  (port-forward, jamais exposé : pas d'authentification en open source)"
pause

step "3 · DÉPLOYER — depuis le catalogue, dans le namespace de l'équipe"
if ! kubectl -n "$NS" get secret jira-credentials >/dev/null 2>&1; then
  : "${JIRA_URL:?export JIRA_URL, JIRA_USERNAME and JIRA_API_TOKEN (Jira Cloud) before the demo}"
  : "${JIRA_USERNAME:?}" "${JIRA_API_TOKEN:?}"
  # --from-env-file + substitution de processus : les valeurs ne passent jamais
  # sur la ligne de commande de kubectl (visible dans `ps`). printf est un builtin.
  kubectl -n "$NS" create secret generic jira-credentials \
    --from-env-file=<(printf 'JIRA_URL=%s\nJIRA_USERNAME=%s\nJIRA_API_TOKEN=%s\n' \
                        "$JIRA_URL" "$JIRA_USERNAME" "$JIRA_API_TOKEN") >/dev/null
  ok "Secret jira-credentials créé dans $NS (hors dépôt, hors catalogue)"
fi
arctl apply -f "$HERE/deploiement.yaml"
for _ in $(seq 1 60); do kubectl -n "$NS" get mcpserver jira-mcp-tickets >/dev/null 2>&1 && break; sleep 2; done
kubectl -n "$NS" get mcpservers -l aregistry.ai/managed=true
kubectl -n "$NS" wait mcpserver/jira-mcp-tickets --for=condition=Ready --timeout=180s || true

# The agent: a kagent manifest whose tools and prompt come from the catalogue.
kubectl apply -f "$HERE/../../chalet/B-self-service/modelconfig.yaml" >/dev/null
prompt_to_configmap v1
kubectl apply -f "$HERE/agent.yaml"
kubectl -n "$NS" wait agent/assistant-tickets --for=condition=Ready --timeout=180s
ok "assistant-tickets prêt — dans LibreChat (outil « agents ») et dans l'UI kagent"
pause

step "4 · FAIRE ÉVOLUER — prompt v2 publié à côté de v1, l'agent passe en v2 sans rebuild"
arctl apply -f "$HERE/catalogue/prompt-v2.yaml"
arctl get prompt assistant-tickets --all-tags
prompt_to_configmap v2
kubectl -n "$NS" rollout restart deployment/assistant-tickets >/dev/null 2>&1 || true
kubectl -n "$NS" rollout status deployment/assistant-tickets --timeout=120s >/dev/null 2>&1 || true
echo "  LibreChat : « Quels tickets bloquants cette semaine ? » → réponse classée en trois groupes"
pause

step "5 · REVENIR EN ARRIÈRE — v1 est toujours au catalogue"
prompt_to_configmap v1
kubectl -n "$NS" rollout restart deployment/assistant-tickets >/dev/null 2>&1 || true
kubectl -n "$NS" rollout status deployment/assistant-tickets --timeout=120s >/dev/null 2>&1 || true
pause

step "6 · RETIRER — l'agent, puis le déploiement : le registre supprime ce qu'il a créé"
kubectl -n "$NS" delete agent assistant-tickets --wait=false
arctl delete deployment tickets
sleep 5
kubectl -n "$NS" get mcpservers
echo "  La version 1.0.0 reste au catalogue (audit, redéploiement) ; la retirer : arctl delete mcp jira-mcp --tag 1.0.0"
ok "Cycle complet : publier · découvrir · déployer · faire évoluer · revenir · retirer"
