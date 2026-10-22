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
./demos/B-agent-equipe/prepare.ps1   # gh session token; or $env:AI_TEAM_GITHUB_TOKEN = "<fine-grained token>" first
./demos/B-agent-equipe/run.ps1                  # -Equipe equipe-docs
./demos/B-agent-equipe/reset.ps1                # destroy through the pipeline; -Local from this workstation
```

## Who may do what

| Identity | Federated with | Azure | Kubernetes |
|---|---|---|---|
| `id-<base>-ai-team` (Agent Ready) | environment `ai-team` of the platform repository (approval, `main` only) | Contributor on `rg-<base>-equipes` (an Azure Policy keeps its federations to this cluster and `agent-*` repositories); Role Based Access Control Administrator under an ABAC condition: four roles, service principals only, never itself (both assigned by Terraform run as Owner, or by `prepare.ps1` when the apply runs in CI — `ai_team_manage_role_assignments = false`); the team states only: custom role « Agentic - etats Terraform des equipes » (blob data actions, no management action — the container cannot be deleted) on the `tfstate` container, ABAC on the blob path and on the list prefix `teams/` | ClusterRole `agentic-team-provisioner` (namespaces, quotas, limits, NetworkPolicies, RoleBindings, `bind` on `agentic-team-deployer` only; Secrets: `create`, and `get/update/patch/delete` on `gateway-key` and `github-token` only) + Role `agentic-team-provisioner-cles` in `agentgateway-system` (the `vk-<team>` keys), bounded by the admission policy `agent-ready-perimetre`: team namespaces with Pod Security `baseline`, no platform name, RoleBindings to `agentic-team-deployer` for one user that is not itself |
| `id-<team>-pipeline` (team pipelines) | branch `main` of `agent-<team>`, inside one of the AI team's two reusable workflows (`job_workflow_ref` in the OIDC subject) | Storage Blob Data Contributor on its storage, AcrPush, AKS Cluster User | `agentic-team-deployer` in its namespace (no Secrets, no RBAC, NetworkPolicies read-only; Services ClusterIP with a selector, MCP target name starting with the namespace — admission policy `equipes-services`) |
| `id-<team>-mcp` (team MCP server) | ServiceAccount `<team>/docs-mcp` | Storage Blob Data Reader on its storage | — |

The reusable workflows (`.github/workflows/agent-image.yml`, `agent-deploy.yml`) are the
AI team's: the platform changes the CI of every team without touching their repositories.
Agent Ready sets the team repository's OIDC subject to repository + ref + `job_workflow_ref`:
the team identity's federations match only a job running on `main` *inside* the AI team's
`agent-image.yml` or `agent-deploy.yml`. A workflow the team writes itself, even on `main`,
gets no Azure token.

## Prerequisites and limits

- By default `prepare.ps1` stores the token of your `gh` session (scopes `repo`, `workflow`,
  `delete_repo`, requested if missing): simple for a demo, but valid on all your repositories.
  Otherwise, a fine-grained GitHub token for the AI team (Administration, Contents, Workflows,
  Variables **and Actions** — read and write, all repositories of the owner), stored as an
  environment secret. Actions is what sets the team repository's OIDC subject
  (`PUT /repos/<owner>/<repo>/actions/oidc/customization/sub`): without it, Agent Ready
  fails on `github_actions_repository_oidc_subject_claim_customization_template`.
- The team's NetworkPolicies (`docs-mcp-entrees`, `equipe-sorties`, `agents-vers-kagent`)
  are created by Agent Ready, not by the team's kustomize: the team's pipeline can read
  them, never change or delete them (egress closed to IMDS, the wireserver and internal
  ranges; the kagent controller `:8083` from agent pods only). A team repository created
  before this change needs a migration, or a reset of the team (`reset.ps1`):
  1. as admin, before re-running Agent Ready (otherwise Terraform fails with
     « already exists »): `kubectl -n <team> delete networkpolicy docs-mcp-entrees equipe-sorties --ignore-not-found`;
  2. in the team repository: remove `networkpolicy.yaml` from `deploy/kustomization.yaml`
     and set the annotation `agentgateway.dev/mcp-target-name` of `deploy/docs-mcp.yaml`
     to `<team>--docs` (otherwise the next deployment is refused by admission).
- MCP target name: `<team>--docs` (annotation `agentgateway.dev/mcp-target-name`); the
  admission policy accepts `<namespace>` or `<namespace>--…` only. `--` is forbidden in
  team names, so team `abc` cannot take a target of team `abc-def`.
- Platform repository: public (team repositories stay private and call its reusable
  workflows). Environment reviewers and environment secrets in a private repository need
  GitHub Enterprise; with Enterprise, `prepare.ps1` also opens the private repository's
  reusable workflows to the owner's repositories (Actions → Access).
- The AI team pipeline never reads the platform state (it holds the admin kubeconfig and
  the Entra app secrets): it gets the platform's non-secret outputs as the repository
  variable `PLATEFORME`, set by `prepare.ps1`. **`.github/workflows/agent-ready.yml` must
  pass it to Terraform** (step `terraform`): `TF_VAR_plateforme: ${{ vars.PLATEFORME }}`,
  in place of the former `platform_state` variable.
- Known limits, by design: Terraform reads back the Secrets it manages, and the admission
  policy only sees writes. The AI team identity reads Secrets named `gateway-key` or
  `github-token` in any namespace (kagent's platform key and the `var.teams` namespaces
  included), and every Secret of `agentgateway-system` (the `vk-<team>` names are not
  known in advance: platform virtual keys, and the certificates of the public listeners
  when `public_exposure` is set) — no longer the GitHub App key, LibreChat, Entra, ACME or
  Grafana secrets. AcrPush is registry-wide (a team could push under another team's path —
  repository-scoped ACR permissions would close it).
- Re-running Agent Ready never overwrites the team's files (agent, documents, MCP server);
  the pipelines (workflow files) stay the AI team's and are updated.
- Validate at the D-7 rehearsal: the Kubernetes subject of a managed identity (object ID —
  both pipelines print `kubectl auth whoami`), role propagation before the first run (the
  pipelines retry), the GitHub token permissions, the OIDC subject printed by `azure/login`
  in « 1 · Image » (it must match `github-main-image`), the team states readable and writable
  under the ABAC condition (`terraform init` lists blobs with the prefix `teams/`; a list
without prefix must be refused), the custom role update (`az role definition update`), the
pod labels the team NetworkPolicies rely on (kagent controller, agent pods
`app=kagent,kagent=<agent>`, gateway proxy), and the admission refusals checked by
`prepare.ps1` (step 1 bis).
