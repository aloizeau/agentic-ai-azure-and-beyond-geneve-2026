# Revue de sécurité — octobre 2026

Deux passes de revue sur l'ensemble du dépôt (Terraform, passerelle, garde-fous, démos,
outils), corrigées sur la branche `securite/audit-2026-10`.

- **1re passe** : 32 constats (commit `88fd832`).
- **2e passe (contre-audit)** : vérification des 32 correctifs, puis 30 nouveaux constats,
  corrigés dans le commit suivant, puis une relecture indépendante des correctifs (5 défauts
  trouvés et corrigés).

Ce qui ne peut se vérifier que sur un cluster réel est marqué `VÉRIFIER (D-7)` dans le code
et repris en fin de document.

## Ce qui protège quoi, après correction

| Domaine | Mesure |
|---|---|
| Accès des personnes | Affectation Entra ID obligatoire sur l'API de la passerelle, LibreChat et le portail (`authorized_principal_object_ids`) ; Grafana en Viewer par défaut |
| API AKS | Plages IP autorisées en option (`aks_api_authorized_ip_ranges`) ; Entra ID avec Azure RBAC et Kubernetes RBAC côte à côte |
| Administration AKS | L'identité qui exécute Terraform depuis le poste (`aks_admin_current_principal`) : Azure Kubernetes Service RBAC Cluster Admin, Cluster Admin Role et Contributor Role sur le cluster seulement ; jamais en CI |
| Identités CI | PR : identité sans aucun droit sur l'état Terraform (`fmt` + `validate` sans backend). Apply : environnement protégé, branche main, rôles délégables sans Owner, ni RBAC Administrator, ni Contributor |
| Équipe IA (Agent Ready) | Lecture de l'état plateforme impossible (sorties non sensibles passées en variable `PLATEFORME`) ; états `teams/` seulement, rôle personnalisé sans action de gestion, sur le conteneur `tfstate` ; Secrets limités par nom ; admission sur namespaces, RoleBindings et Services |
| Namespaces d'équipe | PSA baseline (restricted en avertissement) ; NetworkPolicies posées par Terraform, non modifiables par l'équipe ; IMDS et wireserver refusés en défense en profondeur (Cilium) ; contrôleur kagent `:8083` joignable par les pods agents seulement |
| Passerelle | Une politique d'authentification par route ; listes blanches d'outils MCP ; `invoke_agent` limité à une liste d'agents publiés ; nom de cible MCP `<équipe>--…` imposé à l'admission |
| Outils d'entreprise | Azure MCP en `--read-only --mode all`, outils de lecture seulement (règle CEL) ; Graph et Grafana en lecture |
| Démo D | Clé de l'application GitHub dans `jetons-github` seulement ; émetteur à droits minimaux + admission (écriture dans les namespaces d'équipe seulement) ; jeton d'une heure, un dépôt, `issues:write` ; texte du modèle publié en bloc de code ; commentaires seulement sur les issues de l'application de la plateforme |
| Garde-fous | Corps limité à 1 Mio ; statuts inconnus du microservice en fail-closed ; résultats d'outils contrôlés (secrets) ; carte bancaire vérifiée par Luhn après normalisation NFKC |

## 2e passe : constats et correctifs

