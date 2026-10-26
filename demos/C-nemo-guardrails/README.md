# Démo C — NeMo Guardrails, le socle standard de garde-fous

**Message :** une seule politique de garde-fous, appliquée à la passerelle, identique quel
que soit le fournisseur de modèle derrière la route (Foundry, Bedrock, OVHcloud…).
Aujourd'hui, en production, ce sont les filtres de contenu Foundry : efficaces, mais
propres à Azure, et **absents pour les modèles Claude** déployés dans Foundry. La démo
montre la cible : le socle standard, en deux couches, devant n'importe quel modèle.

```
client ─► agentgateway ─ (1) regex native ─ (2) webhook ─► guardrail-adapter ─► NeMo Guardrails
 (JWT       │              cartes : µs        FailClosed        FastAPI           (bibliothèque,
  Entra)    │                                 délai de 3 s      /request          Apache-2.0)
            ▼                                                   /response              │ profil « strict »
      fournisseur de modèle                                                            ▼ seulement
                                                              agentgateway-internal (sans garde-fous)
```

| Couche | Où | Ce qu'elle arrête | Coût |
|---|---|---|---|
| 1 | `AgentgatewayPolicy` `regex` (native) | numéros de carte | microsecondes, aucune dépendance |
| 2 | `AgentgatewayPolicy` `webhook` → adaptateur → NeMo Guardrails | secrets (clés d'API, jetons GitHub, clés privées), IBAN, NIR, injections (YARA : code, SQL, XSS, gabarits), auto-contrôles LLM (profil `strict`) | < 10 ms sans appel LLM |

Deux profils de règles, choisis par route avec l'en-tête `x-guardrail-profile` :
`default` (déterministe : regex + YARA, sans appel LLM) et `strict` (`default` + auto-contrôles
d'entrée et de sortie par un modèle, pour les routes grand public).

## Déroulé

| Étape | Ce que voit le public | Fichier montré |
|---|---|---|
| 1 | Le socle standard : couche 1 (regex native), couche 2 (webhook vers NeMo), `FailClosed`, délai de 3 s, profils `default` / `strict` | [`rails/default/config.yml`](../../guardrails/deploy/rails/default/config.yml), [`guardrail-policies.yaml`](../../guardrails/deploy/gateway/guardrail-policies.yaml) |
| 2 | **Avant** : une clé d'API et un numéro de sécurité sociale (NIR) atteignent le modèle ; seule la carte bancaire est arrêtée | — |
| 3 | `kubectl apply` de [`guardrails/deploy`](../../guardrails/deploy), rendu pour ce cluster : image de l'adaptateur dans le registre de la plateforme, compte et projet Foundry recopiés du backend `llm` | [`overlay.ps1`](overlay.ps1) |
| 4 | **Après** : les mêmes prompts reçoivent un 403 ; un prompt normal passe, avec le temps de bout en bout | — |
| 5 | Les décisions de l'adaptateur : journaux, métrique `guardrail_adapter_decisions_total{decision,direction,profile}`, alertes `PrometheusRule` si le taux de blocage s'envole | — |
| 6 | `-AvecPanne` : l'adaptateur est mis à 0 réplique, la passerelle refuse tous les appels LLM (fail-closed), puis l'adaptateur est rétabli | — |

### Les trois prompts

| Prompt | Avant | Après |
|---|---|---|
| Clé d'API collée (`sk-proj-…`) | passe jusqu'au modèle | 403 (couche 2, regex de secrets) |
| Numéro de sécurité sociale (NIR avec sa clé) | passe jusqu'au modèle | 403 (couche 2, regex de données personnelles) |
| Numéro de carte (`4111 1111 1111 1111`) | 403 (couche 1) | 403 (la couche 1 reste en place) |

Ces prompts font partie de la suite de tests de l'adaptateur
(`guardrails/adapter/tests/test_adapter.py::test_demo_prompts_rejected`) : la démo ne peut
pas dériver des règles.

## Lancer la démo

```powershell
./demos/C-nemo-guardrails/prepare.ps1    # J-1 : az acr build de guardrails/adapter (-Tag 0.1.0)
./demos/C-nemo-guardrails/run.ps1        # -AvecPanne pour l'étape 6
./demos/C-nemo-guardrails/reset.ps1      # retour à la politique regex native seule
```

| Script | Rôle |
|---|---|
| `prepare.ps1` | Construit l'image `plateforme/nemo-guardrail-adapter:<tag>` **dans Azure** (`az acr build`) : pas de Docker requis sur le poste. N'applique rien au cluster. |
| `run.ps1` | Déroule les étapes 1 à 6, avec une pause entre chaque étape. |
| `reset.ps1` | Supprime l'adaptateur et les politiques NeMo, puis ré-applique la politique `garde-fous-llm` d'origine (regex native, [`gateway/deploy/policies.yaml`](../../gateway/deploy/policies.yaml)). À lancer avant chaque répétition. |
| `overlay.ps1` | Fonctions communes : rend `guardrails/deploy` en mémoire avec l'image du registre et les noms Foundry du backend `llm` (rien n'est écrit sur le disque). |

**Prérequis :** `az`, `kubectl`, `terraform` ; plateforme déployée (passerelle `agentgateway`
et backend `llm`) ; `ADAPTER_TAG` pour utiliser un autre tag que `0.1.0`.

## Pourquoi la mise en place se fait en direct

Le webhook est `FailClosed` : sans adaptateur prêt, **tout** le trafic LLM serait refusé.
C'est pourquoi `prepare.ps1` ne construit que l'image, et que `run.ps1` applique les
manifestes puis attend `rollout status` avant de tester.

## Points à connaître avant de présenter

- **Latence :** le chiffre affiché à l'étape 4 est le temps de bout en bout, modèle compris ;
  les garde-fous déterministes pèsent moins de 10 ms. Le profil `strict` ajoute des appels
  LLM : savoir s'il tient dans le délai de 3 s sous charge reste à valider (D-7).
- **Ce n'est pas un DLP :** les regex arrêtent les fuites évidentes (copier-coller), pas
  une donnée encodée, découpée ou reformulée.
- **Claude dans Foundry :** les filtres de contenu Foundry ne couvrent pas les modèles
  Anthropic ; ce socle est alors la seule couche de règles de la plateforme.
- **Variante NVIDIA :** le microservice NeMo Guardrails
  ([`overlays/nvidia-microservice`](../../guardrails/overlays/nvidia-microservice)) exige
  NVIDIA AI Enterprise ; la démo utilise le mode bibliothèque (Apache-2.0).
- **Statut :** R&D, architecture cible, pas encore en production.

Détails d'architecture, correspondance des décisions NeMo → passerelle et limites connues :
[`guardrails/README.md`](../../guardrails/README.md).
