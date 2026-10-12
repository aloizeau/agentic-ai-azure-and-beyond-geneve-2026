data "terraform_remote_state" "platform" {
  backend = "azurerm"
  config = {
    resource_group_name  = var.platform_state.resource_group_name
    storage_account_name = var.platform_state.storage_account_name
    container_name       = var.platform_state.container_name
    key                  = var.platform_state.key
    use_azuread_auth     = true
  }
}

locals {
  p = data.terraform_remote_state.platform.outputs
}

provider "azurerm" {
  subscription_id     = local.p.subscription_id
  storage_use_azuread = true # shared keys are disabled on the team storage
  features {}
}

# The pipeline signs in to the AKS API with its own Entra ID identity
# (kubelogin, after azure/login): its rights are the ClusterRole
# agentic-team-provisioner and the admission policy agent-ready-perimetre.
provider "kubernetes" {
  config_path            = var.kubeconfig_path
  host                   = var.kubeconfig_path == null ? local.p.aks_api_server : null
  cluster_ca_certificate = var.kubeconfig_path == null ? base64decode(local.p.aks_ca_certificate) : null

  dynamic "exec" {
    for_each = var.kubeconfig_path == null ? [1] : []
    content {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "kubelogin"
      # AKS server application ID (Microsoft Learn, kubelogin).
      args = ["get-token", "--login", "azurecli", "--server-id", "6dae42f8-4368-4678-94ff-3960e28e3630"]
    }
  }
}

# Token from the GITHUB_TOKEN environment variable (secret AI_TEAM_GITHUB_TOKEN
# of the « ai-team » environment), never from a file.
provider "github" {
  owner = var.github_owner
}
