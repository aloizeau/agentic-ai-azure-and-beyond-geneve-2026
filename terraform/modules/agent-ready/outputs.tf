output "teams_resource_group_name" { value = azurerm_resource_group.equipes.name }
output "teams_resource_group_id" { value = azurerm_resource_group.equipes.id }
output "ai_team_client_id" { value = try(azurerm_user_assigned_identity.ai_team[0].client_id, null) }
output "ai_team_principal_id" { value = try(azurerm_user_assigned_identity.ai_team[0].principal_id, null) }
