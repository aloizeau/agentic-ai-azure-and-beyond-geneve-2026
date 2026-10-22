output "teams_resource_group_name" { value = azurerm_resource_group.equipes.name }
output "teams_resource_group_id" { value = azurerm_resource_group.equipes.id }
output "ai_team_client_id" { value = try(azurerm_user_assigned_identity.ai_team[0].client_id, null) }
output "ai_team_principal_id" { value = try(azurerm_user_assigned_identity.ai_team[0].principal_id, null) }

# What a person with Owner assigns when Terraform does not
# (manage_role_assignments = false): demos/B-agent-equipe/prepare.ps1.
# The condition on one line: passed as is to az role assignment create.
output "ai_team_role_assignments" {
  value = local.pipeline_on ? {
    managed_by_terraform = var.manage_role_assignments
    contributor_scope    = azurerm_resource_group.equipes.id
    delegation_scopes    = values(local.delegation_scopes)
    condition            = join(" ", [for l in split("\n", trimspace(local.delegation_condition)) : trimspace(l)])
  } : null
}
