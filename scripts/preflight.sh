#!/usr/bin/env bash
# =============================================================================
#  preflight.sh — Validation de l'abonnement Azure avant déploiement du PoC
#  "IA agentique : vers Azure et au-delà !" — Chalet Azure Romandie, 29/10/2026
#
#  Vérifie, sans rien créer, que l'abonnement peut accueillir la plateforme :
#  outillage local, providers, quotas, disponibilité des modèles Foundry,
#  droits RBAC et Entra ID, et joignabilité du provider de repli.
#
#  Usage :   ./preflight.sh
#            LOCATION=francecentral ./preflight.sh
#            GPU_SKU=Standard_NC24ads_A100_v4 GPU_FAMILY=standardNCADSA100v4Family GPU_VCPU=24 ./preflight.sh
#            ./preflight.sh --json > preflight-report.json
#
#  Aucune ressource n'est créée. Lecture seule.
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------- paramètres
LOCATION="${LOCATION:-swedencentral}"
NODE_SKU="${NODE_SKU:-Standard_D4s_v5}"
NODE_COUNT="${NODE_COUNT:-2}"
# Modèles attendus : "nom|version|sku|quota exact|capacité requise|rôle"
EXPECTED_MODELS=(
  "gpt-5.6-sol|2026-07-09|GlobalStandard|OpenAI.GlobalStandard.gpt-5.6-sol|50|frontier — travaux complexes, traitement mondial"
  "gpt-5.6-terra|2026-07-09|DataZoneStandard|OpenAI.DataZoneStandard.gpt-5.6-terra|50|production — modèle équilibré, traitement UE"
  "gpt-5.6-luna|2026-07-09|DataZoneStandard|OpenAI.DataZoneStandard.gpt-5.6-luna|50|repli — rapide et économique, traitement UE"
  "model-router|2025-11-18|DataZoneStandard|OpenAI.DataZoneStandard.ModelRouter|50|Microsoft — routage automatique, traitement UE"
  "MAI-Image-2.6|2026-07-31|GlobalStandard|AIServices.GlobalStandard.MAI-Image-2.6|1|Microsoft — génération d'images, Preview"
)
OVH_ENDPOINT="${OVH_ENDPOINT:-https://oai.endpoints.kepler.ai.cloud.ovh.net/v1}"

JSON_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true

# ------------------------------------------------------------------ affichage
if [[ -t 1 ]] && ! $JSON_MODE; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

PASS=0; WARN=0; FAIL=0
declare -a RESULTS=()

