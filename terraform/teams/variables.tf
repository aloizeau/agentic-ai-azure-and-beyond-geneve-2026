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

variable "platform_state" {
  description = "Where the platform's Terraform state lives (backend.hcl written by scripts/deploy.ps1)."
  type = object({
    resource_group_name  = string
    storage_account_name = string
    container_name       = optional(string, "tfstate")
    key                  = optional(string, "agentic-platform.tfstate")
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
  description = "Git ref of the reusable workflows the team pipelines call."
  type        = string
  default     = "main"
}

variable "kubeconfig_path" {
  description = "Run by hand with the admin kubeconfig (az aks get-credentials --admin). null: Entra ID through kubelogin (the pipeline)."
  type        = string
  default     = null
}

# Démo D — tickets GitHub. Set both (TF_VAR_github_app_id, TF_VAR_github_app_private_key,
# from the « ai-team » environment) to give the team's MCP server the platform GitHub
# App (Secret github-app). null: no Secret, the team's server runs without tickets.
variable "github_app_id" {
  description = "ID of the platform GitHub App (Issues: read and write, Metadata: read), installed on the owner's repositories."
  type        = string
  default     = null
}

variable "github_app_private_key" {
  description = "PEM private key of that GitHub App."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = (var.github_app_private_key == null ? "" : var.github_app_private_key) == "" || can(regex("BEGIN (RSA )?PRIVATE KEY", var.github_app_private_key))
    error_message = "PEM private key expected (-----BEGIN RSA PRIVATE KEY-----)."
  }
}
