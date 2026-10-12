variable "base" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }
variable "log_analytics_id" { type = string }

variable "model_deployments" {
  type = map(object({
    model_name    = string
    model_version = optional(string)
    model_format  = string
    sku_name      = string
    capacity      = number
    rung          = string
    enabled       = optional(bool, true)
  }))
}
