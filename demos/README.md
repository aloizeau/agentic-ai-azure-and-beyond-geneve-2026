# Démos — runbook

Two decks, two sets of demos. Folder names match what the audience sees on the slides.

## 45-minute talk — « IA agentique : vers Azure et au-delà ! » (slides/build-rex.js)

PowerShell (Windows PowerShell 5.1 or PowerShell 7), `az`, `kubectl`, `terraform` — no bash, no curl, no python on the workstation.

| Démo | What the audience sees | Scripts |
|---|---|---|
| A — Stopper l'usage illimité d'un LLM | an open route, then an Entra ID token (401 without it), then a token ceiling (429), live | [A-ratelimit-entra](A-ratelimit-entra/README.md) |
| B — « Agent Ready » : l'équipe IA prépare, l'équipe de dev déploie | the AI team's GitHub pipeline (approval, Terraform per team) creates identities, storage, rights, namespace and the team repository; the dev team's two pipelines (image → registry, then deployment) call the AI team's reusable workflows; the gateway discovers the team's MCP server; LibreChat answers from the team's documents | [B-agent-equipe](B-agent-equipe/README.md) |
| C — NeMo Guardrails : le socle standard | two layers (native regex + NeMo webhook), before/after on the same prompts, fail-closed | [C-nemo-guardrails](C-nemo-guardrails/README.md) |
| D — Un agent d'exploitation autour des MCP d'entreprise | same « Agent Ready » process; Azure MCP Server (read-only, Workload Identity) and Microsoft Learn published by the AI team behind `/agents/mcp-entreprise` (team key, tools per team); the dev team pushes its own GitHub tickets layer and agent; the agent diagnoses AKS, cites Learn, a human approves the issue | [D-agent-ops](D-agent-ops/README.md) |

Shared helpers: [`lib.ps1`](lib.ps1) (gateway port-forward, Entra token, chat and MCP calls through the gateway).

### Before the day

