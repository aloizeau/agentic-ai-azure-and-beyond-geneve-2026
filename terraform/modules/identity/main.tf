data "azurerm_client_config" "current" {}
data "azuread_client_config" "current" {}

# -----------------------------------------------------------------------------
# Workload Identity: pods authenticate to Azure with no secret at all.
#
# The chain is: AKS publishes an OIDC discovery document -> Entra trusts it via
# a federated identity credential scoped to one exact namespace/serviceaccount
# pair -> the pod's projected SA token is exchanged for an Entra access token.
# Pod-managed identity, the predecessor, went out of support in Sept 2025.
# -----------------------------------------------------------------------------

resource "azurerm_user_assigned_identity" "workload" {
  for_each = var.workload_identities

  name                = "id-${var.base}-${each.key}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_federated_identity_credential" "workload" {
  for_each = var.workload_identities

  name                      = "fic-${each.key}"
  user_assigned_identity_id = azurerm_user_assigned_identity.workload[each.key].id # azurerm 5: replaces parent_id
  issuer                    = var.oidc_issuer_url

  # This exact string is the whole security boundary: only this service account
  # in this namespace can assume this identity.
  subject = "system:serviceaccount:${each.value.namespace}:${each.value.service_account}"

  # Global constant across all Azure clouds. Changing it breaks the exchange.
  # (Note: the preview "identity bindings" feature uses api://AKSIdentityBinding
  # instead and cannot be mixed with this in the same pod - AADSTS700212.)
  audience = ["api://AzureADTokenExchange"]
}

resource "azurerm_role_assignment" "workload" {
  for_each = var.role_assignments

  scope        = each.value.scope
  principal_id = azurerm_user_assigned_identity.workload[each.value.workload].principal_id

  # Assigned by GUID, not by name: the Foundry role rename (Azure AI User ->
  # Foundry User) is still rolling out and name lookups are what break.
  role_definition_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/${each.value.role_definition_id}"

  principal_type = "ServicePrincipal"
}

# -----------------------------------------------------------------------------
# Entra ID app registrations for end-user OIDC.
#
# Two apps, and the distinction matters:
#   - the API app (agentgateway) defines the scope and is the token AUDIENCE
#   - the client app (LibreChat) does the code flow and REQUESTS that scope
#
# The gateway validates an ACCESS TOKEN, never an id_token. Microsoft is
# explicit: "Access tokens are only validated in the web APIs for which they
# were acquired by a client. The client shouldn't validate access tokens."
# -----------------------------------------------------------------------------

resource "random_uuid" "scope_agents_invoke" {}

resource "azuread_application" "gateway_api" {
  count = var.create_entra_apps ? 1 : 0

  display_name     = "agentgateway-api-${var.base}"
  owners           = [data.azuread_client_config.current.object_id]
  sign_in_audience = "AzureADMyOrg"

  api {
    # MUST be set explicitly. The provider default is 1, which silently changes
    # the `aud` claim from the client-ID GUID to api://<app-id> - the single
    # most common 401 in this setup.
    requested_access_token_version = 2

    oauth2_permission_scope {
      id                         = random_uuid.scope_agents_invoke.result
      value                      = "agents.invoke"
      type                       = "User"
      enabled                    = true
      admin_consent_display_name = "Invoke AI agents"
      admin_consent_description  = "Allows the app to call AI agents and models through the gateway on behalf of the signed-in user."
      user_consent_display_name  = "Invoke AI agents on your behalf"
      user_consent_description   = "Allows the app to call AI agents on your behalf."
    }
  }
}

resource "azuread_application_identifier_uri" "gateway_api" {
  count = var.create_entra_apps ? 1 : 0

  application_id = azuread_application.gateway_api[0].id
  identifier_uri = "api://${azuread_application.gateway_api[0].client_id}"
}

# Demo convenience: lets `az account get-access-token --scope api://<id>/agents.invoke`
# mint a user token for the gateway without a consent prompt (demos/A-ratelimit-entra). The Azure
# CLI client ID is Microsoft's well-known first-party public client.
resource "azuread_application_pre_authorized" "azure_cli" {
  count = var.create_entra_apps ? 1 : 0

  application_id       = azuread_application.gateway_api[0].id
  authorized_client_id = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"
  permission_ids       = [random_uuid.scope_agents_invoke.result]
}

resource "azuread_service_principal" "gateway_api" {
  count     = var.create_entra_apps ? 1 : 0
  client_id = azuread_application.gateway_api[0].client_id
  owners    = [data.azuread_client_config.current.object_id]
}

locals {
  librechat_host = coalesce(var.public_hostname, "librechat.localtest.me")
}

resource "azuread_application" "librechat" {
  count = var.create_entra_apps ? 1 : 0

  display_name     = "librechat-${var.base}"
  owners           = [data.azuread_client_config.current.object_id]
  sign_in_audience = "AzureADMyOrg"

  web {
    # LibreChat's OpenID callback path.
    redirect_uris = [
      "https://${local.librechat_host}/oauth/openid/callback",
      "http://localhost:3080/oauth/openid/callback",
    ]
    implicit_grant {
      access_token_issuance_enabled = false # authorization code flow only
      id_token_issuance_enabled     = false
    }
  }

  required_resource_access {
    resource_app_id = azuread_application.gateway_api[0].client_id
    resource_access {
      id   = random_uuid.scope_agents_invoke.result
      type = "Scope"
    }
  }

  # openid / profile / email / offline_access on Microsoft Graph.
  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000" # Microsoft Graph
    dynamic "resource_access" {
      for_each = {
        openid         = "37f7f235-527c-4136-accd-4a02d197296e"
        profile        = "14dad69e-099b-42c9-810b-d002981feec1"
        email          = "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0"
        offline_access = "7427e0e9-2fba-42fe-b0c0-848c9e6a8182"
      }
      content {
        id   = resource_access.value
        type = "Scope"
      }
    }
  }
}

