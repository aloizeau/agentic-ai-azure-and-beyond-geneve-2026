# -----------------------------------------------------------------------------
# Public exposure — Kubernetes part (root variable public_exposure, phase 2).
#
#   cert-manager       Let's Encrypt certificates, HTTP-01 through the Gateway
#   gateway/public     second agentgateway Gateway on the static public IP,
#                      HTTPS listeners, routes (applied with kustomize, patched
#                      here with the host names, IP name and client ID)
#   oauth2-proxy       Entra ID sign-in in front of Grafana; kagent uses the
#                      oauth2-proxy bundled with its chart (main.tf)
#
# Nothing here exists when public_hosts is null.
# -----------------------------------------------------------------------------

locals {
  public            = var.public_hosts != null
  public_namespaces = ["agentgateway-system", "librechat", "kagent", "monitoring"]

  # Extra Helm values documents, merged over the base values by Helm.
  kagent_public_values = local.public ? [yamlencode({
    ui = { externalUrl = "https://${var.public_hosts["kagent"]}" }
    # The UI is published only through this proxy. The controller keeps its
    # default auth mode, so in-cluster callers (LibreChat MCP, agents) are
    # unchanged.
    "oauth2-proxy" = {
      enabled = true
      config = {
        clientID     = var.portal_client_id
        clientSecret = var.portal_client_secret
        cookieSecret = try(random_password.oauth2_cookie["kagent"].result, null)
      }
      extraArgs = {
        provider          = "entra-id"
        "oidc-issuer-url" = var.entra_issuer
        "redirect-url"    = "https://${var.public_hosts["kagent"]}/oauth2/callback"
        scope             = "openid profile email" # the chart's default adds "groups", which Entra rejects
        "reverse-proxy"   = true
      }
    }
  })] : []

  grafana_public_values = local.public ? [yamlencode({
    grafana = {
      "grafana.ini" = {
        server = { root_url = "https://${var.public_hosts["grafana"]}" }
        # oauth2-proxy has already authenticated the user against Entra ID and
        # forwards their identity as X-Forwarded-* headers. Trust it so Grafana
        # signs the user in as themselves instead of falling back to the
        # anonymous Viewer (which is what shows the "Sign in" button).
        # The header is trusted from any caller that reaches Grafana: the
        # NetworkPolicy grafana-entrees (network-policies.tf) is what keeps that
        # to oauth2-proxy and the platform. New users are Viewers, never Admins.
        "auth.proxy" = {
          enabled         = true
          header_name     = "X-Forwarded-Email"
          header_property = "email"
          auto_sign_up    = true
          headers         = "Name:X-Forwarded-Preferred-Username Login:X-Forwarded-Email"
        }
        users = { auto_assign_org_role = "Viewer" }
      }
    }
  })] : []

  public_route_hosts = local.public ? {
    "librechat-public"  = var.public_hosts["chat"]
    "grafana-public"    = var.public_hosts["grafana"]
    "kagent-public"     = var.public_hosts["kagent"]
    "llm-public"        = var.public_hosts["api"]
    "llm-agents-public" = var.public_hosts["api"]
  } : {}

  public_src = abspath("${path.root}/../gateway/public")
  public_dir = "${path.root}/.generated/public"
  public_rel = "../../../gateway/public" # kustomize refuses absolute roots

  public_patches = local.public ? concat(
    [
      {
        target = { group = "agentgateway.dev", kind = "AgentgatewayParameters", name = "public-lb" }
        patch = yamlencode([
          { op = "replace", path = "/spec/service/metadata/annotations/service.beta.kubernetes.io~1azure-pip-name", value = var.public_ip_name },
          { op = "replace", path = "/spec/service/metadata/annotations/service.beta.kubernetes.io~1azure-load-balancer-resource-group", value = var.public_ip_rg },
          { op = "replace", path = "/spec/serviceAccount/metadata/annotations/azure.workload.identity~1client-id", value = var.workload_identity_client_ids["agentgateway-public"] },
        ])
      },
      {
        target = { group = "gateway.networking.k8s.io", kind = "Gateway", name = "agentgateway-public" }
        patch = yamlencode([
          { op = "replace", path = "/spec/listeners/1/hostname", value = var.public_hosts["chat"] },
          { op = "replace", path = "/spec/listeners/2/hostname", value = var.public_hosts["grafana"] },
          { op = "replace", path = "/spec/listeners/3/hostname", value = var.public_hosts["kagent"] },
          { op = "replace", path = "/spec/listeners/4/hostname", value = var.public_hosts["api"] },
        ])
      },
      {
        target = { group = "cert-manager.io", kind = "ClusterIssuer", name = "letsencrypt" }
        patch = yamlencode([
          var.acme_email == null ? { op = "remove", path = "/spec/acme/email" } : { op = "replace", path = "/spec/acme/email", value = var.acme_email },
        ])
      },
    ],
    [
      for name, host in local.public_route_hosts : {
        target = { group = "gateway.networking.k8s.io", kind = "HTTPRoute", name = name }
        patch  = yamlencode([{ op = "replace", path = "/spec/hostnames", value = [host] }])
      }
    ],
    # expose_api = false: the api host keeps its listener and certificate, but
    # no route answers on it.
    var.public_expose_api ? [] : [
      for name in ["llm-public", "llm-agents-public"] : {
        target = { group = "gateway.networking.k8s.io", kind = "HTTPRoute", name = name }
        patch  = yamlencode({ "$patch" = "delete", apiVersion = "gateway.networking.k8s.io/v1", kind = "HTTPRoute", metadata = { name = name } })
      }
    ],
  ) : []

  public_overlay = yamlencode({
    apiVersion = "kustomize.config.k8s.io/v1beta1"
    kind       = "Kustomization"
    resources  = [local.public_rel]
    patches    = local.public_patches
  })

  public_hash = sha256(join("", [
    for f in sort(fileset(local.public_src, "**")) : filesha256("${local.public_src}/${f}")
  ]))
}

