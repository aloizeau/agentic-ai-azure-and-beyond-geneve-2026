output "resource_group_name" {
  value = module.foundation.resource_group_name
}

output "aks_cluster_name" {
  value = module.foundation.cluster_name
}

output "aks_get_credentials" {
  description = "Copy-paste command to point kubectl at the cluster."
  value       = "az aks get-credentials --resource-group ${module.foundation.resource_group_name} --name ${module.foundation.cluster_name} --admin --overwrite-existing"
}

output "foundry_account_name" {
  value = module.ai.foundry_account_name
}

output "foundry_openai_v1_endpoint" {
  description = <<-EOT
    The OpenAI-compatible endpoint. Note the /openai/v1/ path and the absence of
    an api-version query parameter: the older `/models` endpoint and the Azure AI
    Inference SDK were retired on 2026-08-26.
  EOT
  value       = module.ai.openai_v1_endpoint
}

output "foundry_token_scope" {
  description = "Entra scope to request. Changed from cognitiveservices.azure.com in 2026 - requesting the old one is a silent 401."
  value       = "https://ai.azure.com/.default"
}

output "model_deployment_names" {
  description = "Deployment names to use as the `model` field in OpenAI-compatible calls."
  value       = { for k, v in module.ai.deployment_names : k => v }
}

output "workload_identity_client_ids" {
  value = module.identity.workload_identity_client_ids
}

output "entra_issuer" {
  value = module.identity.entra_issuer
}

output "gateway_api_audience" {
  description = "Expected `aud` claim. requested_access_token_version = 2 means this is the app's client-ID GUID, not api://<id>."
  value       = module.identity.gateway_api_audience
}

output "gateway_scope" {
  value = module.identity.gateway_scope
}

output "librechat_client_id" {
  value = module.identity.librechat_client_id
}

output "librechat_client_secret" {
  value     = module.identity.librechat_client_secret
  sensitive = true
}

output "estimated_monthly_cost_usd" {
  description = "Rough retail estimate, Sweden Central. Compute dominates - destroy between sessions."
  value = {
    aks_control_plane = var.aks_sku_tier == "Free" ? 0 : 73
    nodes             = var.system_node_count * 134
    inference_note    = "Usage-based; check current Foundry pricing for the selected models"
    hourly_burn       = format("%.2f USD/h while running", var.system_node_count * 0.184)
  }
}

output "grafana_admin_password" {
  description = "Available after phase 2."
  value       = try(module.platform[0].grafana_admin_password, null)
  sensitive   = true
}

output "public_urls" {
  description = "Public entry points (var.public_exposure), null when nothing is public."
  value = local.public_hosts == null ? null : {
    librechat = "https://${local.public_hosts.chat}"
    grafana   = "https://${local.public_hosts.grafana}"
    kagent    = "https://${local.public_hosts.kagent}"
    api       = "https://${local.public_hosts.api}/v1  and  /agents/v1"
  }
}

output "public_ip_address" {
  description = "Static IP behind demos.<zone> and *.demos.<zone>."
  value       = module.foundation.public_ip_address
}

output "acr_name" {
  description = "Platform container registry (az acr build --registry <name>)."
  value       = module.foundation.acr_name
}

output "acr_login_server" {
  value = module.foundation.acr_login_server
}

# -----------------------------------------------------------------------------
# What the « Agent Ready » stack (terraform/teams) needs from the platform.
# Nothing secret: the API server CA certificate is public material. The AI team
# pipeline gets these values as one GitHub variable (PLATEFORME, set by
# demos/B-agent-equipe/prepare.ps1) — never the platform state, which holds
# the admin kubeconfig and the Entra app secrets.
# -----------------------------------------------------------------------------
output "plateforme_pour_equipes" {
  value = {
    subscription_id           = data.azurerm_client_config.current.subscription_id
    tenant_id                 = data.azurerm_client_config.current.tenant_id
    location                  = var.location
    resource_group_name       = module.foundation.resource_group_name
    teams_resource_group_name = module.agent_ready.teams_resource_group_name
    acr_id                    = module.foundation.acr_id
    acr_name                  = module.foundation.acr_name
    acr_login_server          = module.foundation.acr_login_server
    aks_cluster_id            = module.foundation.cluster_id
    aks_cluster_name          = module.foundation.cluster_name
    aks_oidc_issuer_url       = module.foundation.oidc_issuer_url
    aks_api_server            = module.foundation.api_server
    aks_ca_certificate        = module.foundation.ca_certificate
    # Immutable GitHub OIDC subjects (repo:<owner>@<owner_id>/…): terraform/teams.
    github_owner_id = try(var.ai_team_github_ids.owner, null)
  }
}

output "subscription_id" { value = data.azurerm_client_config.current.subscription_id }
output "tenant_id" { value = data.azurerm_client_config.current.tenant_id }
output "location" { value = var.location }
output "acr_id" { value = module.foundation.acr_id }
output "aks_cluster_id" { value = module.foundation.cluster_id }
output "aks_oidc_issuer_url" { value = module.foundation.oidc_issuer_url }
output "aks_api_server" { value = module.foundation.api_server }
output "aks_ca_certificate" { value = module.foundation.ca_certificate }
output "teams_resource_group_name" { value = module.agent_ready.teams_resource_group_name }
output "ai_team_client_id" { value = module.agent_ready.ai_team_client_id }
output "ai_team_principal_id" { value = module.agent_ready.ai_team_principal_id }
output "ai_team_role_assignments" { value = module.agent_ready.ai_team_role_assignments }
