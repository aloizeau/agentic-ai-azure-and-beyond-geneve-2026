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

variable "ai_team_environment" {
  type    = string
  default = "ai-team"
}
