variable "base" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }
variable "acr_id" { type = string }
variable "aks_id" { type = string }
variable "aks_oidc_issuer_url" { type = string }

variable "ai_team_github_repository" {
  description = "owner/repo of the platform repository whose « ai-team » environment runs the Agent Ready pipeline. null: no pipeline identity."
  type        = string
  default     = null
}

variable "ai_team_github_ids" {
  description = "Numeric IDs { owner, repository } of ai_team_github_repository, for immutable OIDC subjects. null: name-based subjects only."
  type = object({
    owner      = number
    repository = number
  })
  default = null
}

variable "ai_team_environment" {
  type    = string
  default = "ai-team"
}

variable "manage_role_assignments" {
  description = "true: Terraform assigns the AI team identity its Contributor (rg-<base>-equipes) and conditioned RBAC Administrator roles — needs Owner. false: a person with Owner creates them (demos/B-agent-equipe/prepare.ps1), from the output ai_team_role_assignments."
  type        = bool
  default     = true
}
