# -----------------------------------------------------------------------------
# Namespaces
# -----------------------------------------------------------------------------
locals {
  namespaces = ["agentgateway-system", "kagent", "librechat", "monitoring", "agentregistry"]
}

resource "kubernetes_namespace" "this" {
  for_each = toset(local.namespaces)
  # Only labelled namespaces may attach routes to the public Gateway.
  metadata {
    name   = each.value
    labels = local.public && contains(local.public_namespaces, each.value) ? { "agentic.io/public" = "true" } : {}
  }
}

# -----------------------------------------------------------------------------
# Gateway API CRDs (standard channel) - prerequisite for agentgateway.
# Upstream publishes them as a plain manifest, not a chart: kubectl is the
# honest tool. One line on purpose — local-exec runs cmd.exe on Windows, where
# a backslash continuation would break.
# -----------------------------------------------------------------------------
resource "terraform_data" "gateway_api_crds" {
  triggers_replace = [var.chart_versions.gateway_api]

  provisioner "local-exec" {
    command = "kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v${var.chart_versions.gateway_api}/standard-install.yaml"
  }
}

# -----------------------------------------------------------------------------
# agentgateway
#
# Note for anyone porting older manifests: since v1.5 agentgateway ships its own
# Rust control plane and its own CRD group agentgateway.dev/v1alpha1. kgateway
# is NOT required, and the CRDs are AgentgatewayBackend / AgentgatewayPolicy /
# AgentgatewayParameters - not Backend / TrafficPolicy, which are kgateway's.
# -----------------------------------------------------------------------------
resource "helm_release" "agentgateway_crds" {
  name       = "agentgateway-crds"
  repository = "oci://cr.agentgateway.dev/charts"
  chart      = "agentgateway-crds"
  version    = var.chart_versions.agentgateway
  namespace  = kubernetes_namespace.this["agentgateway-system"].metadata[0].name

  depends_on = [terraform_data.gateway_api_crds]
}

resource "helm_release" "agentgateway" {
  name       = "agentgateway"
  repository = "oci://cr.agentgateway.dev/charts"
  chart      = "agentgateway"
  version    = var.chart_versions.agentgateway
  namespace  = kubernetes_namespace.this["agentgateway-system"].metadata[0].name
  wait       = true
  timeout    = 600

  values = [yamlencode({
    # Let the chart own the ServiceAccount (name defaults to the release name);
    # a Terraform-created SA of the same name isn't Helm-adoptable and breaks install.
    serviceAccount = {
      annotations = {
        "azure.workload.identity/client-id" = var.workload_identity_client_ids["agentgateway"]
        "azure.workload.identity/tenant-id" = var.tenant_id
      }
    }
    # Creates a ServiceMonitor (control plane :9092) and a PodMonitor
    # (data plane :15020). The `release` label is what makes the
    # kube-prometheus-stack operator actually select them.
    monitoring = {
      enabled = true
      serviceMonitor = {
        extraLabels = { release = "kps" }
      }
      proxy = {
        gatewayClassNames = ["agentgateway"]
      }
    }
  })]

  depends_on = [helm_release.agentgateway_crds]
}

# -----------------------------------------------------------------------------
# kagent (CNCF Sandbox). Ships kmcp as a sub-chart, which gives us the
# MCPServer CRD used by the live "add a business agent" demo.
# -----------------------------------------------------------------------------
resource "helm_release" "kagent_crds" {
  name       = "kagent-crds"
  repository = "oci://ghcr.io/kagent-dev/kagent/helm"
  chart      = "kagent-crds"
  version    = var.chart_versions.kagent
  namespace  = kubernetes_namespace.this["kagent"].metadata[0].name
}

resource "helm_release" "kagent" {
  name       = "kagent"
  repository = "oci://ghcr.io/kagent-dev/kagent/helm"
  chart      = "kagent"
  version    = var.chart_versions.kagent
  namespace  = kubernetes_namespace.this["kagent"].metadata[0].name
  wait       = true
  timeout    = 900

  values = concat([yamlencode({
    # Let the chart own the controller ServiceAccount; a Terraform-created SA
    # of the same name isn't Helm-adoptable and breaks install.
    controller = {
      serviceAccount = {
        annotations = {
          "azure.workload.identity/client-id" = var.workload_identity_client_ids["kagent"]
          "azure.workload.identity/tenant-id" = var.tenant_id
        }
      }
    }
    # The default ModelConfig points at the GATEWAY (/agents/v1, OpenAI-compatible),
    # never at Foundry: agents inherit the gateway's keys, ceilings, content
    # rules and metering. Authenticated with the "platform" virtual key (teams.tf).
    providers = {
      default = "openAI"
      openAI = {
        provider        = "OpenAI"
        model           = "llm" # ignored: the gateway backend pins the deployment
        apiKeySecretRef = "gateway-key"
        apiKeySecretKey = "key"
        config = {
          baseUrl = "http://agentgateway-proxy.agentgateway-system.svc.cluster.local/agents/v1"
        }
      }
    }
    kmcp = { enabled = true }
  })], local.kagent_public_values)

  depends_on = [helm_release.kagent_crds, kubernetes_secret.gateway_key]
}

