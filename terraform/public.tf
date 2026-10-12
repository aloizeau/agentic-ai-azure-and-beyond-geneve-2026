# -----------------------------------------------------------------------------
# Public exposure (var.public_exposure) — Azure and DNS part, phase 1.
#
#   static public IP  ->  Service LoadBalancer of the public agentgateway Gateway
#   Cloudflare A      ->  demos.<zone> and *.demos.<zone>, "DNS only"
#
# The IP (modules/foundation) lives in the main resource group, not in AKS's
# node resource group, so it survives a cluster rebuild and the DNS records
# never move. The AKS control plane identity therefore needs Network
# Contributor on that group (Microsoft: "Use a static public IP address with
# the AKS load balancer").
# The Kubernetes part (Gateway, certificates, routes, oauth2-proxy) is in
# modules/platform/public.tf, phase 2.
# -----------------------------------------------------------------------------

resource "azurerm_role_assignment" "aks_public_ip" {
  count = var.public_exposure == null ? 0 : 1

  scope              = "/subscriptions/${var.subscription_id}/resourceGroups/${module.foundation.resource_group_name}"
  role_definition_id = "/subscriptions/${var.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/${local.role_ids.network_contributor}"
  principal_id       = module.foundation.cluster_principal_id
  principal_type     = "ServicePrincipal"
}

data "cloudflare_zone" "public" {
  count  = var.public_exposure == null ? 0 : 1
  filter = { name = var.public_exposure.zone }
}

# demos.<zone> and *.demos.<zone>. Grey cloud on purpose: Universal SSL only
# covers first-level names, and certificates come from Let's Encrypt in-cluster.
resource "cloudflare_dns_record" "public" {
  for_each = var.public_exposure == null ? {} : {
    base     = local.public_base
    wildcard = "*.${local.public_base}"
  }

  zone_id = data.cloudflare_zone.public[0].id
  name    = each.value
  type    = "A"
  content = module.foundation.public_ip_address
  ttl     = 300
  proxied = false
  comment = "agentic platform demo (${local.base}) — managed by Terraform"
}
