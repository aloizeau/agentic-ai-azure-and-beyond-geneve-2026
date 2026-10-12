#!/usr/bin/env bash
# Démo D — changer de modèle sans toucher aux agents. Live.
source "$(dirname "$0")/../../lib.sh"
gateway_up
TOKEN="$(user_token)"
trap '"$(dirname "$0")/restore.sh" >/dev/null 2>&1 || true' EXIT

step "Avant : qui répond ?"
chat /v1 "Bearer $TOKEN" "En une phrase : qui es-tu ?"
pause

step "On coupe le déploiement gpt-5.6-terra (DataZone)"
"$(dirname "$0")/cut.sh"
sleep 3
pause

step "Même route, même agent, même LibreChat"
chat /v1 "Bearer $TOKEN" "En une phrase : qui es-tu ?"
echo "  → regarder x-served-model, puis Grafana : les tokens changent de ligne (gen_ai_response_model)."
pause

step "On rétablit"
"$(dirname "$0")/restore.sh"
trap - EXIT