_record() { # statut | libellé | détail
  RESULTS+=("$(printf '{"status":"%s","check":%s,"detail":%s}' \
    "$1" "$(_json "$2")" "$(_json "$3")")")
}
_json() { printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null \
          || printf '"%s"' "$(printf '%s' "$1" | tr -d '"' | tr '\n' ' ')"; }

ok()   { PASS=$((PASS+1)); $JSON_MODE || printf '  %s✔%s %-46s %s%s%s\n' "$GREEN" "$RESET" "$1" "$DIM" "$2" "$RESET"; _record ok "$1" "$2"; }
warn() { WARN=$((WARN+1)); $JSON_MODE || printf '  %s▲%s %-46s %s%s%s\n' "$YELLOW" "$RESET" "$1" "$YELLOW" "$2" "$RESET"; _record warn "$1" "$2"; }
bad()  { FAIL=$((FAIL+1)); $JSON_MODE || printf '  %s✘%s %-46s %s%s%s\n' "$RED" "$RESET" "$1" "$RED" "$2" "$RESET"; _record fail "$1" "$2"; }
head2(){ $JSON_MODE || printf '\n%s%s%s\n' "$BOLD$BLUE" "$1" "$RESET"; }

need() { command -v "$1" >/dev/null 2>&1; }

# ------------------------------------------------- helpers python temporaires
# Note : on écrit ces scripts dans des fichiers plutôt que de les passer en
# heredoc à `python3 -`, car un heredoc occupe stdin et écraserait le JSON
# acheminé par le pipe.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

TMP_MODELCHK="$TMP_DIR/modelchk.py"
cat > "$TMP_MODELCHK" <<'PY'
import json, sys
name, ver, want_sku = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    models = json.load(sys.stdin)
except Exception as e:
    print("ERROR||" + str(e)[:60]); sys.exit(0)
hits = []
for entry in models:
    m = entry.get("model", entry) if isinstance(entry, dict) else {}
    if str(m.get("name", "")).lower() != name.lower():
        continue
    if ver and str(m.get("version", "")) != ver:
        continue
    skus = [s.get("name") for s in (m.get("skus") or []) if isinstance(s, dict)]
    hits.append((m.get("version"), m.get("format"), skus))
if not hits:
    # le modèle existe-t-il sous une autre version ?
    others = sorted({str((e.get("model", e) or {}).get("version"))
                     for e in models
                     if str((e.get("model", e) or {}).get("name", "")).lower() == name.lower()})
    print("MISSING||" + (",".join(v for v in others if v and v != "None")))
else:
    all_skus = sorted({s for _, _, sk in hits for s in sk if s})
    _, fmt, _ = hits[0]
    print(("OK" if want_sku in all_skus else "NOSKU") + "|" + (fmt or "?") + "|" + ",".join(all_skus))
PY

TMP_QUOTACHK="$TMP_DIR/quotachk.py"
cat > "$TMP_QUOTACHK" <<'PY'
import json, sys
quota_name, need = sys.argv[1], int(sys.argv[2])
try:
    rows = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for u in rows:
    nm = (u.get("name") or {}).get("value", "") if isinstance(u.get("name"), dict) else str(u.get("name", ""))
    if nm.lower() != quota_name.lower():
        continue
    cur = u.get("currentValue") or 0
    lim = u.get("limit") or 0
    free = lim - cur
    status = "ok" if free >= need else "fail"
    print(f"{status}|{nm}|{int(free)}K TPM libres sur {int(lim)}K")
    break
else:
    print(f"warn|{quota_name}|ligne de quota absente")
PY

# =============================================================================
head2 "1 · Outillage local"
# =============================================================================

check_tool() { # binaire | commande de version | minimum indicatif
  local bin="$1" vercmd="$2" want="${3:-}"
  if ! need "$bin"; then
    bad "$bin" "absent — à installer"
    return
  fi
  local v; v="$(eval "$vercmd" 2>/dev/null | head -n1)"
  [[ -n "$want" ]] && ok "$bin" "$v  (recommandé ≥ $want)" || ok "$bin" "$v"
}

check_tool az        "az version --query '\"azure-cli\"' -o tsv"                 "2.60"
check_tool terraform "terraform version -json | python3 -c 'import json,sys;print(json.load(sys.stdin)[\"terraform_version\"])'" "1.9"
check_tool kubectl   "kubectl version --client -o json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)[\"clientVersion\"][\"gitVersion\"])'" "1.30"
check_tool helm      "helm version --short"                                      "3.15"
check_tool python3   "python3 --version"                                         "3.9"
need jq || warn "jq" "absent — confort seulement, le script utilise python3"
need gh || warn "gh (GitHub CLI)" "absent — utile pour configurer l'OIDC des Actions"

if ! need az; then
  $JSON_MODE || printf '\n%sImpossible de continuer sans Azure CLI.%s\n' "$RED$BOLD" "$RESET"
  exit 2
fi

# =============================================================================
head2 "2 · Connexion et abonnement"
# =============================================================================

ACCOUNT_JSON="$(az account show -o json 2>/dev/null)"
if [[ -z "$ACCOUNT_JSON" ]]; then
  bad "az login" "non connecté — lancer 'az login'"
  $JSON_MODE || printf '\n%sImpossible de continuer sans session Azure.%s\n' "$RED$BOLD" "$RESET"
  exit 2
fi

_q() { printf '%s' "$ACCOUNT_JSON" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
SUB_ID="$(_q "['id']")"
SUB_NAME="$(_q "['name']")"
TENANT_ID="$(_q "['tenantId']")"
USER_NAME="$(_q "['user']['name']")"
USER_TYPE="$(_q "['user']['type']")"

ok  "Abonnement"        "$SUB_NAME  ($SUB_ID)"
ok  "Tenant"            "$TENANT_ID"
ok  "Identité courante" "$USER_NAME  [$USER_TYPE]"

if [[ "$USER_TYPE" == "user" ]]; then
  PRINCIPAL_ID="$(az ad signed-in-user show --query id -o tsv 2>/dev/null)"
else
  PRINCIPAL_ID="$(az ad sp show --id "$USER_NAME" --query id -o tsv 2>/dev/null)"
fi
[[ -n "${PRINCIPAL_ID:-}" ]] && ok "Object ID du principal" "$PRINCIPAL_ID" \
                             || warn "Object ID du principal" "non résolu — contrôles RBAC dégradés"

# =============================================================================
head2 "3 · Resource providers"
# =============================================================================

for p in Microsoft.ContainerService Microsoft.CognitiveServices Microsoft.ManagedIdentity \
         Microsoft.Network Microsoft.OperationalInsights Microsoft.Authorization; do
  state="$(az provider show -n "$p" --query registrationState -o tsv 2>/dev/null)"
  case "$state" in
    Registered)   ok   "$p" "Registered" ;;
    Registering)  warn "$p" "Registering — patienter" ;;
    "")           bad  "$p" "introuvable / droits insuffisants" ;;
    *)            bad  "$p" "$state — lancer : az provider register -n $p" ;;
  esac
