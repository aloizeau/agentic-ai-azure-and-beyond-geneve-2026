"""Les manifestes de la démo D restent cohérents entre eux, sans cluster."""
import re
from pathlib import Path

import yaml

D = Path(__file__).resolve().parents[1]
KIT = D / "kit-equipe"
PLATEFORME = D / "plateforme"
TEMPLATE_DEPLOY = D.parents[1] / "terraform" / "teams" / "template" / "deploy"


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
    assert {"GITHUB_REPOSITORY", "GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY_PATH"} <= env
    tickets = (KIT / "mcp" / "tickets.py").read_text(encoding="utf-8")
    for var in env:
        assert var in tickets


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
    rules = pols["outils-equipes-lecture"]["spec"]["backend"]["mcp"]["authorization"]["policy"]["matchExpressions"]
    assert "_creer_ticket" in rules[0] and "_commenter_ticket" in rules[0]


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