| Gravité | Constat | Correctif |
|---|---|---|
| Critique | Démo D : clé de l'App et jeton illisibles par l'UID 65532 (pas de `fsGroup`) | `fsGroup: 65532` sur l'émetteur et le serveur MCP, `defaultMode 0440`, erreur explicite, test de manifeste |
| Élevée | `agentic-team-provisioner` lisait tous les Secrets du cluster (clé de l'App comprise) | `resourceNames` (`gateway-key`, `github-token`) ; Role dédié dans `agentgateway-system` pour les `vk-*` |
| Élevée | Équipe propriétaire de sa NetworkPolicy de sortie | NetworkPolicies déplacées dans Terraform, deployer en lecture seule ; `CiliumClusterwideNetworkPolicy` `egressDeny` IMDS / wireserver |
| Élevée | ABAC démo B : `List Blobs` refusé (init Terraform en 403), suppression du conteneur possible | Rôle personnalisé (DataActions blobs seulement) sur le conteneur, condition `Blob.List` par préfixe ; rétention des conteneurs supprimés |
| Élevée | Identité PR lisant l'état plateforme | Plus aucun droit sur le compte d'état |
| Élevée | Ancienne politique `outils-equipes-lecture` jamais supprimée (deux Allow = OU) | Supprimée dans `prepare.ps1` et `reset.ps1`, `run.ps1` refuse de démarrer si elle existe, contrôle « une politique par backend » |
| Élevée | Jeton fine-grained sans `Actions: write` (personnalisation OIDC) | Documenté (`prepare.ps1`, README B) |
| Élevée | Serveur docs : un blob vide (416) cassait tous les outils | Blob vide géré, erreurs par blob isolées, budget total `MAX_TOTAL_BYTES` (32 Mio) |
| Moyenne | Escalade possible vers Owner via RBAC Administrator / Contributor délégables | Retirés de la liste ; `ai_team_manage_role_assignments` ; échec explicite au lieu de `|| true` |
| Moyenne | Affectations Entra ID qui oscillent entre CI et poste | `assign_current_principal` + précondition |
| Moyenne | Contrôleur kagent `:8083` (MCP `invoke_agent` sans authentification) joignable par toute équipe | Contrôleur seulement, port 8083, pods agents seulement |
| Moyenne | `invoke_agent` ouvert sur tous les agents depuis LibreChat | Liste explicite (`equipe-docs/assistant-docs`) ; `assistant-ops` s'utilise dans l'UI kagent |
| Moyenne | Nom de cible MCP libre (usurpation d'une autre équipe) | Admission : `<équipe>` ou `<équipe>--…` (`--` interdit dans les noms d'équipe) |
| Moyenne | Azure MCP : outils répartiteurs non bornés, arguments du conteneur invalides | `--mode all`, liste de lecture en CEL, conteneur aligné sur la démo D |
| Moyenne | Description de ticket : liens, images, HTML, entités `&#64;`, fausse signature | Description et commentaires publiés dans un bloc de code ; titre neutralisé |
| Moyenne | Faux positifs des regex (versions, IP, dates, téléphones, « mot de passe: introuvable »), désormais appliqués aux résultats d'outils | Contrôle carte en Python (groupement, préfixe, Luhn) ; messages `tool` : secrets seulement par défaut (`TOOL_RAILS`) |
| Moyenne | Cache docs non borné au total | `MAX_TOTAL_BYTES` |
| Faible | Commentaire accepté sur une issue d'une autre App | `app-id` écrit par l'émetteur, comparé à `performed_via_github_app.id` |
| Faible | Patch de l'émetteur possible sur tout Secret `github-token` | ValidatingAdmissionPolicy : namespaces `agentic.io/team` seulement |
| Faible | Rails `tool` en série (refus en cascade sous 3 s) | Contrôles en parallèle, sans self check LLM sur les résultats d'outils par défaut |
| Faible | `ValidatePattern` insensible à la casse et tolérant `\n` | `ValidateScript` + `-cmatch '\A…\z'` (démos B et D, reset compris) |
| Faible | Proxy public autorisé vers les équipes | Retiré |
| Faible | Destroy des outils d'entreprise supprimant le namespace partagé | Suppression des objets seulement |
| Faible | Route de la démo A ouverte après une fin normale | Nettoyage systématique dans `finally`, code de sortie vérifié |
| Faible | Jeton Cloudflare resté en session sur certaines erreurs | `try/catch` dédié |
| Faible | VAP créées autrefois par kubectl (« already exists ») | `deploy.ps1` les supprime si elles ne sont pas dans l'état |
| Faible | Namespaces d'add-ons AKS non réservés | Ajoutés à `noms_reserves` |

## Limites assumées

- **Images non épinglées par digest** (`latest` ou tags mobiles) : aucun digest n'est inventé ;
  à épingler à la répétition (`VÉRIFIER (D-7)`).
- **Outils d'entreprise** : identité partagée (principal de service Azure, Graph en app-only).
- **Liste blanche par suffixe** sur `/mcp-equipes` : protège des erreurs, pas d'une équipe
  malveillante qui nommerait un outil d'écriture `x_rechercher`.
- **Clés virtuelles** : le Role du provisioner lit tous les Secrets d'`agentgateway-system`
  (noms `vk-*` inconnus d'avance).
- **Garde-fous** : un mot de passe fait uniquement de lettres n'est plus détecté (compromis
  contre les faux positifs) ; par défaut, une injection indirecte venue d'un outil n'est vue
  qu'en sortie (`TOOL_RAILS=profile` pour la contrôler en entrée).
- **Démo D** : dans `passerelle-agents.yaml`, `azure_*` est ouvert en bloc ; les vraies bornes
  sont `--read-only` et le rôle Reader.

## À faire hors du dépôt

`.github/workflows` contient les workflows de la démo B : `agent-ready.yml` (équipe IA,
`TF_VAR_plateforme` depuis la variable `PLATEFORME`) et les workflows réutilisables
`agent-image.yml` / `agent-deploy.yml`. Les workflows Terraform de la plateforme (PR, apply)
ne font pas partie de ce dépôt ; ils doivent suivre :

- **Workflow PR** : connexion avec `AZURE_CLIENT_ID_PLAN`, puis
  `terraform fmt -check -recursive` et `terraform init -backend=false && terraform validate`
  sur `terraform/` et `terraform/teams`. Plus de `plan` en PR.
- **Apply CI** : `TF_VAR_assign_current_principal=false`,
  `TF_VAR_aks_admin_current_principal=false` (les rôles AKS ne sont pas dans la condition ABAC
  de l'identité CI, son Contributor couvre déjà le kubeconfig admin),
  `TF_VAR_ai_team_manage_role_assignments=false`,
  `TF_VAR_authorized_principal_object_ids='["<oid>"]'` ; puis `prepare.ps1` (démo B) lancé une
  fois par un Owner. Sur un état existant, d'abord `terraform state rm` des deux attributions
  de l'équipe IA (voir README racine).
- **Jeton fine-grained de l'équipe IA** : Administration, Contents, Workflows, Variables et
  **Actions** en lecture/écriture.
- **Application GitHub de la démo D** : `-GitHubAppId` reçoit l'identifiant numérique (pas le
  Client ID).

## Migration d'un environnement existant

- **Équipes créées avant ces changements** : supprimer `docs-mcp-entrees` et `equipe-sorties`
  avant de relancer Agent Ready ; retirer `networkpolicy.yaml` de la kustomization de l'équipe
  et passer l'annotation `agentgateway.dev/mcp-target-name` à `<équipe>--docs`. Ou réinitialiser
  l'équipe (README de la démo B).
- **Démo D déjà préparée** : relancer `prepare.ps1` (supprime `outils-equipes-lecture`). Au
  premier passage du nouvel émetteur, les Secrets n'ont pas encore `app-id` : créer un ticket
  marche, commenter est refusé jusqu'au passage suivant.

## Liste de contrôle de la répétition (D-7)

1. Labels réels : contrôleur kagent 0.10.1, pods agents (`app=kagent`, `kagent=<nom>`), proxys agentgateway v1.5.
2. Depuis un pod d'équipe : `curl` vers 169.254.169.254 refusé (Cilium ≥ 1.15, sinon le plan échoue) ; `docs-mcp` ne joint pas `kagent-controller:8083`.
3. `invoke_agent` : un `tools/call` vers un agent hors liste est **refusé** (vérifie que `mcp.tool.arguments` est bien fourni à l'autorisation) ; `invoke_agent` reste visible dans `tools/list`.
4. Une seule politique d'autorisation MCP par backend ; comportement de fusion de deux politiques.
5. ABAC démo B : `terraform init/plan/apply/destroy` d'une équipe ; liste de blobs sans préfixe refusée ; `az role definition update` avec Id.
6. Émetteur : pod lisible en UID 65532 ; refus de `kubectl --as=system:serviceaccount:jetons-github:emetteur-jetons-github -n kube-system patch secret github-token …` ; `namespaceObject` renseigné.
7. Azure MCP (démo D et outils d'entreprise) : démarrage avec `--transport http`, noms d'outils en `--mode all`, liste de lecture complète (certains outils `monitor_*` de lecture sont exclus par la règle actuelle).
8. Garde-fous : statuts réels du microservice NVIDIA (`skipped` ?) ; garde native `CreditCard` d'agentgateway (Luhn, faux positifs sur la démo D) ; self check strict sous 3 s.
9. Épingler toutes les images par digest.
10. Azure RBAC pour Kubernetes : passage de `azure_rbac_enabled` à `true` en place sur le cluster existant (pas de recréation dans le plan) ; `kubectl auth whoami` puis `kubectl auth can-i '*' '*' -A` avec `kubelogin` (sans `--admin`) pour l'identité Terraform, après la propagation (jusqu'à 5 min) ; les pipelines d'équipe de la démo B toujours autorisés par leurs RoleBindings.
