"""La couche tickets de l'équipe, contre une API GitHub simulée (httpx.MockTransport)."""
import importlib.util
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

MCP = Path(__file__).resolve().parents[1] / "kit-equipe" / "mcp"
sys.path.insert(0, str(MCP))
import tickets  # noqa: E402

REPO = "contoso/agent-equipe-ops"
JETON = "ghs_emis_par_la_plateforme"
RES = ("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-demo"
       "/providers/Microsoft.ContainerService/managedClusters/aks-demo")
LEARN = "https://learn.microsoft.com/azure/aks/supported-kubernetes-versions"
APP = {"id": 1, "slug": "agent-tickets"}


class FakeGitHub:
    """Juste ce que tickets.py appelle, avec le contrôle du jeton et du dépôt."""

    def __init__(self):
        self.issues: list[dict] = []
        self.comments: list[dict] = []
        self.calls: list[tuple[str, str]] = []

    def _issue(self, n, title, labels, app=APP, **extra):
        return {"number": n, "title": title, "state": "open", "html_url": f"https://github.com/{REPO}/issues/{n}",
                "labels": [{"name": x} for x in labels], "performed_via_github_app": app, **extra}

    def handler(self, req: httpx.Request) -> httpx.Response:
        path = req.url.path
        self.calls.append((req.method, path))
        assert req.headers["authorization"] == f"Bearer {JETON}", "appel sans le jeton émis par la plateforme"
        assert path.startswith(f"/repos/{REPO}/"), f"hors du dépôt de l'équipe : {path}"
        if path.endswith("/issues") and req.method == "GET":
            assert req.url.params["labels"] == "agent"
            pr = self._issue(999, "une PR", ["agent"], pull_request={})
            return httpx.Response(200, json=[i for i in self.issues if i["state"] == "open"] + [pr])
        if path.endswith("/issues") and req.method == "POST":
            body = json.loads(req.content)
            issue = self._issue(len(self.issues) + 1, body["title"], body["labels"], body=body["body"])
            self.issues.append(issue)
            return httpx.Response(201, json=issue)
        if req.method == "GET" and "/issues/" in path:
            n = int(path.rsplit("/", 1)[1])
            if n == 50:   # issue humaine, label « agent » posé à la main
                return httpx.Response(200, json=self._issue(50, "ticket humain", ["agent"], app=None))
            if n == 60:   # pull request étiquetée « agent »
                return httpx.Response(200, json=self._issue(60, "une PR", ["agent"], pull_request={}))
            return httpx.Response(200, json=next(i for i in self.issues if i["number"] == n))
        if path.endswith("/comments"):
            self.comments.append(json.loads(req.content))
            return httpx.Response(201, json={"html_url": "https://github.com/c/1"})
        return httpx.Response(404)


@pytest.fixture
def gh():
    fake = FakeGitHub()
    clock = SimpleNamespace(t=1_800_000_000.0)
    t = tickets.GitHubTickets(REPO, lambda: JETON, max_creations=2, max_commentaires=2, fenetre_s=600,
                              client=httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(fake.handler)),
                              horloge=lambda: clock.t)
    return t, fake, clock


def test_creation_structuree_et_signee(gh):
    t, fake, _ = gh
    r = t.creer("AKS aks-demo : version hors support", "Version 1.29 lue dans Azure.", "Haute", RES, [LEARN])
    assert r == {"numero": 1, "url": f"https://github.com/{REPO}/issues/1", "doublon": False}
    issue = fake.issues[0]
    assert [x["name"] for x in issue["labels"]] == ["agent", "severite:haute"]
    assert RES in issue["body"] and LEARN in issue["body"] and tickets.SIGNATURE in issue["body"]


def test_mentions_neutralisees(gh):
    t, fake, _ = gh
    t.creer("Alerte pour @contoso/securite", "Prévenir @alice et @contoso/admins tout de suite.", "basse")
    issue = fake.issues[0]
    for texte in (issue["title"], issue["body"]):
        assert "@contoso" not in texte and "@alice" not in texte
    assert "@​alice" in issue["body"]
    t.commenter(1, "cc @bob")
    assert "@bob" not in fake.comments[0]["body"]


def test_pas_de_doublon_et_les_pr_sont_ignorees(gh):
    t, fake, _ = gh
    t.creer("AKS aks-demo : version hors support", "constat", "haute", RES)
    r = t.creer("aks AKS-DEMO :   version hors support", "constat", "haute", RES)
    assert r["doublon"] is True and r["numero"] == 1 and len(fake.issues) == 1
    assert [x["numero"] for x in t.lister()] == [1]


