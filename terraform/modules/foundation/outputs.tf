output "resource_group_name" { value = azurerm_resource_group.this.name }
output "cluster_name" { value = azurerm_kubernetes_cluster.this.name }
output "cluster_id" { value = azurerm_kubernetes_cluster.this.id }
output "log_analytics_workspace_id" { value = azurerm_log_analytics_workspace.this.id }

output "oidc_issuer_url" {
  description = "https://{region}.oic.prod-aks.azure.com/{tenant}/{uuid} - the issuer Entra federates against."
  value       = azurerm_kubernetes_cluster.this.oidc_issuer_url
}

# Entra ID is enabled on the API server: Terraform uses the local admin
# credentials (local accounts stay enabled in this PoC).
output "kube_host" {
  value     = azurerm_kubernetes_cluster.this.kube_admin_config[0].host
  sensitive = true
}
output "kube_ca_certificate" {
  value     = azurerm_kubernetes_cluster.this.kube_admin_config[0].cluster_ca_certificate
  sensitive = true
}
output "kube_client_certificate" {
  value     = azurerm_kubernetes_cluster.this.kube_admin_config[0].client_certificate
  sensitive = true
}
output "kube_client_key" {
  value     = azurerm_kubernetes_cluster.this.kube_admin_config[0].client_key
  sensitive = true
}

output "cluster_principal_id" {
  description = "Control plane (system-assigned) identity: needs Network Contributor to attach a static public IP outside the node resource group."
  value       = azurerm_kubernetes_cluster.this.identity[0].principal_id
}

output "public_ip_name" { value = try(azurerm_public_ip.gateway[0].name, null) }
output "public_ip_address" { value = try(azurerm_public_ip.gateway[0].ip_address, null) }

output "acr_id" { value = azurerm_container_registry.this.id }
output "acr_name" { value = azurerm_container_registry.this.name }
output "acr_login_server" { value = azurerm_container_registry.this.login_server }

# Public API endpoint and CA (no credential): for kubelogin-based access.
output "api_server" { value = "https://${azurerm_kubernetes_cluster.this.fqdn}:443" }
output "ca_certificate" { value = nonsensitive(azurerm_kubernetes_cluster.this.kube_admin_config[0].cluster_ca_certificate) }
