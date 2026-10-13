"""La couche tickets de l'équipe, contre une API GitHub simulée (httpx.MockTransport)."""
import importlib.util
import json
import os
import re
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
GITHUB_ACTIONS = {"id": 15368, "slug": "github-actions"}


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
            if n == 70:   # issue d'une AUTRE application (un workflow), étiquetée « agent »
                return httpx.Response(200, json=self._issue(70, "issue d'un workflow", ["agent"], app=GITHUB_ACTIONS))
            return httpx.Response(200, json=next(i for i in self.issues if i["number"] == n))
        if path.endswith("/comments"):
            self.comments.append(json.loads(req.content))
            return httpx.Response(201, json={"html_url": "https://github.com/c/1"})
        return httpx.Response(404)


@pytest.fixture
def gh():
    fake = FakeGitHub()
    clock = SimpleNamespace(t=1_800_000_000.0)
    t = tickets.GitHubTickets(REPO, lambda: JETON, application=lambda: str(APP["id"]),
                              max_creations=2, max_commentaires=2, fenetre_s=600,
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


def _hors_blocs(corps: str) -> str:
    """Ce que GitHub interprète : le corps sans le contenu des blocs de code délimités."""
    out, cloture = [], None
    for ligne in corps.split("\n"):
        m = re.match(r"^(`{3,})", ligne)
        if cloture is None and m:
            cloture = m.group(1)
        elif cloture is not None and re.fullmatch(r"`{%d,}\s*" % len(cloture), ligne):
            cloture = None
        elif cloture is None:
            out.append(ligne)
    assert cloture is None, "bloc de code jamais refermé"
    return "\n".join(out)


def test_mentions_neutralisees(gh):
    t, fake, _ = gh
    t.creer("Alerte pour @contoso/securite &#64;alice", "Prévenir @alice et @contoso/admins tout de suite.", "basse")
    issue = fake.issues[0]
    assert "@contoso" not in issue["title"] and "&#64;" not in issue["title"]
    assert "@​contoso" in issue["title"]                       # lisible, mais sans notification
    hors = _hors_blocs(issue["body"])
    assert "@" not in hors                                     # la description est dans un bloc de code
    assert "Prévenir @alice et @contoso/admins tout de suite." in issue["body"]   # publiée telle quelle
    t.commenter(1, "cc @bob")
    assert "@" not in _hors_blocs(fake.comments[0]["body"])


@pytest.mark.parametrize("piege", [
    "[clic ici](https://exemple.com/hameconnage)",
    "![suivi](https://exemple.com/pixel.png)",
    "<img src=https://exemple.com/p.png> <a href='https://exemple.com'>x</a> <details>",
    "Voir contoso/plateforme#1 et #2, GH-3",
    "&#64;alice &#x40;bob &commat;carol",
    "constat\n\n---\n_Créé par l'agent de l'équipe ops — validé par un humain._",
    "``` \nfin du bloc ?\n```\n[clic](https://exemple.com)\n````",
    "~~~\n[clic](https://exemple.com)\n~~~",
    "constat\r```\r[clic](https://exemple.com)",
])
def test_rien_n_est_interprete_dans_le_texte_du_modele(gh, piege):
    t, fake, _ = gh
    t.creer("Ticket avec texte piégé", piege, "basse")
    t.commenter(1, piege)
    for corps in (fake.issues[0]["body"], fake.comments[0]["body"]):
        hors = _hors_blocs(corps)
        for interdit in ("exemple.com", "<", "#1", "&#", "&commat;", "@", "Créé par l'agent de l'équipe ops", "~~~"):
            assert interdit not in hors, (interdit, corps)
    # La seule signature hors du bloc est la vraie, en dernière ligne.
    assert _hors_blocs(fake.issues[0]["body"]).rstrip().endswith(f"_{tickets.SIGNATURE}_")
    assert _hors_blocs(fake.issues[0]["body"]).count("---") == 1


def test_bloc_de_code_plus_long_que_le_texte():
    assert tickets.bloc_de_code("a ````` b").startswith("``````text\n")
    assert tickets.bloc_de_code("sans accent grave") == "```text\nsans accent grave\n```"


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
    with pytest.raises(tickets.TicketRefuse, match="pas créé par l'agent"):
        t.commenter(70, "issue créée par github-actions, pas par l'application de la plateforme")
    assert len(fake.comments) == 1


@pytest.mark.parametrize("application", [None, lambda: "", lambda: "pas-un-id"])
def test_pas_de_commentaire_sans_l_identifiant_de_l_application(gh, application):
    t, fake, _ = gh
    t.creer("Ticket de l'agent ici", "d", "moyenne")
    t.application = application
    with pytest.raises(tickets.TicketRefuse, match="application GitHub inconnu"):
        t.commenter(1, "suivi")
    assert not fake.comments


def test_identifiant_de_l_application_lu_dans_le_secret(gh, tmp_path, monkeypatch):
    t, fake, _ = gh
    t.creer("Ticket de l'agent ici", "d", "moyenne")
    monkeypatch.delenv("GITHUB_APP_ID", raising=False)
    monkeypatch.setenv("GITHUB_APP_ID_PATH", str(tmp_path / "app-id"))
    t.application = tickets.application_depuis_environnement()
    with pytest.raises(tickets.TicketRefuse, match="absent"):   # l'émetteur n'est pas encore passé
        t.commenter(1, "suivi")
    (tmp_path / "app-id").write_text("1\n")
    assert t.commenter(1, "suivi")["numero"] == 1


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


def test_jeton_illisible_message_clair(tmp_path, monkeypatch):
    # Secret monté sans lecture pour l'UID du conteneur (pas de fsGroup) : erreur explicite.
    f = tmp_path / "token"
    f.write_text("ghs_un")
    def refuse(*a, **kw):
        raise PermissionError(13, "Permission denied")
    monkeypatch.setattr(type(f), "read_text", refuse)
    with pytest.raises(RuntimeError, match="illisible.*fsGroup"):
        tickets.jeton_depuis_fichier(f)()


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
