# -----------------------------------------------------------------------------
# « Agent Ready » — what the AI team gives a development team, in one apply.
# Run by .github/workflows/agent-ready.yml (environment « ai-team », approval
# required), one state per team: teams/<équipe>.tfstate.
#
#   Azure       two identities (pipeline · MCP server), federated, no secret
#               storage account (Entra ID only) + container « documents »
#               four role assignments, nothing else
#   Kubernetes  namespace (label agentic.io/team), quota, default limits,
#               virtual key for the gateway, RoleBinding agentic-team-deployer,
#               the slot of its GitHub token (démo D: filled by the platform)
#   GitHub      private repository agent-<équipe> from the standard template,
#               its Actions variables, two pipelines calling the AI team's
#               reusable workflows
# -----------------------------------------------------------------------------

locals {
  rg              = local.p.teams_resource_group_name
  repository      = "agent-${var.equipe}"
  storage_account = "st${substr(replace(var.equipe, "-", ""), 0, 14)}${substr(sha256("${local.p.subscription_id}/${var.equipe}"), 0, 8)}"
  mcp_target      = "docs-${var.equipe}"
  tags            = { equipe = var.equipe, "cree-par" = "agent-ready" }

  role_ids = {
    storage_blob_data_contributor = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
    storage_blob_data_reader      = "2a2b9908-6ea1-4ae2-8e65-a410df84e7d1"
    acr_push                      = "8311e382-0749-4cb8-b61a-304f252e45ec"
    aks_cluster_user              = "4abbcc35-e782-43d8-92c5-2d3f1bd2253f"
  }
  role_def = { for k, v in local.role_ids : k => "/subscriptions/${local.p.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/${v}" }
}

# =============================================================================
# Azure
# =============================================================================

# The team's PIPELINES: push the image, upload the documents, deploy.
resource "azurerm_user_assigned_identity" "pipeline" {
  name                = "id-${var.equipe}-pipeline"
  location            = local.p.location
  resource_group_name = local.rg
  tags                = local.tags
}

# Only the main branch of the team repository, AND only inside one of the AI
# team's two reusable workflows: the repository's OIDC subject carries
# job_workflow_ref (github_actions_repository_oidc_subject_claim_customization_template
# below). A workflow the team writes or rewrites itself — even on main — gets
# a subject no federation matches: no Azure token, no kubectl.
locals {
  reusable_workflows = {
    image       = "agent-image.yml"
    deploiement = "agent-deploy.yml"
  }
}

resource "azurerm_federated_identity_credential" "pipeline" {
  for_each                  = local.reusable_workflows
  name                      = "github-main-${each.key}"
  user_assigned_identity_id = azurerm_user_assigned_identity.pipeline.id
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.github_owner}/${local.repository}:ref:refs/heads/main:job_workflow_ref:${var.platform_repository}/.github/workflows/${each.value}@refs/heads/${var.platform_ref}"
  audience                  = ["api://AzureADTokenExchange"]
}

