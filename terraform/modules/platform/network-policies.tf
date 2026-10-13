# -----------------------------------------------------------------------------
# Who may reach the platform's own components inside the cluster.
#
# Without these, any pod — a team's agent, an MCP server steered by a prompt —
# could call them directly, around the gateway and its Entra ID check:
#   - Grafana trusts the X-Forwarded-Email header of oauth2-proxy (public.tf):
#     reachable by anyone, that header would sign in as any user;
#   - the kagent controller serves invoke_agent (MCP) and the UI's API;
#   - agentregistry (open-source edition) has no authentication at all.
# kubectl port-forward is not filtered (it enters the pod itself): the
# presenter's access is unchanged.
# VÉRIFIER (D-7): kagent and agentregistry declare no admission webhook in the
# pinned charts (`kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations`)
# — a webhook served from these namespaces would need an ingress rule for the
# API server.
# -----------------------------------------------------------------------------

resource "kubernetes_network_policy" "grafana" {
  metadata {
    name      = "grafana-entrees"
    namespace = kubernetes_namespace.this["monitoring"].metadata[0].name
  }
  spec {
    pod_selector {
      match_labels = { "app.kubernetes.io/name" = "grafana" }
    }
    policy_types = ["Ingress"]
    ingress {
      # oauth2-proxy-grafana, Prometheus (metrics), the dashboard sidecar: the
      # monitoring namespace holds platform components only.
      from {
        pod_selector {}
      }
      # The optional Grafana MCP server (tools/enterprise, API key).
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "outils-entreprise" }
        }
        pod_selector {
          match_labels = { app = "mcp-grafana" }
        }
      }
    }
  }
}

resource "kubernetes_network_policy" "kagent" {
  metadata {
    name      = "kagent-entrees"
    namespace = kubernetes_namespace.this["kagent"].metadata[0].name
  }
  spec {
    pod_selector {}
    policy_types = ["Ingress"]
    ingress {
      # The controller, the UI and its oauth2-proxy, the platform's agents.
      from {
        pod_selector {}
      }
      # The gateway (/mcp → invoke_agent, with the user's Entra ID token).
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "agentgateway-system" }
        }
      }
      # Team agents call back the controller (sessions, tasks).
      from {
        namespace_selector {
          match_expressions {
            key      = "agentic.io/team"
            operator = "Exists"
          }
        }
      }
      # Prometheus.
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "monitoring" }
        }
      }
    }
  }
}

resource "kubernetes_network_policy" "agentregistry" {
  metadata {
    name      = "agentregistry-entrees"
    namespace = kubernetes_namespace.this["agentregistry"].metadata[0].name
  }
  spec {
    pod_selector {}
    policy_types = ["Ingress"]
    ingress {
      # The registry and its database only; people come in with port-forward.
      from {
        pod_selector {}
      }
    }
  }
}
