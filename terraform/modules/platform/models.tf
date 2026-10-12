# -----------------------------------------------------------------------------
# Self-hosted model on AKS (KAITO add-on) behind agentgateway — OPTIONAL.
#
# The add-on itself is enabled on the cluster (module "foundation",
# ai_toolchain_operator_enabled). Here: the KAITO Workspace (GPU node + vLLM),
# the AgentgatewayBackend `custom` provider, its HTTPRoute (/aks/v1), the
# gateway controls (JWT, regex, token ceiling), NetworkPolicy and PodMonitor.
# Everything is plain Kubernetes / vendor CRDs in models/deploy, applied with
# kustomize like guardrails/. See models/README.md for cost and clean-up.
# -----------------------------------------------------------------------------

locals {
  models_src = abspath("${path.root}/../models/deploy")
  models_dir = "${path.root}/.generated/models"
  models_rel = "../../../models/deploy" # kustomize refuses absolute roots

  models_overlay = yamlencode({
    apiVersion = "kustomize.config.k8s.io/v1beta1"
    kind       = "Kustomization"
    resources  = [local.models_rel]
    patches = [
      {
        target = { group = "kaito.sh", kind = "Workspace", name = "workspace-phi-4-mini" }
        patch = yamlencode([{
          op    = "replace"
          path  = "/resource/instanceType"
          value = var.self_hosted_gpu_instance_type
        }])
      },
      {
        target = { group = "agentgateway.dev", kind = "AgentgatewayPolicy", name = "llm-aks-controls" }
        patch = yamlencode([
          { op = "replace", path = "/spec/traffic/jwtAuthentication/providers/0/issuer", value = var.entra_issuer },
          { op = "replace", path = "/spec/traffic/jwtAuthentication/providers/0/audiences", value = [coalesce(var.gateway_api_audience, "REPLACE-ME")] },
          { op = "replace", path = "/spec/traffic/jwtAuthentication/providers/0/jwks/remote/url", value = var.entra_jwks_uri },
        ])
      },
    ]
  })

  models_hash = sha256(join("", [
    for f in sort(fileset(local.models_src, "**")) : filesha256("${local.models_src}/${f}")
  ]))
}

resource "local_file" "models_overlay" {
  count    = var.enable_self_hosted_models ? 1 : 0
  filename = "${local.models_dir}/kustomization.yaml"
  content  = local.models_overlay
}

resource "terraform_data" "self_hosted_models" {
  count = var.enable_self_hosted_models ? 1 : 0

  triggers_replace = [local.models_overlay, local.models_hash]

  provisioner "local-exec" {
    command = "kubectl apply -k ${local.models_dir}"
  }

  # The Workspace is the expensive part: remove it on destroy so KAITO releases
  # the GPU node. The GPU node pool itself must still be deleted (models/README.md).
  provisioner "local-exec" {
    when       = destroy
    on_failure = continue
    command    = "kubectl delete workspace workspace-phi-4-mini -n models --ignore-not-found --wait=false"
  }

  depends_on = [
    local_file.models_overlay,
    terraform_data.gateway_core,        # Gateway agentgateway-proxy (parentRef)
    helm_release.kube_prometheus_stack, # PodMonitor CRD
  ]
}