| When | What |
|---|---|
| D-14 | Foundry quota (`scripts/preflight.sh`); démo B: `ai_team_github_repository` in `terraform.tfvars`, fine-grained GitHub token for the AI team; démo D: GitHub App « tickets » (Issues read/write, installed on the owner's repositories) |
| D-7 | Full rehearsal with `$env:NO_PAUSE = "1"`, record the fallback videos; démo D: the `VÉRIFIER` checklist of its README |
| D-1 | `./scripts/deploy.ps1`, then `./demos/B-agent-equipe/prepare.ps1` (once), `./demos/C-nemo-guardrails/prepare.ps1` and `./demos/D-agent-ops/prepare.ps1` |
| H-10 min | Terminal font size up, `az login`, `gh auth status`, port-forwards below, LibreChat signed in, GitHub Actions open in the browser (approval) |

```powershell
kubectl -n librechat port-forward svc/librechat 3080:3080      # http://localhost:3080
kubectl -n kagent port-forward svc/kagent-ui 8081:8080         # http://localhost:8081 (démo D : approbation)
kubectl -n monitoring port-forward svc/kps-grafana 3000:80     # http://localhost:3000
# the gateway port-forward (8080) is started by the scripts themselves
```

### On stage

```powershell
./demos/A-ratelimit-entra/run.ps1
./demos/B-agent-equipe/run.ps1          # -Equipe equipe-docs by default
./demos/C-nemo-guardrails/run.ps1       # -AvecPanne to show fail-closed
./demos/D-agent-ops/run.ps1             # -Equipe equipe-ops by default; ticket approval in the kagent UI
```

If a live demo stalls for more than 5 seconds: switch to its video and keep talking.

### Between rehearsals

```powershell
./demos/A-ratelimit-entra/reset.ps1
./demos/B-agent-equipe/reset.ps1          # terraform destroy of the team, through the pipeline (-Local: from here)
./demos/C-nemo-guardrails/reset.ps1
./demos/D-agent-ops/reset.ps1             # equipe-ops (and its issues); -Plateforme: Azure MCP, route, identity
```

## 50-minute deck — Chalet Azure (slides/build.js) — [chalet/](chalet)

Bash scripts (Git Bash or WSL on Windows), letters as on that deck's slides.

| Demo | What the audience sees | Script |
|---|---|---|
| A — The platform in one apply | video: `make up`, Azure modules, then the portable platform | [chalet/A-plateforme](chalet/A-plateforme/README.md) |
| B — A team adds its agent, no ticket | one `kubectl apply`, the agent appears in kagent and LibreChat (Jira MCP) | [chalet/B-self-service/run.sh](chalet/B-self-service/run.sh) |
| C — The antidote to the 60 000 € weekend | 401 without an Entra token, card number rejected, 429 at the ceiling | [chalet/C-garde-fous/run.sh](chalet/C-garde-fous/run.sh) |
| D — Switch model without touching agents | Terra cut, Luna answers on the same route | [chalet/D-bascule/run.sh](chalet/D-bascule/run.sh) |
| E — A model in the cluster, same rules | Phi-4-mini on an AKS GPU node behind the same gateway | [chalet/E-auto-heberge/run.sh](chalet/E-auto-heberge/run.sh) |

Demo B needs `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`; demo E needs GPU quota and `kubectl apply -k models/deploy` 30 minutes before.

## Extra (in neither deck)

| Demo | Script |
|---|---|
| Life cycle of an agent with agentregistry: publish, discover, deploy, evolve, roll back, retire | [extras/cycle-de-vie-registre](extras/cycle-de-vie-registre/README.md) |

## What the demos rely on

Deployed by Terraform (`./scripts/deploy.ps1`), nothing to do by hand:

- **Gateway core** — [`gateway/deploy`](../gateway/deploy): Gateway `agentgateway-proxy` (ClusterIP), backend `llm`, routes `/v1` (people, Entra ID token), `/agents/v1` (agents, team virtual keys), `/mcp` (kagent agents), `/mcp-equipes` (MCP servers published by the teams, discovered by label), policies `acces-llm` (models), `acces-outils` (tools), `acces-agents`, `garde-fous-llm`, per-tool allow-lists, resilience and metering.
- **« Agent Ready » teams** (démos B and D) — platform registry, Entra ID authentication on the AKS API, `rg-<base>-equipes` and the AI team pipeline identity with bounded rights ([`terraform/modules/agent-ready`](../terraform/modules/agent-ready)), its Kubernetes role and admission policy ([`modules/platform/teams.tf`](../terraform/modules/platform/teams.tf)). Per-team stack and repository template: [`terraform/teams`](../terraform/teams). Pipelines: [`.github/workflows/agent-ready.yml`](../.github/workflows/agent-ready.yml), reusable `agent-image.yml` and `agent-deploy.yml`.
- **LibreChat** — Entra ID sign-in; MCP servers « agents » (kagent), « recherche-web », « outils-equipes ».
- **kagent** — default ModelConfig on the gateway (`/agents/v1`, platform key).

Published by `D-agent-ops/prepare.ps1` (not Terraform): the Azure MCP Server in `outils-entreprise` with its managed identity (Reader), the agents' route `/agents/mcp-entreprise` with its policies, and the GitHub token issuer in `jetons-github` (the only place the GitHub App key lives).

## Notes and honest limits

- The local ceiling is per route and per proxy replica. A budget per team or per person needs agentgateway's global rate limit with an external rate-limit service; the virtual keys already carry the team name.
- Démo B: the Kubernetes subject of a managed identity is its object ID (AKS with Entra ID) — both pipelines print `kubectl auth whoami`, validate at the D-7 rehearsal. Freshly granted roles can take minutes to propagate: the pipelines retry.
- Démo C runs the « default » profile only (deterministic rails, no LLM call). The « strict » profile's self-checks go through the internal gateway, whose proxy needs the agentgateway workload identity.
- Démo D: one Azure identity (Reader) for every authorised agent — on-behalf-of is the next step; its manifests carry `VÉRIFIER` marks never run on a cluster yet.
- LibreChat forwards the user's Entra token only from v0.8.8 (chart `2.0.14`). Check it at the D-7 rehearsal.
