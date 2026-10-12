# -----------------------------------------------------------------------------
# Microsoft Foundry account
#
# Naming note: "Azure AI Foundry" is now "Microsoft Foundry". There is no
# `azurerm_ai_foundry` resource for this shape - that one is for legacy
# hub-based projects. The current model is `azurerm_cognitive_account` with
# kind = "AIServices" plus `azurerm_cognitive_account_project`.
# -----------------------------------------------------------------------------

resource "azurerm_cognitive_account" "foundry" {
  name                = "fdy-${var.base}"
  location            = var.location
  resource_group_name = var.resource_group_name
  kind                = "AIServices"
  sku_name            = "S0"

  # Mandatory for Entra ID token-based auth. Without it the account has no
  # stable data-plane hostname to issue tokens against.
  custom_subdomain_name = "fdy-${var.base}"

  # Enables Foundry projects on this account.
  project_management_enabled = true

  # The headline of the demo: no API keys at all. Callers must present an Entra
  # token. Do NOT copy Microsoft's own keyless-auth Bicep sample for this - its
  # `disableLocalAuth: allowKeys` mapping is inverted and leaves keys enabled.
  local_auth_enabled = false

  public_network_access_enabled = true

  identity { type = "SystemAssigned" }

  tags = var.tags
}

resource "azurerm_cognitive_account_project" "main" {
  name                 = "proj-${var.base}"
  cognitive_account_id = azurerm_cognitive_account.foundry.id
  location             = var.location

  identity { type = "SystemAssigned" }
}

# -----------------------------------------------------------------------------
# The failover ladder, one real deployment per rung.
#
# Deployments are created sequentially: concurrent deployment writes against the
# same account race on quota and intermittently fail with a 409.
# -----------------------------------------------------------------------------

resource "azurerm_cognitive_deployment" "models" {
  for_each = { for k, v in var.model_deployments : k => v if v.enabled }

  name                 = each.key
  cognitive_account_id = azurerm_cognitive_account.foundry.id

  sku {
    name     = each.value.sku_name
    capacity = each.value.capacity # thousands of tokens per minute
  }

  model {
    format  = each.value.model_format
    name    = each.value.model_name
    version = each.value.model_version # null = current default version
  }

  # A conference demo must not wake up on a model version it has never seen.
  version_upgrade_option = "NoAutoUpgrade"

  # Guardrails IN PRODUCTION TODAY: Foundry's content filters apply to every
  # deployment (default policy when rai_policy_name is not set). Set
  # rai_policy_name to attach a custom policy. The gateway-level NeMo
  # Guardrails layer (module "platform", guardrails.tf) is the R&D target.

}

# -----------------------------------------------------------------------------
# Diagnostics
# -----------------------------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "foundry" {
  name                       = "diag-foundry"
  target_resource_id         = azurerm_cognitive_account.foundry.id
  log_analytics_workspace_id = var.log_analytics_id

  enabled_log { category_group = "audit" }
  enabled_metric { category = "AllMetrics" } # azurerm 5: `metric` was removed
}
