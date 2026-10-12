# -----------------------------------------------------------------------------
# agentregistry — the catalogue of AI building blocks (Solo.io, Apache-2.0).
#
# One place to publish, discover and version MCP servers, agents, skills and
# prompts, and to deploy them onto the cluster: its Kubernetes runtime turns a
# registry Deployment into kagent / kmcp resources (MCPServer, RemoteMCPServer,
# BYO Agent) in a team namespace. The extra demo demos/extras/cycle-de-vie-registre uses it.
#
# Security posture, on purpose:
#   - ClusterIP only, never published. The open-source edition has no
#     authentication: its authorization provider allows every call (Solo
#     Enterprise adds it). Reach it with kubectl port-forward.
#   - rbac.watchedNamespaces = the team namespaces: the registry can create
#     resources there and nowhere else (namespaced Roles, no cluster-wide write).
#   - Bundled PostgreSQL: demo only. In production, database.postgres.type =
#     external (Azure Database for PostgreSQL) — see the chart README.
# -----------------------------------------------------------------------------

resource "helm_release" "agentregistry" {
  name       = "agentregistry"
  repository = "oci://ghcr.io/agentregistry-dev/agentregistry/charts"
  chart      = "agentregistry"
  version    = var.chart_versions.agentregistry
  namespace  = kubernetes_namespace.this["agentregistry"].metadata[0].name
  wait       = true
  timeout    = 600

  values = [yamlencode({
    rbac = {
      enabled           = true
      watchedNamespaces = [for t in var.teams : kubernetes_namespace.team[t].metadata[0].name]
    }
    service = { type = "ClusterIP" }
    resources = {
      requests = { cpu = "100m", memory = "192Mi" }
      limits   = { cpu = "500m", memory = "512Mi" }
    }
    database = {
      postgres = {
        type = "bundled"
        bundled = {
          storage = "2Gi"
          resources = {
            requests = { cpu = "100m", memory = "128Mi" }
            limits   = { cpu = "500m", memory = "512Mi" }
          }
        }
      }
    }
  })]

  # The kubernetes runtime lists and writes kagent.dev resources: CRDs first.
  depends_on = [helm_release.kagent]
}