@pytest.mark.parametrize("args, message", [
    (("court", "d", "haute"), "titre"),
    (("Titre suffisamment long", "d", "urgente"), "sévérité"),
    (("Titre suffisamment long", "", "haute"), "description"),
    (("Titre suffisamment long", "d", "haute", "aks-demo"), "ressource"),
    (("Titre suffisamment long", "d", "haute", RES + "` [clic](https://exemple.com)"), "ressource"),
    (("Titre suffisamment long", "d", "haute", "", ["https://exemple.com/blog"]), "source non autorisée"),
    (("Titre suffisamment long", "d", "haute", "", ["https://learn.microsoft.com/x) ![](https://exemple.com/p.png"]), "source non autorisée"),
])
def test_regles_de_l_equipe(gh, args, message):
    t, fake, _ = gh
    with pytest.raises(tickets.TicketRefuse, match=message):
        t.creer(*args)
    assert not fake.issues


def test_plafond_de_creations(gh):
    t, fake, clock = gh
    t.creer("Premier ticket de test", "d", "basse")
    t.creer("Deuxième ticket de test", "d", "basse")
    with pytest.raises(tickets.TicketRefuse, match="plafond"):
        t.creer("Troisième ticket de test", "d", "basse")
    clock.t += 601
    assert t.creer("Troisième ticket de test", "d", "basse")["numero"] == 3


def test_plafond_de_commentaires(gh):
    t, fake, clock = gh
    t.creer("Ticket de l'agent ici", "d", "moyenne")
    t.commenter(1, "un")
    t.commenter(1, "deux")
    with pytest.raises(tickets.TicketRefuse, match="plafond"):
        t.commenter(1, "trois")
    assert len(fake.comments) == 2


def test_commentaire_seulement_sur_une_issue_de_l_agent(gh):
    t, fake, _ = gh
    t.creer("Ticket de l'agent ici", "d", "moyenne")
    assert t.commenter(1, "Toujours présent ce matin.")["numero"] == 1
    assert tickets.SIGNATURE in fake.comments[0]["body"]
    with pytest.raises(tickets.TicketRefuse, match="pas créé par l'agent"):
        t.commenter(50, "label posé par un humain")
    with pytest.raises(tickets.TicketRefuse, match="pull request"):
        t.commenter(60, "sur une PR")
    assert len(fake.comments) == 1


def test_aucun_geste_de_fermeture_ou_de_suppression(gh):
    t, fake, _ = gh
    t.creer("Ticket de l'agent ici", "d", "moyenne")
    t.commenter(1, "suivi")
    assert all(m in ("GET", "POST") for m, _ in fake.calls)
    assert not any(p.endswith("/1") and m == "POST" for m, p in fake.calls)


def test_depot_invalide_refuse():
    with pytest.raises(ValueError):
        tickets.GitHubTickets("pas-un-depot", lambda: JETON)


def test_jeton_relu_quand_le_secret_change(tmp_path):
    f = tmp_path / "token"
    lire = tickets.jeton_depuis_fichier(f)
    with pytest.raises(RuntimeError, match="absent"):
        lire()
    f.write_text("ghs_un\n")
    assert lire() == "ghs_un"
    f.write_text("ghs_deux")
    os.utime(f, (f.stat().st_atime, f.stat().st_mtime + 10))
    assert lire() == "ghs_deux"
    f.write_text("")
    os.utime(f, (f.stat().st_atime, f.stat().st_mtime + 20))
    with pytest.raises(RuntimeError, match="vide"):
        lire()


def _load_server(monkeypatch, tmp_path, avec_tickets):
    import azure.storage.blob

    class FakeContainer:
        def __init__(self, *a, **kw): pass
        def list_blobs(self): return []

    monkeypatch.setattr(azure.storage.blob, "ContainerClient", FakeContainer)
    monkeypatch.setenv("STORAGE_ACCOUNT", "stfake")
    monkeypatch.setenv("AZURE_CLIENT_ID", "00000000-0000-0000-0000-000000000000")
    if avec_tickets:
        monkeypatch.setenv("GITHUB_REPOSITORY", REPO)
        monkeypatch.setenv("GITHUB_TOKEN_PATH", str(tmp_path / "token"))
    else:
        monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)
    spec = importlib.util.spec_from_file_location("serveur_equipe", MCP / "server.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.parametrize("avec_tickets, attendus", [
    (True, {"lister_documents", "lire_document", "rechercher", "creer_ticket", "lister_tickets", "commenter_ticket"}),
    (False, {"lister_documents", "lire_document", "rechercher"}),
])
def test_outils_du_serveur(monkeypatch, tmp_path, avec_tickets, attendus):
    import asyncio
    mod = _load_server(monkeypatch, tmp_path, avec_tickets)
    names = {t.name for t in asyncio.run(mod.mcp.list_tools())}
    assert names == attendus


def test_serveur_du_kit_aligne_sur_le_modele():
    """Le kit reprend le serveur durci du modèle d'équipe ; seuls les tickets s'ajoutent."""
    modele = (Path(__file__).resolve().parents[3] / "terraform" / "teams" / "template" / "mcp" / "server.py").read_text(encoding="utf-8")
    kit = (MCP / "server.py").read_text(encoding="utf-8")
    debut = modele.index("ACCOUNT = ")
    corps = modele[debut:modele.index('if __name__ == "__main__":')]
    assert corps.strip() in kit
