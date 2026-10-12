output "workload_identity_client_ids" {
  description = "Values for the azure.workload.identity/client-id ServiceAccount annotation."
  value       = { for k, v in azurerm_user_assigned_identity.workload : k => v.client_id }
}

output "workload_identity_principal_ids" {
  value = { for k, v in azurerm_user_assigned_identity.workload : k => v.principal_id }
}

output "entra_issuer" {
  description = "v2.0 issuer. The gateway must match this exactly against the token's iss claim."
  value       = "https://login.microsoftonline.com/${var.tenant_id}/v2.0"
}

output "entra_jwks_uri" {
  value = "https://login.microsoftonline.com/${var.tenant_id}/discovery/v2.0/keys"
}

output "entra_openid_config" {
  value = "https://login.microsoftonline.com/${var.tenant_id}/v2.0/.well-known/openid-configuration"
}

output "gateway_api_audience" {
  description = "Expected aud. With requested_access_token_version = 2 this is the client-ID GUID."
  value       = try(azuread_application.gateway_api[0].client_id, null)
}

output "gateway_scope" {
  description = "Scope LibreChat requests."
  value       = try("api://${azuread_application.gateway_api[0].client_id}/agents.invoke", null)
}

output "librechat_client_id" {
  value = try(azuread_application.librechat[0].client_id, null)
}

output "librechat_client_secret" {
  value     = try(azuread_application_password.librechat[0].value, null)
  sensitive = true
}

output "portal_client_id" {
  description = "Entra app used by oauth2-proxy in front of Grafana and the kagent UI (public exposure)."
  value       = try(azuread_application.portal[0].client_id, null)
}

output "portal_client_secret" {
  value     = try(azuread_application_password.portal[0].value, null)
  sensitive = true
}
