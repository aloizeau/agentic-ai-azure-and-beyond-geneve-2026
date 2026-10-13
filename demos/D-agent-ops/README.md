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
Émetteur de jetons GitHub (jetons-github)             docs/runbook-incidents.md   sévérités
  seul détenteur de la clé de l'application            « 1 · Image » → « 2 · Déploiement »
  → Secret github-token de chaque équipe : 1 h, son dépôt, issues:write
        │
        ▼                                                         │
passerelle  /agents/mcp-entreprise ◄──── clé virtuelle de l'équipe ┘
  401 sans clé · azure_* pour les équipes listées · learn_* pour toutes · comptage par équipe
```

| Étape | Ce que la salle voit |
|---|---|
| 1 | Agent Ready pour `equipe-ops` (approbation « ai-team ») ; l'émetteur de la plateforme dépose dans son Secret `github-token` un jeton d'une heure limité à `agent-equipe-ops` — la clé de l'application GitHub reste dans `jetons-github` |
| 2 | `tools/list` sur `/agents/mcp-entreprise` : 401 sans clé ; la clé d'`equipe-ops` voit `azure_*` et `learn_*` ; la clé `platform` ne voit que Learn |
| 3 | L'équipe pousse son kit (`git diff --stat`) ; « 1 · Image » puis « 2 · Déploiement » ; l'agent `assistant-ops` apparaît |
| 4 | UI kagent, « Diagnostique le cluster AKS… » : état lu dans Azure, version comparée au calendrier AKS de Microsoft Learn, sévérité du runbook, ticket proposé |
| 5 | UI kagent : l'agent s'arrête sur `creer_ticket`, on relit, Approve → l'issue apparaît dans `agent-equipe-ops` |
| 6 | Même demande rejouée : pas de doublon. Grafana « Usage IA » : outils comptés pour `equipe-ops` |

```powershell
# J-1, une fois (après deploy.ps1 et B-agent-equipe/prepare.ps1)
./demos/D-agent-ops/prepare.ps1 -GitHubAppId <id> -GitHubAppKeyPath <clé.pem>
# Sur scène
./demos/D-agent-ops/run.ps1                     # -SansAgentReady : équipe déjà prête
./demos/D-agent-ops/reset.ps1                   # -Plateforme : retire aussi Azure MCP et la route
```

Paramètres validés strictement (`ValidateScript` + `-cmatch '\A…\z'`, dans les trois scripts) :
`-Equipe` et chaque élément de `-EquipesAzure` = `[a-z][a-z0-9-]{1,18}[a-z0-9]`, `-GitHubAppId` =
1 à 12 chiffres. Ni majuscules, ni retour à la ligne final (`ValidatePattern` avec `^…$`
acceptait `equipe-ops` suivi d'un saut de ligne) : ces valeurs partent dans du YAML, du CEL et
des commandes.

### Nettoyage des clusters préparés avant l'audit d'octobre 2026

L'ancienne politique `agentgateway-system/outils-equipes-lecture` (liste NOIRE sur le backend
`mcp-equipes`) n'est plus dans le dépôt, et `kubectl apply -k` n'élague rien : restée sur le
cluster, elle s'additionne (OU) à la liste blanche `outils-equipes-autorises` et rouvre
`creer_ticket` / `commenter_ticket` à tout le tenant. Donc :

- `prepare.ps1` la supprime avant d'appliquer `plateforme/`, puis vérifie qu'**une seule**
  `AgentgatewayPolicy` portant `spec.backend.mcp.authorization` vise chaque backend MCP
  (`kubectl -o json`) — sinon il s'arrête en nommant les doublons ;
- `reset.ps1 -Plateforme` la supprime aussi ;
- `run.ps1` refuse de démarrer (étape 2) si elle est encore là.

## Pourquoi trois MCP, et pas le MCP GitHub générique

| MCP | Publié par | Identité vers le service | Ce qu'il peut faire |
|---|---|---|---|
| Azure MCP Server | équipe IA | identité managée fédérée, **Reader** sur 2 groupes de ressources | lire : AKS, groupes, Monitor, Resource Health (`--read-only`) |
| Microsoft Learn | Microsoft (distant) | aucune (public) | chercher et lire la documentation ; `code_sample_search` fermé par la passerelle |
| Tickets (`mcp/tickets.py`) | **l'équipe** | jeton d'installation GitHub d'une heure, émis par la plateforme pour **ce dépôt seul** et `issues:write` | créer (structuré, sans doublon, texte du modèle publié en bloc de code, plafonné), lister, commenter ses propres tickets (plafonné) — ni fermer, ni supprimer, ni toucher au code |

Le serveur MCP GitHub générique expose des dizaines d'outils (code, PR, workflows) et agit
avec le jeton qu'on lui donne. La couche de l'équipe en garde trois, avec ses règles métier,
dans **son** serveur MCP : c'est ce qu'une équipe sait construire et déployer elle-même sur la
plateforme, sans ticket à l'équipe IA.

## Qui protège quoi

- **Passerelle** : clé virtuelle obligatoire (401) ; liste blanche d'outils par équipe
  (`apiKey.team`) ; plafond d'appels ; comptage `team` / `server` / `resource` dans Grafana.
  Sur `/mcp-equipes` (LibreChat), la plateforme n'ouvre que les outils de lecture
  (`gateway/deploy/autorisations-mcp.yaml`) : `creer_ticket` et `commenter_ticket` restent des
  gestes de l'agent, approuvés.
- **kagent** : `requireApproval` sur les deux outils qui écrivent — sans mode pour le désactiver.
  `assistant-ops` n'est **pas publié aux personnes** : sur `/mcp` (LibreChat), `invoke_agent`
  n'accepte que les agents de la liste de `gateway/deploy/autorisations-mcp.yaml`. Sinon tout
  le tenant piloterait un agent qui lit Azure (Reader) et ouvre des tickets. On l'interroge et
  on l'approuve dans l'UI kagent (étapes 4 et 5).
- **Plateforme** : la clé privée de l'application GitHub ne vit que dans `jetons-github`.
  L'émetteur (`tools/github-token-issuer`) calcule le dépôt à partir du nom du namespace
  (`<owner>/agent-<équipe>`), jamais d'un objet qu'une équipe écrit. Même en réécrivant son
  serveur, une équipe n'obtient qu'un jeton pour son dépôt, qui expire dans l'heure.
- **Serveur de l'équipe** : un dépôt, trois gestes, sources Microsoft Learn seulement, description et
  commentaires publiés dans un bloc de code — ni lien, ni image, ni HTML, ni mention, ni
  référence (le texte vient d'un modèle) ; mentions et entités `&#64;` neutralisées dans le titre, identifiant Azure validé, dédoublonnage,
  5 créations et 10 commentaires / 10 min, commentaire seulement sur une issue créée par
  l'application de la plateforme (identifiant `app-id` écrit par l'émetteur) et étiquetée « agent » (pas une PR).
