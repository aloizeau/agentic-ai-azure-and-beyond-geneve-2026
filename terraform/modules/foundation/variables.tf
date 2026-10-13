variable "base" { type = string }
variable "location" { type = string }
variable "tags" { type = map(string) }
variable "kubernetes_version" { type = string }
variable "aks_sku_tier" { type = string }
variable "system_node_vm_size" { type = string }
variable "system_node_count" { type = number }
variable "use_spot_nodes" { type = bool }
variable "ai_toolchain_operator_enabled" { type = bool }

variable "public_ip_enabled" {
  description = "Create the static public IP of the public Gateway (root variable public_exposure)."
  type        = bool
  default     = false
}

variable "tenant_id" {
  description = "Entra ID tenant of the cluster's Kubernetes API authentication."
  type        = string
}

variable "aks_admin_group_object_ids" {
  description = "Entra ID groups bound to cluster-admin (empty: the admin kubeconfig only)."
  type        = list(string)
  default     = []
}

variable "api_server_authorized_ip_ranges" {
  type    = list(string)
  default = []
}
