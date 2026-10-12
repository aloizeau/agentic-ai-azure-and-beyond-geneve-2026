# -----------------------------------------------------------------------------
# Team onboarding = one line in var.teams.
# Each team gets a namespace and a virtual key for the /agents/v1 route:
#   - agentgateway-system/vk-<team>  the gateway's copy (label agentic.io/virtual-key),
#                                     key + metadata { team } used for attribution
#   - <team>/gateway-key             what the team's kagent ModelConfig references
# The platform's own agents (kagent namespace) get the "platform" key.
# -----------------------------------------------------------------------------

locals {
  key_holders = merge(
    { platform = kubernetes_namespace.this["kagent"].metadata[0].name },
    { for t in var.teams : t => kubernetes_namespace.team[t].metadata[0].name },
  )
}

resource "kubernetes_namespace" "team" {
  for_each = toset(var.teams)
  metadata {
    name   = each.value
    labels = { "agentic.io/team" = each.value }
  }
}

resource "random_password" "team_key" {
  for_each = local.key_holders
  length   = 40
  special  = false
}

resource "kubernetes_secret" "virtual_key" {
  for_each = local.key_holders
  metadata {
    name      = "vk-${each.key}"
    namespace = kubernetes_namespace.this["agentgateway-system"].metadata[0].name
    labels    = { "agentic.io/virtual-key" = "true" }
  }
  data = {
    (each.key) = jsonencode({
      key      = "sk-${each.key}-${random_password.team_key[each.key].result}"
      metadata = { team = each.key }
    })
  }
}

resource "kubernetes_secret" "gateway_key" {
  for_each = local.key_holders
  metadata {
    name      = "gateway-key"
    namespace = each.value
  }
  data = {
    key = "sk-${each.key}-${random_password.team_key[each.key].result}"
  }
}

# -----------------------------------------------------------------------------
# What a team's deployment pipeline may do — in its own namespace only. The
# "Agent Ready" stack (terraform/teams) binds it to the team's managed identity
# with one RoleBinding. No Secrets, no RBAC, no namespaces.
# -----------------------------------------------------------------------------
resource "kubernetes_cluster_role" "team_deployer" {
  metadata { name = "agentic-team-deployer" }

  rule {
    api_groups = [""]
    resources  = ["configmaps", "services", "serviceaccounts"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  rule {
    api_groups = [""]
    resources  = ["pods", "pods/log", "events"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["apps"]
    resources  = ["deployments"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  rule {
    api_groups = ["apps"]
    resources  = ["replicasets"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["networkpolicies"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  rule {
    api_groups = ["kagent.dev"]
    resources  = ["agents", "remotemcpservers", "modelconfigs"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
}

# -----------------------------------------------------------------------------
# What the AI team's « Agent Ready » pipeline may do in the cluster (Entra ID
# identity of modules/agent-ready, kubelogin). Namespaces, quotas, limits,
# the team's virtual key, ONE RoleBinding kind. RBAC cannot restrict by label:
# the admission policy below keeps every one of these operations inside team
# namespaces (label agentic.io/team), and Secrets in agentgateway-system to
# the vk-<team> keys.
# Known limit: Terraform reads back the Secrets it manages, hence "get".
# -----------------------------------------------------------------------------
resource "kubernetes_cluster_role" "team_provisioner" {
  count = var.ai_team_enabled ? 1 : 0
  metadata { name = "agentic-team-provisioner" }

  rule {
    api_groups = [""]
    resources  = ["namespaces", "resourcequotas", "limitranges", "secrets"]
    verbs      = ["get", "create", "update", "patch", "delete"]
  }
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["rolebindings"]
    verbs      = ["get", "create", "update", "patch", "delete"]
  }
  rule {
    # Without this, Kubernetes refuses a RoleBinding to permissions the
    # pipeline does not hold itself (privilege escalation check).
    api_groups     = ["rbac.authorization.k8s.io"]
    resources      = ["clusterroles"]
    verbs          = ["bind"]
    resource_names = ["agentic-team-deployer"]
  }
}

resource "kubernetes_cluster_role_binding" "team_provisioner" {
  count = var.ai_team_enabled ? 1 : 0
  metadata { name = "agentic-team-provisioner" }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.team_provisioner[0].metadata[0].name
  }
  subject {
    # AKS with Entra ID: a service principal / managed identity is identified
    # by its object ID (validate with `kubectl auth whoami` in the pipeline).
    api_group = "rbac.authorization.k8s.io"
    kind      = "User"
    name      = var.ai_team_principal_id
  }
}

resource "local_file" "team_provisioner_admission" {
  count    = var.ai_team_enabled ? 1 : 0
  filename = "${path.root}/.generated/agent-ready/admission.yaml"
  content  = templatefile("${path.module}/manifests/agent-ready-admission.yaml.tftpl", { principal_id = var.ai_team_principal_id })
}

resource "terraform_data" "team_provisioner_admission" {
  count            = var.ai_team_enabled ? 1 : 0
  triggers_replace = [local_file.team_provisioner_admission[0].content]

  provisioner "local-exec" {
    command = "kubectl apply -f ${local_file.team_provisioner_admission[0].filename}"
  }
}
