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
    name = each.value
    labels = {
      "agentic.io/team" = each.value
      # No privileged pod, hostPath or host network in a team namespace: a
      # team deploys its own Deployments, it must not be able to take a node.
      # « restricted » is reported (warn, audit) — not enforced, because the
      # pods kagent generates for agents are not all restricted-compliant.
      "pod-security.kubernetes.io/enforce" = "baseline"
      "pod-security.kubernetes.io/warn"    = "restricted"
      "pod-security.kubernetes.io/audit"   = "restricted"
    }
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
    # Read only: the team's NetworkPolicies (egress equipe-sorties above all)
    # are created by Agent Ready (terraform/teams), never by the team — with
    # write access it would delete them and reach IMDS, the wireserver and
    # every internal service again.
    api_groups = ["networking.k8s.io"]
    resources  = ["networkpolicies"]
    verbs      = ["get", "list", "watch"]
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
# NetworkPolicies, the team's Secrets, ONE RoleBinding kind. RBAC cannot
# restrict by label: the admission policy below keeps every write inside team
# namespaces (label agentic.io/team), and Secrets in agentgateway-system to
# the vk-<team> keys.
# Secrets, least privilege — Terraform reads back what it manages, and the
# admission policy only sees writes, never reads:
#   - create: RBAC cannot restrict it by name (the name is in the body), it
#     stays cluster-wide, bounded by the admission policy;
#   - get/update/patch/delete: the two names terraform/teams creates in a team
#     namespace (gateway-key, github-token) — never jetons-github/github-app,
#     LibreChat, Entra, ACME or Grafana secrets;
#   - the vk-<team> copies: a Role in agentgateway-system only (below).
# Remaining limit: gateway-key and github-token are readable in EVERY
# namespace that has them (kagent's platform key, the var.teams namespaces).
# -----------------------------------------------------------------------------
resource "kubernetes_cluster_role" "team_provisioner" {
  count = var.ai_team_enabled ? 1 : 0
  metadata { name = "agentic-team-provisioner" }

  rule {
    api_groups = [""]
    resources  = ["namespaces", "resourcequotas", "limitranges"]
    verbs      = ["get", "create", "update", "patch", "delete"]
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["create"]
  }
  rule {
    api_groups     = [""]
    resources      = ["secrets"]
    verbs          = ["get", "update", "patch", "delete"]
    resource_names = ["gateway-key", "github-token"]
  }
  rule {
    # The team's NetworkPolicies (terraform/teams): ingress of its MCP server,
    # egress of every pod. The admission policy keeps them in team namespaces.
    api_groups = ["networking.k8s.io"]
    resources  = ["networkpolicies"]
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

# The vk-<team> copies, in agentgateway-system only. Names are not known in
# advance (one per team), so this Role covers every Secret of the namespace;
# the admission policy limits writes and deletes to vk-* keys labelled
# agentic.io/agent-ready. Remaining limit: READS of the other Secrets of
# agentgateway-system (platform virtual keys, certificates of the public
# listeners when public_exposure is set). Closing it: virtual keys in a
# namespace of their own, if the gateway's secretSelector allows it
# (VÉRIFIER, agentgateway v1.5.0).
resource "kubernetes_role" "team_provisioner_keys" {
  count = var.ai_team_enabled ? 1 : 0
  metadata {
    name      = "agentic-team-provisioner-cles"
    namespace = kubernetes_namespace.this["agentgateway-system"].metadata[0].name
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get", "update", "patch", "delete"]
  }
}

resource "kubernetes_role_binding" "team_provisioner_keys" {
  count      = var.ai_team_enabled ? 1 : 0
  depends_on = [kubernetes_manifest.admission]
  metadata {
    name      = "agentic-team-provisioner-cles"
    namespace = kubernetes_namespace.this["agentgateway-system"].metadata[0].name
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.team_provisioner_keys[0].metadata[0].name
  }
  subject {
    api_group = "rbac.authorization.k8s.io"
    kind      = "User"
    name      = var.ai_team_principal_id
  }
}

resource "kubernetes_cluster_role_binding" "team_provisioner" {
  count      = var.ai_team_enabled ? 1 : 0
  depends_on = [kubernetes_manifest.admission]
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

# Admission policies, applied by the Kubernetes provider itself (its own
# credentials, never the ambient kubectl context) and destroyed with the
# platform. The provisioner's binding waits for its policy: the pipeline never
# holds its rights without the perimeter around them.
locals {
  # Names no Agent Ready team may take (the platform's, created before or after).
  # AKS add-ons included (kube-* and agentgateway* are refused by prefix).
  noms_reserves = ["default", "kagent", "monitoring", "librechat", "agentregistry", "platform", "plateforme",
    "outils-entreprise", "models", "cert-manager", "jetons-github",
  "gatekeeper-system", "app-routing-system", "aks-command", "calico-system", "tigera-operator"]

  # replace() : sous Windows, git (core.autocrlf) extrait les fichiers en CRLF ;
  # sans normalisation, « \n---\n » ne coupe rien et yamldecode reçoit tout le fichier.
  admission_docs = concat(
    var.ai_team_enabled ? [
      for d in split("\n---\n", replace(templatefile("${path.module}/manifests/agent-ready-admission.yaml.tftpl", {
        principal_id  = var.ai_team_principal_id
        noms_reserves = jsonencode(local.noms_reserves)
      }), "\r\n", "\n")) : yamldecode(d)
    ] : [],
    [for d in split("\n---\n", replace(file("${path.module}/manifests/equipes-admission.yaml"), "\r\n", "\n")) : yamldecode(d)],
  )
  admission = { for d in local.admission_docs : "${d.kind}/${d.metadata.name}" => d }
}

resource "kubernetes_manifest" "admission" {
  for_each = local.admission
  manifest = each.value
}