resource "azuread_service_principal" "librechat" {
  count     = var.create_entra_apps ? 1 : 0
  client_id = azuread_application.librechat[0].client_id
  owners    = [data.azuread_client_config.current.object_id]
}

resource "azuread_application_password" "librechat" {
  count = var.create_entra_apps ? 1 : 0

  application_id = azuread_application.librechat[0].id
  display_name   = "poc-secret"
  end_date       = timeadd(timestamp(), "2160h") # 90 days

  lifecycle { ignore_changes = [end_date] }
}

# -----------------------------------------------------------------------------
# "Portail" app for oauth2-proxy: the Entra ID sign-in in front of the admin
# UIs published on the internet (Grafana, kagent UI), which have no sign-in of
# their own in this PoC. Single tenant: only accounts of this tenant get in.
# To restrict further, set app_role_assignment_required on the service
# principal and assign the people or groups allowed.
# -----------------------------------------------------------------------------
resource "azuread_application" "portal" {
  count = var.create_entra_apps && var.public_hosts != null ? 1 : 0

  display_name     = "portail-${var.base}"
  owners           = [data.azuread_client_config.current.object_id]
  sign_in_audience = "AzureADMyOrg"

  web {
    # oauth2-proxy's callback path, one per protected host.
    redirect_uris = [
      "https://${var.public_hosts["grafana"]}/oauth2/callback",
      "https://${var.public_hosts["kagent"]}/oauth2/callback",
    ]
    implicit_grant {
      access_token_issuance_enabled = false
      id_token_issuance_enabled     = false
    }
  }

  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000" # Microsoft Graph
    dynamic "resource_access" {
      for_each = {
        openid  = "37f7f235-527c-4136-accd-4a02d197296e"
        profile = "14dad69e-099b-42c9-810b-d002981feec1"
        email   = "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0"
      }
      content {
        id   = resource_access.value
        type = "Scope"
      }
    }
  }
}

resource "azuread_service_principal" "portal" {
  count     = length(azuread_application.portal)
  client_id = azuread_application.portal[0].client_id
  owners    = [data.azuread_client_config.current.object_id]
}

resource "azuread_application_password" "portal" {
  count = length(azuread_application.portal)

  application_id = azuread_application.portal[0].id
  display_name   = "oauth2-proxy"
  end_date       = timeadd(timestamp(), "2160h") # 90 days

  lifecycle { ignore_changes = [end_date] }
}
