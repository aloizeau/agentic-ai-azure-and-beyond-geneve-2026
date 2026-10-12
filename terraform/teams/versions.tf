terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm    = { source = "hashicorp/azurerm", version = "~> 5.6" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.38" }
    github     = { source = "integrations/github", version = "~> 6.6" }
    random     = { source = "hashicorp/random", version = "~> 3.7" }
  }

  # One state per team, configured at init time (same storage as the platform):
  #   terraform init -backend-config=../backend.hcl -backend-config="key=teams/<équipe>.tfstate"
  backend "azurerm" {}
}
