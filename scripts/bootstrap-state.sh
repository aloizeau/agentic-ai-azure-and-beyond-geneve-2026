#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# One-time bootstrap, run by a human with Owner on the subscription:
#   1. a storage account for the Terraform state (Entra auth only, no keys)
#   2. two user-assigned managed identities for GitHub Actions, federated with
#      the repository (OIDC: no secret stored anywhere): read-only for pull
#      requests, bounded write for the protected environment only
#   3. terraform/backend.hcl for local runs, and the values to paste as
#      GitHub repository variables
#
# Usage:
#   GITHUB_REPO=<owner>/<repo> ./scripts/bootstrap-state.sh
#   LOCATION=swedencentral PREFIX=agentic GITHUB_REPO=... ./scripts/bootstrap-state.sh
# Idempotent: re-running reuses what exists.
# -----------------------------------------------------------------------------
set -euo pipefail

: "${GITHUB_REPO:?set GITHUB_REPO=<owner>/<repo>}"
LOCATION="${LOCATION:-swedencentral}"
PREFIX="${PREFIX:-agentic}"
RG="${STATE_RG:-rg-${PREFIX}-tfstate}"
CONTAINER="tfstate"
STATE_KEY="${STATE_KEY:-agentic-platform.tfstate}"
ENVIRONMENT="${GH_ENVIRONMENT:-demo}"       # GitHub environment that may apply/destroy

SUB_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
ME="$(az ad signed-in-user show --query id -o tsv)"
echo "Subscription $SUB_ID · tenant $TENANT_ID · region $LOCATION"

# ---------------------------------------------------------------- state storage
az group create -n "$RG" -l "$LOCATION" -o none

# Storage account names are global, 3-24 lowercase alphanumerics: derive a
# stable suffix from the subscription so re-runs find the same account.
SUFFIX="$(printf '%s' "$SUB_ID" | sha256sum | cut -c1-8)"
SA="${SA_NAME:-st${PREFIX//-/}tf${SUFFIX}}"
SA="${SA:0:24}"

if ! az storage account show -n "$SA" -g "$RG" -o none 2>/dev/null; then
  az storage account create -n "$SA" -g "$RG" -l "$LOCATION" \
    --sku Standard_ZRS --kind StorageV2 --min-tls-version TLS1_2 \
    --allow-blob-public-access false --allow-shared-key-access false -o none
fi
SA_ID="$(az storage account show -n "$SA" -g "$RG" --query id -o tsv)"
az storage account blob-service-properties update --account-name "$SA" -g "$RG" \
  --enable-versioning true --enable-delete-retention true --delete-retention-days 7 -o none

# Shared keys are disabled: every principal needs a data-plane role.
az role assignment create --assignee-object-id "$ME" --assignee-principal-type User \
  --role "Storage Blob Data Contributor" --scope "$SA_ID" -o none 2>/dev/null || true
az storage container create -n "$CONTAINER" --account-name "$SA" --auth-mode login -o none

# --------------------------------------------------- GitHub Actions identities
# Two identities, so that what a pull request can reach stays read-only:
#   id-<prefix>-github-plan  pull requests: Reader + state Reader (terraform plan)
#   id-<prefix>-github       the protected environment only (apply / destroy,
#                            required reviewers): Contributor, RBAC Administrator
#                            under an ABAC condition, state Contributor
# No credential for a branch: anyone who can push a branch or merge to main
# would otherwise run with the apply identity, without an approval.
fic() {
  az identity federated-credential create --identity-name "$1" -g "$RG" -n "$2" \
    --issuer "https://token.actions.githubusercontent.com" \
    --subject "$3" --audiences "api://AzureADTokenExchange" -o none 2>/dev/null || true
}
drop_fic() {
  az identity federated-credential delete --identity-name "$1" -g "$RG" -n "$2" --yes -o none 2>/dev/null || true
}

MI_PLAN="id-${PREFIX}-github-plan"
az identity create -n "$MI_PLAN" -g "$RG" -l "$LOCATION" -o none
PLAN_CLIENT_ID="$(az identity show -n "$MI_PLAN" -g "$RG" --query clientId -o tsv)"
PLAN_PRINCIPAL_ID="$(az identity show -n "$MI_PLAN" -g "$RG" --query principalId -o tsv)"
fic "$MI_PLAN" "github-pr" "repo:${GITHUB_REPO}:pull_request"
az role assignment create --assignee-object-id "$PLAN_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Reader" --scope "/subscriptions/$SUB_ID" -o none 2>/dev/null || true
az role assignment create --assignee-object-id "$PLAN_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Reader" --scope "$SA_ID" -o none 2>/dev/null || true