- **Azure** : `--read-only` et Reader ; l'Azure MCP Server n'est joignable que par les
  proxys de la passerelle (NetworkPolicy).

## Changements dans le dépôt

| Fichier | Changement |
|---|---|
| `terraform/teams/main.tf` | `gateway-key` porte aussi `authorization = "Bearer sk-…"` (en-tête du RemoteMCPServer) ; Secret vide `github-token`, rempli par l'émetteur |
| `tools/github-token-issuer/` | l'émetteur : code, image, CronJob, RBAC minimal (Secrets nommés `github-token` : `get`, `patch`), ValidatingAdmissionPolicy (écriture seulement dans les namespaces `agentic.io/team`), `fsGroup` 65532 |
| `gateway/deploy/autorisations-mcp.yaml` | listes blanches d'outils sur `/mcp-equipes`, et sur `/mcp` : `invoke_agent` limité aux agents publiés (`<namespace>/<nom>`, liste explicite) |

Le kit est poussé par l'équipe pendant la démo, c'est le propos. Le modèle de dépôt d'équipe
(`terraform/teams/template`) n'a reçu que des correctifs de sécurité : serveur docs robuste
(blob vide, budget total `MAX_TOTAL_BYTES`), NetworkPolicies déplacées dans Terraform.

## Application GitHub (une fois)

