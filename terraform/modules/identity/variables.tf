variable "base" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }
variable "oidc_issuer_url" { type = string }
variable "tenant_id" { type = string }
variable "create_entra_apps" { type = bool }
variable "public_hostname" { type = string }

variable "workload_identities" {
  description = "Workloads needing an Azure identity, keyed by logical name."
  type = map(object({
    namespace       = string
    service_account = string
  }))
}

variable "role_assignments" {
  type = map(object({
    workload           = string
    scope              = string
    role_definition_id = string
  }))
}

variable "public_hosts" {
  description = "Public host names (chat, grafana, kagent, api), or null when nothing is public."
  type        = map(string)
  default     = null
}

variable "authorized_principal_object_ids" {
  description = "Entra ID users or groups (object IDs) allowed to sign in to the gateway API, LibreChat and the portal, besides the identity running Terraform (assign_current_principal)."
  type        = list(string)
  default     = []
}

variable "assign_current_principal" {
  description = "Add the identity running Terraform to the people allowed to sign in. false in CI (see the root variable)."
  type        = bool
  default     = true
}
