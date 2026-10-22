# -----------------------------------------------------------------------------
# « Agent Ready » (démo B) — what the platform prepares for the AI team.
#
#   - rg-<base>-equipes: every team's identities and storage live here, and
#     only here (the terraform/teams stack creates them, one state per team);
#   - the identity of the AI team's pipeline (GitHub Actions, environment
#     « ai-team », OIDC, no secret), with bounded rights:
#       Contributor on rg-<base>-equipes only,
#       Role Based Access Control Administrator under an ABAC condition:
#       FOUR roles, to service principals only (Microsoft Learn, "Delegate
#       Azure role assignment management to others with conditions",
#       example "Constrain roles and principal types").
#   Kubernetes rights of that identity: modules/platform/teams.tf.
#
# Who assigns those two roles (var.manage_role_assignments):
#   true   Terraform, run by a person with Owner (./scripts/deploy.ps1 on the
#          presenter's workstation);
#   false  the CI apply identity (scripts/bootstrap-state.sh) may not hand out
#          Contributor or RBAC Administrator — that would let it make itself
#          Owner. Terraform then leaves them alone and a person with Owner
#          creates them once: demos/B-agent-equipe/prepare.ps1 (step 1 ter),
#          from the output ai_team_role_assignments.

# -----------------------------------------------------------------------------

data "azurerm_client_config" "current" {}

locals {
  role_ids = {
    contributor                   = "b24988ac-6180-42a0-ab88-20f7382dd24c"
    rbac_administrator            = "f58310d9-a9f6-439a-9e8d-f62e7b41a168"
    storage_blob_data_contributor = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
    storage_blob_data_reader      = "2a2b9908-6ea1-4ae2-8e65-a410df84e7d1"
    acr_push                      = "8311e382-0749-4cb8-b61a-304f252e45ec"
    aks_cluster_user              = "4abbcc35-e782-43d8-92c5-2d3f1bd2253f"
  }

  role_def = { for k, v in local.role_ids : k => "/subscriptions/${data.azurerm_client_config.current.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/${v}" }

  # The only roles the AI team's pipeline may hand out to a team.
  delegable = join(", ", [
    local.role_ids.storage_blob_data_contributor, # team pipeline → its storage (documents)
    local.role_ids.storage_blob_data_reader,      # team MCP server → its storage
    local.role_ids.acr_push,                      # team pipeline → registry
    local.role_ids.aks_cluster_user,              # team pipeline → kubeconfig (Entra ID)
  ])

  # Never to itself: the AI team identity cannot give its own pipeline the
  # data roles it hands out (every team's documents, the registry).
  ai_team_oid = try(azurerm_user_assigned_identity.ai_team[0].principal_id, "00000000-0000-0000-0000-000000000000")

  delegation_condition = <<-EOT
    (
     (
      !(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})
     )
     OR
     (
      @Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${local.delegable}}
      AND
      @Request[Microsoft.Authorization/roleAssignments:PrincipalType] ForAnyOfAnyValues:StringEqualsIgnoreCase {'ServicePrincipal'}
      AND
      @Request[Microsoft.Authorization/roleAssignments:PrincipalId] ForAnyOfAllValues:GuidNotEquals {${local.ai_team_oid}}
     )
    )
    AND
    (
     (
      !(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})
     )
     OR
     (
      @Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${local.delegable}}
      AND
      @Resource[Microsoft.Authorization/roleAssignments:PrincipalType] ForAnyOfAnyValues:StringEqualsIgnoreCase {'ServicePrincipal'}
     )
    )
  EOT

  pipeline_on = var.ai_team_github_repository != null
  delegation_scopes = local.pipeline_on ? {
    equipes  = azurerm_resource_group.equipes.id
    registry = var.acr_id
    cluster  = var.aks_id
  } : {}
}

resource "azurerm_resource_group" "equipes" {
  name     = "rg-${var.base}-equipes"
  location = var.location
  tags     = merge(var.tags, { purpose = "agent-ready-teams" })
}