done

# =============================================================================
head2 "4 · Région $LOCATION"
# =============================================================================

if az account list-locations --query "[?name=='$LOCATION'].name" -o tsv 2>/dev/null | grep -q .; then
  ok "Région disponible" "$LOCATION"
else
  bad "Région disponible" "$LOCATION introuvable pour cet abonnement"
fi

AKS_VERSIONS="$(az aks get-versions --location "$LOCATION" \
  --query "values[?isPreview==null].version" -o tsv 2>/dev/null | sort -V | tail -3 | tr '\n' ' ')"
[[ -n "$AKS_VERSIONS" ]] && ok "Versions AKS GA" "$AKS_VERSIONS" \
                         || warn "Versions AKS GA" "non récupérées"

# =============================================================================
head2 "5 · Quota de calcul (node pool)"
# =============================================================================

SKU_RESTRICTION="$(az vm list-skus --location "$LOCATION" --size "$NODE_SKU" \
  --query "[?name=='$NODE_SKU'].restrictions[].reasonCode" -o tsv 2>/dev/null | tr '\n' ' ')"
if [[ -z "$SKU_RESTRICTION" ]]; then
  ok "SKU $NODE_SKU" "disponible sans restriction"
else
  bad "SKU $NODE_SKU" "restreint : $SKU_RESTRICTION"
fi

read -r DSV5_USED DSV5_LIMIT <<<"$(az vm list-usage --location "$LOCATION" -o json 2>/dev/null \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)
for u in d:
    if u["name"]["value"]=="standardDSv5Family":
        print(u["currentValue"], u["limit"]); break
else: print("", "")
' 2>/dev/null)"

NEEDED_VCPU=$(( NODE_COUNT * 4 ))
if [[ -n "${DSV5_LIMIT:-}" ]]; then
  AVAIL=$(( DSV5_LIMIT - DSV5_USED ))
  if (( AVAIL >= NEEDED_VCPU )); then
    ok "Quota standardDSv5Family" "$AVAIL vCPU libres / $DSV5_LIMIT — besoin $NEEDED_VCPU"
  else
    bad "Quota standardDSv5Family" "$AVAIL vCPU libres, besoin $NEEDED_VCPU — demander une augmentation"
  fi
