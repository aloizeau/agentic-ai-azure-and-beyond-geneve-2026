"""Le modèle de dépôt d'équipe et main.tf restent alignés : chaque marqueur
__X__ du modèle est remplacé par main.tf, et inversement."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARK = re.compile(r"__([A-Z][A-Z_]+)__")


def template_marks():
    marks = {}
    for p in (ROOT / "template").rglob("*"):
        if p.is_file() and "__pycache__" not in p.parts:
            for m in MARK.findall(p.read_text(encoding="utf-8")):
                marks.setdefault(m, set()).add(p.relative_to(ROOT / "template").as_posix())
    return marks


def test_every_marker_is_replaced_by_main_tf():
    replaced = set(re.findall(r'"__([A-Z][A-Z_]+)__"', (ROOT / "main.tf").read_text(encoding="utf-8")))
    used = set(template_marks())
    assert used <= replaced, f"marqueurs non remplacés : {used - replaced}"
    assert replaced <= used, f"remplacements inutiles : {replaced - used}"


def test_pipelines_call_the_ai_team_reusable_workflows():
    wf = ROOT / "template" / ".github" / "workflows"
    image = (wf / "1-image.yml").read_text(encoding="utf-8")
    deploy = (wf / "2-deploiement.yml").read_text(encoding="utf-8")
    assert "__PLATFORM_REPO__/.github/workflows/agent-image.yml@__PLATFORM_REF__" in image
    assert "__PLATFORM_REPO__/.github/workflows/agent-deploy.yml@__PLATFORM_REF__" in deploy
    assert 'workflows: ["1 · Image"]' in deploy and "name: 1 · Image" in image
    reusable = ROOT.parents[1] / ".github" / "workflows"
    assert (reusable / "agent-image.yml").is_file() and (reusable / "agent-deploy.yml").is_file()


def test_network_policies_belong_to_agent_ready_not_to_the_team():
    """Les NetworkPolicies de l'équipe sont dans Terraform : le pipeline de
    l'équipe (agentic-team-deployer) ne peut ni les modifier ni les supprimer."""
    for p in (ROOT / "template").rglob("*.y*ml"):
        assert "kind: NetworkPolicy" not in p.read_text(encoding="utf-8"), p
    kz = (ROOT / "template" / "deploy" / "kustomization.yaml").read_text(encoding="utf-8")
    assert "networkpolicy" not in kz.split("resources:")[1].split("images:")[0]
    main = (ROOT / "main.tf").read_text(encoding="utf-8")
    for name in ("equipe-sorties", "docs-mcp-entrees", "agents-vers-kagent"):
        assert f'name      = "{name}"' in main, name
    assert "agentgateway-public" not in main
    teams = (ROOT.parent / "modules" / "platform" / "teams.tf").read_text(encoding="utf-8")
    deployer = teams.split('"team_deployer"')[1].split("\n}\n")[0]
    np_rule = deployer.split('"networkpolicies"')[1].split("}")[0]
    assert '"create"' not in np_rule and '"delete"' not in np_rule and '"patch"' not in np_rule


def test_mcp_target_starts_with_the_namespace():
    """Admission equipes-services : la cible MCP commence par le namespace."""
    main = (ROOT / "main.tf").read_text(encoding="utf-8")
    assert re.search(r'mcp_target\s*=\s*"\$\{var\.equipe\}--', main)