resource "azurerm_user_assigned_identity" "ai_team" {
  count               = local.pipeline_on ? 1 : 0
  name                = "id-${var.base}-ai-team"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

# Only the « ai-team » environment of the platform repository — whose
# deployments need an approval — can obtain a token for this identity.
resource "azurerm_federated_identity_credential" "ai_team" {
  count                     = local.pipeline_on ? 1 : 0
  name                      = "github-ai-team"
  user_assigned_identity_id = azurerm_user_assigned_identity.ai_team[0].id
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.ai_team_github_repository}:environment:${var.ai_team_environment}"
  audience                  = ["api://AzureADTokenExchange"]
}

resource "azurerm_role_assignment" "ai_team_contributor" {
  count              = local.pipeline_on && var.manage_role_assignments ? 1 : 0
  scope              = azurerm_resource_group.equipes.id
  role_definition_id = local.role_def.contributor
  principal_id       = azurerm_user_assigned_identity.ai_team[0].principal_id
  principal_type     = "ServicePrincipal"
}

resource "azurerm_role_assignment" "ai_team_delegation" {
  for_each = var.manage_role_assignments ? local.delegation_scopes : {}

  scope              = each.value
  role_definition_id = local.role_def.rbac_administrator
  principal_id       = azurerm_user_assigned_identity.ai_team[0].principal_id
  principal_type     = "ServicePrincipal"
  condition_version  = "2.0"
  condition          = local.delegation_condition
}

# -----------------------------------------------------------------------------
# Contributor on rg-<base>-equipes lets the AI team pipeline create identities
# and their federated credentials — that is its job. This policy keeps those
# federations to the two subjects Agent Ready creates: a ServiceAccount of this
# cluster, or an agent-<team> repository of the owner running one of the
# platform's reusable workflows. A federation to any other repository or
# workflow (a persistent, approval-free way in) is refused by Azure Resource
# Manager. (`like` takes one wildcard: the workflow part is a `contains`.)
# VÉRIFIER (D-7): the federatedIdentityCredentials aliases, with
# `az provider show --namespace Microsoft.ManagedIdentity --expand "resourceTypes/aliases"`.
# -----------------------------------------------------------------------------
locals {
  github_owner = local.pipeline_on ? split("/", var.ai_team_github_repository)[0] : ""
  fic_alias    = "Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials"
}

resource "azurerm_policy_definition" "fic_equipes" {
  count        = local.pipeline_on ? 1 : 0
  name         = "fic-equipes-${var.base}"
  policy_type  = "Custom"
  mode         = "All"
  display_name = "Agent Ready : fédérations d'identité limitées au cluster et aux dépôts agent-<équipe>"

  policy_rule = jsonencode({
    if = {
      allOf = [
        { field = "type", equals = local.fic_alias },
        {
          not = {
            anyOf = [
              { field = "${local.fic_alias}/issuer", equals = var.aks_oidc_issuer_url },
              {
                allOf = [
                  { field = "${local.fic_alias}/issuer", equals = "https://token.actions.githubusercontent.com" },
                  { field = "${local.fic_alias}/subject", like = "repo:${local.github_owner}/agent-*" },
                  { field = "${local.fic_alias}/subject", contains = ":ref:refs/heads/main:job_workflow_ref:${coalesce(var.ai_team_github_repository, "-")}/.github/workflows/agent-" },
                ]
              },
            ]
          }
        },
      ]
    }
    then = { effect = "deny" }
  })
}

resource "azurerm_resource_group_policy_assignment" "fic_equipes" {
  count                = local.pipeline_on ? 1 : 0
  name                 = "fic-equipes"
  resource_group_id    = azurerm_resource_group.equipes.id
  policy_definition_id = azurerm_policy_definition.fic_equipes[0].id
  description          = "Fédérations d'identité de rg-${var.base}-equipes : cluster AKS, ou agent-<équipe>@main dans un workflow réutilisable de la plateforme."
}