else
  warn "Quota standardDSv5Family" "non récupéré"
fi

TOTAL_USAGE="$(az vm list-usage --location "$LOCATION" -o json 2>/dev/null \
  | python3 -c '
import json,sys
for u in json.load(sys.stdin):
    if u["name"]["value"]=="cores":
        print(f"{u[\"currentValue\"]}/{u[\"limit\"]} vCPU régionaux utilisés"); break
' 2>/dev/null)"
[[ -n "$TOTAL_USAGE" ]] && ok "Quota vCPU régional total" "$TOTAL_USAGE"

# =============================================================================
head2 "5b · GPU pour le modèle hébergé dans AKS (optionnel — KAITO)"
# =============================================================================
# Uniquement si enable_self_hosted_models = true. Un avertissement ici ne
# bloque pas le reste du PoC. KAITO exige un GPU Ampere ou plus récent.

GPU_SKU="${GPU_SKU:-Standard_NV36ads_A10_v5}"
GPU_FAMILY="${GPU_FAMILY:-standardNVADSA10v5Family}"
GPU_VCPU="${GPU_VCPU:-36}"

GPU_RESTRICTION="$(az vm list-skus --location "$LOCATION" --size "$GPU_SKU" \
  --query "[?name=='$GPU_SKU'].restrictions[].reasonCode" -o tsv 2>/dev/null | tr '\n' ' ' | xargs)"
GPU_EXISTS="$(az vm list-skus --location "$LOCATION" --size "$GPU_SKU" --query "[?name=='$GPU_SKU'] | length(@)" -o tsv 2>/dev/null)"
if [[ "${GPU_EXISTS:-0}" == "0" ]]; then
  warn "SKU $GPU_SKU" "absent en $LOCATION — choisir une autre taille GPU"
elif [[ -z "$GPU_RESTRICTION" ]]; then
  ok "SKU $GPU_SKU" "disponible sans restriction"
else
  warn "SKU $GPU_SKU" "restreint : $GPU_RESTRICTION"
fi

read -r GPU_USED GPU_LIMIT <<<"$(az vm list-usage --location "$LOCATION" -o json 2>/dev/null \
  | GPU_FAMILY="$GPU_FAMILY" python3 -c '
import json,os,sys
fam=os.environ["GPU_FAMILY"].lower()
for u in json.load(sys.stdin):
    if u["name"]["value"].lower()==fam:
        print(u["currentValue"], u["limit"]); break
else: print("", "")
' 2>/dev/null)"

if [[ -n "${GPU_LIMIT:-}" ]]; then
  GPU_AVAIL=$(( GPU_LIMIT - GPU_USED ))
  if (( GPU_AVAIL >= GPU_VCPU )); then
    ok "Quota $GPU_FAMILY" "$GPU_AVAIL vCPU libres / $GPU_LIMIT — besoin $GPU_VCPU"
  else
    warn "Quota $GPU_FAMILY" "$GPU_AVAIL vCPU libres, besoin $GPU_VCPU — demander une augmentation (≈ 4,16 \$/h une fois allumé)"
  fi
else
  warn "Quota $GPU_FAMILY" "non récupéré"
fi

# =============================================================================
head2 "6 · Modèles Microsoft Foundry en $LOCATION"
# =============================================================================
# NB : « Azure AI Foundry » est renommé Microsoft Foundry. L'endpoint /models et
# le SDK Azure AI Inference ont été retirés le 26/08/2026 : le PoC cible
# https://<res>.openai.azure.com/openai/v1/ et le scope ai.azure.com/.default.

MODELS_JSON="$(az cognitiveservices model list --location "$LOCATION" -o json 2>/dev/null)"
if [[ -z "$MODELS_JSON" || "$MODELS_JSON" == "[]" ]]; then
  bad "Catalogue de modèles" "non récupéré — droits Cognitive Services insuffisants ?"