# The team's MCP SERVER (pod): reads its documents, nothing else.
resource "azurerm_user_assigned_identity" "mcp" {
  name                = "id-${var.equipe}-mcp"
  location            = local.p.location
  resource_group_name = local.rg
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "mcp" {
  name                      = "aks-docs-mcp"
  user_assigned_identity_id = azurerm_user_assigned_identity.mcp.id
  issuer                    = local.p.aks_oidc_issuer_url
  subject                   = "system:serviceaccount:${var.equipe}:docs-mcp"
  audience                  = ["api://AzureADTokenExchange"]
}

resource "azurerm_storage_account" "docs" {
  name                            = local.storage_account
  resource_group_name             = local.rg
  location                        = local.p.location
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  shared_access_key_enabled       = false # Entra ID only: no account key to leak
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"
  tags                            = local.tags
}

resource "azurerm_storage_container" "docs" {
  name                  = "documents"
  storage_account_id    = azurerm_storage_account.docs.id # management plane
  container_access_type = "private"
}

resource "azurerm_role_assignment" "pipeline_docs" {
  scope              = azurerm_storage_account.docs.id
  role_definition_id = local.role_def.storage_blob_data_contributor
  principal_id       = azurerm_user_assigned_identity.pipeline.principal_id
  principal_type     = "ServicePrincipal"
}

resource "azurerm_role_assignment" "pipeline_acr" {
  scope              = local.p.acr_id
  role_definition_id = local.role_def.acr_push
  principal_id       = azurerm_user_assigned_identity.pipeline.principal_id
  principal_type     = "ServicePrincipal"
}

resource "azurerm_role_assignment" "pipeline_aks" {
  scope              = local.p.aks_cluster_id
  role_definition_id = local.role_def.aks_cluster_user
  principal_id       = azurerm_user_assigned_identity.pipeline.principal_id
  principal_type     = "ServicePrincipal"
}

resource "azurerm_role_assignment" "mcp_docs" {
  scope              = azurerm_storage_account.docs.id
  role_definition_id = local.role_def.storage_blob_data_reader
  principal_id       = azurerm_user_assigned_identity.mcp.principal_id
  principal_type     = "ServicePrincipal"
}

# =============================================================================
# Kubernetes
# =============================================================================

resource "kubernetes_namespace" "equipe" {
  metadata {
    name = var.equipe
    labels = {
      "agentic.io/team"        = var.equipe # gateway discovery of its MCP servers, admission perimeter
      "agentic.io/agent-ready" = "true"
      # No privileged pod, hostPath or host network: the team deploys its own
      # Deployments, it must not be able to take a node. Required by the
      # admission policy agent-ready-perimetre, which also forbids removing it.
      "pod-security.kubernetes.io/enforce" = "baseline"
      "pod-security.kubernetes.io/warn"    = "restricted"
      "pod-security.kubernetes.io/audit"   = "restricted"
    }
  }
}

resource "kubernetes_resource_quota" "equipe" {
  metadata {
    name      = "quota-equipe"
    namespace = kubernetes_namespace.equipe.metadata[0].name
  }
  spec {
    hard = {
      "requests.cpu"    = "2"
      "requests.memory" = "4Gi"
      "limits.memory"   = "8Gi"
      pods              = "20"
    }
  }
}

resource "kubernetes_limit_range" "equipe" {
  metadata {
    name      = "defauts-equipe"
    namespace = kubernetes_namespace.equipe.metadata[0].name
  }
  spec {
    limit {
      type            = "Container"
      default         = { cpu = "500m", memory = "512Mi" }
      default_request = { cpu = "50m", memory = "128Mi" }
    }
  }
}

# The team's virtual key for /agents/v1 and /agents/mcp-entreprise: its copy
# (read by the kagent ModelConfig, and as an Authorization header by the
# RemoteMCPServer of démo D) and the gateway's copy (label + metadata team:
# cost attribution). Same format as terraform/modules/platform/teams.tf.
resource "random_password" "key" {
  length  = 40
  special = false
}

resource "kubernetes_secret" "gateway_key" {
  metadata {
    name      = "gateway-key"
    namespace = kubernetes_namespace.equipe.metadata[0].name
  }
  data = {
    key           = "sk-${var.equipe}-${random_password.key.result}"
    authorization = "Bearer sk-${var.equipe}-${random_password.key.result}" # kagent headersFrom takes a value as is
  }
}

resource "kubernetes_secret" "virtual_key" {
  metadata {
    name      = "vk-${var.equipe}"
    namespace = "agentgateway-system"
    labels    = { "agentic.io/virtual-key" = "true", "agentic.io/agent-ready" = "true" }
  }
  data = {
    (var.equipe) = jsonencode({ key = "sk-${var.equipe}-${random_password.key.result}", metadata = { team = var.equipe } })
  }
}

# Démo D — the slot of the team's GitHub token. The platform's issuer
# (tools/github-token-issuer, namespace jetons-github) writes in it, every 30
# minutes, a one-hour installation token restricted to <owner>/agent-<équipe>
# (a name it derives from this namespace itself, never from anything a team
# writes) and issues:write. The GitHub App's private key never enters here.
resource "kubernetes_secret" "github_token" {
  metadata {
    name      = "github-token"
    namespace = kubernetes_namespace.equipe.metadata[0].name
    labels    = { "agentic.io/github-token" = "true" }
  }
  data = {}

  lifecycle {
    ignore_changes = [data] # the issuer's, not Terraform's
  }
}

# The team's deployment pipeline: agentic-team-deployer, in ITS namespace only.
resource "kubernetes_role_binding" "deployer" {
  metadata {
    name      = "deployeur-github"
    namespace = kubernetes_namespace.equipe.metadata[0].name
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "agentic-team-deployer"
  }
  subject {
    # AKS with Entra ID: a managed identity is identified by its object ID
    # (the deployment pipeline prints `kubectl auth whoami`).
    api_group = "rbac.authorization.k8s.io"
    kind      = "User"
    name      = azurerm_user_assigned_identity.pipeline.principal_id
  }
}

# =============================================================================
# GitHub
# =============================================================================

resource "github_repository" "equipe" {
  name                   = local.repository
  description            = substr(var.description, 0, 200)
  visibility             = "private"
  auto_init              = true
  has_issues             = true
  has_wiki               = false
  delete_branch_on_merge = true
  vulnerability_alerts   = true
  archive_on_destroy     = false
}

# OIDC subject of this repository's workflows: repo + ref + the workflow file
# that actually runs (job_workflow_ref). VÉRIFIER (D-7): the subject printed by
# `azure/login` in « 1 · Image » equals the federation above.
resource "github_actions_repository_oidc_subject_claim_customization_template" "equipe" {
  repository         = github_repository.equipe.name
  use_default        = false
  include_claim_keys = ["repo", "context", "job_workflow_ref"]
}

locals {
  variables = {
    EQUIPE                = var.equipe
    AZURE_CLIENT_ID       = azurerm_user_assigned_identity.pipeline.client_id
    AZURE_TENANT_ID       = local.p.tenant_id
    AZURE_SUBSCRIPTION_ID = local.p.subscription_id
    ACR_NAME              = local.p.acr_name
    AKS_NAME              = local.p.aks_cluster_name
    AKS_RESOURCE_GROUP    = local.p.resource_group_name
    STORAGE_ACCOUNT       = azurerm_storage_account.docs.name
  }

  # The standard template, rendered for this team (placeholders __X__ so that
  # ${{ }} in workflows and ${VAR} in shell stay untouched).
  template_dir   = "${path.module}/template"
  template_files = [for f in fileset(local.template_dir, "**") : f if !strcontains(f, "__pycache__")]
  rendered = {
    for f in local.template_files : f => replace(replace(replace(replace(replace(replace(replace(replace(
      file("${local.template_dir}/${f}"),
      "__EQUIPE__", var.equipe),
      "__CLIENT_ID__", azurerm_user_assigned_identity.mcp.client_id),
      "__TENANT_ID__", local.p.tenant_id),
      "__ACR__", local.p.acr_login_server),
      "__STORAGE__", azurerm_storage_account.docs.name),
      "__MCP_TARGET__", local.mcp_target),
      "__PLATFORM_REPO__", var.platform_repository),
    "__PLATFORM_REF__", var.platform_ref)
  }
  workflows = { for f, c in local.rendered : f => c if startswith(f, ".github/") }
  content   = { for f, c in local.rendered : f => c if !startswith(f, ".github/") }
}

resource "github_actions_variable" "equipe" {
  for_each      = local.variables
  repository    = github_repository.equipe.name
  variable_name = each.key
  value         = each.value
}

resource "github_repository_file" "content" {
  for_each            = local.content
  repository          = github_repository.equipe.name
  branch              = "main"
  file                = each.key
  content             = each.value
  commit_message      = "Agent Ready : ${each.key}"
  commit_author       = "Agent Ready (équipe IA)"
  commit_email        = "agent-ready@users.noreply.github.com"
  overwrite_on_create = true

  # The team owns these files once created: re-running Agent Ready must not
  # overwrite its agent, its documents or its MCP server.
  lifecycle {
    ignore_changes = [content]
  }
}

# The pipelines last: no run is triggered while the repository is being
# filled; the team's first push (or a manual run) starts them.
resource "github_repository_file" "workflows" {
  for_each            = local.workflows
  repository          = github_repository.equipe.name
  branch              = "main"
  file                = each.key
  content             = each.value
  commit_message      = "Agent Ready : pipelines (${each.key})"
  commit_author       = "Agent Ready (équipe IA)"
  commit_email        = "agent-ready@users.noreply.github.com"
  overwrite_on_create = true

  depends_on = [
    github_repository_file.content,
    github_actions_variable.equipe,
    github_actions_repository_oidc_subject_claim_customization_template.equipe,
  ]
}
