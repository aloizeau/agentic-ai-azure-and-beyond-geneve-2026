# -----------------------------------------------------------------------------
# Gateway core (gateway/deploy at the repo root): Gateway, the `llm` backend
# with its failover groups, the `mcp` backend (kagent tools), the routes
# (/v1 people, /agents/v1 agents, /mcp tools), the policies — access, ceilings,
# content rules, resilience — the usage labels on the metrics and the model
# price list (ConfigMap model-costs).
# Plain agentgateway / Gateway API CRDs, applied with kustomize; this file only
# injects the values Terraform knows (Foundry name, tenant, audience).
# -----------------------------------------------------------------------------

locals {
  gateway_src = abspath("${path.root}/../gateway/deploy")
  gateway_dir = "${path.root}/.generated/gateway"
  gateway_rel = "../../../gateway/deploy" # kustomize refuses absolute roots

  gateway_patches = concat(
    [
      {
        target = { group = "agentgateway.dev", kind = "AgentgatewayBackend", name = "llm" }
        patch = yamlencode([
          { op = "replace", path = "/spec/ai/groups/0/providers/0/azure/resourceName", value = var.foundry_account_name },
          { op = "replace", path = "/spec/ai/groups/0/providers/0/azure/projectName", value = var.foundry_project_name },
          { op = "replace", path = "/spec/ai/groups/1/providers/0/azure/resourceName", value = var.foundry_account_name },
          { op = "replace", path = "/spec/ai/groups/1/providers/0/azure/projectName", value = var.foundry_project_name },
        ])
      },
      {
        # Workload Identity of the internal proxy pods (Foundry, keyless).
        target = { group = "agentgateway.dev", kind = "AgentgatewayParameters", name = "internal-only" }
        patch = yamlencode([
          { op = "replace", path = "/spec/serviceAccount/metadata/annotations/azure.workload.identity~1client-id", value = var.workload_identity_client_ids["agentgateway"] },
        ])
      },
    ],
    # The same Entra ID check on both people-facing policies: models (acces-llm)
    # and tools (acces-outils, request ceiling instead of a token ceiling).
    [
      for policy in ["acces-llm", "acces-outils"] : {
        target = { group = "agentgateway.dev", kind = "AgentgatewayPolicy", name = policy }
        patch = yamlencode([
          { op = "replace", path = "/spec/traffic/jwtAuthentication/providers/0/issuer", value = var.entra_issuer },
          { op = "replace", path = "/spec/traffic/jwtAuthentication/providers/0/audiences", value = [coalesce(var.gateway_api_audience, "REPLACE-ME")] },
          { op = "replace", path = "/spec/traffic/jwtAuthentication/providers/0/jwks/remote/url", value = var.entra_jwks_uri },
        ])
      }
    ],
    # With NeMo on, guardrails/ owns the `garde-fous-llm` policy (regex + webhook).
    var.enable_nemo_guardrails ? [{
      target = { group = "agentgateway.dev", kind = "AgentgatewayPolicy", name = "garde-fous-llm" }
      patch  = yamlencode({ "$patch" = "delete", apiVersion = "agentgateway.dev/v1alpha1", kind = "AgentgatewayPolicy", metadata = { name = "garde-fous-llm" } })
    }] : [],
    # Per-user label off: the dashboard keeps team, model, cost and tools.
    var.usage_metrics_per_user ? [] : [{
      target = { group = "agentgateway.dev", kind = "AgentgatewayPolicy", name = "metriques-usage" }
      patch = yamlencode([
        { op = "test", path = "/spec/frontend/metrics/attributes/add/0/name", value = "user" },
        { op = "remove", path = "/spec/frontend/metrics/attributes/add/0" },
      ])
    }],
  )

  gateway_overlay = yamlencode({
    apiVersion = "kustomize.config.k8s.io/v1beta1"
    kind       = "Kustomization"
    resources  = [local.gateway_rel]
    patches    = local.gateway_patches
  })

  gateway_hash = sha256(join("", [
    for f in sort(fileset(local.gateway_src, "**")) : filesha256("${local.gateway_src}/${f}")
  ]))
}

resource "local_file" "gateway_overlay" {
  filename = "${local.gateway_dir}/kustomization.yaml"
  content  = local.gateway_overlay
}

resource "terraform_data" "gateway_core" {
  triggers_replace = [local.gateway_overlay, local.gateway_hash]

  provisioner "local-exec" {
    command = "kubectl apply -k ${local.gateway_dir}"
  }

  depends_on = [local_file.gateway_overlay, helm_release.agentgateway]
}