else
  COUNT="$(printf '%s' "$MODELS_JSON" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')"
  ok "Catalogue de modèles" "$COUNT entrées en $LOCATION"

  for spec in "${EXPECTED_MODELS[@]}"; do
    IFS='|' read -r m_name m_ver m_sku _m_quota _m_capacity m_role <<<"$spec"
    RES="$(printf '%s' "$MODELS_JSON" | python3 "$TMP_MODELCHK" "$m_name" "$m_ver" "$m_sku")"
    IFS='|' read -r r_status r_format r_skus <<<"$RES"
    label="$m_name${m_ver:+ v$m_ver} / $m_sku"
    case "$r_status" in
      OK)      ok   "$label" "format=$r_format — $m_role" ;;
      NOSKU)   bad  "$label" "SKU absent ; disponibles : ${r_skus:-aucun}" ;;
      MISSING) if [[ -n "$r_skus" ]]; then
                 bad "$label" "version absente ; versions présentes : $r_skus"
               else
                 bad "$label" "modèle introuvable en $LOCATION — le catalogue bouge, revérifier"
               fi ;;
      ERROR)   warn "$label" "JSON illisible : $r_skus" ;;
      *)       warn "$label" "vérification impossible" ;;
    esac
  done

fi

# =============================================================================
head2 "7 · Quota de déploiement Foundry"
# =============================================================================

USAGE_JSON="$(az cognitiveservices usage list --location "$LOCATION" -o json 2>/dev/null)"
if [[ -z "$USAGE_JSON" || "$USAGE_JSON" == "[]" ]]; then
  warn "Quotas Cognitive Services" "non récupérés — vérifier manuellement dans le portail"
else
  : > "$TMP_DIR/quota.txt"
  for spec in "${EXPECTED_MODELS[@]}"; do
    IFS='|' read -r _m_name _m_ver _m_sku m_quota m_capacity _m_role <<<"$spec"
    printf '%s' "$USAGE_JSON" | python3 "$TMP_QUOTACHK" "$m_quota" "$m_capacity" >> "$TMP_DIR/quota.txt" 2>"$TMP_DIR/quota.err"
  done
  if [[ -s "$TMP_DIR/quota.txt" ]]; then
    while IFS='|' read -r st nm detail; do
      case "$st" in
        ok)   ok   "Quota $nm" "$detail" ;;
        warn) warn "Quota $nm" "$detail — quota probablement à 0, à demander dans le portail Foundry" ;;
        *)    bad  "Quota $nm" "$detail — capacité requise non disponible" ;;
      esac
    done < "$TMP_DIR/quota.txt"
  else
    warn "Quotas des modèles ciblés" "aucune ligne correspondante — quota probablement à 0, à demander"
  fi
fi

# =============================================================================
head2 "8 · Droits RBAC et Entra ID"
# =============================================================================

if [[ -n "${PRINCIPAL_ID:-}" ]]; then
  ROLES="$(az role assignment list --assignee "$PRINCIPAL_ID" \
           --scope "/subscriptions/$SUB_ID" --include-inherited \
           --query "[].roleDefinitionName" -o tsv 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')"
  if [[ -z "$ROLES" ]]; then
    warn "Rôles sur l'abonnement" "aucun rôle direct lu — droits de lecture RBAC limités"
  else
    ok "Rôles sur l'abonnement" "$ROLES"
    if grep -qE 'Owner|User Access Administrator|Role Based Access Control Administrator' <<<"$ROLES"; then
      ok "Création de role assignments" "autorisée (nécessaire : le PoC assigne Cognitive Services User)"
    else
      bad "Création de role assignments" "Owner ou User Access Administrator requis"
    fi
    grep -q 'Contributor\|Owner' <<<"$ROLES" \
      && ok "Création de ressources" "autorisée" \
      || bad "Création de ressources" "Contributor ou Owner requis"
  fi