resource "helm_release" "cert_manager" {
  count = local.public ? 1 : 0

  name             = "cert-manager"
  repository       = "oci://quay.io/jetstack/charts"
  chart            = "cert-manager"
  version          = var.chart_versions.cert_manager
  namespace        = "cert-manager"
  create_namespace = true
  wait             = true
  timeout          = 600

  values = [yamlencode({
    # Gateway API integration: one Certificate per annotated HTTPS listener.
    # The Gateway API CRDs are installed first (gateway_api_crds): cert-manager
    # only checks for them at startup.
    crds   = { enabled = true }
    config = { gatewayAPI = { enabled = true } }
  })]

  depends_on = [terraform_data.gateway_api_crds]
}

resource "random_password" "oauth2_cookie" {
  for_each = local.public ? toset(["kagent", "grafana"]) : toset([])
  length   = 32 # oauth2-proxy wants a 16, 24 or 32-byte cookie secret
  special  = false
}

# Grafana: oauth2-proxy as a reverse proxy, Entra ID sign-in, then Grafana.
resource "helm_release" "oauth2_proxy_grafana" {
  count = local.public ? 1 : 0

  name       = "oauth2-proxy-grafana"
  repository = "oci://ghcr.io/oauth2-proxy/charts"
  chart      = "oauth2-proxy"
  version    = var.chart_versions.oauth2_proxy
  namespace  = kubernetes_namespace.this["monitoring"].metadata[0].name
  wait       = true
  timeout    = 600

  values = [yamlencode({
    config = {
      clientID     = var.portal_client_id
      clientSecret = var.portal_client_secret
      cookieSecret = try(random_password.oauth2_cookie["grafana"].result, null)
      emailDomains = ["*"]
      upstreams    = ["http://kps-grafana.monitoring.svc.cluster.local:80"]
    }
    extraArgs = {
      provider               = "entra-id"
      "oidc-issuer-url"      = var.entra_issuer
      "redirect-url"         = "https://${var.public_hosts["grafana"]}/oauth2/callback"
      scope                  = "openid profile email"
      "reverse-proxy"        = true
      "skip-provider-button" = true
      "cookie-secure"        = true
      # Forward the signed-in identity to Grafana as X-Forwarded-Email /
      # X-Forwarded-Preferred-Username, which Grafana's auth.proxy trusts.
      "pass-user-headers" = true
      # oauth2-proxy sends "Authorization: Basic <email>:" upstream by default;
      # Grafana tries it as a login and answers 401 "Unauthorized".
      "pass-basic-auth" = false
    }
    service = { portNumber = 4180 }
  })]

  depends_on = [helm_release.kube_prometheus_stack]
}

resource "local_file" "public_overlay" {
  count    = local.public ? 1 : 0
  filename = "${local.public_dir}/kustomization.yaml"
  content  = local.public_overlay
}

resource "terraform_data" "public_gateway" {
  count            = local.public ? 1 : 0
  triggers_replace = [local.public_overlay, local.public_hash]

  provisioner "local-exec" {
    command = "kubectl apply -k ${local.public_dir}"
  }

  depends_on = [
    local_file.public_overlay,
    helm_release.cert_manager,   # ClusterIssuer CRD
    terraform_data.gateway_core, # `llm` backend and policies
    helm_release.librechat,      # route backends
    helm_release.kagent,
    helm_release.oauth2_proxy_grafana,
  ]
}
