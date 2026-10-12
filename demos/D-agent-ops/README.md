# Démo D — Un agent d'exploitation autour des MCP d'entreprise

Azure MCP Server et Microsoft Learn, publiés par l'équipe IA ; une couche « tickets GitHub »
construite par l'équipe de dev ; le même processus « Agent Ready » que la démo B.

```
ÉQUIPE IA (une fois, prepare.ps1)                     ÉQUIPE DE DEV (dépôt agent-equipe-ops)
──────────────────────────────────                    ──────────────────────────────────────
Azure MCP Server  outils-entreprise/azure-mcp         un commit :
  image Microsoft · --read-only · 4 domaines            mcp/tickets.py   3 outils GitHub, ses règles
  Workload Identity · Reader · aucun secret             deploy/assistant-ops.yaml   l'agent
Microsoft Learn   https://learn.microsoft.com/api/mcp   deploy/outils-entreprise.yaml  via la passerelle
Application GitHub « tickets » (Issues)                 docs/runbook-incidents.md   sévérités
        │                                             « 1 · Image » → « 2 · Déploiement »
        ▼                                                         │
passerelle  /agents/mcp-entreprise ◄──── clé virtuelle de l'équipe ┘
  401 sans clé · azure_* pour les équipes listées · learn_* pour toutes · comptage par équipe
```

| Étape | Ce que la salle voit |
|---|---|
| 1 | Agent Ready pour `equipe-ops` (approbation « ai-team ») ; le Secret `github-app` est posé dans son namespace — l'équipe ne peut pas le lire, son pod le monte |
| 2 | `tools/list` sur `/agents/mcp-entreprise` : 401 sans clé ; la clé d'`equipe-ops` voit `azure_*` et `learn_*` ; la clé `platform` ne voit que Learn |
| 3 | L'équipe pousse son kit (`git diff --stat`) ; « 1 · Image » puis « 2 · Déploiement » ; l'agent `assistant-ops` apparaît |
| 4 | « Diagnostique le cluster AKS… » : état lu dans Azure, version comparée au calendrier AKS de Microsoft Learn, sévérité du runbook, ticket proposé |
| 5 | UI kagent : l'agent s'arrête sur `creer_ticket`, on relit, Approve → l'issue apparaît dans `agent-equipe-ops` |
| 6 | Même demande rejouée : pas de doublon. Grafana « Usage IA » : outils comptés pour `equipe-ops` |

```powershell
# J-1, une fois (après deploy.ps1 et B-agent-equipe/prepare.ps1)
./demos/D-agent-ops/prepare.ps1 -GitHubAppId <id> -GitHubAppKeyPath <clé.pem>
# Sur scène
./demos/D-agent-ops/run.ps1                     # -SansApprobation : tout au terminal
./demos/D-agent-ops/reset.ps1                   # -Plateforme : retire aussi Azure MCP et la route
```

## Pourquoi trois MCP, et pas le MCP GitHub générique

| MCP | Publié par | Identité vers le service | Ce qu'il peut faire |
|---|---|---|---|
| Azure MCP Server | équipe IA | identité managée fédérée, **Reader** sur 2 groupes de ressources | lire : AKS, groupes, Monitor, Resource Health (`--read-only`) |
| Microsoft Learn | Microsoft (distant) | aucune (public) | chercher et lire la documentation ; `code_sample_search` fermé par la passerelle |
| Tickets (`mcp/tickets.py`) | **l'équipe** | jeton d'application GitHub d'une heure, **ce dépôt seul**, `issues:write` | créer (structuré, sans doublon, plafonné), lister, commenter ses propres tickets — ni fermer, ni supprimer, ni toucher au code |

Le serveur MCP GitHub générique expose des dizaines d'outils (code, PR, workflows) et agit
avec le jeton qu'on lui donne. La couche de l'équipe en garde trois, avec ses règles métier,
dans **son** serveur MCP : c'est ce qu'une équipe sait construire et déployer elle-même sur la
plateforme, sans ticket à l'équipe IA.

## Qui protège quoi

- **Passerelle** : clé virtuelle obligatoire (401) ; liste blanche d'outils par équipe
  (`apiKey.team`) ; plafond d'appels ; comptage `team` / `server` / `resource` dans Grafana.
  Sur `/mcp-equipes` (LibreChat), `creer_ticket` et `commenter_ticket` sont masqués : écrire
  reste un geste de l'agent, approuvé.
