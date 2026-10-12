# -----------------------------------------------------------------------------
# LibreChat — the front end people use. Entra ID sign-in (authorization code
# flow); OPENID_REUSE_TOKENS forwards the user's access token to the gateway,
# which validates it on /v1 (policy `acces-llm`). Per-user identity reaches the
# gateway: that is what makes per-user metering and a 401 without a session.
#
# OPENID_REUSE_TOKENS and the {{LIBRECHAT_OPENID_ACCESS_TOKEN}} placeholder are
# in the v0.8.8 release candidates (chart 2.0.14 = v0.8.8-rc4), not in v0.8.7.
#
# Not exposed on the internet by default: with public_hostname = null, reach it
# with `kubectl -n librechat port-forward svc/librechat 3080:3080` and open
# http://localhost:3080 — a redirect URI already registered in Entra ID.
# With public exposure, public_hostname is demos.<zone> (root variable public_exposure).
# -----------------------------------------------------------------------------

locals {
  librechat_url = var.public_hostname == null ? "http://localhost:3080" : "https://${var.public_hostname}"
  gateway_url   = "http://agentgateway-proxy.agentgateway-system.svc.cluster.local"

  librechat_config = {
    version = "1.3.17"
    cache   = true
    interface = {
      endpointsMenu = true
    }
    # kagent exposes every agent as MCP tools on :8083/mcp — this is how an
    # agent a team just applied shows up in LibreChat (Démo B), with no ticket.
    # LibreChat reaches it through the gateway (/mcp, backend `mcp`) with the
    # user's Entra ID token: the gateway checks it and counts every tool call
    # per user (Grafana dashboard "Usage IA", monitoring/).
    mcpSettings = {
      allowedDomains = concat(
        [local.gateway_url],
        # GitHub (OAuth par utilisateur) et Microsoft Learn (sans auth) sont des
        # serveurs MCP distants, appelés directement par LibreChat.
        var.enable_enterprise_tools ? ["https://api.githubcopilot.com", "https://learn.microsoft.com"] : [],
      )
    }
    mcpServers = merge(
      {
        agents = {
          type    = "streamable-http"
          url     = "${local.gateway_url}/mcp"
          headers = { Authorization = "Bearer {{LIBRECHAT_OPENID_ACCESS_TOKEN}}" }
          timeout = 300000 # invoke_agent waits for the agent's whole answer (route timeout 300s)
        }
        # Recherche web (DuckDuckGo) — serveur MCP gratuit publié par la plateforme
        # (gateway/deploy/web-search.yaml), atteint par la gateway sur /mcp-web avec
        # le jeton Entra ID de l'utilisateur : mêmes contrôles et même comptage que
        # les modèles. Outils : search, fetch_content, expand_link.
        recherche-web = {
          type    = "streamable-http"
          url     = "${local.gateway_url}/mcp-web"
          headers = { Authorization = "Bearer {{LIBRECHAT_OPENID_ACCESS_TOKEN}}" }
          timeout = 60000 # fetch_content d'une page peut être lent (route timeout 60s)
        }
        # Outils publiés par les équipes (démo B) : un seul serveur côté LibreChat,
        # alimenté par la passerelle qui découvre les serveurs MCP des équipes par
        # label. Une nouvelle équipe n'ajoute rien ici. Outils préfixés par la cible.
        outils-equipes = {
          type    = "streamable-http"
          url     = "${local.gateway_url}/mcp-equipes"
          headers = { Authorization = "Bearer {{LIBRECHAT_OPENID_ACCESS_TOKEN}}" }
          timeout = 60000
        }
      },
      # Outils d'entreprise auto-hébergés, via la gateway (jeton Entra ID, comptés
      # dans le dashboard). Option enable_enterprise_tools (tools/enterprise).
      { for k, v in {
        grafana = {
          type    = "streamable-http"
          url     = "${local.gateway_url}/mcp-grafana"
          headers = { Authorization = "Bearer {{LIBRECHAT_OPENID_ACCESS_TOKEN}}" }
          timeout = 60000
        }
        azure = {
          type    = "streamable-http"
          url     = "${local.gateway_url}/mcp-azure"
          headers = { Authorization = "Bearer {{LIBRECHAT_OPENID_ACCESS_TOKEN}}" }
          timeout = 60000
        }
        sharepoint = {
          type    = "streamable-http"
          url     = "${local.gateway_url}/mcp-graph"
          headers = { Authorization = "Bearer {{LIBRECHAT_OPENID_ACCESS_TOKEN}}" }
          timeout = 60000
        }
      } : k => v if var.enable_enterprise_tools },
      # Serveurs MCP distants : GitHub en OAuth PAR UTILISATEUR (chacun son compte,
      # aucun secret partagé, ne passe pas par la gateway) et Microsoft Learn public.
      { for k, v in {
        github = {
          type    = "streamable-http"
          url     = "https://api.githubcopilot.com/mcp/"
          timeout = 60000
        }
        microsoft-learn = {
          type    = "streamable-http"
          url     = "https://learn.microsoft.com/api/mcp"
          timeout = 60000
        }
      } : k => v if var.enable_enterprise_tools },
    )
    endpoints = {
      custom = concat(
        [{
          name              = "Passerelle"
          apiKey            = "entra-id" # unused: the Authorization header below wins
          baseURL           = "${local.gateway_url}/v1"
          headers           = { Authorization = "Bearer {{LIBRECHAT_OPENID_ACCESS_TOKEN}}" }
          models            = { default = ["llm"], fetch = false }
          titleConvo        = true
          titleModel        = "llm"
          modelDisplayLabel = "Microsoft Foundry via la passerelle"
        }],
        var.enable_self_hosted_models ? [{
          name              = "Hébergé dans AKS"
          apiKey            = "entra-id"
          baseURL           = "${local.gateway_url}/aks/v1"
          headers           = { Authorization = "Bearer {{LIBRECHAT_OPENID_ACCESS_TOKEN}}" }
          models            = { default = ["phi-4-mini-instruct"], fetch = false }
          titleConvo        = false
          modelDisplayLabel = "Phi-4-mini sur AKS (KAITO)"
        }] : []
      )
    }
  }
}

