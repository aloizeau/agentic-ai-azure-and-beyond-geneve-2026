terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm    = { source = "hashicorp/azurerm", version = "~> 5.6" }
    azuread    = { source = "hashicorp/azuread", version = "~> 3.9" }
    azapi      = { source = "Azure/azapi", version = "~> 2.12" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.38" }
    helm       = { source = "hashicorp/helm", version = "~> 3.0" }
    random     = { source = "hashicorp/random", version = "~> 3.7" }
    tls        = { source = "hashicorp/tls", version = "~> 4.1" }
    local      = { source = "hashicorp/local", version = "~> 2.5" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.25" }
  }

  # Backend configured at init time:
  #   terraform init -backend-config=backend.hcl
  # See scripts/bootstrap-state.sh. Comment out for a purely local PoC.
  backend "azurerm" {}
}
