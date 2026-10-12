output "repository_url" { value = github_repository.equipe.html_url }
output "namespace" { value = kubernetes_namespace.equipe.metadata[0].name }
output "storage_account" { value = azurerm_storage_account.docs.name }
output "pipeline_client_id" { value = azurerm_user_assigned_identity.pipeline.client_id }
output "mcp_client_id" { value = azurerm_user_assigned_identity.mcp.client_id }
