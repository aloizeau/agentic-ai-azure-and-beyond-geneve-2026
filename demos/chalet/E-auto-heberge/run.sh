#!/usr/bin/env bash
# Démo E — un modèle dans le cluster, les mêmes règles. Live.
# Prerequisite (30 min before): enable_self_hosted_models = true, or
#   kubectl apply -k models/deploy   — then wait for the Workspace.
source "$(dirname "$0")/../../lib.sh"

step "Le modèle tourne déjà sur un nœud GPU du cluster (KAITO)"
kubectl -n models get workspace workspace-phi-4-mini
kubectl get nodes -l kaito.sh/workspace=workspace-phi-4-mini -o wide 2>/dev/null || true
pause

step "La passerelle : un fournisseur « custom », rien d'Azure dedans"
sed -n '/^kind: AgentgatewayBackend/,/^---/p' "$DEMOS_DIR/../models/deploy/gateway.yaml"
kubectl apply -k "$DEMOS_DIR/../models/deploy" >/dev/null && ok "appliqué"
pause

gateway_up
TOKEN="$(user_token)"
step "Une question au modèle hébergé dans AKS"
chat /aks/v1 "Bearer $TOKEN" "En une phrase, qu'est-ce que Kubernetes ?"
pause

step "Le même numéro de carte : même refus — il n'y a pas de filtres Foundry ici"
chat /aks/v1 "Bearer $TOKEN" "Peux-tu vérifier ma carte 4111 1111 1111 1111 ?"
expect "^4" "la règle a suivi le trafic" "attendu un refus 4xx, reçu $LAST_CODE"
echo "  → Grafana : une ligne gen_ai_system=\"kaito\" à côté de Foundry ; au token, 0 \$."