fi

APP_POLICY="$(az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/policies/authorizationPolicy" \
  --query "defaultUserRolePermissions.allowedToCreateApps" -o tsv 2>/dev/null)"
case "$APP_POLICY" in
  true)  ok   "Création d'app registrations" "autorisée pour les utilisateurs du tenant" ;;
  false) warn "Création d'app registrations" "réservée aux admins — le PoC en crée 2 (gateway API + LibreChat)" ;;
  *)     warn "Création d'app registrations" "non déterminé — vérifier avec l'admin du tenant" ;;
esac

# Rôle d'annuaire : utile pour créer les app registrations et consentir les scopes
DIR_ROLES="$(az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/me/transitiveMemberOf/microsoft.graph.directoryRole" \
  --query "value[].displayName" -o tsv 2>/dev/null | tr '\n' ',' | sed 's/,$//')"
[[ -n "$DIR_ROLES" ]] && ok "Rôles d'annuaire Entra" "$DIR_ROLES" \
                      || warn "Rôles d'annuaire Entra" "aucun — le consentement admin devra être demandé"

# =============================================================================
head2 "9 · Provider de repli hors Azure (cran 3)"
# =============================================================================

if [[ -z "${OVH_AI_ENDPOINTS_TOKEN:-}" ]]; then
  warn "Clé OVHcloud AI Endpoints" "OVH_AI_ENDPOINTS_TOKEN non défini — le cran 3 ne sera pas testable"
else
  HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
          -H "Authorization: Bearer $OVH_AI_ENDPOINTS_TOKEN" \
          "$OVH_ENDPOINT/models" 2>/dev/null)"
  case "$HTTP" in
    200) ok  "OVHcloud AI Endpoints" "joignable et authentifié ($OVH_ENDPOINT)" ;;
    401|403) bad "OVHcloud AI Endpoints" "HTTP $HTTP — clé refusée" ;;
    000) bad "OVHcloud AI Endpoints" "injoignable — réseau ou proxy" ;;
    *)   warn "OVHcloud AI Endpoints" "HTTP $HTTP" ;;
  esac
fi

# =============================================================================
#  Synthèse
# =============================================================================

if $JSON_MODE; then
  printf '{"location":%s,"subscription":%s,"tenant":%s,"pass":%d,"warn":%d,"fail":%d,"checks":[%s]}\n' \
    "$(_json "$LOCATION")" "$(_json "$SUB_ID")" "$(_json "$TENANT_ID")" \
    "$PASS" "$WARN" "$FAIL" "$(IFS=,; echo "${RESULTS[*]}")"
  exit $(( FAIL > 0 ? 1 : 0 ))
fi

printf '\n%s%s%s\n' "$BOLD" "──────────────────────────────────────────────────────────" "$RESET"
printf '  %s%d OK%s   %s%d avertissements%s   %s%d bloquants%s\n' \
  "$GREEN" "$PASS" "$RESET" "$YELLOW" "$WARN" "$RESET" "$RED" "$FAIL" "$RESET"
printf '%s%s%s\n\n' "$BOLD" "──────────────────────────────────────────────────────────" "$RESET"

if (( FAIL > 0 )); then
  printf '%sIl reste %d point(s) bloquant(s) avant de lancer terraform apply.%s\n' "$RED$BOLD" "$FAIL" "$RESET"
  printf '%sLes quotas de modèles se demandent depuis le portail Foundry et peuvent\nprendre plusieurs jours ouvrés : à traiter en priorité.%s\n\n' "$DIM" "$RESET"
  exit 1
fi

printf '%sAbonnement prêt.%s Relancer ce script la veille de l'\''événement :\n' "$GREEN$BOLD" "$RESET"
printf '%sle catalogue de modèles Foundry évolue toutes les deux semaines.%s\n\n' "$DIM" "$RESET"