- **kagent** : `requireApproval` sur les deux outils qui écrivent.
- **Serveur de l'équipe** : un dépôt, trois gestes, sources Microsoft Learn seulement,
  dédoublonnage, 5 créations / 10 min, commentaire seulement sur un ticket de l'agent.
- **Azure** : `--read-only` et Reader ; l'Azure MCP Server n'est joignable que par les
  proxys de la passerelle (NetworkPolicy).

## Changements dans le dépôt

| Fichier | Changement |
|---|---|
| `terraform/teams/main.tf` | `gateway-key` porte aussi `authorization = "Bearer sk-…"` (en-tête du RemoteMCPServer) ; Secret `github-app` si `github_app_id` est fourni |
| `terraform/teams/variables.tf` | `github_app_id`, `github_app_private_key` (sensible), facultatives |
| `.github/workflows/agent-ready.yml` | **à ajouter à la main** (fichier absent de cette livraison) — à l'étape Terraform : |

```yaml
        env:
          TF_VAR_github_app_id: ${{ vars.TICKETS_GITHUB_APP_ID }}
          TF_VAR_github_app_private_key: ${{ secrets.TICKETS_GITHUB_APP_PRIVATE_KEY }}
```

Sans cette modification, `run.ps1 -GitHubAppId … -GitHubAppKeyPath …` pose le Secret depuis le
poste du présentateur (kubeconfig admin) et le dit à l'écran.

Le modèle de dépôt d'équipe (`terraform/teams/template`) ne change pas : le kit est poussé par
l'équipe pendant la démo, c'est le propos.

## Application GitHub (une fois)

Settings → Developer settings → GitHub Apps → New GitHub App : webhook désactivé ; permissions
de dépôt **Issues : Read and write**, **Metadata : Read-only**, rien d'autre ; installée sur le
propriétaire des dépôts d'équipes avec **All repositories** (les dépôts `agent-<équipe>` sont
créés pendant la démo). Générer une clé privée (`.pem`), la passer à `prepare.ps1`, puis la
supprimer du poste.

## Limites assumées

- Une seule identité Azure pour tous les agents autorisés (Reader) : l'Azure MCP Server ne
  sait pas qui est derrière l'agent. Étape suivante documentée par Microsoft :
  `--outgoing-auth-strategy UseOnBehalfOf` — même sujet que la slide « Où l'identité se perd ».
- `--dangerously-disable-http-incoming-auth` : l'authentification du serveur attend un jeton émis
  pour sa propre application, la passerelle authentifie à sa place ; la NetworkPolicy en est la
  condition (testée par `tests/test_manifests.py`).
- Le plafond de créations est par réplica du serveur de l'équipe (en mémoire).
- Microsoft Learn dépend du réseau du lieu : `failureMode: FailOpen`, Azure reste servi.

## À valider à la répétition D-7

Marqués `VÉRIFIER` dans les manifestes, jamais exécutés sur un cluster :

- [ ] Azure MCP Server : chemin MCP en HTTP (`path: /` dans le backend), noms des domaines
      (`aks`, `group`, `monitor`, `resourcehealth`), `AZURE_TOKEN_CREDENTIALS`, utilisateur de l'image
      (`runAsUser: 1000`) ; épingler un digest.
- [ ] agentgateway v1.5.0 : `policies.tls.sni` sur la cible Learn, `rateLimit.local[].requests`,
      `apiKey.team` dans une règle `authorization` de backend.
- [ ] kagent 0.10 : un `mcpServer` sans `toolNames` expose bien tous les outils servis ; l'UI
      affiche la demande d'approbation de `creer_ticket`.
- [ ] Les workflows réutilisables appliquent `deploy/` avec kustomize (patch et deux ressources
      ajoutés par le kit) et reconstruisent l'image sur un push dans `mcp/`.
- [ ] Vidéo de secours D.

## Tests

```powershell
python -m pip install -r demos/D-agent-ops/tests/requirements.txt
python -m pytest demos/D-agent-ops/tests     # 22 tests : tickets (GitHub simulé), serveur, manifestes
```
