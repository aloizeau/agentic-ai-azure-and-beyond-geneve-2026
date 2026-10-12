# Architecture diagrams

Ten draw.io diagrams (labels in French, the language of the talk), with a PNG export of each.
Open the `.drawio` files in [draw.io](https://app.diagrams.net) or in VS Code with the *Draw.io Integration* extension.

| Diagram | What it shows |
|---|---|
| [01 — Vue fonctionnelle](01-vue-fonctionnelle.drawio) | Capabilities: what is portable (everything inside Kubernetes) and the two cloud adapters (identity, models) |
| [02 — Architecture Azure](02-architecture-azure.drawio) | Reference architecture: Entra ID tenant, Cloudflare DNS, subscription, resource groups, VNet, AKS with its two doors (public, internal), Foundry and its five deployments, identities, Log Analytics |
| [03 — Plateforme Kubernetes](03-plateforme-kubernetes.drawio) | Namespaces and Kubernetes objects installed by phase 2: Services, CRDs, Secrets, policies |
| [04 — Flux d'une requête et sécurité](04-flux-requete-securite.drawio) | The control chain in agentgateway: identity, token ceiling, guardrails, failover, retry, tracing |
| [05 — Déploiement](05-deploiement.drawio) | GitHub Actions (OIDC) or `deploy.ps1`, Terraform state, phase 1 and phase 2 |
| [06 — Exposition publique](06-exposition-publique.drawio) | Optional public exposure: Cloudflare DNS, static IP, public agentgateway Gateway, Let's Encrypt, oauth2-proxy |
| [07 — Identités : vue d'ensemble](07-identites-vue-ensemble.drawio) | Identity management: five access paths (people → gateway, people → admin UIs, agents, gateway → Foundry, CI → Azure), what proves identity and what checks it |
| [08 — Identités : séquence de connexion](08-identites-sequence-connexion.drawio) | Sequence: Entra ID sign-in (authorization code), token reuse by LibreChat, JWT validation by the gateway, Workload Identity to Foundry |
| [09 — Identités : fédération](09-identites-federation.drawio) | Workload Identity (AKS OIDC issuer, federated credentials, managed identities, RBAC) and GitHub Actions OIDC federation |
| [10 — Mesurer l'usage](10-monitoring-usage.drawio) | Usage monitoring: user / team / agent labels, model price list, MCP through the gateway, Prometheus and the Grafana dashboard « Usage IA » ([monitoring/](../../monitoring/README.md)) |

![Architecture Azure](png/02-architecture-azure.png)

## Conventions

Microsoft reference-architecture style: numbered steps explained under each diagram, one legend per diagram.

| Element | Style |
|---|---|
| Entra ID tenant | grey, dashed |
| Subscription | yellow |
| Resource group | blue |
| Virtual network / subnet | green, dashed |
| AKS cluster | purple |
| Kubernetes namespace | purple, dashed (lighter when optional) |
| Outside Azure | grey, dashed |

Flows: blue = a person's request (Entra ID token), purple = an agent's request (team virtual key), green = model call (Workload Identity, no key), orange dashed = identity, grey dotted = telemetry, grey dashed = optional, red = rejection.

Icons: official Azure icons (draw.io `azure2` library), Kubernetes community icons (draw.io `kubernetes` stencils), official logos of agentgateway, kagent and agentregistry (Solo.io / CNCF), and of LibreChat, Prometheus, Grafana, Helm, Terraform, GitHub Actions, MongoDB (in `src/logos`).

## Regenerate

The diagrams are generated, so geometry stays exact and every arrow is checked against every label and icon.

```bash
cd docs/architecture/src
python generate.py                               # writes ../*.drawio
git clone --depth 1 https://github.com/jgraph/drawio /tmp/drawio
pip install playwright
python render_check.py ../*.drawio --png ../png  # renders with the draw.io viewer; exit 1 if an arrow crosses text
```

`render_check.py --debug` draws the label and icon boxes it checks against. Segoe UI is the diagram font; on Linux, alias it to [Selawik](https://github.com/microsoft/Selawik) (same metrics) for faithful exports. Edits made by hand in draw.io are fine — just remember that `generate.py` overwrites the files.