Settings → Developer settings → GitHub Apps → New GitHub App : webhook désactivé ; permissions
de dépôt **Issues : Read and write**, **Metadata : Read-only**, rien d'autre ; installée sur le
propriétaire des dépôts d'équipes avec **All repositories** (les dépôts `agent-<équipe>` sont
créés pendant la démo). Générer une clé privée (`.pem`), la passer à `prepare.ps1` — elle part
dans le Secret `jetons-github/github-app`, et nulle part ailleurs — puis la supprimer du poste.

## Limites assumées

- Une seule identité Azure pour tous les agents autorisés (Reader) : l'Azure MCP Server ne
  sait pas qui est derrière l'agent. Étape suivante documentée par Microsoft :
  `--outgoing-auth-strategy UseOnBehalfOf` — même sujet que la slide « Où l'identité se perd ».
- `--dangerously-disable-http-incoming-auth` : l'authentification du serveur attend un jeton émis
  pour sa propre application, la passerelle authentifie à sa place ; la NetworkPolicy en est la
  condition (testée par `tests/test_manifests.py`).
- Les plafonds de créations et de commentaires sont par réplica du serveur de l'équipe (en mémoire).
- L'équipe lit son propre jeton (son pod le monte) : c'est voulu, il ne vaut que pour son dépôt,
  en `issues:write`, une heure.
- Microsoft Learn dépend du réseau du lieu : `failureMode: FailOpen`, Azure reste servi.
- La liste blanche de `/mcp-equipes` porte sur le **suffixe** des outils (`_rechercher`,
  `_lister_tickets`…) : elle protège contre l'erreur, pas contre une équipe qui nommerait un
  outil d'écriture `x_rechercher` (accepté par la passerelle ; impact borné aux identifiants de
  cette équipe). Le préfixe est le nom de cible, qui commence par le namespace de l'équipe.
- Côté passerelle, Azure est ouvert en bloc (`azure_*`) aux équipes listées : en mode
  `namespace`, un outil par domaine reçoit la commande en argument, donc `--read-only` et le
  rôle Reader sont les vraies bornes (`tools/enterprise` passe en mode `all`, filtré par commande).

## À valider à la répétition D-7

Marqués `VÉRIFIER` dans les manifestes, jamais exécutés sur un cluster :

- [ ] Azure MCP Server : chemin MCP en HTTP (`path: /` dans le backend), noms des domaines
      (`aks`, `group`, `monitor`, `resourcehealth`), `AZURE_TOKEN_CREDENTIALS`, utilisateur de l'image
      (`runAsUser: 1000`) ; épingler un digest.
- [ ] agentgateway v1.5.0 : `policies.tls.sni` sur la cible Learn, `rateLimit.local[].requests`,
      `apiKey.team` dans une règle `authorization` de backend.
- [ ] kagent 0.10 : un `mcpServer` sans `toolNames` expose bien tous les outils servis ; l'UI
      affiche la demande d'approbation de `creer_ticket`.
- [ ] `invoke_agent` sur `/mcp` : argument `agent` au format `namespace/nom` ; refusé pour
      `equipe-ops/assistant-ops`, accepté pour un agent de la liste, toujours visible dans
      `tools/list`.
- [ ] `prepare.ps1` : « une seule liste blanche d'outils par backend MCP » sur le cluster de
      répétition (noms de ressources `agentgatewaybackends` / `agentgatewaypolicies`).
- [ ] Les workflows réutilisables appliquent `deploy/` avec kustomize (patch et deux ressources
      ajoutés par le kit) et reconstruisent l'image sur un push dans `mcp/`.
- [ ] Émetteur : `kubectl -n jetons-github logs job/<job>` montre un jeton écrit pour
      `equipe-ops` ; le pod `docs-mcp` relit le jeton renouvelé sans redémarrer.
- [ ] Vidéo de secours D.

## Tests

```powershell
python -m pip install -r demos/D-agent-ops/tests/requirements.txt
python -m pytest demos/D-agent-ops/tests     # 28 tests : tickets (GitHub simulé), serveur, manifestes
python -m pip install -r tools/github-token-issuer/tests/requirements.txt
python -m pytest tools/github-token-issuer/tests   # l'émetteur (GitHub et Kubernetes simulés)
```