MI="id-${PREFIX}-github"
az identity create -n "$MI" -g "$RG" -l "$LOCATION" -o none
MI_CLIENT_ID="$(az identity show -n "$MI" -g "$RG" --query clientId -o tsv)"
MI_PRINCIPAL_ID="$(az identity show -n "$MI" -g "$RG" --query principalId -o tsv)"
fic "$MI" "github-env" "repo:${GITHUB_REPO}:environment:${ENVIRONMENT}"
# Earlier versions of this script federated pull requests and main here too.
drop_fic "$MI" "github-pr"
drop_fic "$MI" "github-main"

# Contributor to create resources; Resource Policy Contributor for the one
# policy the platform sets (modules/agent-ready: federations of rg-…-equipes).
for role in "Contributor" "Resource Policy Contributor" ; do
  az role assignment create --assignee-object-id "$MI_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "$role" --scope "/subscriptions/$SUB_ID" -o none 2>/dev/null || true
done

# RBAC Administrator, but only for the roles the platform assigns, and only to
# service principals (its managed identities): never Owner, never User Access
# Administrator, never a person. Microsoft Learn, "Delegate Azure role
# assignment management to others with conditions".
#   Contributor, RBAC Administrator  the AI team identity (modules/agent-ready)
#   Cognitive Services User          gateway → Foundry
#   Network Contributor              AKS → public IP
#   AcrPull                          kubelet → registry
#   Storage Blob Data Contributor/Reader, AcrPush, AKS Cluster User
#                                    teams (terraform/teams, when run from here)
ROLES="b24988ac-6180-42a0-ab88-20f7382dd24c, f58310d9-a9f6-439a-9e8d-f62e7b41a168, a97b65f3-24c7-4388-baec-2e87135dc908, 4d97b98b-1d4f-4787-a291-c67834d212e7, 7f951dda-4ed3-4680-a7ca-43fe172d538d, ba92f5b4-2d11-453d-a403-e96b0029c9fe, 2a2b9908-6ea1-4ae2-8e65-a410df84e7d1, 8311e382-0749-4cb8-b61a-304f252e45ec, 4abbcc35-e782-43d8-92c5-2d3f1bd2253f"
CONDITION="((!(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${ROLES}} AND @Request[Microsoft.Authorization/roleAssignments:PrincipalType] ForAnyOfAnyValues:StringEqualsIgnoreCase {'ServicePrincipal'})) AND ((!(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})) OR (@Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${ROLES}} AND @Resource[Microsoft.Authorization/roleAssignments:PrincipalType] ForAnyOfAnyValues:StringEqualsIgnoreCase {'ServicePrincipal'}))"
# An unconditioned assignment from an earlier run would win: replace it.
OLD="$(az role assignment list --assignee "$MI_PRINCIPAL_ID" --scope "/subscriptions/$SUB_ID" \
  --role "Role Based Access Control Administrator" --query "[?condition==null].id" -o tsv)"
[ -n "$OLD" ] && az role assignment delete --ids $OLD -o none
az role assignment create --assignee-object-id "$MI_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Role Based Access Control Administrator" --scope "/subscriptions/$SUB_ID" \
  --condition "$CONDITION" --condition-version "2.0" -o none 2>/dev/null || true
az role assignment create --assignee-object-id "$MI_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" --scope "$SA_ID" -o none 2>/dev/null || true

# -------------------------------------------------------------------- outputs
cat > "$(dirname "$0")/../terraform/backend.hcl" <<EOF
resource_group_name  = "$RG"
storage_account_name = "$SA"
container_name       = "$CONTAINER"
key                  = "$STATE_KEY"
use_azuread_auth     = true
EOF

cat <<EOF

Done. terraform/backend.hcl written (git-ignored).

GitHub → Settings → Secrets and variables → Actions → Variables:
  AZURE_CLIENT_ID        $MI_CLIENT_ID      (environment "$ENVIRONMENT": apply, destroy)
  AZURE_CLIENT_ID_PLAN   $PLAN_CLIENT_ID    (pull requests: plan, read-only)
  AZURE_TENANT_ID        $TENANT_ID
  AZURE_SUBSCRIPTION_ID  $SUB_ID
  TFSTATE_RG             $RG
  TFSTATE_ACCOUNT        $SA
GitHub → Settings → Environments: create "$ENVIRONMENT" with required reviewers
and deployment branches restricted to main. Pull requests must log in with
AZURE_CLIENT_ID_PLAN: they plan phase 1 (Azure); the phase 2 plan (cluster)
runs in the environment.

Entra app registrations (create_entra_apps = true) need Microsoft Graph
Application.ReadWrite.OwnedBy on the identity — an admin grants it once.
Without it, set TF_VAR_create_entra_apps=false in the workflow and create the
two apps by hand (see README).
EOF
