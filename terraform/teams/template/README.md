# Agent de l'équipe __EQUIPE__

Dépôt créé par le pipeline « Agent Ready » de l'équipe IA. Tout ce que l'équipe
écrit est ici ; le reste (identités, stockage, droits, passerelle, LibreChat,
pipelines) est fourni par l'équipe IA.

| Dossier | Contenu | Qui le modifie |
|---|---|---|
| `agent/` | l'agent kagent (déclaratif) et sa configuration de modèle : **la passerelle, jamais un fournisseur** | l'équipe |
| `mcp/` | le serveur MCP « docs » : lit les documents Markdown du stockage de l'équipe | l'équipe |
| `docs/` | les documents que l'agent consulte | l'équipe |
| `deploy/` | manifestes Kubernetes du serveur MCP (identité de charge de travail, publication sur la passerelle) | rarement |
| `.github/workflows/` | deux pipelines de dix lignes qui appellent les workflows réutilisables de l'équipe IA | l'équipe IA |

## Les deux pipelines

| Pipeline | Déclencheur | Ce qu'il fait (workflow réutilisable de l'équipe IA) |
|---|---|---|
| **1 · Image** | push sur `main` qui touche `mcp/` | `agent-image.yml` : `docker build`, push dans le registre de la plateforme (rôle AcrPush) |
| **2 · Déploiement** | après « 1 · Image », ou push qui touche `agent/`, `deploy/`, `docs/` | `agent-deploy.yml` : `docs/` → stockage, `kubectl apply` dans le namespace `__EQUIPE__` |

Aucun secret dans ce dépôt : connexion OIDC avec l'identité du pipeline de l'équipe,
fédérée avec la branche `main` de ce dépôt uniquement.

## Ce que l'équipe obtient sans rien demander

- Modèle : via la passerelle (`/agents/v1`, clé virtuelle de l'équipe) — plafonds, règles de
  contenu et coûts attribués à `__EQUIPE__`.
- Outils : le Service du serveur MCP porte le label `agentic.io/publier-mcp=true` ; la passerelle
  le découvre et l'expose dans LibreChat (« outils-equipes », outils préfixés `__MCP_TARGET__`),
  jeton Entra ID obligatoire, chaque appel compté par personne.
- Kubernetes : `agentic-team-deployer` dans `__EQUIPE__` seulement (pas de Secrets, pas de RBAC).
- Azure : le pipeline écrit dans `__STORAGE__` et pousse dans le registre ; le serveur MCP
  ne fait que lire `__STORAGE__`. Rien d'autre.
