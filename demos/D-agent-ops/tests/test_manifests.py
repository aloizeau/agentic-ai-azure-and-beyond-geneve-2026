"""Les manifestes de la démo D restent cohérents entre eux, sans cluster."""
import re
from pathlib import Path

import yaml

D = Path(__file__).resolve().parents[1]
KIT = D / "kit-equipe"
PLATEFORME = D / "plateforme"
REPO = D.parents[1]
TEMPLATE_DEPLOY = REPO / "terraform" / "teams" / "template" / "deploy"
EMETTEUR = REPO / "tools" / "github-token-issuer" / "deploy" / "emetteur.yaml"


def docs(path):
    return [d for d in yaml.safe_load_all(path.read_text(encoding="utf-8")) if d]


def by_kind(paths):
    out = {}
    for p in paths:
        for d in docs(p):
            out.setdefault(d["kind"], []).append(d)
    return out


def test_tous_les_yaml_se_lisent():
    for p in list(KIT.rglob("*.yaml")) + list(PLATEFORME.rglob("*.yaml")):
        assert docs(p), p


def test_marqueurs_connus_seulement():
    kit = {m for p in KIT.rglob("*") if p.is_file() and "__pycache__" not in p.parts for m in re.findall(r"__[A-Z][A-Z_]+__", p.read_text(encoding="utf-8"))}
    assert kit <= {"__EQUIPE__", "__GITHUB_REPO__"}, kit          # rendus par run.ps1
    plat = {m for p in PLATEFORME.rglob("*") for m in re.findall(r"__[A-Z][A-Z_]+__", p.read_text(encoding="utf-8"))}
    assert plat == {"__AZURE_MCP_CLIENT_ID__", "__TENANT_ID__", "__SUBSCRIPTION_ID__", "__EQUIPES_AZURE__"}  # prepare.ps1
    for m in kit | plat:
        script = "run.ps1" if m in kit else "prepare.ps1"
        assert f'"{m}"' in (D / script).read_text(encoding="utf-8"), f"{m} non remplacé par {script}"


def test_kustomization_plateforme_complete():
    k = docs(PLATEFORME / "kustomization.yaml")[0]
    assert sorted(k["resources"]) == sorted(p.name for p in PLATEFORME.glob("*.yaml") if p.name != "kustomization.yaml")


def test_patch_vise_le_deploiement_du_modele():
    patch = docs(KIT / "deploy" / "tickets-patch.yaml")[0]
    base = next(d for d in docs(TEMPLATE_DEPLOY / "docs-mcp.yaml") if d["kind"] == "Deployment")
    assert patch["metadata"]["name"] == base["metadata"]["name"]
    assert patch["spec"]["template"]["spec"]["containers"][0]["name"] == base["spec"]["template"]["spec"]["containers"][0]["name"]
    env = {e["name"] for e in patch["spec"]["template"]["spec"]["containers"][0]["env"]}
    assert {"GITHUB_REPOSITORY", "GITHUB_TOKEN_PATH"} <= env
    tickets = (KIT / "mcp" / "tickets.py").read_text(encoding="utf-8")
    for var in env:
        assert var in tickets
    # Le pod monte le jeton émis par la plateforme, jamais la clé de l'application.
    volumes = patch["spec"]["template"]["spec"]["volumes"]
    assert [v["secret"]["secretName"] for v in volumes] == ["github-token"]
    # Le jeton et l'identifiant de l'application (écrits par l'émetteur), rien d'autre.
    assert [i["key"] for i in volumes[0]["secret"]["items"]] == ["token", "app-id"]
    assert {"GITHUB_APP_ID_PATH"} <= env


def _lisible_par_le_groupe(pod_spec, volume):
    """UID 65532 non root : le Secret monté (root:fsGroup) doit être lisible par le groupe 65532."""
    assert pod_spec["securityContext"]["fsGroup"] == 65532
    mode = next(v for v in pod_spec["volumes"] if v["name"] == volume)["secret"]["defaultMode"]
    assert mode & 0o040, oct(mode)          # lecture groupe
    assert not mode & 0o007, oct(mode)      # rien pour les autres


