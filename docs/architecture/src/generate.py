"""Generate the architecture diagrams (draw.io) of the repository.

    python generate.py                 # writes ../*.drawio
    python render_check.py ../*.drawio --png ../png

Icons: Azure (draw.io azure2 library, official Microsoft icons), Kubernetes
(draw.io kubernetes stencils, from the Kubernetes community icon set), Solo.io
projects and other tools (official SVG logos in ./logos, embedded).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawio_lib import Diagram, az, logo  # noqa: E402

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Azure icons
I_SUB = az("general/Subscriptions.svg")
I_RG = az("general/Resource_Groups.svg")
I_ENTRA = az("identity/Azure_Active_Directory.svg")
I_APPREG = az("identity/App_Registrations.svg")
I_USERS = az("identity/Users.svg")
I_GROUPS = az("identity/Groups.svg")
I_MI = az("identity/Managed_Identities.svg")
I_AKS = az("containers/Kubernetes_Services.svg")
I_VNET = az("networking/Virtual_Networks.svg")
I_SUBNET = az("networking/Subnet.svg")
I_LB = az("networking/Load_Balancers.svg")
I_VMSS = az("compute/VM_Scale_Sets.svg")
I_FOUNDRY = az("ai_machine_learning/AI_Foundry.svg")
I_FPROJ = az("ai_machine_learning/Foundry_Project.svg")
I_FMODEL = az("ai_machine_learning/Foundry_Models.svg")
I_LAW = az("management_governance/Log_Analytics_Workspaces.svg")
I_STORAGE = az("storage/Storage_Accounts.svg")

# Kubernetes icons (draw.io kubernetes stencils)
K_NS, K_POD, K_SVC, K_SECRET, K_CRD, K_DEPLOY = (("k8s", n) for n in ("ns", "pod", "svc", "secret", "crd", "deploy"))
K_NETPOL, K_SA, K_STS = ("k8s", "netpol"), ("k8s", "sa"), ("k8s", "sts")

# Solo.io projects and other tools
L_AGW, L_KAGENT, L_AREG = logo("agentgateway"), logo("kagent"), logo("agentregistry")
L_LIBRECHAT, L_PROM, L_GRAFANA = logo("librechat"), logo("prometheus"), logo("grafana")
L_HELM, L_TF, L_GHA, L_MONGO = logo("helm"), logo("terraform"), logo("github-actions"), logo("mongodb")
L_CF, L_LE, L_CM = logo("cloudflare"), logo("letsencrypt"), logo("cert-manager")
I_PIP = az("networking/Public_IP_Addresses.svg")


# =============================================================================
# 01 — Vue fonctionnelle
# =============================================================================
def functional_view():
    d = Diagram("01-vue-fonctionnelle", 1460, 1260,
                "Vue fonctionnelle — une plateforme agentique portable",
                "Toute la plateforme vit dans Kubernetes ; seuls deux adaptateurs dépendent du cloud : l'identité et les modèles")

    AZ_BLUE, PURPLE, GREY = "#0078D4", "#773ADC", "#8A8886"

    # acteurs
    d.image("users", 96, 232, 48, I_USERS, "Collaborateurs")
    d.image("teams", 96, 362, 48, I_GROUPS, "Équipes produit")
    d.image("ops", 96, 950, 48, I_USERS, "Équipe plateforme")

    # adaptateur identité
    d.card("entra", 640, 92, 350, 64, I_ENTRA, "Microsoft Entra ID — adaptateur identité",
           "SSO des personnes, Workload Identity des pods", stroke=AZ_BLUE)

    # exposition publique (optionnelle)
    d.card("public", 1080, 92, 340, 64, L_CF, "Exposition publique (optionnelle)",
           "demos.shift-cloud.io · IP statique · Let's Encrypt · oauth2-proxy", stroke="#8A8886", dashed=1)

    # plateforme portable
    d.box("platform", 230, 180, 790, 660, "Plateforme portable · Kubernetes", "aks", icon=I_AKS)
    d.card("librechat", 260, 220, 300, 72, L_LIBRECHAT, "LibreChat",
           "conversation, SSO Entra ID, agents visibles en MCP", stroke=PURPLE, parent="platform")
    d.card("kagent", 260, 350, 300, 72, L_KAGENT, "kagent — agents déclaratifs",
           "CRD Agent et ModelConfig : un agent = une pull request", stroke=PURPLE, parent="platform")
    d.card("mcp", 260, 470, 300, 72, K_POD, "Outils MCP (kmcp)",
           "Jira, API internes — serveurs MCP en lecture seule", stroke=PURPLE, parent="platform")
    d.card("registry", 260, 590, 300, 72, L_AREG, "agentregistry — catalogue",
           "serveurs MCP, prompts, skills versionnés · déploie vers kagent", stroke=PURPLE, parent="platform")
    d.card("onboard", 260, 740, 300, 72, K_NS, "Équipes « Agent Ready »",
           "pipeline de l'équipe IA : identités, stockage, droits, namespace, dépôt", stroke=PURPLE, parent="platform")

    d.box("gwcard", 640, 220, 350, 420, "", "group", parent="platform")
    d.image("gw", 656, 234, 40, L_AGW, "", parent="gwcard")
    d.text("gw_t", 704, 232, 270, 44, "<b>agentgateway — passerelle IA</b><br>"
           "<span style=\"color:#605E5C;font-size:10px;\">chaque jeton passe par elle</span>",
           size=12, parent="gwcard")
    caps = [("Identité", "jeton Entra ID (personnes), clé virtuelle (agents)"),
            ("Plafonds", "jetons par minute et par route"),
            ("Garde-fous", "données sensibles bloquées (regex, webhook NeMo)"),
            ("Bascule", "groupes de fournisseurs, santé, éviction"),
            ("Traçabilité", "réessais, en-tête x-served-model"),
            ("Métriques", "OpenTelemetry GenAI : jetons, coûts")]
    for i, (t, desc) in enumerate(caps):
        d.chip(f"cap{i}", 656, 290 + i * 56, 318, 46,
               f"<b>{t}</b><br><span style=\"color:#605E5C;font-size:10px;\">{desc}</span>",
               fill="#F5F0FD", stroke="#C9B6F2", parent="gwcard", align="left")

    d.card("obs", 640, 740, 350, 72, L_GRAFANA, "Prometheus · Grafana",
           "jetons et coûts par modèle, équipe, fournisseur", stroke=PURPLE, parent="platform")

    # adaptateurs modèles
    d.box("models", 1080, 180, 340, 400, "Adaptateur modèles", "external")
    d.card("foundry", 1100, 220, 300, 72, I_FOUNDRY, "Microsoft Foundry",
           "Terra → Luna (EU) · Sol, Router, MAI-Image · sans clé", stroke=AZ_BLUE, parent="models")
    d.card("kaito", 1100, 350, 300, 72, K_POD, "Modèle dans AKS (KAITO)",
           "Phi-4-mini sur GPU — optionnel", stroke=PURPLE, dashed=1, parent="models")
    d.card("others", 1100, 480, 300, 72, None, "Au-delà : Bedrock, OVHcloud…",
           "un groupe de plus dans le backend", stroke=GREY, dashed=1, parent="models")

    d.text("portable", 1080, 620, 340, 118,
           "<b>Ce qui change d'un cloud à l'autre</b><br>deux adaptateurs : l'identité et les modèles."
           "<br><br><b>Ce qui ne change pas</b><br>la passerelle, les agents, les règles, les métriques : "
           "identiques sur AKS, EKS, GKE ou sur site.",
           size=11, fill="#FFF9E1", stroke="#E8B400", rounded=1)

    # socle
    d.box("socle", 230, 910, 1190, 110, "Socle : infrastructure as code", "github")
    d.card("tf", 250, 946, 250, 56, L_TF, "Terraform", "Azure puis plateforme, en 2 phases",
           stroke="#844FBA", parent="socle")
    d.card("helm", 520, 946, 250, 56, L_HELM, "Helm · Kustomize", "charts et manifestes versionnés",
           stroke="#0F1689", parent="socle")
    d.card("gha", 790, 946, 280, 56, L_GHA, "GitHub Actions", "plan sur PR, apply approuvé, OIDC",
           stroke="#2088FF", parent="socle")

    # flux
    d.edge("users", "librechat", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("teams", "kagent", "agent", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("librechat", "gwcard", "user", [(600, 256)], exit=(1, 0.5), entry=(0, 36 / 420))
    d.edge("kagent", "gwcard", "agent", exit=(1, 0.5), entry=(0, 166 / 420))
    d.edge("librechat", "kagent", "control", exit=(0.3, 1), entry=(0.3, 0))
    d.edge("kagent", "mcp", "control", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("registry", "mcp", "control", exit=(0.5, 0), entry=(0.5, 1))
    d.edge("onboard", "gwcard", "identity", [(600, 776), (600, 586)], exit=(1, 0.5), entry=(0, 366 / 420))
    d.edge("librechat", "entra", "identity", [(515, 124)], exit=(255 / 300, 0), entry=(0, 0.5))
    d.edge("gwcard", "entra", "identity", exit=(0.5, 0), entry=(0.5, 1))
    d.edge("gwcard", "foundry", "model", exit=(1, 36 / 420), entry=(0, 0.5))
    d.edge("gwcard", "kaito", "optional", exit=(1, 166 / 420), entry=(0, 0.5))
    d.edge("gwcard", "others", "optional", exit=(1, 296 / 420), entry=(0, 0.5))
    d.edge("gwcard", "obs", "telemetry", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("ops", "tf", "deploy", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("socle", "platform", "deploy", exit=(95 / 1190, 0), entry=(95 / 790, 1))

    for n, x, y in ((1, 172, 206), (2, 604, 222), (3, 172, 336), (4, 588, 352), (5, 1028, 222),
                    (6, 1028, 352), (7, 1028, 482), (8, 480, 94), (9, 826, 680), (10, 606, 680)):
        d.badge(n, x, y)

    d.legend(40, 1070, ["user", "agent", "model", "identity", "telemetry", "optional", "deploy"])
    d.steps(420, 1070, 1000, [
        (1, "Les collaborateurs utilisent LibreChat, connectés avec leur compte Entra ID."),
        (2, "LibreChat envoie chaque requête à la passerelle avec le jeton de l'utilisateur."),
        (3, "Les équipes livrent leurs agents par pull request (CRD kagent)."),
        (4, "Les agents appellent la passerelle avec la clé virtuelle de leur équipe."),
        (5, "La passerelle appelle Microsoft Foundry : gpt-5.6-terra, bascule vers gpt-5.6-luna."),
        (6, "Optionnel : un modèle servi dans le cluster, avec les mêmes règles."),
        (7, "Au-delà d'Azure : un fournisseur de plus, sans toucher aux agents."),
        (8, "Entra ID : SSO des personnes et validation des jetons par la passerelle."),
        (9, "Chaque requête produit ses métriques : jetons et coûts visibles dans Grafana."),
        (10, "Le pipeline « Agent Ready » de l'équipe IA prépare l'espace de l'équipe et sa clé virtuelle."),
    ], cols=2, col_w=500)
    return d


# =============================================================================
# 02 — Architecture Azure
# =============================================================================
def azure_architecture():
    d = Diagram("02-architecture-azure", 2080, 1560,
                "Architecture Azure de référence",
                "Entra ID · AKS · Solo.io agentgateway et kagent · Microsoft Foundry — deux portes : publique (optionnelle) et interne ; ce que déploie le Terraform du dépôt")

    # --- acteurs ---------------------------------------------------------------
    d.image("users", 96, 600, 48, I_USERS, "Collaborateurs\nnavigateur, curl")
    d.image("teams", 96, 1060, 48, I_GROUPS, "Équipes produit\nkubectl apply / PR")

    # --- hors abonnement -----------------------------------------------------
    d.box("cf", 20, 90, 220, 140, "Cloudflare DNS", "external", icon=L_CF)
    d.chip("cf1", 32, 124, 196, 26, "demos.shift-cloud.io", parent="cf", size=10)
    d.chip("cf2", 32, 156, 196, 26, "*.demos.shift-cloud.io", parent="cf", size=10)
    d.text("cf_t", 32, 188, 200, 34, "A → IP statique · DNS seul<br>(optionnel)", size=10,
           color="#605E5C", parent="cf")

    d.box("tenant", 260, 90, 1300, 140, "Tenant Microsoft Entra ID", "tenant", icon=I_ENTRA)
    d.image("entra", 320, 120, 48, I_ENTRA, "Microsoft Entra ID\nutilisateurs · groupes", parent="tenant")
    d.image("app_lc", 620, 120, 48, I_APPREG, "App « LibreChat »\nclient OIDC", parent="tenant")
    d.image("app_portal", 920, 120, 48, I_APPREG, "App « Portail »\noauth2-proxy (optionnel)", parent="tenant")
    d.image("app_api", 1330, 120, 48, I_APPREG, "App « API passerelle »\nscope agents.invoke · jetons v2", parent="tenant")

    d.box("beyond", 1590, 90, 460, 140, "Au-delà d'Azure (optionnel)", "external")
    d.chip("bedrock", 1606, 126, 200, 30, "Amazon Bedrock", parent="beyond", dashed=1)
    d.chip("ovh", 1830, 126, 204, 30, "OVHcloud AI Endpoints", parent="beyond", dashed=1)
    d.text("beyond_t", 1606, 166, 420, 36,
           "un fournisseur de plus = un groupe de plus dans le backend <i>llm</i> ;<br>rien ne change pour les agents",
           size=10, color="#605E5C", parent="beyond")

    # --- abonnement ------------------------------------------------------------
    d.box("sub", 260, 260, 1790, 990, "Abonnement Azure", "sub", icon=I_SUB)
    d.box("rg", 290, 310, 1540, 920, "rg-agwpoc-<suffixe>", "rg", parent="sub", icon=I_RG)
    d.image("pip", 318, 600, 48, I_PIP, "IP publique\nstatique", parent="rg")
    d.box("vnet", 400, 360, 975, 850, "vnet-agwpoc · 10.40.0.0/16", "vnet", parent="rg", icon=I_VNET)
    d.box("snet", 425, 405, 925, 785, "snet-aks · 10.40.0.0/20", "subnet", parent="vnet", icon=I_SUBNET)
    d.box("aks", 450, 450, 875, 720, "aks-agwpoc", "aks", parent="snet", icon=I_AKS,
          sub="Azure CNI Overlay · Cilium · émetteur OIDC · Workload Identity")

    # colonne 1 — porte publique
    d.box("ns_pub", 475, 530, 210, 240, "porte publique", "ns-opt", parent="aks", icon=K_NS,
          sub="ns agentgateway-system")
    d.image("gw_pub", 556, 600, 48, L_AGW, "agentgateway-public\nLoadBalancer · HTTPS", parent="ns_pub")
    d.box("ns_cm", 475, 800, 210, 160, "cert-manager", "ns-opt", parent="aks", icon=K_NS)
    d.image("cm", 556, 845, 48, L_CM, "cert-manager\nLet's Encrypt", parent="ns_cm")

    # colonne 2 — applications
    d.box("ns_lc", 725, 530, 325, 120, "librechat", "ns", parent="aks", icon=K_NS)
    d.image("librechat", 745, 564, 48, L_LIBRECHAT, "LibreChat\n+ MongoDB", parent="ns_lc")
    d.box("ns_mon", 725, 680, 325, 145, "monitoring", "ns", parent="aks", icon=K_NS)
    d.image("o2g", 745, 714, 48, K_POD, "oauth2-proxy\n(optionnel)", parent="ns_mon")
    d.image("grafana", 865, 714, 48, L_GRAFANA, "Grafana", parent="ns_mon")
    d.image("prom", 975, 714, 48, L_PROM, "Prometheus", parent="ns_mon")
    d.box("ns_ka", 725, 855, 325, 150, "kagent", "ns", parent="aks", icon=K_NS)
    d.image("o2k", 745, 890, 48, K_POD, "oauth2-proxy\n(optionnel)", parent="ns_ka")
    d.image("kagent", 865, 890, 48, L_KAGENT, "kagent\nUI · contrôleur · MCP", parent="ns_ka")
    d.box("ns_eq", 725, 1035, 325, 115, "equipe-produit", "ns", parent="aks", icon=K_NS)
    d.image("agent", 745, 1060, 48, K_POD, "assistant-tickets", parent="ns_eq")

    # colonne 3 — porte interne
    d.box("ns_int", 1090, 530, 215, 240, "porte interne", "ns", parent="aks", icon=K_NS,
          sub="ns agentgateway-system")
    d.image("gw", 1230, 600, 48, L_AGW, "agentgateway-proxy\nClusterIP · policies", parent="ns_int")
    d.box("ns_mo", 1090, 800, 215, 160, "models", "ns-opt", parent="aks", icon=K_NS)
    d.image("phi", 1170, 845, 48, K_POD, "Phi-4-mini · KAITO\nGPU (optionnel)", parent="ns_mo", opacity=70)

    # --- Foundry, identités, journaux ----------------------------------------
    d.box("foundry", 1430, 360, 380, 440, "Microsoft Foundry", "group", parent="rg", icon=I_FOUNDRY)
    d.image("fproj", 1460, 420, 48, I_FPROJ, "proj-agwpoc\nprojet Foundry", parent="foundry")
    d.image("facct", 1460, 600, 48, I_FOUNDRY, "fdy-agwpoc\nsans clé", parent="foundry")
    models = [("m_sol", 430, "gpt-5.6-sol\nGlobal · tâches complexes"),
              ("m_terra", 510, "gpt-5.6-terra\nData Zone EU · groupe 1"),
              ("m_luna", 590, "gpt-5.6-luna\nData Zone EU · groupe 2"),
              ("m_router", 670, "model-router\nData Zone EU"),
              ("m_img", 750, "MAI-Image-2.6\nGlobal · image (préversion)")]
    for cid, cy, lab in models:
        d.image(cid, 1600, cy - 18, 36, I_FMODEL, lab, parent="foundry", pos="right", font=10)

    d.image("mi_gw", 1450, 830, 48, I_MI, "id-agentgateway\nporte interne", parent="rg")
    d.image("mi_pub", 1600, 830, 48, I_MI, "id-agentgateway-public\nporte publique", parent="rg")
    d.image("mi_ka", 1750, 830, 48, I_MI, "id-kagent\nWorkload Identity", parent="rg")
    d.image("law", 1460, 960, 48, I_LAW, "log-agwpoc\nContainer Insights · diagnostics", parent="rg")

    d.box("rg_nodes", 1855, 310, 180, 400, "rg-…-nodes", "rg", parent="sub", icon=I_RG, sub="géré par AKS")
    d.image("vmss", 1920, 390, 48, I_VMSS, "Pool système\n2 × D4as_v5", parent="rg_nodes")
    d.image("vmss_gpu", 1920, 540, 48, I_VMSS, "Pool GPU KAITO\nA10 · optionnel", parent="rg_nodes", opacity=50)
    d.box("rg_tf", 1855, 740, 180, 300, "rg-…-tfstate", "rg", parent="sub", icon=I_RG, sub="deploy.ps1 / bootstrap")
    d.image("st", 1920, 810, 48, I_STORAGE, "st…tf…\nétat Terraform", parent="rg_tf")
    d.image("mi_gh", 1920, 930, 48, I_MI, "id-…-github\nOIDC GitHub", parent="rg_tf")

    # --- flux -----------------------------------------------------------------
    d.edge("users", "cf", "control", exit=(0.25, 0), entry=(88 / 220, 1))
    d.edge("users", "tenant", "identity", [(132, 245), (300, 245)], exit=(0.75, 0), entry=(40 / 1300, 1))
    d.edge("users", "pip", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("pip", "gw_pub", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("gw_pub", "librechat", "user", [(705, 624), (705, 588)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("gw_pub", "o2g", "user", [(705, 624), (705, 738)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("gw_pub", "o2k", "user", [(705, 624), (705, 914)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("o2g", "grafana", "control", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("o2k", "kagent", "control", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("librechat", "gw", "user", [(1070, 588), (1070, 612)], exit=(1, 0.5), entry=(0, 0.25))
    d.edge("teams", "agent", "agent", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("agent", "gw", "agent", [(1070, 1084), (1070, 636)], exit=(1, 0.5), entry=(0, 0.75))
    d.edge("gw", "facct", "model", exit=(1, 0.5), entry=(0, 0.5))
    for cid, cy, _ in models:
        pts = [] if cy == 624 else [(1560, 624), (1560, cy)]
        d.edge("facct", cid, "control", pts, exit=(1, 0.5), entry=(0, 0.5))
    d.edge("gw", "phi", "optional", [(1316, 636), (1316, 869)], exit=(1, 0.75), entry=(1, 0.5))
    d.edge("gw", "app_api", "identity", [(1266, 144)], exit=(0.75, 0), entry=(0, 0.5))
    d.edge("aks", "law", "telemetry", exit=(1, (984 - 450) / 720), entry=(0, 0.5))
    d.edge("foundry", "law", "telemetry", [(1822, 790), (1822, 984)], exit=(1, 430 / 440), entry=(1, 0.5))

    for n, x, y in ((1, 60, 400), (2, 140, 400), (3, 372, 586), (4, 711, 652), (5, 990, 552),
                    (6, 990, 1050), (7, 1392, 590), (8, 1528, 690), (9, 1322, 740), (10, 1274, 290),
                    (11, 1392, 950), (12, 2016, 96)):
        d.badge(n, x, y)

    # --- légende et étapes -------------------------------------------------------
    d.legend(40, 1290, ["user", "agent", "model", "identity", "telemetry", "optional", "control"])
    d.steps(440, 1290, 1600, [
        (1, "Optionnel : demos.shift-cloud.io et *.demos se résolvent chez Cloudflare vers l'IP statique."),
        (2, "Connexion Entra ID : LibreChat (OIDC) et, pour Grafana et kagent, oauth2-proxy (app « Portail »)."),
        (3, "L'IP statique porte le Service LoadBalancer de la porte publique ; certificats Let's Encrypt."),
        (4, "La porte publique route vers LibreChat, et vers Grafana et kagent seulement via oauth2-proxy."),
        (5, "LibreChat appelle la porte interne sur <b>/v1</b> avec le jeton Entra ID de l'utilisateur."),
        (6, "Les agents d'une équipe appellent <b>/agents/v1</b> avec la clé virtuelle de l'équipe."),
        (7, "La porte interne appelle Microsoft Foundry avec Workload Identity : aucune clé d'API."),
        (8, "Bascule gpt-5.6-terra → gpt-5.6-luna (groupes du backend <i>llm</i>) ; Sol pour les tâches complexes."),
        (9, "Optionnel : Phi-4-mini servi dans AKS par KAITO, derrière la même passerelle (<b>/aks/v1</b>)."),
        (10, "La passerelle valide les jetons avec les clés publiques d'Entra ID (audience : API passerelle)."),
        (11, "Container Insights et diagnostics Foundry vers Log Analytics ; métriques GenAI dans Prometheus."),
        (12, "Au-delà d'Azure : Bedrock, OVHcloud… un groupe de plus dans le backend, rien ne change pour les agents."),
    ], cols=2, col_w=800)
    return d


# =============================================================================
# 03 — Plateforme Kubernetes
# =============================================================================
def kubernetes_platform():
    d = Diagram("03-plateforme-kubernetes", 1820, 1520,
                "Plateforme Kubernetes — namespaces et objets",
                "Ce que la phase 2 du Terraform installe dans AKS ; identique sur tout cluster Kubernetes (seuls Entra ID et Foundry sont spécifiques à Azure)")
    P = "#773ADC"

    def c(cid, x, y, icon, title, desc, parent, w=320, dashed=0, stroke=P):
        return d.card(cid, x, y, w, 50, icon, title, desc, parent=parent, stroke=stroke,
                      dashed=dashed, icon_size=28)

    d.image("ws", 106, 191, 48, I_USERS, "Poste de travail\nkubectl port-forward")
    d.image("teams", 106, 1061, 48, I_GROUPS, "Équipe produit\nkubectl apply")

    d.box("aks", 260, 100, 1240, 1060, "aks-agwpoc", "aks", icon=I_AKS)

    # colonne 1
    d.box("ns_lc", 290, 150, 360, 250, "librechat", "ns", parent="aks", icon=K_NS)
    c("lc_svc", 310, 190, K_SVC, "Service librechat", "ClusterIP :3080", "ns_lc")
    c("lc", 310, 260, L_LIBRECHAT, "LibreChat v0.8.8", "OIDC Entra ID · jeton réutilisé (aud = API passerelle)", "ns_lc")
    c("mongo", 310, 330, L_MONGO, "MongoDB", "StatefulSet · conversations", "ns_lc")

    d.box("ns_ka", 290, 440, 360, 390, "kagent", "ns", parent="aks", icon=K_NS)
    c("ka_svc", 310, 480, K_SVC, "Service kagent-controller", "MCP :8083 · UI :8080", "ns_ka")
    c("ka", 310, 550, L_KAGENT, "Contrôleur kagent + kmcp", "réconcilie Agent, ModelConfig, MCPServer", "ns_ka")
    c("ka_mc", 310, 620, K_CRD, "ModelConfig default", "→ /agents/v1 · Secret gateway-key", "ns_ka")
    c("ka_sa", 310, 690, K_SA, "ServiceAccount kagent", "Workload Identity (id-kagent)", "ns_ka")
    c("ka_o2p", 310, 760, K_POD, "oauth2-proxy (sous-chart)", "Entra ID devant l'UI · optionnel", "ns_ka", dashed=1)

    # colonne 2
    d.box("ns_gw", 690, 150, 420, 620, "agentgateway-system", "ns", parent="aks", icon=K_NS)
    c("gw_svc", 710, 190, K_SVC, "Service agentgateway-proxy", "ClusterIP :80 — porte interne", "ns_gw", w=380)
    c("gw", 710, 260, L_AGW, "Gateway agentgateway-proxy", "SA agentgateway-proxy → id-agentgateway", "ns_gw", w=380)
    c("gw_pub", 710, 330, L_AGW, "Gateway agentgateway-public", "optionnelle · LoadBalancer · HTTPS · id-agentgateway-public", "ns_gw", w=380, dashed=1)
    c("gw_rt", 710, 400, K_CRD, "HTTPRoutes", "/v1 · /agents/v1 · /mcp · llm-aks · routes publiques", "ns_gw", w=380)
    c("gw_pol", 710, 470, K_CRD, "AgentgatewayPolicy × 6", "accès · garde-fous · résilience · metriques-usage", "ns_gw", w=380)
    c("gw_be", 710, 540, K_CRD, "AgentgatewayBackend llm · mcp", "terra EU → luna EU · outils kagent · ConfigMap model-costs", "ns_gw", w=380)
    c("gw_be2", 710, 610, K_CRD, "AgentgatewayBackend llm-aks", "optionnel · models/phi-4-mini:80", "ns_gw", w=380, dashed=1)
    c("gw_vk", 710, 680, K_SECRET, "Secrets vk-<équipe>", "clés virtuelles · agentic.io/virtual-key", "ns_gw", w=380)

    d.box("ns_eq", 690, 810, 420, 320, "equipe-produit", "ns", parent="aks", icon=K_NS)
    c("eq_pod", 710, 850, K_POD, "Pod assistant-tickets", "l'agent en exécution → /agents/v1", "ns_eq", w=380)
    c("eq_agent", 710, 920, K_CRD, "Agent assistant-tickets", "prompt · outils jira_search, jira_get_issue", "ns_eq", w=380)
    c("eq_mc", 710, 990, K_CRD, "ModelConfig passerelle-llm", "jamais un fournisseur : la passerelle", "ns_eq", w=380)
    c("eq_mcp", 710, 1060, K_SECRET, "MCPServer jira-mcp · Secrets", "gateway-key · jira-credentials", "ns_eq", w=380)

    # colonne 3
    d.box("ns_mo", 1180, 150, 290, 320, "models (optionnel)", "ns-opt", parent="aks", icon=K_NS)
    c("mo_svc", 1200, 190, K_SVC, "Service phi-4-mini", "API OpenAI (vLLM) :80", "ns_mo", w=250, dashed=1)
    c("mo_ws", 1200, 260, K_CRD, "Workspace phi-4-mini", "KAITO · nœud GPU A10", "ns_mo", w=250, dashed=1)
    c("mo_np", 1200, 330, K_NETPOL, "NetworkPolicy", "passerelle et Prometheus seulement", "ns_mo", w=250, dashed=1)
    c("mo_pm", 1200, 400, K_CRD, "PodMonitor kaito-vllm", "métriques vLLM", "ns_mo", w=250, dashed=1)

    d.box("ns_mon", 1180, 510, 290, 260, "monitoring", "ns", parent="aks", icon=K_NS)
    c("prom", 1200, 550, L_PROM, "Prometheus", "kube-prometheus-stack", "ns_mon", w=250)
    c("graf", 1200, 620, L_GRAFANA, "Grafana · « Usage IA »", "coût, jetons, outils par utilisateur", "ns_mon", w=250)
    c("o2g", 1200, 690, K_POD, "oauth2-proxy-grafana", "Entra ID devant Grafana · optionnel", "ns_mon", w=250, dashed=1)

    d.box("ns_cm", 1180, 810, 290, 110, "cert-manager (optionnel)", "ns-opt", parent="aks", icon=K_NS)
    c("cm", 1200, 850, L_CM, "cert-manager", "Let's Encrypt · public-*-tls", "ns_cm", w=250, dashed=1)
    d.box("ns_reg", 1180, 950, 290, 110, "agentregistry", "ns", parent="aks", icon=K_NS)
    c("reg", 1200, 990, L_AREG, "agentregistry v0.4.0", "catalogue · ClusterIP · écrit dans les ns d'équipe", "ns_reg", w=250)

    # hors cluster
    d.image("entra", 1580, 94, 48, I_ENTRA, "Microsoft Entra ID\nJWKS · échange de jetons", pos="right")
    d.image("foundry", 1580, 300, 48, I_FOUNDRY, "Microsoft Foundry\nfdy-agwpoc · sans clé", pos="right")

    # flux
    d.edge("ws", "lc_svc", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("lc", "gw_svc", "user", [(670, 285), (670, 205)], exit=(1, 0.5), entry=(0, 0.3))
    d.edge("gw_rt", "ka_svc", "user", [(660, 425), (660, 505)], exit=(0, 0.5), entry=(1, 0.5))
    d.edge("ka", "eq_agent", "control", [(660, 575), (660, 945)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("eq_pod", "gw_svc", "agent", [(680, 875), (680, 225)], exit=(0, 0.5), entry=(0, 0.7))
    d.edge("gw_svc", "gw", "control", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("gw_pol", "entra", "identity", [(1125, 495), (1125, 118)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("gw_be", "foundry", "model", [(1145, 565), (1145, 134), (1530, 134), (1530, 324)],
           exit=(1, 0.5), entry=(0, 0.5))
    d.edge("gw_be2", "mo_svc", "optional", [(1165, 635), (1165, 215)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("ns_gw", "prom", "telemetry", exit=(1, 440 / 620), entry=(0, 0.8))
    d.edge("ns_mo", "prom", "telemetry", exit=(145 / 290, 1), entry=(125 / 250, 0))
    d.edge("prom", "graf", "control", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("o2g", "graf", "control", exit=(0.8, 0), entry=(0.8, 1))
    d.edge("teams", "ns_eq", "agent", exit=(1, 0.5), entry=(0, 275 / 320))

    for n, x, y in ((1, 196, 181), (2, 640, 228), (3, 620, 408), (4, 624, 900), (5, 686, 782),
                    (6, 1094, 437), (7, 1538, 214), (8, 1170, 234), (9, 1132, 600), (10, 560, 1051)):
        d.badge(n, x, y)

    d.legend(40, 1210, ["user", "agent", "model", "identity", "telemetry", "optional", "control"])
    d.steps(440, 1210, 1340, [
        (1, "Accès à LibreChat par <b>kubectl port-forward</b>, ou par la porte publique optionnelle (schéma 06)."),
        (2, "LibreChat appelle le Service agentgateway-proxy sur <b>/v1</b> avec le jeton Entra ID de l'utilisateur."),
        (3, "LibreChat voit les agents par la passerelle (<b>/mcp</b>, même jeton) : elle relaie à kagent et compte chaque outil."),
        (4, "Le contrôleur kagent réconcilie l'Agent de l'équipe et crée son pod."),
        (5, "Le pod de l'agent appelle <b>/agents/v1</b> avec la clé <i>gateway-key</i> de son équipe."),
        (6, "La policy <i>acces-llm</i> valide les jetons avec les clés publiques d'Entra ID."),
        (7, "Le backend <i>llm</i> appelle Foundry avec un jeton Workload Identity : aucune clé stockée."),
        (8, "Optionnel : le backend <i>llm-aks</i> appelle Phi-4-mini dans le namespace <i>models</i>."),
        (9, "Prometheus collecte les métriques de la passerelle (jetons, coût, outils, par utilisateur) et de vLLM ; Grafana les affiche."),
        (10, "L'équipe applique ses manifestes (Agent, ModelConfig, MCPServer) dans son namespace."),
    ], cols=2, col_w=670)
    return d


# =============================================================================
# 04 — Chaîne de contrôle d'une requête
# =============================================================================
def request_flow():
    d = Diagram("04-flux-requete-securite", 1820, 1010,
                "Chaîne de contrôle d'une requête",
                "Toutes les règles sont portées par la passerelle, attachées aux routes : elles valent pour Foundry, un modèle dans AKS ou un autre cloud")
    P, RED, AZ_BLUE = "#773ADC", "#C50F1F", "#0078D4"

    d.card("lc", 40, 190, 230, 64, L_LIBRECHAT, "Collaborateur · LibreChat",
           "<b>/v1</b> · Bearer &lt;jeton Entra ID&gt;", stroke=AZ_BLUE)
    d.card("ag", 40, 330, 230, 64, L_KAGENT, "Agent d'équipe · kagent",
           "<b>/agents/v1</b> · Bearer &lt;clé virtuelle&gt;", stroke=P)
    d.card("pubdoor", 40, 470, 230, 64, L_CF, "Porte publique (optionnelle)",
           "api.demos.shift-cloud.io : mêmes étapes, mêmes policies", stroke="#8A8886", dashed=1)
    d.card("entra", 560, 86, 300, 44, I_ENTRA, "Microsoft Entra ID", "clés publiques (JWKS)",
           stroke=AZ_BLUE, icon_size=24)

    d.box("gwbox", 320, 140, 1080, 400, "agentgateway", "ns", icon=L_AGW)
    stages = [
        ("s1", "Authentification", "JWT Entra ID : émetteur, audience, signature · ou clé virtuelle", "acces-llm · acces-agents"),
        ("s2", "Plafond de jetons", "50 000 jetons / min par route", "rateLimit local"),
        ("s3", "Garde-fous requête", "carte bancaire (regex intégrée) · webhook NeMo en option", "garde-fous-llm"),
        ("s4", "Routage et santé", "groupe 1 tant qu'il est sain · éviction 60 s sur 404/429/5xx", "llm-resilience"),
        ("s5", "Réessai", "1 réessai : le groupe suivant sert la requête", "llm-retry-tracabilite"),
    ]
    for i, (cid, t, desc, pol) in enumerate(stages):
        x = 350 + i * 210
        d.card(cid, x, 200, 180, 80, None, t,
               f"{desc}<br><i style=\"color:{P};\">{pol}</i>", stroke=P, fill="#F5F0FD", parent="gwbox")
        d.badge(i + 1, x - 10, 190, parent="gwbox")
        if i < 4:
            d.edge(cid, stages[i + 1][0], "user", exit=(1, 0.5), entry=(0, 0.5))
    rejects = [("r1", "s1", "<b>401</b> — pas de jeton valide"),
               ("r2", "s2", "<b>429</b> — plafond atteint"),
               ("r3", "s3", "<b>Rejet</b> — « donnée de carte bancaire détectée »")]
    for i, (rid, sid, txt) in enumerate(rejects):
        d.chip(rid, 350 + i * 210, 320, 180, 40, txt, fill="#FDE7E9", stroke=RED, color="#A80000",
               size=10, parent="gwbox")
        d.edge(sid, rid, "reject", exit=(0.5, 1), entry=(0.5, 0))
    d.chip("r4", 980, 320, 180, 40, "fournisseur en échec : <b>évincé 60 s</b>", fill="#FFF4CE",
           stroke="#C19C00", color="#6B5200", size=10, parent="gwbox")
    d.edge("s4", "r4", "control", exit=(0.5, 1), entry=(0.5, 0))

    d.card("t1", 1190, 420, 180, 80, None, "Réponse tracée",
           "en-tête <b>x-served-model</b> : le modèle qui a vraiment répondu", stroke=AZ_BLUE, parent="gwbox")
    d.card("t2", 980, 420, 180, 80, None, "Métriques GenAI",
           "OpenTelemetry : jetons entrée / sortie, modèle, fournisseur", stroke=AZ_BLUE, parent="gwbox")
    d.badge(7, 1180, 410, parent="gwbox")

    d.box("foundry", 1450, 170, 330, 190, "Microsoft Foundry", "group", icon=I_FOUNDRY)
    d.card("g1", 1470, 210, 290, 50, I_FMODEL, "gpt-5.6-terra · Data Zone EU", "groupe 1 — production courante", stroke=AZ_BLUE,
           parent="foundry", icon_size=28)
    d.card("g2", 1470, 290, 290, 50, I_FMODEL, "gpt-5.6-luna · Data Zone EU", "groupe 2 — si le groupe 1 est évincé",
           stroke=AZ_BLUE, parent="foundry", icon_size=28)
    d.card("kaito", 1450, 560, 330, 56, K_POD, "Route /aks/v1 : Phi-4-mini (KAITO)",
           "optionnel — les mêmes étapes 1 à 3 s'appliquent", stroke=P, dashed=1, icon_size=28)

    d.card("prom", 980, 600, 180, 56, L_PROM, "Prometheus", "ServiceMonitor", stroke=P, icon_size=28)
    d.card("graf", 1190, 600, 180, 56, L_GRAFANA, "Grafana", "jetons et coûts", stroke=P, icon_size=28)

    d.edge("lc", "s1", "user", exit=(1, 0.5), entry=(0, 22 / 80))
    d.edge("ag", "s1", "agent", [(300, 362), (300, 256)], exit=(1, 0.5), entry=(0, 56 / 80))
    d.edge("s1", "entra", "identity", [(512, 108)], exit=(162 / 180, 0), entry=(0, 0.5))
    d.edge("s5", "g1", "model", exit=(1, 35 / 80), entry=(0, 0.5))
    d.edge("s5", "g2", "optional", [(1420, 264), (1420, 315)], exit=(1, 0.8), entry=(0, 0.5))
    d.edge("foundry", "t1", "response", [(1615, 460)], exit=(0.5, 1), entry=(1, 0.5))
    d.edge("t1", "t2", "response", exit=(0, 0.5), entry=(1, 0.5))
    d.edge("t2", "ag", "response", [(155, 460)], exit=(0, 0.5), entry=(0.5, 1))
    d.edge("t2", "prom", "telemetry", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("prom", "graf", "telemetry", exit=(1, 0.5), entry=(0, 0.5))
    d.badge(6, 1392, 206)

    d.legend(40, 720, ["user", "agent", "model", "identity", "reject", "response", "telemetry", "optional"])
    d.steps(470, 720, 1310, [
        (1, "Identité : jeton Entra ID validé (émetteur, audience, signature JWKS) sur <b>/v1</b>, clé virtuelle d'équipe sur <b>/agents/v1</b>."),
        (2, "Plafond de jetons par route : au-delà, <b>429</b> — la dépense s'arrête d'elle-même."),
        (3, "Garde-fous : un numéro de carte bancaire est rejeté avant le modèle ; webhook NeMo en option."),
        (4, "Routage vers le backend <i>llm</i> : un fournisseur qui répond 404, 429 ou 5xx est évincé 60 s."),
        (5, "Un réessai : la requête qui échoue est servie par le groupe suivant (gpt-5.6-luna)."),
        (6, "Appel Foundry sans clé : jeton Workload Identity de la passerelle."),
        (7, "La réponse porte <b>x-served-model</b> ; les métriques GenAI partent vers Prometheus et Grafana."),
    ], cols=2, col_w=655)
    return d


# =============================================================================
# 05 — Déploiement
# =============================================================================
def deployment():
    d = Diagram("05-deploiement", 1820, 1120,
                "Déploiement — infrastructure as code",
                "GitHub Actions (OIDC, sans secret) ou poste Windows (deploy.ps1) : le même Terraform, en deux phases")
    GH, AZ_BLUE, P = "#24292F", "#0078D4", "#773ADC"

    d.box("gh", 40, 100, 520, 400, "GitHub — dépôt et workflow terraform.yml", "github")
    d.card("pr", 60, 150, 230, 60, L_GHA, "Pull request", "terraform/, gateway/, demos/…", stroke=GH, parent="gh")
    d.card("lint", 310, 150, 230, 60, None, "Job lint", "fmt · validate · check_wiring · kustomize · shellcheck", stroke=GH, parent="gh")
    d.card("plan", 310, 240, 230, 60, None, "Job plan", "phase 1 · plan résumé dans la PR", stroke=GH, parent="gh")
    d.card("run", 60, 330, 230, 60, L_GHA, "Run workflow", "action : apply ou destroy", stroke=GH, parent="gh")
    d.card("env", 310, 330, 230, 60, None, "Environnement « demo »", "approbation requise · branche main", stroke=GH, parent="gh")
    d.card("apply", 310, 420, 230, 60, None, "Job apply", "phase 1 puis phase 2", stroke=GH, parent="gh")

    d.box("ws", 40, 540, 520, 250, "Poste Windows", "tenant", icon=az("general/Powershell.svg"))
    d.card("ps", 60, 590, 480, 90, None, "scripts/deploy.ps1",
           "outils et compte · resource providers · catalogue Foundry · état Terraform · tfvars · "
           "phase 1 · kubectl get-credentials · phase 2 — chaque plan attend votre « oui »",
           stroke="#012456", parent="ws")
    d.card("destroy", 60, 710, 480, 56, None, "scripts/destroy.ps1", "détruit tout, conserve l'état Terraform",
           stroke="#012456", parent="ws")

    d.card("entra", 640, 164, 280, 60, I_ENTRA, "Entra ID — fédération OIDC",
           "jeton GitHub → id-agwpoc-github, sans secret", stroke=AZ_BLUE)
    d.card("cf", 640, 600, 280, 60, L_CF, "Cloudflare DNS (optionnel)",
           "A demos et *.demos → IP statique · CLOUDFLARE_API_TOKEN", stroke="#F38020", dashed=1)
    d.card("tf", 640, 420, 280, 80, L_TF, "Terraform ≥ 1.9",
           "azurerm 5 · azuread · helm · kubernetes<br>deploy_platform = false, puis true", stroke="#844FBA")

    d.box("sub", 1000, 100, 780, 730, "Abonnement Azure", "sub", icon=I_SUB)
    d.box("rg_tf", 1030, 140, 720, 130, "rg-agwpoc-tfstate", "rg", parent="sub", icon=I_RG)
    d.image("mi_gh", 1080, 170, 48, I_MI, "id-agwpoc-github\nContributor · RBAC Admin · Blob Data", parent="rg_tf", pos="right")
    d.image("st", 1440, 170, 48, I_STORAGE, "st…tf… · conteneur tfstate\nEntra uniquement, sans clé partagée", parent="rg_tf", pos="right")

    d.box("rg", 1030, 310, 720, 220, "Phase 1 — rg-agwpoc-<suffixe>", "rg", parent="sub", icon=I_RG)
    for i, (icon, lab) in enumerate([(I_VNET, "vnet-agwpoc"), (I_AKS, "aks-agwpoc\n2 × D4as_v5"), (I_FOUNDRY, "fdy-agwpoc\n5 modèles"),
                                     (I_MI, "identités\nWorkload Identity"), (I_LAW, "log-agwpoc"),
                                     (I_PIP, "IP publique\n(optionnelle)")]):
        d.image(f"p1_{i}", 1075 + i * 112, 370, 48, icon, lab, parent="rg")
    d.text("p1_t", 1060, 470, 680, 40,
           "modules <b>foundation</b> · <b>ai</b> · <b>identity</b> — et, dans Entra ID, les applications "
           "« API passerelle » et « LibreChat »", size=10, color="#004E8C", parent="rg", wrap=True)

    d.box("aks", 1030, 570, 720, 230, "Phase 2 — dans AKS (Helm, Kustomize)", "aks", parent="sub", icon=I_AKS)
    for i, (icon, lab) in enumerate([(L_AGW, "agentgateway\n2 Gateways"), (L_KAGENT, "kagent\n+ kmcp"),
                                     (L_PROM, "Prometheus\nGrafana"), (L_LIBRECHAT, "LibreChat"),
                                     (K_NS, "équipes\nnamespace + clé"), (L_CM, "cert-manager\n(optionnel)")]):
        d.image(f"p2_{i}", 1075 + i * 112, 630, 48, icon, lab, parent="aks")
    d.text("p2_t", 1060, 740, 680, 40,
           "optionnel : <i>models/</i> (KAITO, GPU) et <i>guardrails/</i> (NeMo), activés par variable",
           size=10, color="#4B1FA0", parent="aks", wrap=True)

    # flux
    d.edge("pr", "lint", "deploy", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("lint", "plan", "deploy", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("run", "env", "deploy", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("env", "apply", "deploy", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("plan", "tf", "deploy", [(590, 270), (590, 440)], exit=(1, 0.5), entry=(0, 0.25))
    d.edge("apply", "tf", "deploy", exit=(1, 0.5), entry=(0, 30 / 80))
    d.edge("ps", "tf", "deploy", [(600, 635), (600, 480)], exit=(1, 0.5), entry=(0, 0.75))
    d.edge("tf", "entra", "identity", exit=(0.5, 0), entry=(0.5, 1))
    d.edge("entra", "mi_gh", "identity", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("tf", "st", "deploy", [(960, 440), (960, 250), (1464, 250)], exit=(1, 0.25), entry=(0.5, 1))
    d.edge("tf", "rg", "deploy", exit=(1, 0.5), entry=(0, 150 / 220))
    d.edge("tf", "aks", "deploy", [(975, 480), (975, 685)], exit=(1, 0.75), entry=(0, 115 / 230))
    d.edge("tf", "cf", "optional", exit=(0.5, 1), entry=(0.5, 0))

    for n, x, y in ((1, 288, 122), (2, 288, 302), (3, 790, 300), (4, 966, 330), (5, 1004, 425),
                    (6, 946, 590), (7, 606, 560), (8, 790, 530)):
        d.badge(n, x, y)

    d.legend(40, 870, ["deploy", "identity", "optional"])
    d.steps(440, 870, 1340, [
        (1, "Pull request : lint (format, validation, câblage des modules, kustomize, shellcheck) puis plan de la phase 1."),
        (2, "Run workflow : apply ou destroy, derrière l'environnement protégé « demo » (approbation)."),
        (3, "Terraform obtient un jeton Azure par fédération OIDC : aucun secret stocké dans GitHub."),
        (4, "L'état Terraform vit dans un compte de stockage en authentification Entra, clés partagées désactivées."),
        (5, "Phase 1 : groupe de ressources, réseau, AKS, Foundry, identités et applications Entra ID."),
        (6, "Phase 2 : Helm et Kustomize dans AKS — passerelle, agents, observabilité, LibreChat, équipes."),
        (7, "Depuis Windows, <b>deploy.ps1</b> déroule les mêmes phases avec la session <i>az login</i>."),
        (8, "Optionnel (<i>public_exposure</i>) : enregistrements DNS Cloudflare en phase 1, cert-manager et porte publique en phase 2."),
    ], cols=2, col_w=670)
    return d


# =============================================================================
# 06 — Exposition publique
# =============================================================================
def public_exposure():
    d = Diagram("06-exposition-publique", 1820, 1420,
                "Exposition publique — demos.shift-cloud.io",
                "Optionnelle (variable public_exposure) : une seconde Gateway agentgateway sur une IP statique, DNS Cloudflare, certificats Let's Encrypt, Entra ID devant chaque interface")
    P, AZ_BLUE, GREY = "#773ADC", "#0078D4", "#8A8886"

    d.image("users", 96, 606, 48, I_USERS, "Internautes\nnavigateur, curl")

    # hors Azure
    d.box("cf", 260, 90, 520, 150, "Cloudflare — zone shift-cloud.io", "external", icon=L_CF)
    d.chip("rec1", 280, 128, 480, 30, "<b>demos</b>.shift-cloud.io — A — IP statique", parent="cf")
    d.chip("rec2", 280, 166, 480, 30, "<b>*.demos</b>.shift-cloud.io — A — IP statique", parent="cf")
    d.text("cf_t", 280, 204, 480, 30, "DNS seul (nuage gris) : le SSL universel gratuit ne couvre pas *.demos",
           size=10, color="#605E5C", parent="cf")
    d.card("entra", 830, 110, 300, 60, I_ENTRA, "Microsoft Entra ID",
           "connexion LibreChat et oauth2-proxy (app « portail »)", stroke=AZ_BLUE)
    d.card("le", 1480, 110, 300, 60, L_LE, "Let's Encrypt", "ACME HTTP-01 : un certificat par hôte",
           stroke="#003A70")

    d.box("sub", 260, 280, 1520, 860, "Abonnement Azure", "sub", icon=I_SUB)
    d.box("rg", 290, 330, 1470, 790, "rg-agwpoc-<suffixe>", "rg", parent="sub", icon=I_RG)
    d.image("pip", 320, 606, 48, I_PIP, "pip-agwpoc-gateway\nIP statique", parent="rg")
    d.card("foundry", 1480, 1015, 260, 60, I_FOUNDRY, "Microsoft Foundry",
           "backend llm · identité agentgateway-public", stroke=AZ_BLUE, parent="rg", icon_size=28)

    d.box("aks", 440, 380, 1000, 720, "aks-agwpoc", "aks", parent="rg", icon=I_AKS)
    d.box("ns_gw", 470, 440, 540, 640, "agentgateway-system", "ns", parent="aks", icon=K_NS)
    d.card("svc", 490, 600, 190, 60, K_SVC, "Service LoadBalancer", "annotation azure-pip-name",
           stroke=P, parent="ns_gw", icon_size=28)
    d.box("gw", 710, 470, 280, 605, "Gateway agentgateway-public", "group", parent="ns_gw", icon=L_AGW)
    chips = [("l80", 520, "<b>:80</b> — redirection HTTPS, défis ACME", "#FAFAFA", GREY),
             ("lchat", 610, "<b>:443</b> demos.shift-cloud.io", "#F5F0FD", P),
             ("lgraf", 720, "<b>:443</b> grafana.demos.shift-cloud.io", "#F5F0FD", P),
             ("lkag", 900, "<b>:443</b> kagent.demos.shift-cloud.io", "#F5F0FD", P),
             ("lapi", 1025, "<b>:443</b> api.demos — /v1 · /agents/v1", "#F5F0FD", P)]
    for cid, y, txt, fill, stroke in chips:
        d.chip(cid, 725, y, 250, 40, txt, fill=fill, stroke=stroke, parent="gw", size=10, align="left")

    d.box("ns_cm", 1050, 440, 370, 110, "cert-manager", "ns", parent="aks", icon=K_NS)
    d.card("cm", 1070, 475, 330, 50, L_CM, "cert-manager", "Certificates public-*-tls, renouvelés",
           stroke=P, parent="ns_cm", icon_size=28)
    d.box("ns_lc", 1050, 568, 370, 102, "librechat", "ns", parent="aks", icon=K_NS)
    d.card("lc", 1070, 605, 330, 50, L_LIBRECHAT, "LibreChat", "sa connexion Entra ID · audience API passerelle acceptée",
           stroke=P, parent="ns_lc", icon_size=28)
    d.box("ns_mon", 1050, 688, 370, 152, "monitoring", "ns", parent="aks", icon=K_NS)
    d.card("o2g", 1070, 715, 330, 50, K_POD, "oauth2-proxy-grafana", "Entra ID · sans en-tête Basic vers Grafana",
           stroke=P, parent="ns_mon", icon_size=28)
    d.card("graf", 1070, 780, 330, 46, L_GRAFANA, "Grafana", "jamais routé en direct",
           stroke=P, parent="ns_mon", icon_size=26)
    d.box("ns_ka", 1050, 860, 370, 150, "kagent", "ns", parent="aks", icon=K_NS)
    d.card("o2k", 1070, 895, 330, 50, L_KAGENT, "kagent-oauth2-proxy", "sous-chart du chart kagent",
           stroke=P, parent="ns_ka", icon_size=28)
    d.card("kui", 1070, 958, 330, 46, K_POD, "kagent UI", "jamais routée en direct",
           stroke=P, parent="ns_ka", icon_size=26)

    # flux
    d.edge("users", "cf", "control", [(108, 165)], exit=(0.25, 0), entry=(0, 0.5))
    d.edge("users", "entra", "identity", [(132, 255), (980, 255)], exit=(0.75, 0), entry=(0.5, 1))
    d.edge("users", "pip", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("pip", "svc", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("svc", "gw", "user", exit=(1, 0.5), entry=(0, 160 / 605))
    d.edge("lchat", "lc", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("lgraf", "o2g", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("o2g", "graf", "control", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("lkag", "o2k", "user", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("o2k", "kui", "control", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("lapi", "foundry", "model", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("cm", "le", "control", [(1630, 500)], exit=(1, 0.5), entry=(0.5, 1))

    for n, x, y in ((1, 72, 300), (2, 400, 600), (3, 692, 442), (4, 1018, 596), (5, 1018, 708),
                    (6, 1018, 1000), (7, 1640, 330), (8, 850, 262)):
        d.badge(n, x, y)

    d.legend(40, 1180, ["user", "model", "identity", "control"])
    d.steps(440, 1180, 1340, [
        (1, "Le navigateur résout demos.shift-cloud.io ou *.demos chez Cloudflare : DNS seul, vers l'IP statique."),
        (2, "L'IP statique (groupe de ressources principal) est portée par le Service LoadBalancer de la Gateway publique."),
        (3, "Un listener HTTPS par hôte ; le port 80 ne fait que rediriger vers HTTPS et répondre aux défis ACME."),
        (4, "<b>demos</b> → LibreChat, avec sa propre connexion Entra ID."),
        (5, "<b>grafana</b> et <b>kagent</b> → oauth2-proxy (Entra ID) avant l'interface, jamais en direct."),
        (6, "<b>api</b> → /v1 et /agents/v1 : mêmes policies qu'en interne, appel Foundry sans clé."),
        (7, "cert-manager obtient et renouvelle les certificats Let's Encrypt (HTTP-01 via la Gateway)."),
        (8, "Connexion Entra ID : LibreChat et oauth2-proxy (application « portail », mono-tenant)."),
    ], cols=2, col_w=670)
    return d


# =============================================================================
# 07 — Identités : qui prouve quoi, à qui
# =============================================================================
def identities_overview():
    d = Diagram("07-identites-vue-ensemble", 1620, 1440,
                "Gestion des identités — qui prouve quoi, à qui",
                "Cinq chemins d'accès, une seule règle : Entra ID ou une clé d'équipe à l'entrée, aucune clé d'API vers les modèles ni vers l'état Terraform")
    AZ_BLUE, P, GREEN, GH = "#0078D4", "#773ADC", "#107C10", "#24292F"
    cols = [(60, 240, "Qui"), (360, 360, "Preuve d'identité"), (780, 360, "Contrôle"), (1200, 360, "Ressource")]
    for x, w, t in cols:
        d.text(None, x, 96, w, 24, f"<b>{t}</b>", size=14, color="#201F1E", align="center")

    lanes = [
        ("A", "A · Collaborateurs → passerelle LLM", "user", AZ_BLUE, [
            (I_USERS, "Collaborateur", "via LibreChat, ou Azure CLI pour les démos"),
            (I_APPREG, "Jeton d'accès Entra ID v2", "aud = API passerelle · scope agents.invoke · obtenu par l'app « LibreChat »"),
            (L_AGW, "Policy acces-llm", "JWT : émetteur, audience, signature (clés JWKS d'Entra ID) · plafond de jetons"),
            (I_FMODEL, "Route /v1", "backend llm : gpt-5.6-terra → gpt-5.6-luna")]),
        ("B", "B · Collaborateurs → interfaces d'administration", "user", AZ_BLUE, [
            (I_USERS, "Collaborateur", "navigateur, porte publique"),
            (I_APPREG, "Session oauth2-proxy", "connexion Entra ID via l'app « Portail » · cookie chiffré"),
            (K_POD, "oauth2-proxy", "un devant chaque interface · aucun en-tête Basic vers l'amont"),
            (L_GRAFANA, "Grafana · kagent UI", "jamais routés en direct sur Internet")]),
        ("C", "C · Agents d'équipe → passerelle LLM", "secret", "#8764B8", [
            (K_POD, "Agent d'équipe", "pod créé par le contrôleur kagent"),
            (K_SECRET, "Clé virtuelle", "Secret gateway-key (sk-&lt;équipe&gt;-…) créé par Terraform"),
            (L_AGW, "Policy acces-agents", "apiKeyAuthentication · Secrets vk-&lt;équipe&gt; · métadonnée team"),
            (I_FMODEL, "Route /agents/v1", "même backend, mêmes garde-fous, coûts par équipe")]),
        ("D", "D · Passerelle → Microsoft Foundry (Workload Identity)", "model", GREEN, [
            (L_AGW, "Proxy agentgateway", "porte interne et porte publique : une identité chacune"),
            (K_SA, "Jeton de ServiceAccount projeté", "échangé contre un jeton Entra ID (fédération avec l'émetteur OIDC d'AKS)"),
            (I_MI, "Identité managée + RBAC", "id-agentgateway(-public) · rôle Cognitive Services User"),
            (I_FOUNDRY, "Microsoft Foundry", "local_auth = false : aucune clé d'API n'existe")]),
        ("E", "E · Pipeline GitHub Actions → Azure (fédération OIDC)", "deploy", GH, [
            (L_GHA, "GitHub Actions", "workflow terraform.yml · permission id-token: write"),
            (L_GHA, "Jeton OIDC GitHub", "sujet repo:…:pull_request · environment:demo · ref main"),
            (I_MI, "id-…-github + RBAC", "Contributor · RBAC Administrator · Storage Blob Data Contributor"),
            (I_STORAGE, "Azure Resource Manager · état Terraform", "authentification Entra ID, clés partagées désactivées")]),
    ]
    for li, (key, title, flow, stroke, cells) in enumerate(lanes):
        y = 140 + li * 190
        d.box(f"lane{key}", 40, y, 1540, 170, title, "lane")
        ids = []
        for ci, ((x, w, _), (icon, t, desc)) in enumerate(zip(cols, cells)):
            cid = f"{key}{ci}"
            d.card(cid, x, y + 55, w, 84, icon, t, desc, stroke=stroke, parent=f"lane{key}", icon_size=32)
            ids.append(cid)
        for a, b in zip(ids, ids[1:]):
            d.edge(a, b, flow, exit=(1, 0.5), entry=(0, 0.5))

    d.text("secrets", 40, 1100, 1540, 50,
           "<b>Ce qui reste un secret</b> : le client OIDC de LibreChat et celui du « Portail » (Entra ID, 90 jours), "
           "les clés virtuelles des équipes et les cookies de session — tous dans des Secrets Kubernetes générés par Terraform. "
           "<b>Aucun</b> secret pour Foundry, pour l'état Terraform ni pour GitHub Actions.",
           size=11, fill="#FFF9E1", stroke="#E8B400", rounded=1)

    d.legend(40, 1200, ["user", "secret", "model", "deploy"])
    d.steps(440, 1200, 1140, [
        ("A", "LibreChat obtient pour l'utilisateur un jeton dont l'audience est l'API passerelle ; la passerelle le valide à chaque appel."),
        ("B", "Grafana et kagent UI ne sont publiés que derrière oauth2-proxy : même tenant, application « Portail »."),
        ("C", "Un agent n'a jamais de jeton Entra ID : sa clé virtuelle identifie son équipe, pour les plafonds et les coûts."),
        ("D", "La passerelle seule parle à Foundry, avec sa propre identité : le jeton de l'utilisateur n'est jamais transmis à Foundry."),
        ("E", "GitHub Actions n'a aucun secret : Entra ID fait confiance au jeton OIDC de ce dépôt, pour ces trois sujets seulement."),
    ], cols=1, col_w=1140)
    return d


# =============================================================================
# 08 — Séquence : connexion d'un collaborateur et appel d'un modèle
# =============================================================================
def identity_sequence():
    d = Diagram("08-identites-sequence-connexion", 1760, 1580,
                "Séquence — connexion d'un collaborateur et appel d'un modèle",
                "OIDC (code d'autorisation) avec Entra ID, réutilisation du jeton par LibreChat, validation par la passerelle, Workload Identity vers Foundry")
    AZ_BLUE = "#0078D4"
    lanes = [("nav", 160, I_USERS, "Navigateur", "collaborateur"),
             ("lc", 520, L_LIBRECHAT, "LibreChat", "app « LibreChat »"),
             ("entra", 880, I_ENTRA, "Microsoft Entra ID", "tenant"),
             ("gw", 1240, L_AGW, "agentgateway", "porte interne · acces-llm"),
             ("fdy", 1600, I_FOUNDRY, "Microsoft Foundry", "fdy-agwpoc")]
    X = {k: x for k, x, *_ in lanes}
    top, bottom = 190, 1370
    for k, x, icon, t, sub in lanes:
        d.card(f"h_{k}", x - 130, 100, 260, 64, icon, t, sub, stroke=AZ_BLUE, icon_size=32)
        d.text(f"end_{k}", x, bottom, 1, 1, "")
        d.edge(f"h_{k}", f"end_{k}", "lifeline", exit=(0.5, 1), entry=(0.5, 0.5), end_arrow=False)

    n = [0]
    def anchor(k, y):
        n[0] += 1
        cid = f"a{n[0]}"
        d.text(cid, X[k], y, 1, 1, "")
        return cid

    def msg(num, src, dst, y, label, kind="user", note_side=None):
        a, b = anchor(src, y), anchor(dst, y)
        d.edge(a, b, kind, exit=(0.5, 0.5), entry=(0.5, 0.5))
        right = X[dst] > X[src]
        # label in the first gap next to the source lifeline, above the arrow
        gx = X[src] + 14 if right else X[src] - 346
        d.badge(num, gx, y - 34)
        d.text(None, gx + 30, y - 38, 300, 32, label, size=10, wrap=True)

    def note(k, y, h, html, side="right"):
        x = X[k] + 14 if side == "right" else X[k] - 346
        d.text(None, x, y, 332, h, html, size=10, fill="#FFF9E1", stroke="#E8B400", rounded=1)

    y = 250
    msg(1, "nav", "lc", y, "Ouvre demos.shift-cloud.io — pas encore de session")
    y += 70
    msg(2, "lc", "nav", y, "302 vers Entra ID : <i>authorize</i> · scope openid profile email offline_access <b>api://…/agents.invoke</b> · state", "response")
    y += 70
    msg(3, "nav", "entra", y, "Connexion Entra ID (MFA, accès conditionnel, consentement)", "identity")
    y += 70
    msg(4, "entra", "nav", y, "302 vers /oauth/openid/callback avec <b>code</b> et state", "response")
    y += 70
    msg(5, "nav", "lc", y, "Callback : LibreChat retrouve le state dans son cookie de session")
    y += 70
    msg(6, "lc", "entra", y, "Échange du code (secret client de l'app) → id_token, access_token, refresh_token", "identity")
    y += 60
    note("lc", y, 50, "<b>access_token v2</b> : aud = client ID de l'API passerelle, iss = tenant, scp = agents.invoke. "
         "LibreChat l'accepte car OPENID_AUDIENCE contient cette audience.")
    y += 100
    msg(7, "nav", "lc", y, "Message dans la conversation")
    y += 70
    msg(8, "lc", "gw", y, "POST /v1/chat/completions · <b>Authorization: Bearer &lt;jeton de l'utilisateur&gt;</b>")
    y += 70
    msg(9, "gw", "entra", y, "Clés publiques (JWKS), mises en cache", "identity")
    y += 60
    note("gw", y, 50, "<b>acces-llm</b> : émetteur, audience, signature, expiration → sinon <b>401</b>. "
         "Puis plafond de jetons (<b>429</b>) et garde-fous (rejet) avant tout appel modèle.")
    y += 100
    msg(10, "gw", "fdy", y, "Appel du modèle avec le jeton <b>Workload Identity</b> de la passerelle (scope https://ai.azure.com/.default)", "model")
    y += 70
    note("fdy", y, 30, "RBAC : <b>Cognitive Services User</b> · local_auth = false", side="left")
    y += 75
    msg(11, "fdy", "gw", y, "Réponse du modèle (gpt-5.6-terra, ou gpt-5.6-luna après bascule)", "response")
    y += 70
    msg(12, "gw", "lc", y, "Réponse + en-tête <b>x-served-model</b> · métriques GenAI par utilisateur", "response")
    y += 70
    msg(13, "lc", "nav", y, "Réponse affichée ; le refresh_token renouvelle le jeton sans nouvelle connexion", "response")

    d.legend(40, 1410, ["user", "identity", "model", "response"])
    d.text("seq_t", 440, 1410, 1300, 120,
           "<b>À retenir</b><br>"
           "• Le jeton de l'utilisateur sert deux fois : session LibreChat et appel à la passerelle — jamais vers Foundry.<br>"
           "• La passerelle ne fait confiance qu'à Entra ID (émetteur, audience) ; elle n'appelle Entra que pour ses clés publiques.<br>"
           "• Vers Foundry, une autre identité : celle de la passerelle, fédérée, sans clé ni secret.",
           size=11)
    return d


# =============================================================================
# 09 — Fédération d'identité : Workload Identity et GitHub Actions
# =============================================================================
def identity_federation():
    d = Diagram("09-identites-federation", 1820, 1320,
                "Fédération d'identité — pods AKS et GitHub Actions, sans aucun secret",
                "Entra ID fait confiance à un émetteur OIDC externe (AKS, GitHub) pour un sujet précis, et délivre un jeton Azure à l'identité managée correspondante")
    AZ_BLUE, P, GREEN, GH, OR = "#0078D4", "#773ADC", "#107C10", "#24292F", "#D83B01"

    def c(cid, x, y, w, h, icon, t, desc, parent, stroke, dashed=0):
        return d.card(cid, x, y, w, h, icon, t, desc, parent=parent, stroke=stroke, dashed=dashed, icon_size=30)

    # ---------------------------------------------------------------- pods
    d.box("aks", 40, 100, 520, 470, "aks-agwpoc", "aks", icon=I_AKS)
    c("pod", 60, 150, 480, 60, L_AGW, "Pod agentgateway-proxy",
      "label azure.workload.identity/use = true (AgentgatewayParameters)", "aks", P)
    c("sa", 60, 230, 480, 60, K_SA, "ServiceAccount agentgateway-proxy",
      "annotation azure.workload.identity/client-id = id-agentgateway", "aks", P)
    c("tok", 60, 310, 480, 60, K_SECRET, "Jeton de ServiceAccount projeté",
      "aud api://AzureADTokenExchange · courte durée · renouvelé par le kubelet", "aks", P)
    c("hook", 60, 390, 480, 60, K_POD, "Webhook Workload Identity (add-on AKS)",
      "injecte AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_FEDERATED_TOKEN_FILE", "aks", P)
    c("iss", 60, 480, 480, 70, I_AKS, "Émetteur OIDC d'AKS",
      "oidc_issuer_enabled · publie /.well-known/openid-configuration et ses clés (JWKS)", "aks", P)

    # --------------------------------------------------------------- Entra
    d.box("entra", 640, 100, 540, 470, "Tenant Microsoft Entra ID", "tenant", icon=I_ENTRA)
    c("mi", 660, 150, 500, 60, I_MI, "Identité managée id-agentgateway",
      "user-assigned · dans rg-agwpoc-&lt;suffixe&gt;", "entra", AZ_BLUE)
    c("fic", 660, 230, 500, 90, I_MI, "Identifiant fédéré fic-agentgateway",
      "émetteur = URL OIDC d'AKS<br>sujet = system:serviceaccount:agentgateway-system:agentgateway-proxy<br>audience = api://AzureADTokenExchange", "entra", OR)
    c("atok", 660, 350, 500, 60, I_ENTRA, "Jeton d'accès Entra ID",
      "pour https://ai.azure.com/.default · émis à id-agentgateway", "entra", GREEN)
    c("others", 660, 440, 500, 110, I_MI, "Même schéma pour",
      "<b>id-agentgateway-public</b> ← sujet …:agentgateway-system:agentgateway-public<br>"
      "<b>id-kagent</b> ← sujet …:kagent:kagent — sans rôle sur Foundry : les agents passent par la passerelle", "entra", AZ_BLUE, dashed=1)

    # ------------------------------------------------------------- Foundry
    d.box("rg", 1260, 100, 520, 470, "rg-agwpoc-<suffixe>", "rg", icon=I_RG)
    c("fdy", 1280, 150, 480, 60, I_FOUNDRY, "Microsoft Foundry · fdy-agwpoc",
      "local_auth_enabled = false : aucune clé d'API", "rg", AZ_BLUE)
    c("role", 1280, 230, 480, 70, I_MI, "Attribution de rôle",
      "Cognitive Services User (par GUID) · id-agentgateway et id-agentgateway-public · portée : le compte Foundry", "rg", AZ_BLUE)
    c("dep", 1280, 330, 480, 60, I_FMODEL, "Déploiements",
      "gpt-5.6-terra · gpt-5.6-luna · gpt-5.6-sol · model-router · MAI-Image-2.6", "rg", AZ_BLUE)

    # -------------------------------------------------------------- GitHub
    d.box("gh", 40, 640, 520, 330, "GitHub — dépôt", "github")
    c("wf", 60, 690, 480, 60, L_GHA, "Workflow terraform.yml",
      "permissions id-token: write · ARM_USE_OIDC = true", "gh", GH)
    c("ghtok", 60, 780, 480, 90, L_GHA, "Jeton OIDC GitHub",
      "émetteur token.actions.githubusercontent.com<br>sujet repo:&lt;owner&gt;/&lt;repo&gt;:environment:demo (apply) ou :pull_request (plan)", "gh", GH)
    c("envp", 60, 890, 480, 60, None, "Environnement « demo »",
      "approbation requise avant apply et destroy", "gh", GH)

    d.box("entra2", 640, 640, 540, 330, "Tenant Microsoft Entra ID", "tenant", icon=I_ENTRA)
    c("mi_gh", 660, 690, 500, 60, I_MI, "Identité managée id-…-github",
      "créée par scripts/bootstrap-state.sh", "entra2", AZ_BLUE)
    c("fic_gh", 660, 780, 500, 90, I_MI, "3 identifiants fédérés",
      "github-pr · github-env · github-main<br>sujets pull_request · environment:demo · ref main<br>aucun autre workflow ne peut obtenir de jeton", "entra2", OR)
    c("tok_gh", 660, 890, 500, 60, I_ENTRA, "Jetons Entra ID",
      "Azure Resource Manager et Azure Storage", "entra2", GH)

    d.box("sub", 1260, 640, 520, 330, "Abonnement Azure", "sub", icon=I_SUB)
    c("arm", 1280, 690, 480, 70, I_SUB, "Contributor · RBAC Administrator",
      "portée abonnement : créer les ressources et attribuer les rôles Workload Identity", "sub", GH)
    c("state", 1280, 790, 480, 70, I_STORAGE, "État Terraform",
      "Storage Blob Data Contributor · clés partagées désactivées · Entra ID uniquement", "sub", GH)

    # --------------------------------------------------------------- flux
    d.edge("hook", "pod", "control", [(30, 420), (30, 180)], exit=(0, 0.5), entry=(0, 0.5))
    d.edge("tok", "fic", "identity", [(600, 340), (600, 275)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("fic", "iss", "identity", [(615, 300), (615, 515)], exit=(0, 70 / 90), entry=(1, 0.5))
    d.edge("sa", "mi", "control", [(585, 260), (585, 180)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("fic", "atok", "identity", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("atok", "fdy", "model", [(1220, 380), (1220, 180)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("wf", "ghtok", "deploy", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("ghtok", "fic_gh", "identity", exit=(1, 0.5), entry=(0, 0.5))
    d.edge("fic_gh", "tok_gh", "identity", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("tok_gh", "arm", "deploy", [(1220, 920), (1220, 725)], exit=(1, 0.5), entry=(0, 0.5))
    d.edge("tok_gh", "state", "deploy", [(1220, 920), (1220, 825)], exit=(1, 0.5), entry=(0, 0.5))

    for n, x, y in ((1, 36, 280), (2, 576, 300), (3, 621, 420), (4, 924, 324), (5, 1226, 260),
                    (6, 574, 790), (7, 924, 873), (8, 1226, 850)):
        d.badge(n, x, y)

    d.legend(40, 1010, ["identity", "model", "deploy", "control"])
    d.steps(440, 1010, 1340, [
        (1, "Le webhook injecte dans le pod l'identité à utiliser et le chemin du jeton de ServiceAccount projeté."),
        (2, "La passerelle présente ce jeton à Entra ID comme assertion client (échange de jeton fédéré)."),
        (3, "Entra ID vérifie la signature avec les clés publiées par l'émetteur OIDC d'AKS."),
        (4, "Émetteur, sujet et audience correspondent à l'identifiant fédéré : jeton émis pour id-agentgateway."),
        (5, "Foundry vérifie le rôle Cognitive Services User : pas de clé, pas de secret dans le cluster."),
        (6, "GitHub Actions présente son jeton OIDC, dont le sujet dit quel dépôt et quel environnement."),
        (7, "Seuls les trois sujets déclarés sont acceptés : une pull request planifie, l'environnement « demo » applique."),
        (8, "Terraform crée les ressources et écrit son état avec ces jetons, sans secret stocké dans GitHub."),
    ], cols=2, col_w=670)
    return d


# =============================================================================
# 10 — Mesurer l'usage : jetons, coût et outils par utilisateur
# =============================================================================
def usage_monitoring():
    d = Diagram("10-monitoring-usage", 1820, 1080,
                "Mesurer l'usage — jetons, coût et outils, par utilisateur et par équipe",
                "La passerelle voit chaque jeton et chaque appel d'outil : elle les étiquette, les chiffre, et Prometheus les collecte pour Grafana")
    BLUE, P, GREEN, GREY = "#0078D4", "#773ADC", "#107C10", "#8A8886"
    K_CM = ("k8s", "cm")

    def c(cid, x, y, w, h, icon, t, desc, parent, stroke, dashed=0):
        return d.card(cid, x, y, w, h, icon, t, desc, parent=parent, stroke=stroke, dashed=dashed, icon_size=30)

    c("users", 40, 300, 250, 80, I_USERS, "Collaborateurs", "compte Entra ID", None, BLUE)

    d.box("aks", 340, 110, 1080, 680, "aks-agwpoc", "aks", icon=I_AKS)
    d.box("ns_lc", 370, 170, 300, 150, "librechat", "ns", icon=K_NS)
    c("lc", 390, 220, 260, 70, L_LIBRECHAT, "LibreChat", "transmet le jeton Entra ID de l'utilisateur", "ns_lc", BLUE)
    d.box("ns_team", 370, 560, 300, 150, "equipe-produit", "ns", icon=K_NS)
    c("agents", 390, 610, 260, 70, L_KAGENT, "Agents de l'équipe", "clé virtuelle · métadonnée team", "ns_team", P)

    d.box("ns_agw", 730, 150, 360, 600, "agentgateway-system", "ns", icon=K_NS)
    c("gw", 750, 200, 320, 80, L_AGW, "agentgateway · 2 portes", "/v1 · /agents/v1 · /mcp", "ns_agw", P)
    d.box("cfg", 745, 330, 330, 395, "Configuration · gateway/deploy", "group")
    c("pol", 760, 380, 300, 90, K_CRD, "Politique metriques-usage",
      "libellés ajoutés à chaque métrique :<br><b>user</b> · <b>team</b> · <b>agent</b> (CEL)", "cfg", P)
    c("cat", 760, 495, 300, 90, K_CM, "ConfigMap model-costs",
      "prix en USD par million de jetons<br>→ coût de chaque réponse", "cfg", P)
    c("mcpb", 760, 610, 300, 90, K_CRD, "Backend mcp · route /mcp",
      "chaque appel d'outil : serveur, outil,<br>agent demandé, utilisateur", "cfg", P)

    d.box("ns_ka", 1150, 150, 250, 230, "kagent", "ns", icon=K_NS)
    c("ka", 1165, 200, 220, 80, L_KAGENT, "kagent-controller", "serveur MCP · list_agents, invoke_agent", "ns_ka", P)
    c("skills", 1165, 295, 220, 70, None, "Skills des agents", "chargés dans l'agent : invisibles pour la passerelle", "ns_ka", GREY, dashed=1)

    d.box("ns_mon", 1150, 420, 250, 330, "monitoring", "ns", icon=K_NS)
    c("prom", 1165, 470, 220, 80, L_PROM, "Prometheus", "PodMonitor des proxys · port 15020", "ns_mon", GREY)
    c("graf", 1165, 600, 220, 120, L_GRAFANA, "Grafana · « Usage IA »",
      "coût, jetons, outils MCP<br>par utilisateur, équipe,<br>déploiement · 401, 429,<br>garde-fous", "ns_mon", "#F46800")

    d.box("rg", 1480, 110, 300, 290, "rg-agwpoc-<suffixe>", "rg", icon=I_RG)
    c("fdy", 1495, 165, 270, 70, I_FOUNDRY, "Microsoft Foundry", "Workload Identity, sans clé", "rg", BLUE)
    c("dep", 1495, 275, 270, 90, I_FMODEL, "gpt-5.6-terra · luna · sol",
      "le modèle réellement servi<br>détermine le prix appliqué", "rg", BLUE)

    # --------------------------------------------------------------- flux
    d.edge("users", "lc", "user", [(320, 340), (320, 255)])
    d.edge("lc", "gw", "user", [(695, 255), (695, 224)], entry=(0, 0.3))
    d.edge("agents", "gw", "agent", [(715, 645), (715, 256)], entry=(0, 0.7))
    d.edge("gw", "ka", "user", exit=(1, 0.3), entry=(0, 0.3))
    d.edge("gw", "fdy", "model", [(910, 132), (1450, 132), (1450, 200)], exit=(0.5, 0), entry=(0, 0.5))
    d.edge("fdy", "dep", "control", exit=(0.5, 1), entry=(0.5, 0))
    d.edge("cfg", "gw", "control", exit=(0.5, 0), entry=(0.5, 1))
    d.edge("gw", "prom", "telemetry", [(1115, 256), (1115, 510)], exit=(1, 0.7), entry=(0, 0.5))
    d.edge("prom", "graf", "telemetry", exit=(0.5, 1), entry=(0.5, 0))

    for n, x, y in ((1, 296, 268), (2, 672, 590), (3, 1423, 150), (4, 1100, 186),
                    (5, 1122, 440), (6, 1300, 562)):
        d.badge(n, x, y)

    d.legend(40, 830, ["user", "agent", "model", "telemetry", "control"])
    d.steps(440, 830, 1340, [
        (1, "Un collaborateur passe par LibreChat : son jeton Entra ID donne <b>user</b> = preferred_username, <b>team</b> = collaborateurs."),
        (2, "Un agent présente la clé virtuelle de son équipe : <b>user</b> = agent:&lt;équipe&gt;, <b>team</b> = l'équipe."),
        (3, "La passerelle appelle Foundry ; à chaque réponse elle compte les jetons et calcule le coût avec model-costs."),
        (4, "Les outils MCP passent par /mcp : la passerelle compte l'outil, le serveur et l'agent demandé."),
        (5, "Prometheus collecte les métriques des deux portes, interne et publique."),
        (6, "Grafana : tableau de bord « Usage IA », filtres porte, équipe, utilisateur, déploiement."),
    ], cols=2, col_w=670)
    return d


DIAGRAMS = [functional_view, azure_architecture, kubernetes_platform, request_flow, deployment, public_exposure, identities_overview, identity_sequence, identity_federation, usage_monitoring]

if __name__ == "__main__":
    for build in DIAGRAMS:
        print(build().save(OUT))
