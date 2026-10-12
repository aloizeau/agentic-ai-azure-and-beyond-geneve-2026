output "foundry_account_id" { value = azurerm_cognitive_account.foundry.id }
output "foundry_account_name" { value = azurerm_cognitive_account.foundry.name }
output "foundry_project_name" { value = azurerm_cognitive_account_project.main.name }

output "openai_v1_endpoint" {
  description = <<-EOT
    OpenAI-compatible base URL. The `/openai/v1/` route uses implicit versioning,
    so no api-version parameter. Pass the DEPLOYMENT name in the `model` field.
  EOT
  value       = "https://${azurerm_cognitive_account.foundry.custom_subdomain_name}.openai.azure.com/openai/v1/"
}

output "deployment_names" {
  value = { for k, v in azurerm_cognitive_deployment.models : k => v.name }
}

output "deployment_rungs" {
  description = "Which rung of the sovereignty ladder each deployment represents."
  value       = { for k, v in var.model_deployments : k => v.rung if v.enabled }
}
