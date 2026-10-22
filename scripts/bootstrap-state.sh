#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# One-time bootstrap, run by a human with Owner on the subscription:
#   1. a storage account for the Terraform state (Entra auth only, no keys)
#   2. two user-assigned managed identities for GitHub Actions, federated with
#      the repository (OIDC: no secret stored anywhere): pull requests get no
#      access to the state at all, the protected environment a bounded write
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
# Versions and soft delete for blobs AND for the container: a deleted tfstate
# container (or state blob) comes back within 7 days.
az storage account blob-service-properties update --account-name "$SA" -g "$RG" \
  --enable-versioning true --enable-delete-retention true --delete-retention-days 7 \
  --enable-container-delete-retention true --container-delete-retention-days 7 -o none

# Shared keys are disabled: every principal needs a data-plane role.
az role assignment create --assignee-object-id "$ME" --assignee-principal-type User \
  --role "Storage Blob Data Contributor" --scope "$SA_ID" -o none 2>/dev/null || true
az storage container create -n "$CONTAINER" --account-name "$SA" --auth-mode login -o none

# --------------------------------------------------- GitHub Actions identities
# Two identities, so that what a pull request can reach stays harmless:
#   id-<prefix>-github-plan  pull requests: Reader on the subscription, and
#                            NOTHING on the state account. The platform state
#                            holds the admin kubeconfig and the Entra app
#                            secrets: any PR author (the subject is
#                            repo:<repo>:pull_request, forks and branches
#                            alike) would read it with a state Reader role.
#                            Pull request workflows therefore never run
#                            `terraform plan`; they run
#                              terraform fmt -check -recursive
#                              terraform init -backend=false && terraform validate
#                            (and terraform/teams the same way). The plan is
#                            shown in the protected environment, before apply.
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
# Earlier versions gave the PR identity Storage Blob Data Reader on the state.
OLD_PLAN="$(az role assignment list --assignee "$PLAN_PRINCIPAL_ID" --scope "$SA_ID" \
  --role "Storage Blob Data Reader" --query "[].id" -o tsv)"
if [ -n "$OLD_PLAN" ]; then
  # shellcheck disable=SC2086 # one id per word
  az role assignment delete --ids $OLD_PLAN -o none
  echo "Removed the state Reader role of $MI_PLAN (pull requests no longer read the state)."
fi

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
#   Cognitive Services User          gateway → Foundry
#   Network Contributor              AKS → public IP
#   AcrPull                          kubelet → registry
#   Storage Blob Data Contributor/Reader, AcrPush, AKS Cluster User
#                                    teams (terraform/teams, when run from here)
# NOT Contributor, NOT RBAC Administrator: with either, this identity could
# create a managed identity it federates itself, give it RBAC Administrator
# without condition, and reach Owner. The AI team identity needs both
# (modules/agent-ready): the CI apply runs with
# TF_VAR_ai_team_manage_role_assignments=false, and a person with Owner
# assigns them once (demos/B-agent-equipe/prepare.ps1).
ROLES="a97b65f3-24c7-4388-baec-2e87135dc908, 4d97b98b-1d4f-4787-a291-c67834d212e7, 7f951dda-4ed3-4680-a7ca-43fe172d538d, ba92f5b4-2d11-453d-a403-e96b0029c9fe, 2a2b9908-6ea1-4ae2-8e65-a410df84e7d1, 8311e382-0749-4cb8-b61a-304f252e45ec, 4abbcc35-e782-43d8-92c5-2d3f1bd2253f"
CONDITION="((!(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${ROLES}} AND @Request[Microsoft.Authorization/roleAssignments:PrincipalType] ForAnyOfAnyValues:StringEqualsIgnoreCase {'ServicePrincipal'})) AND ((!(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})) OR (@Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${ROLES}} AND @Resource[Microsoft.Authorization/roleAssignments:PrincipalType] ForAnyOfAnyValues:StringEqualsIgnoreCase {'ServicePrincipal'}))"
# Any other assignment of this role (no condition, or the wider condition of
# an earlier run) would win: replace it. Keep the one that matches exactly.
KEEP=""
for id in $(az role assignment list --assignee "$MI_PRINCIPAL_ID" --scope "/subscriptions/$SUB_ID" \
  --role "Role Based Access Control Administrator" --query "[].id" -o tsv); do
  current="$(az role assignment list --assignee "$MI_PRINCIPAL_ID" --scope "/subscriptions/$SUB_ID" \
    --role "Role Based Access Control Administrator" --query "[?id=='$id'].condition | [0]" -o tsv)"
  if [ -z "$KEEP" ] && [ "$current" = "$CONDITION" ]; then
    KEEP="$id"
  else
    az role assignment delete --ids "$id" -o none
    echo "Removed an RBAC Administrator assignment of $MI with another condition."
  fi
done
if [ -z "$KEEP" ]; then
  # No `|| true`: if the old assignment is gone and this fails, stop here —
  # the apply identity would silently have no RBAC Administrator role.
  az role assignment create --assignee-object-id "$MI_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "Role Based Access Control Administrator" --scope "/subscriptions/$SUB_ID" \
    --condition "$CONDITION" --condition-version "2.0" -o none \
    || { echo "ERROR: RBAC Administrator (conditioned) not assigned to $MI." >&2; exit 1; }
fi
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
  AZURE_CLIENT_ID_PLAN   $PLAN_CLIENT_ID    (pull requests: Reader, no state access)
  AZURE_TENANT_ID        $TENANT_ID
  AZURE_SUBSCRIPTION_ID  $SUB_ID
  TFSTATE_RG             $RG
  TFSTATE_ACCOUNT        $SA
GitHub → Settings → Environments: create "$ENVIRONMENT" with required reviewers
and deployment branches restricted to main.
Pull requests: NO terraform plan (the PR identity cannot read the state, which
holds the admin kubeconfig and the Entra secrets). The PR workflow runs
  terraform fmt -check -recursive
  terraform init -backend=false && terraform validate     (terraform/ and terraform/teams)
and logs in to Azure only if it needs to (AZURE_CLIENT_ID_PLAN, Reader).
Plans of both phases run in the "$ENVIRONMENT" environment, before apply.
The apply workflow sets TF_VAR_ai_team_manage_role_assignments=false and
TF_VAR_assign_current_principal=false (with TF_VAR_authorized_principal_object_ids
holding the presenter or a group): this identity may not assign Contributor or
RBAC Administrator, and is not a person who signs in.

Entra app registrations (create_entra_apps = true) need Microsoft Graph
Application.ReadWrite.OwnedBy on the identity — an admin grants it once.
Without it, set TF_VAR_create_entra_apps=false in the workflow and create the
two apps by hand (see README).
EOF