def test_secrets_montes_lisibles_par_l_uid_65532():
    patch = docs(KIT / "deploy" / "tickets-patch.yaml")[0]
    _lisible_par_le_groupe(patch["spec"]["template"]["spec"], "github-token")
    # Le patch stratégique fusionne securityContext : celui du modèle reste en place.
    base = next(d for d in docs(TEMPLATE_DEPLOY / "docs-mcp.yaml") if d["kind"] == "Deployment")
    assert base["spec"]["template"]["spec"]["securityContext"].get("runAsNonRoot") is True
    job = by_kind([EMETTEUR])["CronJob"][0]["spec"]["jobTemplate"]["spec"]["template"]["spec"]
    _lisible_par_le_groupe(job, "github-app")
    assert job["securityContext"]["runAsUser"] == job["securityContext"]["runAsGroup"] == 65532
    assert job["securityContext"]["runAsNonRoot"] is True
    for dockerfile in (KIT / "mcp" / "Dockerfile", EMETTEUR.parents[1] / "Dockerfile"):
        assert "USER 65532:65532" in dockerfile.read_text(encoding="utf-8"), dockerfile


def test_la_cle_de_l_application_ne_va_jamais_chez_une_equipe():
    for p in list(KIT.rglob("*")) + [REPO / "terraform" / "teams" / "main.tf", REPO / "terraform" / "teams" / "variables.tf"]:
        if p.is_file() and "__pycache__" not in p.parts:
            texte = p.read_text(encoding="utf-8")
            assert "github-app" not in texte and "PRIVATE_KEY" not in texte.upper().replace("PRIVATE KEY", ""), p
    assert 'resource "kubernetes_secret" "github_token"' in (REPO / "terraform" / "teams" / "main.tf").read_text(encoding="utf-8")


def test_emetteur_aux_droits_minimaux():
    k = by_kind([EMETTEUR])
    regles = k["ClusterRole"][0]["rules"]
    secrets = [r for r in regles if "secrets" in r["resources"]]
    assert secrets == [{"apiGroups": [""], "resources": ["secrets"], "resourceNames": ["github-token"], "verbs": ["get", "patch"]}]
    assert all(not ({"create", "delete", "*"} & set(r["verbs"])) for r in regles)
    ns = k["Namespace"][0]
    assert ns["metadata"]["labels"]["pod-security.kubernetes.io/enforce"] == "restricted"
    # Le RBAC vaut pour tous les namespaces : l'admission borne l'émetteur aux équipes.
    sa = k["ServiceAccount"][0]["metadata"]
    vap = k["ValidatingAdmissionPolicy"][0]
    assert vap["spec"]["failurePolicy"] == "Fail"
    regle = vap["spec"]["matchConstraints"]["resourceRules"][0]
    assert regle["resources"] == ["secrets"] and "UPDATE" in regle["operations"]
    assert [c["expression"] for c in vap["spec"]["matchConditions"]] == [
        f"request.userInfo.username == 'system:serviceaccount:{sa['namespace']}:{sa['name']}'"]
    assert "'agentic.io/team' in namespaceObject.metadata.labels" in vap["spec"]["validations"][0]["expression"]
    binding = k["ValidatingAdmissionPolicyBinding"][0]["spec"]
    assert binding["policyName"] == vap["metadata"]["name"] and binding["validationActions"] == ["Deny"]
    assert "paramRef" not in binding and "matchResources" not in binding
    # Une équipe ne peut pas prendre le nom du namespace de l'émetteur.
    assert '"jetons-github"' in (REPO / "terraform" / "modules" / "platform" / "teams.tf").read_text(encoding="utf-8")


