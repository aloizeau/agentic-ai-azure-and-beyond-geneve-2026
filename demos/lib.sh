#!/usr/bin/env bash
# Shared helpers for the live demos. Source it: `source "$(dirname "$0")/../lib.sh"`.
set -euo pipefail

DEMOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="$DEMOS_DIR/../terraform"
GW_PORT="${GW_PORT:-8080}"
GW="http://localhost:${GW_PORT}"
NS_GW="agentgateway-system"

# Fichiers temporaires : un répertoire privé par exécution (mktemp -d, mode 700)
# plutôt que des noms fixes dans /tmp (prévisibles : lecture ou symlink par un
# autre utilisateur). Un script qui pose son propre `trap … EXIT` remplace
# celui-ci : chat() supprime donc aussi ses fichiers après usage.
DEMO_TMP="$(mktemp -d "${TMPDIR:-/tmp}/agentic-demo.XXXXXX")"
trap 'rm -rf "$DEMO_TMP"' EXIT
# État qui survit d'une exécution à l'autre (pid/log des port-forwards lancés en
# arrière-plan, pour les arrêter plus tard) : répertoire privé à l'utilisateur.
DEMO_STATE="${XDG_RUNTIME_DIR:-$HOME/.cache}/agentic-demos"
mkdir -p "$DEMO_STATE" && chmod 700 "$DEMO_STATE"

step()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✔ %s\033[0m\n' "$*"; }
ko()    { printf '  \033[31m✘ %s\033[0m\n' "$*"; }
pause() { [[ "${NO_PAUSE:-0}" == "1" ]] || read -r -p "  (Entrée pour continuer) " _; }
tf_out(){ terraform -chdir="$TF_DIR" output -raw "$1"; }

# expect <regex> <message if matched> <message otherwise> — checks the last chat status.
expect() { if [[ "$LAST_CODE" =~ $1 ]]; then ok "$2"; else ko "$3"; fi; }
LAST_CODE=""

# The gateway is ClusterIP only: reach it through a port-forward.
gateway_up() {
  if ! curl -s -o /dev/null --max-time 2 "$GW/"; then
    kubectl -n "$NS_GW" port-forward svc/agentgateway-proxy "${GW_PORT}:80" >"$DEMO_STATE/pf-gateway.log" 2>&1 &
    echo $! >"$DEMO_STATE/pf-gateway.pid"   # arrêt : kill "$(cat "$DEMO_STATE/pf-gateway.pid")"
    for _ in $(seq 1 20); do curl -s -o /dev/null --max-time 1 "$GW/" && break; sleep 0.5; done
  fi
}

# A real Entra ID access token for the signed-in user, audience = the gateway API.
# The Azure CLI is pre-authorized on the gateway app (modules/identity).
user_token() {
  az account get-access-token --scope "$(tf_out gateway_scope)" --query accessToken -o tsv
}

# chat <path> <authorization header value or ""> <prompt>
# Prints HTTP status, the model that actually answered, and the answer or error.
chat() {
  local path="$1" auth="$2" prompt="$3" code
  local body; body=$(PROMPT="$prompt" python3 -c 'import json,os; print(json.dumps({"model":"llm","max_tokens":120,"messages":[{"role":"user","content":os.environ["PROMPT"]}]}))')
  local resp="$DEMO_TMP/resp.json" hdr="$DEMO_TMP/hdr.txt" authf="$DEMO_TMP/auth.txt"
  local args=(-s -o "$resp" -D "$hdr" -w '%{http_code}' -H 'content-type: application/json' -d "$body")
  # Le jeton passe par un fichier d'en-têtes (-H @fichier), jamais sur la ligne
  # de commande (visible dans `ps` par les autres utilisateurs).
  if [[ -n "$auth" ]]; then
    (umask 077; printf 'authorization: %s\n' "$auth" >"$authf")
    args+=(-H "@$authf")
  fi
  code=$(curl "${args[@]}" "$GW$path/chat/completions" || true)
  rm -f "$authf"
  local model; model=$(grep -i '^x-served-model:' "$hdr" | cut -d' ' -f2- | tr -d '\r' || true)
  printf '  HTTP %s   modèle servi : %s\n' "$code" "${model:--}"
  RESP="$resp" python3 - <<'PY' || cat "$resp" 2>/dev/null || true
import json, os
d = json.load(open(os.environ['RESP']))
if 'choices' in d:
    print('  ' + d['choices'][0]['message']['content'].strip().replace('\n', '\n  ')[:600])
else:
    print('  ' + json.dumps(d, ensure_ascii=False)[:400])
PY
  rm -f "$resp" "$hdr"
  LAST_CODE="$code"
}
