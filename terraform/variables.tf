# -----------------------------------------------------------------------------
# Core
# -----------------------------------------------------------------------------
variable "subscription_id" {
  description = "Azure subscription ID the PoC is deployed into."
  type        = string
}

variable "name_prefix" {
  description = "Short prefix for all resource names. Lowercase alphanumeric, 3-10 chars."
  type        = string
  default     = "agwpoc"
  validation {
    condition     = can(regex("^[a-z0-9]{3,10}$", var.name_prefix))
    error_message = "name_prefix must be 3-10 lowercase alphanumeric characters."
  }
}

variable "location" {
  description = <<-EOT
    Azure region. Sweden Central is the default because it carries the model
    catalogue needed by the demo and offers DataZoneStandard deployments, which
    the sovereignty scenario depends on.
  EOT
  type        = string
  default     = "swedencentral"
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default = {
    project   = "agentic-ai-platform-poc"
    event     = "chalet-azure-romandie-2026"
    managedBy = "terraform"
    lifecycle = "ephemeral"
  }
}

# -----------------------------------------------------------------------------
# AKS
# -----------------------------------------------------------------------------
variable "kubernetes_version" {
  description = "AKS version. null = let AKS pick the current default."
  type        = string
  default     = null
}

variable "aks_sku_tier" {
  description = <<-EOT
    Free | Standard | Premium. Free costs nothing for cluster management and
    supports up to 1000 nodes; it only lacks the financially-backed API server
    SLA, which a demo does not need. Standard is ~USD 73/month.
  EOT
  type        = string
  default     = "Free"
  validation {
    condition     = contains(["Free", "Standard", "Premium"], var.aks_sku_tier)
    error_message = "aks_sku_tier must be Free, Standard or Premium."
  }
}

variable "system_node_vm_size" {
  # D4as_v5 (AMD) is the cheapest non-burstable 4 vCPU/16 GB SKU available and
  # unrestricted in Sweden Central ($0.184/h vs $0.204/h for the Intel D4s_v5),
  # same capacity, its own DASv5 quota bucket.
  description = "VM size for the system node pool."
  type        = string
  default     = "Standard_D4as_v5"
}

variable "system_node_count" {
  description = <<-EOT
    Node count. 2 x Standard_D4as_v5 = 8 vCPU, which fits the default 20 vCPU
    regional quota of a small subscription and is enough for agentgateway,
    kagent, agentregistry, LibreChat + MongoDB and kube-prometheus-stack.
  EOT
  type        = number
  default     = 2
}

