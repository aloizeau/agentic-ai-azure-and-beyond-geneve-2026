# Extra demo — the life cycle of an agent (agentregistry + kagent)

Publish, discover, deploy, evolve, roll back, retire — one script, live.
Built for an earlier version of the 45-minute talk; kept as an extra (not in either deck).

| Step | What the audience sees | Command behind it |
|---|---|---|
| 0 | The platform declared where a team may deploy (`Runtime aks-equipe-produit`) and what it already publishes (the MCP servers behind the gateway) | `arctl apply -f catalogue/plateforme.yaml` |
| 1 · Publish | The team publishes `jira-mcp` 1.0.0 and its prompt `assistant-tickets` v1 | `arctl apply -f catalogue/equipe-produit.yaml` |
| 2 · Discover | Catalogue: who published what, which version | `arctl get mcps`, `arctl get prompts`, UI on :12121 |
| 3 · Deploy | The registry creates the kmcp `MCPServer` `jira-mcp-tickets` in `equipe-produit`; the kagent `Agent` uses it, its prompt comes from the catalogue | `arctl apply -f deploiement.yaml`, `kubectl apply -f agent.yaml` |
| 4 · Evolve | Prompt v2 published next to v1, the agent switches without a rebuild | `arctl apply -f catalogue/prompt-v2.yaml` |
| 5 · Roll back | v1 is still in the catalogue | prompt v1 → ConfigMap |
| 6 · Retire | Agent deleted, registry Deployment deleted: the registry removes what it created; version 1.0.0 stays for audit | `arctl delete deployment tickets` |

## Prerequisites

- `make up` done: agentregistry is installed by Terraform (`modules/platform/registry.tf`,
  chart `0.4.0`), ClusterIP only, allowed to write in the team namespaces only.
- The CLI, same version as the server:

  ```bash
  curl -fsSLo arctl https://github.com/agentregistry-dev/agentregistry/releases/download/v0.4.0/arctl-linux-amd64
  chmod +x arctl && sudo mv arctl /usr/local/bin/   # macOS: arctl-darwin-arm64
  arctl version                                      # v0.4.0
  ```

- Jira Cloud credentials exported (same as the Chalet self-service demo): `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`.
- Chalet self-service demo reset (`./demos/chalet/B-self-service/reset.sh`): both demos use `equipe-produit`.

The script opens the registry port-forward itself (`localhost:12121`, also the UI).

```bash
./demos/extras/cycle-de-vie-registre/run.sh      # NO_PAUSE=1 for rehearsals
./demos/extras/cycle-de-vie-registre/reset.sh    # between rehearsals
```

## Why the agent itself is not a registry Agent

agentregistry v0.4.0 deploys an `Agent` as a kagent **BYO** agent: a container
image built with `arctl build` (ADK, LangGraph…). Our agents are kagent
**declarative** agents (a manifest, no image). So the catalogue carries the
agent's building blocks — the MCP server (deployed by the registry) and the
prompt (versioned, read into a ConfigMap) — and the agent stays a kagent
manifest. An image-based agent published with `arctl init agent --model-provider
agentgateway` would be deployed by the registry the same way as the MCP server.

### And with kagent 1.0?

kagent 1.0 (alpha, `api.kagent.dev/v1alpha3`) drops the `Declarative` type: an
agent becomes an `AgentTemplate` (model, prompt, tools, skills) plus a `Harness`
(runtime: kagent ADK, Codex, Claude or BYO, digest-pinned image, Substrate).
[`kagent-v1/assistant-tickets.yaml`](kagent-v1/assistant-tickets.yaml) is this
demo's agent rewritten for 1.0 — validated against the v1.0.0-alpha8 CRDs, not
applied (the platform runs 0.10.x). Two migration traps: `systemMessageFrom`
becomes `systemPromptFrom`, and tools reference a `RemoteMCPServer`, no longer a
kmcp `MCPServer`. agentregistry v0.4.0 still emits kagent `v1alpha2` BYO agents.

## Honest limits (say them on stage)

- **No authentication in the open-source registry**: its authorization provider
  allows every call (Solo Enterprise adds authN/authZ). Never publish it; here it is
  ClusterIP + port-forward, and its Kubernetes write access is limited to the team
  namespaces (`rbac.watchedNamespaces`).
- **Skills** are catalogued from a Git repository (`spec.source.repository`); the
  repository is private until the talk, so the demo leaves them out. kagent mounts
  them under `/skills`: no gateway sees their use (see `monitoring/README.md`).
- The platform's MCP servers are **catalogue entries only**: the gateway serves
  them and requires a user's Entra ID token, so the registry does not deploy them.
- Bundled PostgreSQL: demo only. In production, an external PostgreSQL
  (`database.postgres.type: external`).
- Everything here is validated against the agentregistry v0.4.0 API types
  (strict decoding, `Validate()`) and the kagent v1alpha2 CRD; the end-to-end run
  on a cluster is part of the D-7 rehearsal.
