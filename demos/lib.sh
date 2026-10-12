#!/usr/bin/env bash
# Shared helpers for the live demos. Source it: `source "$(dirname "$0")/../lib.sh"`.
set -euo pipefail

DEMOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="$DEMOS_DIR/../terraform"
GW_PORT="${GW_PORT:-8080}"
GW="http://localhost:${GW_PORT}"
NS_GW="agentgateway-system"

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
    kubectl -n "$NS_GW" port-forward svc/agentgateway-proxy "${GW_PORT}:80" >/tmp/pf-gateway.log 2>&1 &
    echo $! >/tmp/pf-gateway.pid
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
  local args=(-s -o /tmp/demo-resp.json -D /tmp/demo-hdr.txt -w '%{http_code}' -H 'content-type: application/json' -d "$body")
  [[ -n "$auth" ]] && args+=(-H "authorization: $auth")
  code=$(curl "${args[@]}" "$GW$path/chat/completions" || true)
  local model; model=$(grep -i '^x-served-model:' /tmp/demo-hdr.txt | cut -d' ' -f2- | tr -d '\r' || true)
  printf '  HTTP %s   modèle servi : %s\n' "$code" "${model:--}"
  python3 - <<'PY' || cat /tmp/demo-resp.json
import json
d = json.load(open('/tmp/demo-resp.json'))
if 'choices' in d:
    print('  ' + d['choices'][0]['message']['content'].strip().replace('\n', '\n  ')[:600])
else:
    print('  ' + json.dumps(d, ensure_ascii=False)[:400])
PY
  LAST_CODE="$code"
}