variable "use_spot_nodes" {
  description = <<-EOT
    Add a Spot user node pool for the demo workloads (~82% cheaper). Useful on a
    credit-limited subscription, but Spot nodes can be evicted with 30s notice:
    leave this false for the live demo and use it while building.
  EOT
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Microsoft Foundry (formerly Azure AI Foundry)
# -----------------------------------------------------------------------------
variable "model_deployments" {
  description = <<-EOT
    The failover ladder. Each rung is a real deployment so the live demo can walk
    down it. `sku_name` is what carries the sovereignty meaning:
      GlobalStandard   - inference may be processed in ANY Azure region worldwide
      DataZoneStandard - processed only inside the EU data zone
      Standard         - processed inside the Azure geography only
    `capacity` is in THOUSANDS of tokens per minute. Microsoft's own sample uses
    capacity = 1 (1K TPM), which rate-limits a single streaming chat - do not
    copy it.
  EOT
  type = map(object({
    model_name    = string
    model_version = optional(string)
    model_format  = string
    sku_name      = string
    capacity      = number
    rung          = string
    enabled       = optional(bool, true)
  }))
  default = {
    "gpt-56-sol-global" = {
      model_name    = "gpt-5.6-sol"
      model_version = "2026-07-09"
      model_format  = "OpenAI"
      sku_name      = "GlobalStandard"
      capacity      = 50
      rung          = "1 - frontier model for complex work, worldwide processing"
    }
    "gpt-56-terra-eu" = {
      model_name    = "gpt-5.6-terra"
      model_version = "2026-07-09"
      model_format  = "OpenAI"
      sku_name      = "DataZoneStandard"
      capacity      = 50
      rung          = "2 - balanced daily production model, EU-only processing"
    }
    "gpt-56-luna-eu" = {
      model_name    = "gpt-5.6-luna"
      model_version = "2026-07-09"
      model_format  = "OpenAI"
      sku_name      = "DataZoneStandard"
      capacity      = 50
      rung          = "3 - fast economical high-volume fallback, EU-only processing"
    }
    "model-router-eu" = {
      model_name    = "model-router"
      model_version = "2025-11-18"
      model_format  = "OpenAI"
      sku_name      = "DataZoneStandard"
      capacity      = 50
      rung          = "Microsoft - automatic model routing, EU-only processing"
    }
    "mai-image-26-global" = {
      model_name    = "MAI-Image-2.6"
      model_version = "2026-07-31"
      model_format  = "Microsoft"
      sku_name      = "GlobalStandard"
      capacity      = 1
      rung          = "Microsoft - latest available MAI image model (Preview)"
    }

    # Anthropic models are Azure Marketplace offers. This subscription has
    # quota for Opus and Haiku, but no payment instrument, so keep every offer
    # disabled until Marketplace purchase eligibility is fixed. Fable and
    # Sonnet additionally have zero quota in Sweden Central.
    "claude-opus-55-global" = {
      model_name    = "claude-opus-5-5"
      model_version = "2"
      model_format  = "Anthropic"
      sku_name      = "GlobalStandard"
      capacity      = 10
      rung          = "Anthropic - frontier model (Marketplace)"
      enabled       = false
    }
    "claude-fable-51-global" = {
      model_name    = "claude-fable-5-1"
      model_version = "1"
      model_format  = "Anthropic"
      sku_name      = "GlobalStandard"
      capacity      = 10
      rung          = "Anthropic - Preview, zero quota (Marketplace)"
      enabled       = false
    }
    "claude-haiku-45-global" = {
      model_name    = "claude-haiku-4-5"
      model_version = "2"
      model_format  = "Anthropic"
      sku_name      = "GlobalStandard"
      capacity      = 20
      rung          = "Anthropic - fast economical model (Marketplace)"
      enabled       = false
    }
    "claude-sonnet-5-global" = {
      model_name    = "claude-sonnet-5"
      model_version = "2"
      model_format  = "Anthropic"
      sku_name      = "GlobalStandard"
      capacity      = 10
      rung          = "Anthropic - zero quota (Marketplace)"
      enabled       = false
    }

    # Mistral chat models also require an Azure Marketplace purchase. Both
    # have 20K TPM quota, but deployment fails on this subscription until a
    # valid payment instrument is associated with it.
    "mistral-medium-2505-global" = {
      model_name    = "mistral-medium-2505"
      model_version = "1"
      model_format  = "Mistral AI"
      sku_name      = "GlobalStandard"
      capacity      = 20
      rung          = "Mistral - balanced model (Marketplace)"
      enabled       = false
    }
    "mistral-small-2503-global" = {
      model_name    = "mistral-small-2503"
      model_version = "1"
      model_format  = "Mistral AI"
      sku_name      = "GlobalStandard"
      capacity      = 20
      rung          = "Mistral - small model (Marketplace)"
      enabled       = false
    }
  }
}

# -----------------------------------------------------------------------------
# Entra ID
# -----------------------------------------------------------------------------
variable "public_exposure" {
  description = <<-EOT
    Public exposure through agentgateway, a static public IP and Cloudflare DNS.
    null (default) = nothing public: port-forward only. Example:

      public_exposure = { zone = "shift-cloud.io", subdomain = "demos" }

    publishes, each with a Let's Encrypt certificate:
      https://demos.<zone>          LibreChat (Entra ID sign-in)
      https://grafana.demos.<zone>  Grafana, behind oauth2-proxy (Entra ID)
      https://kagent.demos.<zone>   kagent UI, behind oauth2-proxy (Entra ID)
      https://api.demos.<zone>      /v1 and /agents/v1, only with expose_api = true

    DNS records are "DNS only" (grey cloud): Cloudflare's free Universal SSL does
    not cover second-level names such as grafana.demos.<zone>.
    Needs CLOUDFLARE_API_TOKEN in the environment (Zone:Read + DNS:Edit on the zone).
  EOT
  type = object({
    zone       = string
    subdomain  = optional(string, "demos")
    acme_email = optional(string)
    expose_api = optional(bool, false) # the LLM API on the internet: opt in
  })
  default = null
}

variable "authorized_principal_object_ids" {
  description = <<-EOT
    Entra ID users or groups (object IDs) allowed to sign in: gateway API (models,
    tools, the Azure CLI token of the demos), LibreChat and the portal in front of
    Grafana and the kagent UI. The identity running Terraform is added too, unless
    assign_current_principal = false. Every one of these apps requires an
    assignment: the rest of the tenant, guests included, is refused by Entra ID.
  EOT
  type        = list(string)
  default     = []
}

variable "assign_current_principal" {
  description = <<-EOT
    Allow the identity running Terraform to sign in (app role assignment on the
    gateway API, LibreChat and the portal). true: the presenter's workstation.
    false in CI: the CI identity is not a person, and the assignments would
    change with whoever runs the apply (a CI apply would remove the presenter's
    — AADSTS50105). With false, put the presenter (or a group) in
    authorized_principal_object_ids: it must not be empty.
  EOT
  type        = bool
  default     = true
}

variable "create_entra_apps" {
  description = "Create the Entra ID app registrations. Needs permission to create applications in the tenant."
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Platform (phase 2)
# -----------------------------------------------------------------------------
variable "deploy_platform" {
  description = <<-EOT
    Two-phase apply. false = infrastructure only (phase 1). true = also install
    the Helm charts (phase 2). The Kubernetes and Helm providers cannot be
    configured from resources that do not exist yet, so the first apply on an
    empty state must run with this false.
  EOT
  type        = bool
  default     = false
}

variable "chart_versions" {
  description = "Pinned chart versions. Never float these for a conference demo."
  type        = map(string)
  default = {
    gateway_api           = "1.6.0"
    agentgateway          = "v1.5.0"
    kagent                = "0.10.1"
    kube_prometheus_stack = "91.4.1"
    librechat             = "2.0.14" # v0.8.8-rc4: needed for OPENID_REUSE_TOKENS
    cert_manager          = "v1.21.2"
    oauth2_proxy          = "10.7.0" # oauth2-proxy v7.15.3 (Grafana; kagent uses its bundled sub-chart)
    agentregistry         = "0.4.0"  # agentregistry v0.4.0 (2026-08-03), oci://ghcr.io/agentregistry-dev/agentregistry/charts
  }
}

# -----------------------------------------------------------------------------
# Guardrails — R&D target
# -----------------------------------------------------------------------------
variable "enable_nemo_guardrails" {
  description = <<-EOT
    Deploy NVIDIA NeMo Guardrails behind agentgateway (webhook guard + adapter,
    library mode, Apache-2.0). This is the TARGET architecture, currently in R&D:
    in production today the guardrails are the Microsoft Foundry content filters.
    Off by default: the adapter image must be built and pushed first
    (guardrail-adapter workflow), because the webhook is fail-closed — with no
    adapter running, every LLM request would be rejected.
  EOT
  type        = bool
  default     = false
}

variable "guardrail_adapter_image" {
  description = "Container image of the NeMo Guardrails adapter (built by the guardrail-adapter workflow)."
  type        = string
  default     = "ghcr.io/OWNER/nemo-guardrail-adapter:0.1.0"
}

# -----------------------------------------------------------------------------
# Self-hosted models (KAITO) — optional
# -----------------------------------------------------------------------------
variable "enable_self_hosted_models" {
  description = <<-EOT
    Enable the AKS AI toolchain operator add-on (KAITO) and serve
    microsoft/Phi-4-mini-instruct inside the cluster, behind agentgateway on
    /aks/v1. Off by default: needs GPU quota and a GPU node costs ~4 $/hour.
    See models/README.md.
  EOT
  type        = bool
  default     = false
}

variable "self_hosted_gpu_instance_type" {
  description = "GPU VM size KAITO provisions for the model. Ampere or newer (no T4/V100)."
  type        = string
  default     = "Standard_NV36ads_A10_v5"

  validation {
    condition     = startswith(var.self_hosted_gpu_instance_type, "Standard_N")
    error_message = "KAITO needs an NVIDIA GPU size (Standard_N*)."
  }
}

# -----------------------------------------------------------------------------
# Enterprise MCP tools — optional
# -----------------------------------------------------------------------------
variable "enable_enterprise_tools" {
  description = <<-EOT
    Publish self-hosted enterprise MCP servers (Grafana, Azure, Microsoft Graph)
    behind agentgateway, and add GitHub (per-user OAuth) and Microsoft Learn
    (no auth) as direct LibreChat MCP servers. Off by default: the self-hosted
    ones need credentials created out of band (tools/enterprise/run.sh).
    See tools/enterprise.
  EOT
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Teams — onboarding a team is one line here
# -----------------------------------------------------------------------------
variable "teams" {
  description = "Teams that get a namespace and a gateway virtual key for their agents (/agents/v1)."
  type        = list(string)
  default     = ["equipe-produit"]

  validation {
    condition     = alltrue([for t in var.teams : can(regex("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$", t)) && t != "platform"])
    error_message = "Team names must be DNS labels, and \"platform\" is reserved for kagent's own agents."
  }
}

# -----------------------------------------------------------------------------
# « Agent Ready » teams (démo B)
# -----------------------------------------------------------------------------
variable "ai_team_github_repository" {
  description = <<-EOT
    owner/repo of THIS repository on GitHub. Creates the identity of the AI
    team's « Agent Ready » pipeline (.github/workflows/agent-ready.yml), federated
    with its « ai-team » environment only, and its bounded rights (Azure and
    Kubernetes). null: no pipeline; the terraform/teams stack can still be run
    by hand.
  EOT
  type        = string
  default     = null
}

variable "ai_team_manage_role_assignments" {
  description = <<-EOT
    Who gives the AI team identity its Azure roles (Contributor on
    rg-<base>-equipes, RBAC Administrator under an ABAC condition).
    true: Terraform — a person with Owner runs it (./scripts/deploy.ps1).
    false: the CI apply identity, which may not hand out these two roles
    (scripts/bootstrap-state.sh), leaves them alone; a person with Owner
    creates them once with demos/B-agent-equipe/prepare.ps1 (output
    ai_team_role_assignments). Switching an existing state to false: first
    `terraform state rm` the two module.agent_ready role assignments, or the
    apply tries to delete them.
  EOT
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# AKS API authentication (Entra ID)
# -----------------------------------------------------------------------------
variable "aks_admin_group_object_ids" {
  description = "Entra ID groups bound to cluster-admin on the AKS API (Entra ID authentication is on). Empty: admin kubeconfig only (az aks get-credentials --admin)."
  type        = list(string)
  default     = []
}

variable "aks_admin_current_principal" {
  description = <<-EOT
    Grant the identity running Terraform full administration of the AKS cluster,
    on the cluster scope: Azure Kubernetes Service RBAC Cluster Admin (Kubernetes
    API through Entra ID: kubelogin, no --admin), Cluster Admin Role (kubeconfigs)
    and Contributor Role (upgrades, node pools, add-ons). true: the presenter's
    workstation (Owner). false in CI: the CI identity may only grant the roles of
    its ABAC condition (scripts/bootstrap-state.sh), and its Contributor on the
    subscription already covers the AKS resource and the admin kubeconfig.
  EOT
  type        = bool
  default     = true
}

variable "aks_api_authorized_ip_ranges" {
  description = <<-EOT
    CIDR ranges allowed to reach the AKS API server (your workstation, the CI
    runners' egress). Empty (default) = reachable from the internet, protected
    by authentication only. Example: ["203.0.113.10/32"].
  EOT
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Usage monitoring (Grafana dashboard monitoring/dashboards/usage-ia.json)
# -----------------------------------------------------------------------------
variable "usage_metrics_per_user" {
  description = <<-EOT
    Add a `user` label (Entra ID preferred_username) to the gateway metrics, so
    the usage dashboard can show tokens, cost and tools per person. One
    Prometheus series per user x model x route: right for a demo or a pilot.
    For thousands of users, set false (team, model, cost and tools remain) and
    keep per-user detail in the access logs / OpenTelemetry.
  EOT
  type        = bool
  default     = true
}