resource "helm_release" "librechat" {
  name       = "librechat"
  repository = "oci://ghcr.io/danny-avila/librechat-chart"
  chart      = "librechat"
  version    = var.chart_versions.librechat
  namespace  = kubernetes_namespace.this["librechat"].metadata[0].name
  wait       = true
  timeout    = 900

  values = [yamlencode({
    fullnameOverride = "librechat"
    # Never the chart's Ingress: public exposure goes through the public
    # agentgateway Gateway (gateway/public, HTTPRoute librechat-public).
    ingress = { enabled = false }
    librechat = {
      existingSecretName = kubernetes_secret.librechat.metadata[0].name
      configYamlContent  = yamlencode(local.librechat_config)
      configEnv = {
        DOMAIN_CLIENT             = local.librechat_url
        DOMAIN_SERVER             = local.librechat_url
        ALLOW_EMAIL_LOGIN         = "false"
        ALLOW_REGISTRATION        = "false"
        ALLOW_SOCIAL_LOGIN        = "true"
        ALLOW_SOCIAL_REGISTRATION = "true"
        OPENID_ISSUER             = var.entra_issuer
        OPENID_CALLBACK_URL       = "/oauth/openid/callback"
        # The gateway scope makes Entra issue an access token whose aud is the
        # gateway API (v2 token: client-ID GUID) — exactly what `acces-llm` checks.
        OPENID_SCOPE        = "openid profile email offline_access ${coalesce(var.gateway_scope, "")}"
        OPENID_REUSE_TOKENS = "true"
        # With token reuse, LibreChat validates that same access token on every
        # call, by default against its own client ID. Its aud is the gateway
        # API: without this, sign-in succeeds at Entra and fails right after
        # ("Échec de l'authentification").
        OPENID_AUDIENCE = var.gateway_api_audience == null ? "" : var.gateway_api_audience
        # Expected in the logs at each sign-in: "getUserInfo: Error fetching
        # user info". Microsoft Graph refuses a token issued for another API;
        # LibreChat then uses the ID token claims (email, preferred_username).
        OPENID_BUTTON_LABEL   = "Se connecter avec Entra ID"
        OPENID_AUTO_REDIRECT  = "true"
        OPENID_USERNAME_CLAIM = "preferred_username"
      }
    }
  })]

  depends_on = [kubernetes_secret.librechat, terraform_data.gateway_core]
}
