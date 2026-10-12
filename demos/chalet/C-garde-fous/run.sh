#!/usr/bin/env bash
# Démo C — l'antidote au week-end à 60 000 €. Live.
# Three effects of the SAME gateway policies: no token -> 401, card number ->
# rejected before the model, ceiling reached -> 429.
source "$(dirname "$0")/../../lib.sh"
gateway_up
TOKEN="$(user_token)"

step "1. Une clé qui fuit, sans jeton Entra : l'appel n'atteint jamais le modèle"
chat /v1 "" "Bonjour"
expect "^401$" "401 — refusé à la porte" "attendu 401, reçu $LAST_CODE"
pause

step "2. Avec mon jeton Entra, un numéro de carte dans le prompt"
chat /v1 "Bearer $TOKEN" "Peux-tu vérifier ma carte 4111 1111 1111 1111 ?"
expect "^4" "rejeté avant le modèle — quel que soit le fournisseur" "attendu un refus 4xx, reçu $LAST_CODE"
pause

step "3. Le plafond : on l'abaisse à 300 tokens/min pour la démo (restauré à la fin)"
restore() { kubectl -n "$NS_GW" patch agentgatewaypolicy acces-llm --type=json \
  -p '[{"op":"replace","path":"/spec/traffic/rateLimit/local/0/tokens","value":50000}]' >/dev/null && ok "plafond restauré à 50 000 tokens/min"; }
trap restore EXIT
kubectl -n "$NS_GW" patch agentgatewaypolicy acces-llm --type=json \
  -p '[{"op":"replace","path":"/spec/traffic/rateLimit/local/0/tokens","value":300}]' >/dev/null
sleep 3
for i in 1 2 3 4 5; do
  echo "  appel $i"
  chat /v1 "Bearer $TOKEN" "Écris trois phrases sur les Alpes."
  [[ "$LAST_CODE" == "429" ]] && { ok "429 — la dépense s'arrête d'elle-même"; break; }
done
echo
echo "  « Vendredi soir, la clé fuit… et lundi matin, on a une alerte, pas une facture. »"

step "4. Qui a consommé quoi : le tableau de bord « Usage IA » (Grafana, dossier Plateforme IA)"
echo "  http://localhost:3000/d/usage-ia — filtre Utilisateur = votre compte Entra ID :"
echo "  les appels ci-dessus, leur coût, le 401 (anonyme), le 429 et le refus du garde-fou."