# -----------------------------------------------------------------------------
# Observability
# -----------------------------------------------------------------------------
resource "helm_release" "kube_prometheus_stack" {
  name       = "kps"
  repository = "oci://ghcr.io/prometheus-community/charts"
  chart      = "kube-prometheus-stack"
  version    = var.chart_versions.kube_prometheus_stack
  namespace  = kubernetes_namespace.this["monitoring"].metadata[0].name
  wait       = true
  timeout    = 900

  values = concat([yamlencode({
    grafana = {
      adminPassword = random_password.grafana.result
      # Standard SSD (non-premium) so the DB — dashboards, users, MCP service
      # account token — survives a pod restart.
      persistence = {
        enabled          = true
        storageClassName = "managed-csi"
        size             = "2Gi"
      }
      sidecar = {
        dashboards = {
          enabled          = true
          label            = "grafana_dashboard"
          labelValue       = "1"
          searchNamespace  = "ALL"
          folderAnnotation = "grafana_folder"
          provider         = { foldersFromFilesStructure = true }
        }
      }
      "grafana.ini" = {
        # Demo convenience only: never do this outside a throwaway cluster.
        # When public, Grafana is only reachable through oauth2-proxy (Entra ID).
        "auth.anonymous" = { enabled = true, org_role = "Viewer" }
      }
    }
    prometheus = {
      prometheusSpec = {
        # Defaults to true, which means the operator only selects monitors
        # labelled release=kps. Kept explicit so the agentgateway
        # serviceMonitor.extraLabels above is obviously load-bearing.
        serviceMonitorSelectorNilUsesHelmValues = true
        podMonitorSelectorNilUsesHelmValues     = true
        ruleSelectorNilUsesHelmValues           = true
        retention                               = "45d"
        retentionSize                           = "18GiB" # stay under the PVC
        # Standard SSD (non-premium) so metrics history survives a pod restart.
        storageSpec = {
          volumeClaimTemplate = {
            spec = {
              storageClassName = "managed-csi"
              accessModes      = ["ReadWriteOnce"]
              resources        = { requests = { storage = "20Gi" } }
            }
          }
        }
        resources = {
          requests = { cpu = "200m", memory = "1Gi" }
        }
      }
    }
    alertmanager = { enabled = false }
  })], local.grafana_public_values)
}

resource "random_password" "grafana" {
  length  = 24
  special = false
}

# -----------------------------------------------------------------------------
# LibreChat - the user-facing front end, doing the Entra ID OIDC code flow.
#
# OPENID_REUSE_TOKENS makes LibreChat forward the user's Entra access token
# downstream, which is what lets the gateway see a per-user JWT. Verified
# present in the v0.8.8-rc code line; the docs PR is still open and it is NOT
# confirmed in v0.8.7 stable. If it does not hold, fall back to forwarding
# X-User-* headers and trusting LibreChat as an authenticated hop.
# -----------------------------------------------------------------------------
resource "random_password" "librechat" {
  for_each = toset(["jwt_secret", "jwt_refresh", "meili_key", "session"])
  length   = 32
  special  = false
}

# CREDS_KEY/CREDS_IV are AES key material LibreChat reads as hex: they must be
# exactly 32 and 16 bytes (64 and 32 hex chars), not arbitrary strings — else
# Buffer.from(.., "hex") yields the wrong length and every encrypt call fails.
resource "random_bytes" "librechat_creds_key" { length = 32 }
resource "random_bytes" "librechat_creds_iv" { length = 16 }

resource "kubernetes_secret" "librechat" {
  metadata {
    name      = "librechat-credentials-env"
    namespace = kubernetes_namespace.this["librechat"].metadata[0].name
  }

  data = {
    CREDS_KEY             = random_bytes.librechat_creds_key.hex
    CREDS_IV              = random_bytes.librechat_creds_iv.hex
    JWT_SECRET            = random_password.librechat["jwt_secret"].result
    JWT_REFRESH_SECRET    = random_password.librechat["jwt_refresh"].result
    MEILI_MASTER_KEY      = random_password.librechat["meili_key"].result
    OPENID_SESSION_SECRET = random_password.librechat["session"].result
    OPENID_CLIENT_ID      = var.librechat_client_id
    OPENID_CLIENT_SECRET  = var.librechat_client_secret
  }
}
