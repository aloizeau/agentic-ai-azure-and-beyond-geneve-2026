#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# One-time bootstrap, run by a human with Owner on the subscription:
#   1. a storage account for the Terraform state (Entra auth only, no keys)
#   2. a user-assigned managed identity for GitHub Actions, federated with the
#      repository (OIDC: no secret stored anywhere)
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

# ---------------------------------------------------- GitHub Actions identity
MI="id-${PREFIX}-github"
az identity create -n "$MI" -g "$RG" -l "$LOCATION" -o none
MI_CLIENT_ID="$(az identity show -n "$MI" -g "$RG" --query clientId -o tsv)"
MI_PRINCIPAL_ID="$(az identity show -n "$MI" -g "$RG" --query principalId -o tsv)"

# Federated credentials: pull requests (plan) and the protected environment
# (apply / destroy). Nothing else in the repository can obtain a token.
fic() {
  az identity federated-credential create --identity-name "$MI" -g "$RG" -n "$1" \
    --issuer "https://token.actions.githubusercontent.com" \
    --subject "$2" --audiences "api://AzureADTokenExchange" -o none 2>/dev/null || true
}
fic "github-pr"  "repo:${GITHUB_REPO}:pull_request"
fic "github-env" "repo:${GITHUB_REPO}:environment:${ENVIRONMENT}"
fic "github-main" "repo:${GITHUB_REPO}:ref:refs/heads/main"

# Contributor to create resources; RBAC Administrator because the platform
# assigns roles (Workload Identity -> Foundry). Both at subscription scope.
for role in "Contributor" "Role Based Access Control Administrator" ; do
  az role assignment create --assignee-object-id "$MI_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "$role" --scope "/subscriptions/$SUB_ID" -o none 2>/dev/null || true
done
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
  AZURE_CLIENT_ID        $MI_CLIENT_ID
  AZURE_TENANT_ID        $TENANT_ID
  AZURE_SUBSCRIPTION_ID  $SUB_ID
  TFSTATE_RG             $RG
  TFSTATE_ACCOUNT        $SA
GitHub → Settings → Environments: create "$ENVIRONMENT" with required reviewers.

Entra app registrations (create_entra_apps = true) need Microsoft Graph
Application.ReadWrite.OwnedBy on the identity — an admin grants it once.
Without it, set TF_VAR_create_entra_apps=false in the workflow and create the
two apps by hand (see README).
EOF
