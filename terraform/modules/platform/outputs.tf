output "grafana_admin_password" {
  value     = random_password.grafana.result
  sensitive = true
}

output "namespaces" {
  value = [for ns in kubernetes_namespace.this : ns.metadata[0].name]
}

output "nemo_guardrails_enabled" {
  value = var.enable_nemo_guardrails
}
