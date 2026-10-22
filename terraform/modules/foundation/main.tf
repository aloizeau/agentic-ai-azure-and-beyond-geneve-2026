resource "azurerm_resource_group" "this" {
  name     = "rg-${var.base}"
  location = var.location
  tags     = var.tags
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "log-${var.base}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_virtual_network" "this" {
  name                = "vnet-${var.base}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  address_space       = ["10.40.0.0/16"]
  tags                = var.tags
}

resource "azurerm_subnet" "aks" {
  name                 = "snet-aks"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = ["10.40.0.0/20"]
}

# Static public IP for the public agentgateway Gateway (root variable public_exposure).
# Declared before the cluster and depended on by it, so that `terraform destroy`
# deletes the cluster — and the load balancer holding this IP — first.
resource "azurerm_public_ip" "gateway" {
  count = var.public_ip_enabled ? 1 : 0

  name                = "pip-${var.base}-gateway"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_kubernetes_cluster" "this" {
  name                = "aks-${var.base}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  dns_prefix          = var.base
  kubernetes_version  = var.kubernetes_version
  sku_tier            = var.aks_sku_tier
  node_resource_group = "rg-${var.base}-nodes"

  # The two flags the whole keyless story depends on. oidc_issuer_enabled
  # publishes the cluster's OIDC discovery document, which Entra ID federates
  # against; workload_identity_enabled installs the mutating webhook that
  # projects the service-account token into pods.
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  # AKS AI toolchain operator add-on (KAITO): serves open models with vLLM and
  # provisions the GPU node each Workspace asks for. Needs the OIDC issuer.
  ai_toolchain_operator_enabled = var.ai_toolchain_operator_enabled

  role_based_access_control_enabled = true
  # PoC: the presenter and Terraform use the admin kubeconfig. Its client
  # certificate cannot be revoked and lives in the Terraform state: in
  # production, set true and grant aks_admin_group_object_ids instead.
  local_account_disabled = false

  # Who may reach the API server at all. Empty = the whole internet, then only
  # authentication protects it: set your workstation and CI egress ranges.
  dynamic "api_server_access_profile" {
    for_each = length(var.api_server_authorized_ip_ranges) > 0 ? [1] : []
    content {
      authorized_ip_ranges = var.api_server_authorized_ip_ranges
    }
  }

  # Microsoft Entra ID authentication, two authorizers side by side:
  #   - Azure RBAC (azure_rbac_enabled): Azure role assignments on the cluster,
  #     here the identity running Terraform (azurerm_role_assignment.cluster_admin) ;
  #   - Kubernetes RBAC, still evaluated when Azure RBAC has no opinion: the
  #     "Agent Ready" teams (démo B, terraform/teams) sign in with their own
  #     managed identity (OIDC, no secret) and get exactly one RoleBinding in
  #     their own namespace.
  # Enabling Entra ID on an existing cluster is in place but one-way.
  # Presenter and Terraform keep the admin kubeconfig (--admin) as well.
  azure_active_directory_role_based_access_control {
    tenant_id              = var.tenant_id
    azure_rbac_enabled     = true
    admin_group_object_ids = var.aks_admin_group_object_ids
  }

  default_node_pool {
    name            = "system"
    vm_size         = var.system_node_vm_size
    node_count      = var.system_node_count
    vnet_subnet_id  = azurerm_subnet.aks.id
    os_disk_size_gb = 64
    os_sku          = "AzureLinux"
    max_pods        = 60
    upgrade_settings { max_surge = "10%" }

    # Lets AKS change the node SKU in place: it spins up this temporary pool,
    # drains onto it, then recreates "system" on the new vm_size.
    temporary_name_for_rotation = "systmp"
  }

  identity { type = "SystemAssigned" }

  # Required block in azurerm 5. Manual = classic node pools, as declared here;
  # KAITO brings its own GPU provisioner, so node auto-provisioning stays off.
  node_provisioning_profile {
    mode = "Manual"
  }

  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_policy      = "cilium"
    network_data_plane  = "cilium"
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
  }

  oms_agent {
    log_analytics_workspace_id      = azurerm_log_analytics_workspace.this.id
    msi_auth_for_monitoring_enabled = true
  }

  workload_autoscaler_profile { keda_enabled = false }

  tags = var.tags

  depends_on = [azurerm_public_ip.gateway]

  lifecycle {
    ignore_changes = [
      # AKS patches the node image continuously; do not fight it.
      default_node_pool[0].node_count,
      kubernetes_version,
    ]
  }
}

# The identity running Terraform administers the whole cluster, on both planes:
#   - Kubernetes API (data plane): every resource, every namespace, through
#     Entra ID (kubelogin, no --admin) — needs azure_rbac_enabled above;
#   - AKS resource (control plane): upgrades, node pools, add-ons, and the
#     admin and user kubeconfigs (listClusterAdminCredential, the credentials
#     the kubernetes and helm providers use).
# null (root variable aks_admin_current_principal = false, CI): no assignment —
# the CI identity may only grant the roles listed in its ABAC condition.
# Azure role assignments take up to 5 minutes to reach the Kubernetes API.
locals {
  cluster_admin_roles = var.admin_principal_object_id == null ? {} : {
    kubernetes_api   = "Azure Kubernetes Service RBAC Cluster Admin"
    admin_kubeconfig = "Azure Kubernetes Service Cluster Admin Role"
    control_plane    = "Azure Kubernetes Service Contributor Role"
  }
}

resource "azurerm_role_assignment" "cluster_admin" {
  for_each = local.cluster_admin_roles

  scope                = azurerm_kubernetes_cluster.this.id
  role_definition_name = each.value
  principal_id         = var.admin_principal_object_id
  description          = "Identity running Terraform: administers the AKS cluster (${each.key})."
}

# Optional Spot pool. Cheaper by ~82% but evictable on 30s notice, so it is off
# by default and should stay off for the live demo.
resource "azurerm_kubernetes_cluster_node_pool" "spot" {
  count = var.use_spot_nodes ? 1 : 0

  name                  = "spot"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.this.id
  vm_size               = var.system_node_vm_size
  node_count            = 1
  vnet_subnet_id        = azurerm_subnet.aks.id
  priority              = "Spot"
  eviction_policy       = "Delete"
  spot_max_price        = -1 # pay up to the on-demand price
  os_sku                = "AzureLinux"

  node_labels = {
    "kubernetes.azure.com/scalesetpriority" = "spot"
  }
  node_taints = [
    "kubernetes.azure.com/scalesetpriority=spot:NoSchedule"
  ]

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Container registry for the platform's and the teams' images (team MCP
# servers pushed by their pipelines, guardrail adapter).
# No admin user: pushes use Entra ID (az acr build, OIDC), the nodes pull with
# the kubelet identity.
# -----------------------------------------------------------------------------
resource "azurerm_container_registry" "this" {
  name                = "acr${var.base}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "Standard"
  admin_enabled       = false
  tags                = var.tags
}

resource "azurerm_role_assignment" "kubelet_acr_pull" {
  scope                = azurerm_container_registry.this.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.this.kubelet_identity[0].object_id
  principal_type       = "ServicePrincipal"
}
