variable "equipe" {
  description = "Team name: namespace, identities, storage and repository agent-<équipe>."
  type        = string

  validation {
    condition = (
      can(regex("^[a-z][a-z0-9-]{1,18}[a-z0-9]$", var.equipe)) && !strcontains(var.equipe, "--") &&
      !contains(["default", "kagent", "monitoring", "librechat", "agentregistry", "platform", "plateforme"], var.equipe) &&
      !startswith(var.equipe, "kube-") && !startswith(var.equipe, "agentgateway")
    )
    error_message = "3 to 20 characters, lowercase letters, digits and dashes, starting with a letter; platform names are reserved."
  }
}

variable "description" {
  description = "What the team's agent is for (GitHub repository description)."
  type        = string
  default     = "Agent de l'équipe"
}

variable "plateforme" {
  description = <<-EOT
    The platform's non-secret outputs: `terraform output -json plateforme_pour_equipes`
    in terraform/. The pipeline passes the GitHub variable PLATEFORME
    (TF_VAR_plateforme), set by demos/B-agent-equipe/prepare.ps1.
  EOT
  type = object({
    subscription_id           = string
    tenant_id                 = string
    location                  = string
    resource_group_name       = string
    teams_resource_group_name = string
    acr_id                    = string
    acr_name                  = string
    acr_login_server          = string
    aks_cluster_id            = string
    aks_cluster_name          = string
    aks_oidc_issuer_url       = string
    aks_api_server            = string
    aks_ca_certificate        = string
  })
}

variable "github_owner" {
  description = "GitHub organization (or user) owning the team repository."
  type        = string
}

variable "platform_repository" {
  description = "owner/repo of the platform repository that publishes the reusable workflows (agent-image.yml, agent-deploy.yml)."
  type        = string
}

variable "platform_ref" {
  description = "Branch of the reusable workflows the team pipelines call (also part of the federated subject)."
  type        = string
  default     = "main"
}

variable "kubeconfig_path" {
  description = "Run by hand with the admin kubeconfig (az aks get-credentials --admin). null: Entra ID through kubelogin (the pipeline)."
  type        = string
  default     = null
}
