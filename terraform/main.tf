data "azurerm_client_config" "current" {}

# -----------------------------------------------------------------------------
# Phase 1 - infrastructure
# -----------------------------------------------------------------------------

module "foundation" {
  source = "./modules/foundation"

  base                = local.base
  location            = var.location
  tags                = local.tags
  kubernetes_version  = var.kubernetes_version
  aks_sku_tier        = var.aks_sku_tier
  system_node_vm_size = var.system_node_vm_size
  system_node_count   = var.system_node_count
  use_spot_nodes      = var.use_spot_nodes

  ai_toolchain_operator_enabled = var.enable_self_hosted_models
  public_ip_enabled             = var.public_exposure != null

  tenant_id                  = data.azurerm_client_config.current.tenant_id
  aks_admin_group_object_ids = var.aks_admin_group_object_ids
  admin_principal_object_id  = var.aks_admin_current_principal ? data.azurerm_client_config.current.object_id : null

  api_server_authorized_ip_ranges = var.aks_api_authorized_ip_ranges
}

# « Agent Ready » teams (démo B): the teams' resource group and the AI team
# pipeline identity with bounded rights. Teams themselves: terraform/teams.
module "agent_ready" {
  source = "./modules/agent-ready"

  base                      = local.base
  location                  = var.location
  resource_group_name       = module.foundation.resource_group_name
  tags                      = local.tags
  acr_id                    = module.foundation.acr_id
  aks_id                    = module.foundation.cluster_id
  aks_oidc_issuer_url       = module.foundation.oidc_issuer_url
  ai_team_github_repository = var.ai_team_github_repository
  ai_team_github_ids        = var.ai_team_github_ids
  manage_role_assignments   = var.ai_team_manage_role_assignments
}

module "ai" {
  source = "./modules/ai"

  base                = local.base
  location            = var.location
  resource_group_name = module.foundation.resource_group_name
  tags                = local.tags
  model_deployments   = var.model_deployments
  log_analytics_id    = module.foundation.log_analytics_workspace_id
}

module "identity" {
  source = "./modules/identity"

  base                = local.base
  location            = var.location
  resource_group_name = module.foundation.resource_group_name
  tags                = local.tags

  oidc_issuer_url = module.foundation.oidc_issuer_url
  tenant_id       = data.azurerm_client_config.current.tenant_id

  # Workloads that need an Azure identity, and the namespace/SA they run under.
  # The proxies that call Foundry are the Deployments the agentgateway
  # controller generates for each Gateway; their ServiceAccount carries the
  # Gateway's name. One identity per door: internal (agentgateway-proxy) and,
  # when public_exposure is set, public (agentgateway-public).
  workload_identities = merge(
    {
      agentgateway = { namespace = "agentgateway-system", service_account = "agentgateway-proxy" }
      kagent       = { namespace = "kagent", service_account = "kagent" }
    },
    var.public_exposure == null ? {} : {
      agentgateway-public = { namespace = "agentgateway-system", service_account = "agentgateway-public" }
    },
  )

  # Keyless access to Foundry — for the gateway only. Agents (kagent) never
  # call Foundry directly: they go through the gateway with a team key.
  role_assignments = merge(
    {
      "agentgateway-foundry" = {
        workload           = "agentgateway"
        scope              = module.ai.foundry_account_id
        role_definition_id = local.role_ids.cognitive_services_user
      }
    },
    var.public_exposure == null ? {} : {
      "agentgateway-public-foundry" = {
        workload           = "agentgateway-public"
        scope              = module.ai.foundry_account_id
        role_definition_id = local.role_ids.cognitive_services_user
      }
    },
  )

  create_entra_apps               = var.create_entra_apps
  authorized_principal_object_ids = var.authorized_principal_object_ids
  assign_current_principal        = var.assign_current_principal
  public_hostname                 = try(local.public_hosts.chat, null)
  public_hosts                    = local.public_hosts
}

# -----------------------------------------------------------------------------
# Phase 2 - platform (Helm)
# -----------------------------------------------------------------------------

module "platform" {
  source = "./modules/platform"
  count  = var.deploy_platform ? 1 : 0

  chart_versions = var.chart_versions

  foundry_endpoint  = module.ai.openai_v1_endpoint
  model_deployments = { for k, v in var.model_deployments : k => v.sku_name if v.enabled }

  workload_identity_client_ids = module.identity.workload_identity_client_ids
  tenant_id                    = data.azurerm_client_config.current.tenant_id

  entra_issuer            = module.identity.entra_issuer
  entra_jwks_uri          = module.identity.entra_jwks_uri
  gateway_api_audience    = module.identity.gateway_api_audience
  librechat_client_id     = module.identity.librechat_client_id
  librechat_client_secret = module.identity.librechat_client_secret
  gateway_scope           = module.identity.gateway_scope

  enable_nemo_guardrails  = var.enable_nemo_guardrails
  guardrail_adapter_image = coalesce(var.guardrail_adapter_image, "${module.foundation.acr_login_server}/plateforme/nemo-guardrail-adapter:0.1.0")
  foundry_account_name    = module.ai.foundry_account_name
  foundry_project_name    = module.ai.foundry_project_name

  enable_self_hosted_models     = var.enable_self_hosted_models
  self_hosted_gpu_instance_type = var.self_hosted_gpu_instance_type

  enable_enterprise_tools = var.enable_enterprise_tools

  teams                  = var.teams
  usage_metrics_per_user = var.usage_metrics_per_user
  ai_team_enabled        = var.ai_team_github_repository != null
  ai_team_principal_id   = module.agent_ready.ai_team_principal_id

  public_hostname = try(local.public_hosts.chat, null)

  # Public exposure (null = none): hosts, static IP, oauth2-proxy app.
  public_hosts         = local.public_hosts
  public_expose_api    = try(var.public_exposure.expose_api, false)
  public_ip_name       = module.foundation.public_ip_name
  public_ip_rg         = module.foundation.resource_group_name
  acme_email           = try(var.public_exposure.acme_email, null)
  portal_client_id     = module.identity.portal_client_id
  portal_client_secret = module.identity.portal_client_secret

  depends_on = [azurerm_role_assignment.aks_public_ip, cloudflare_dns_record.public]
}
