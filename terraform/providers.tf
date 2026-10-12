provider "azurerm" {
  # azurerm >= 4 requires ARM_SUBSCRIPTION_ID or this attribute.
  subscription_id = var.subscription_id

  # azurerm 5 no longer registers any resource provider by default: list the
  # ones this configuration needs (idempotent, needs register permission).
  resource_providers_to_register = [
    "Microsoft.ContainerService",
    "Microsoft.ContainerRegistry",
    "Microsoft.Compute",
    "Microsoft.Network",
    "Microsoft.Storage",
    "Microsoft.CognitiveServices",
    "Microsoft.ManagedIdentity",
    "Microsoft.OperationalInsights",
    "Microsoft.OperationsManagement",
    "Microsoft.Insights",
  ]

  features {
    resource_group {
      # A demo environment must die completely on `terraform destroy`.
      prevent_deletion_if_contains_resources = false
    }
    cognitive_account {
      purge_soft_delete_on_destroy = true
    }
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

provider "azuread" {}

# Cloudflare DNS for var.public_exposure. The token comes from the
# CLOUDFLARE_API_TOKEN environment variable, never from a file; with
# public_exposure = null no Cloudflare resource exists and no token is needed.
provider "cloudflare" {}

provider "azapi" {
  subscription_id = var.subscription_id
}

# The Kubernetes and Helm providers are configured from the AKS module's
# outputs. Terraform cannot know these at plan time on a first apply, which is
# why the platform module is gated behind `var.deploy_platform` (see README:
# "two-phase apply").
provider "kubernetes" {
  host                   = module.foundation.kube_host
  cluster_ca_certificate = base64decode(module.foundation.kube_ca_certificate)
  client_certificate     = base64decode(module.foundation.kube_client_certificate)
  client_key             = base64decode(module.foundation.kube_client_key)
}

provider "helm" {
  kubernetes = {
    host                   = module.foundation.kube_host
    cluster_ca_certificate = base64decode(module.foundation.kube_ca_certificate)
    client_certificate     = base64decode(module.foundation.kube_client_certificate)
    client_key             = base64decode(module.foundation.kube_client_key)
  }
}
