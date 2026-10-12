# Démo B — « Agent Ready » : l'équipe IA prépare, l'équipe de dev déploie

```
ÉQUIPE IA (dépôt plateforme)                         ÉQUIPE DE DEV (dépôt agent-<équipe>)
─────────────────────────────                        ─────────────────────────────────────
Agent Ready (workflow_dispatch)                      1 · Image        (push mcp/ ou manuel)
  approbation « ai-team »                              └─ uses: <plateforme>/agent-image.yml
  terraform/teams, état teams/<équipe>.tfstate             docker build → registre (AcrPush)
   ├─ identités : pipeline (GitHub main) · MCP (pod)  2 · Déploiement  (après l'image, ou push
   ├─ stockage (Entra ID seulement) + « documents »        agent/ deploy/ docs/)
   ├─ 4 rôles, rien d'autre                            └─ uses: <plateforme>/agent-deploy.yml
   ├─ namespace, quota, clé virtuelle, RoleBinding         docs → stockage · kubectl apply
   └─ dépôt agent-<équipe> : modèle + variables             dans SON namespace
                                                     ▼
                         passerelle : découvre le serveur MCP (label) · LibreChat répond
```

| Step | What the audience sees |
|---|---|
| 1 | AI team: `gh workflow run agent-ready.yml`, approval of the « ai-team » environment, `terraform apply` for the team |
| 2 | Proof in Azure (two identities, their federations, storage), Kubernetes (namespace, RoleBinding, quota) and GitHub (repository, variables) |
| 3 | Dev team: « 1 · Image » (docker build → platform registry), then « 2 · Déploiement » chained (documents → storage, agent in its namespace) |
| 4 | `tools/list` on `/mcp-equipes`: the team's tools, discovered by label; 401 without a token |
| 5 | LibreChat (or `invoke_agent` through the gateway): an answer sourced from `astreinte.md` |
| 6 | The team adds a document and pushes: only « 2 · Déploiement » runs, the agent knows the new document |

```powershell
# Once: terraform.tfvars → ai_team_github_repository = "<owner>/<this repo>", ./scripts/deploy.ps1, then
$env:AI_TEAM_GITHUB_TOKEN = "<fine-grained token>"; ./demos/B-agent-equipe/prepare.ps1
./demos/B-agent-equipe/run.ps1                  # -Equipe equipe-docs
./demos/B-agent-equipe/reset.ps1                # destroy through the pipeline; -Local from this workstation
```

## Who may do what

| Identity | Federated with | Azure | Kubernetes |
|---|---|---|---|
| `id-<base>-ai-team` (Agent Ready) | environment `ai-team` of the platform repository (approval) | Contributor on `rg-<base>-equipes`; Role Based Access Control Administrator under an ABAC condition: four roles, service principals only | ClusterRole `agentic-team-provisioner` (namespaces, quotas, limits, Secrets, RoleBindings, `bind` on `agentic-team-deployer` only), bounded by the admission policy `agent-ready-perimetre` to team namespaces |
| `id-<team>-pipeline` (team pipelines) | branch `main` of `agent-<team>` | Storage Blob Data Contributor on its storage, AcrPush, AKS Cluster User | `agentic-team-deployer` in its namespace (no Secrets, no RBAC) |
| `id-<team>-mcp` (team MCP server) | ServiceAccount `<team>/docs-mcp` | Storage Blob Data Reader on its storage | — |

The reusable workflows (`.github/workflows/agent-image.yml`, `agent-deploy.yml`) are the
AI team's: the platform changes the CI of every team without touching their repositories.
With a reusable workflow, the OIDC token subject stays the caller's repository and ref,
so the team identity's federation (`repo:<owner>/agent-<team>:ref:refs/heads/main`) applies.

## Prerequisites and limits

- A fine-grained GitHub token for the AI team (Administration, Contents, Workflows,
  Variables — write, all repositories of the owner), stored as an environment secret.
- Platform repository: public (team repositories stay private and call its reusable
  workflows). Environment reviewers and environment secrets in a private repository need
  GitHub Enterprise; with Enterprise, `prepare.ps1` also opens the private repository's
  reusable workflows to the owner's repositories (Actions → Access).
- Known limits, by design: Terraform reads back the Secrets it manages, so the AI team
  identity has `get` on Secrets cluster-wide (the admission policy covers writes and deletes,
  not reads); its Storage Blob Data Contributor on the state account also reaches the
  platform state; AcrPush is registry-wide (a team could push under another team's path —
  repository-scoped ACR permissions would close it).
- Re-running Agent Ready never overwrites the team's files (agent, documents, MCP server);
  the pipelines (workflow files) stay the AI team's and are updated.
- Validate at the D-7 rehearsal: the Kubernetes subject of a managed identity (object ID —
  both pipelines print `kubectl auth whoami`), role propagation before the first run (the
  pipelines retry), the GitHub token permissions.
