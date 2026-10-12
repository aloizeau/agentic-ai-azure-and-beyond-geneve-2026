# -----------------------------------------------------------------------------
# Enterprise MCP tools behind agentgateway — OPTIONAL (enable_enterprise_tools).
#
# Self-hosted servers (Grafana, Azure, Microsoft Graph) applied from
# tools/enterprise/deploy: pods in `outils-entreprise`, one AgentgatewayBackend
# + HTTPRoute each in agentgateway-system (/mcp-grafana, /mcp-azure, /mcp-graph),
# covered by the acces-llm policy. Their credentials are created out of band by
# tools/enterprise/run.sh (Secrets, never committed) — pods stay Pending until
# then. GitHub (per-user OAuth) and Microsoft Learn (no auth) are direct
# LibreChat MCP servers (see librechat.tf), no pod here.
# -----------------------------------------------------------------------------

locals {
  enterprise_src = abspath("${path.root}/../tools/enterprise/deploy")
  enterprise_hash = sha256(join("", [
    for f in sort(fileset(local.enterprise_src, "**")) : filesha256("${local.enterprise_src}/${f}")
  ]))
}

resource "terraform_data" "enterprise_tools" {
  count = var.enable_enterprise_tools ? 1 : 0

  triggers_replace = [local.enterprise_hash]

  # Relative path (cwd = terraform root): the abspath contains spaces and would
  # break the unquoted shell command.
  provisioner "local-exec" {
    command = "kubectl apply -k ../tools/enterprise/deploy"
  }

  # Turning the flag off removes pods, backends and routes. Destroy-time
  # provisioners take a literal command (no locals); cwd is the terraform root.
  provisioner "local-exec" {
    when       = destroy
    on_failure = continue
    command    = "kubectl delete -k ../tools/enterprise/deploy --ignore-not-found --wait=false"
  }

  depends_on = [terraform_data.gateway_core] # Gateway agentgateway-proxy (parentRef) + acces-llm
}