def test_agent_et_outils_coherents():
    agent = docs(KIT / "deploy" / "assistant-ops.yaml")[0]
    tools = agent["spec"]["declarative"]["tools"]
    names = {t["mcpServer"]["name"] for t in tools}
    remote = docs(KIT / "deploy" / "outils-entreprise.yaml")[0]
    base_remote = docs(TEMPLATE_DEPLOY / "remotemcpserver.yaml")[0]
    assert names == {remote["metadata"]["name"], base_remote["metadata"]["name"]}
    equipe = next(t["mcpServer"] for t in tools if t["mcpServer"]["name"] == "docs-mcp")
    server = (KIT / "mcp" / "server.py").read_text(encoding="utf-8") + (KIT / "mcp" / "tickets.py").read_text(encoding="utf-8")
    defined = set(re.findall(r"@mcp\.tool\(\)\s+def (\w+)", server))
    assert set(equipe["toolNames"]) <= defined
    assert set(equipe["requireApproval"]) <= set(equipe["toolNames"])
    assert agent["spec"]["declarative"]["modelConfig"] == "passerelle-llm"
    # Le RemoteMCPServer passe par la passerelle, avec la clé de l'équipe.
    assert remote["spec"]["url"].startswith("http://agentgateway-proxy.agentgateway-system.svc.cluster.local/agents/mcp-entreprise")
    h = remote["spec"]["headersFrom"][0]
    assert h["name"] == "Authorization" and h["valueFrom"] == {"type": "Secret", "name": "gateway-key", "key": "authorization"}


def test_passerelle_coherente():
    k = by_kind([PLATEFORME / "passerelle-agents.yaml", PLATEFORME / "azure-mcp.yaml"])
    backend = k["AgentgatewayBackend"][0]
    route = k["HTTPRoute"][0]
    assert route["spec"]["rules"][0]["backendRefs"][0]["name"] == backend["metadata"]["name"]
    targets = {t["name"]: t["static"] for t in backend["spec"]["mcp"]["targets"]}
    svc = k["Service"][0]
    assert targets["azure"]["host"] == f'{svc["metadata"]["name"]}.{svc["metadata"]["namespace"]}.svc.cluster.local'
    assert targets["azure"]["port"] == svc["spec"]["ports"][0]["port"]
    assert targets["learn"]["policies"]["tls"]["sni"] == targets["learn"]["host"]
    pols = {p["metadata"]["name"]: p for p in k["AgentgatewayPolicy"]}
    assert pols["acces-agents-outils"]["spec"]["targetRefs"][0]["name"] == route["metadata"]["name"]
    assert pols["acces-agents-outils"]["spec"]["traffic"]["apiKeyAuthentication"]["secretSelector"] == {"matchLabels": {"agentic.io/virtual-key": "true"}}
    assert pols["outils-entreprise-autorises"]["spec"]["targetRefs"][0]["name"] == backend["metadata"]["name"]
    # Côté personnes (/mcp-equipes, LibreChat), la plateforme n'ouvre que les outils de
    # lecture : creer_ticket et commenter_ticket restent des gestes de l'agent, approuvés.
    autorisations = {p["metadata"]["name"]: p for p in docs(REPO / "gateway" / "deploy" / "autorisations-mcp.yaml")}
    regles = " ".join(autorisations["outils-equipes-autorises"]["spec"]["backend"]["mcp"]["authorization"]["policy"]["matchExpressions"])
    # agentgateway v1.5 : la règle voit le nom SANS préfixe de cible (lister_tickets).
    assert '"lister_tickets"' in regles and "creer_ticket" not in regles and "commenter_ticket" not in regles
    # /agents/mcp-entreprise : outils distingués par cible (mcp.tool.target), pas par préfixe.
    entreprise = " ".join(pols["outils-entreprise-autorises"]["spec"]["backend"]["mcp"]["authorization"]["policy"]["matchExpressions"])
    assert 'mcp.tool.target == "learn"' in entreprise and 'mcp.tool.target == "azure"' in entreprise
    assert "learn_" not in entreprise and "azure_" not in entreprise
    assert "microsoft_code_sample_search" not in entreprise


def test_azure_mcp_lecture_seule_et_isole():
    k = by_kind([PLATEFORME / "azure-mcp.yaml"])
    c = k["Deployment"][0]["spec"]["template"]["spec"]["containers"][0]
    assert "--read-only" in c["args"] and "command" not in c
    assert "--dangerously-disable-http-incoming-auth" in c["args"]
    np = k["NetworkPolicy"][0]
    src = np["spec"]["ingress"][0]["from"][0]
    assert src["namespaceSelector"]["matchLabels"] == {"kubernetes.io/metadata.name": "agentgateway-system"}
    assert "podSelector" in src, "l'entrée doit être réservée aux proxys de la passerelle"
    assert k["Deployment"][0]["spec"]["template"]["metadata"]["labels"]["azure.workload.identity/use"] == "true"
