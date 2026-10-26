variable "chart_versions" { type = map(string) }
variable "foundry_endpoint" { type = string }
variable "model_deployments" { type = map(string) }
variable "workload_identity_client_ids" { type = map(string) }
variable "log_analytics_workspace_id" {
  type        = string
  description = "Log Analytics workspace (resource ID): source of the guardrail block log shown in Grafana."
}
variable "tenant_id" { type = string }
variable "entra_issuer" { type = string }
variable "entra_jwks_uri" { type = string }
variable "gateway_api_audience" { type = string }
variable "librechat_client_id" { type = string }
variable "librechat_client_secret" {
  type      = string
  sensitive = true
}
variable "gateway_scope" { type = string }
variable "enable_nemo_guardrails" { type = bool }
variable "guardrail_adapter_image" { type = string }
variable "foundry_account_name" { type = string }
variable "foundry_project_name" { type = string }
variable "enable_self_hosted_models" { type = bool }
variable "self_hosted_gpu_instance_type" { type = string }
variable "enable_enterprise_tools" {
  type    = bool
  default = false
}
variable "teams" { type = list(string) }
variable "usage_metrics_per_user" {
  type    = bool
  default = true
}
variable "public_hostname" {
  type    = string
  default = null
}

# Public exposure (root variable public_exposure). null hosts = nothing public.
variable "public_hosts" {
  type    = map(string)
  default = null
}
variable "public_expose_api" {
  type    = bool
  default = true
}
variable "public_ip_name" {
  type    = string
  default = null
}
variable "public_ip_rg" {
  type    = string
  default = null
}
variable "acme_email" {
  type    = string
  default = null
}
variable "portal_client_id" {
  type    = string
  default = null
}
variable "portal_client_secret" {
  type      = string
  default   = null
  sensitive = true
}

# « Agent Ready » (démo B). The flag drives count (known at plan time); the
# object ID of the AI team pipeline identity is only used inside resources.
variable "ai_team_enabled" {
  type    = bool
  default = false
}
variable "ai_team_principal_id" {
  type    = string
  default = null
}
