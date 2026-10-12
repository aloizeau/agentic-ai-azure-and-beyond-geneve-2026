# -----------------------------------------------------------------------------
# NVIDIA NeMo Guardrails behind agentgateway — R&D TARGET, not production yet.
#
# Today, in production, the guardrails are the Microsoft Foundry content
# filters attached to each model deployment (module "ai"). They work, but they
# are Azure-specific: they do not follow a change of model provider.
#
# The target is one rule set at the gateway, whatever the provider: agentgateway
# `webhook` guard -> NeMo Guardrails adapter (guardrails/ at the repo root).
# Everything is plain Kubernetes / vendor CRDs, applied with kustomize:
#   AgentgatewayPolicy (regex + webhook, FailClosed, timeout), AgentgatewayBackend,
#   internal Gateway + HTTPRoute, ServiceMonitor, PrometheusRule, NetworkPolicy.
# Enterprise variant (NemoGuardrail CR, NVIDIA NIM Operator): guardrails/overlays/.
# -----------------------------------------------------------------------------

locals {
  guardrails_src = abspath("${path.root}/../guardrails/deploy")
  guardrails_dir = "${path.root}/.generated/guardrails"
  # kustomize refuses absolute roots: reference the base relatively from the
  # generated overlay (terraform/.generated/guardrails -> repo/guardrails/deploy).
  guardrails_rel = "../../../guardrails/deploy"

  # Image name/tag split for kustomize's `images` transformer.
  adapter_image_name = split(":", var.guardrail_adapter_image)[0]
  adapter_image_tag  = try(split(":", var.guardrail_adapter_image)[1], "latest")

  guardrails_overlay = yamlencode({
    apiVersion = "kustomize.config.k8s.io/v1beta1"
    kind       = "Kustomization"
    resources  = [local.guardrails_rel]
    images = [{
      # The base already rewrote the placeholder name; match that name here.
      name    = "ghcr.io/OWNER/nemo-guardrail-adapter"
      newName = local.adapter_image_name
      newTag  = local.adapter_image_tag
    }]
    patches = [{
      target = { group = "agentgateway.dev", kind = "AgentgatewayBackend", name = "llm-guardrails-internal" }
      patch = yamlencode([
        { op = "replace", path = "/spec/ai/provider/azure/resourceName", value = var.foundry_account_name },
        { op = "replace", path = "/spec/ai/provider/azure/projectName", value = var.foundry_project_name },
      ])
    }]
  })

  # Re-apply whenever the rails, policies or adapter manifests change.
  guardrails_hash = sha256(join("", [
    for f in sort(fileset(local.guardrails_src, "**")) : filesha256("${local.guardrails_src}/${f}")
  ]))
}

resource "local_file" "guardrails_overlay" {
  count    = var.enable_nemo_guardrails ? 1 : 0
  filename = "${local.guardrails_dir}/kustomization.yaml"
  content  = local.guardrails_overlay
}

resource "terraform_data" "nemo_guardrails" {
  count = var.enable_nemo_guardrails ? 1 : 0

  triggers_replace = [local.guardrails_overlay, local.guardrails_hash]

  provisioner "local-exec" {
    command = "kubectl apply -k ${local.guardrails_dir}"
  }

  depends_on = [
    local_file.guardrails_overlay,
    terraform_data.gateway_core,        # applied after the core: owns garde-fous-llm when on
    helm_release.kube_prometheus_stack, # ServiceMonitor / PrometheusRule CRDs
  ]
}
