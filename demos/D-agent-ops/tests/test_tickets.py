"""La couche tickets de l'équipe, contre une API GitHub simulée (httpx.MockTransport)."""
import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

MCP = Path(__file__).resolve().parents[1] / "kit-equipe" / "mcp"
sys.path.insert(0, str(MCP))
import tickets  # noqa: E402

REPO = "contoso/agent-equipe-ops"
_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PEM = _key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()).decode()
PUB = _key.public_key()


def _app_jwt(auth: str) -> dict:
    """JWT de l'application : signé par sa clé, durée de vie de 10 minutes au plus (règle GitHub)."""
    claims = jwt.decode(auth.removeprefix("Bearer "), PUB, algorithms=["RS256"], options={"verify_iat": False, "verify_exp": False})
    assert claims["exp"] - claims["iat"] <= 600
    return claims


class FakeGitHub:
    """Juste ce que tickets.py appelle, avec les contrôles d'authentification."""

    def __init__(self):
        self.issues: list[dict] = []
        self.comments: list[dict] = []
        self.token_requests: list[dict] = []
        self.calls: list[tuple[str, str]] = []

    def _issue(self, n, title, labels):
        return {"number": n, "title": title, "state": "open", "html_url": f"https://github.com/{REPO}/issues/{n}",
                "labels": [{"name": x} for x in labels]}

    def handler(self, req: httpx.Request) -> httpx.Response:
        path, auth = req.url.path, req.headers.get("authorization", "")
        self.calls.append((req.method, path))
        if path == f"/repos/{REPO}/installation":
            claims = _app_jwt(auth)
            assert claims["iss"] == "4242"
            return httpx.Response(200, json={"id": 77})
        if path == "/app/installations/77/access_tokens":
            _app_jwt(auth)
            self.token_requests.append(json.loads(req.content))
            return httpx.Response(201, json={"token": "ghs_installation"})
        assert auth == "Bearer ghs_installation", "appel au dépôt sans jeton d'installation"
        assert path.startswith(f"/repos/{REPO}/"), f"hors du dépôt de l'équipe : {path}"
        if path.endswith("/issues") and req.method == "GET":
            assert req.url.params["labels"] == "agent"
            pr = {**self._issue(999, "une PR", ["agent"]), "pull_request": {}}
            return httpx.Response(200, json=[i for i in self.issues if i["state"] == "open"] + [pr])
        if path.endswith("/issues") and req.method == "POST":
            body = json.loads(req.content)
            issue = self._issue(len(self.issues) + 1, body["title"], body["labels"])
            issue["body"] = body["body"]
            self.issues.append(issue)
            return httpx.Response(201, json=issue)
        if req.method == "GET" and "/issues/" in path:
            n = int(path.rsplit("/", 1)[1])
            if n == 50:
                return httpx.Response(200, json=self._issue(50, "ticket humain", ["bug"]))
            return httpx.Response(200, json=next(i for i in self.issues if i["number"] == n))
        if path.endswith("/comments"):
            self.comments.append(json.loads(req.content))
            return httpx.Response(201, json={"html_url": "https://github.com/c/1"})
        return httpx.Response(404)


@pytest.fixture
def gh():
    fake = FakeGitHub()
    clock = SimpleNamespace(t=1_800_000_000.0)
    t = tickets.GitHubTickets(REPO, "4242", PEM, max_creations=2, fenetre_s=600,
                              client=httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(fake.handler)),
                              horloge=lambda: clock.t)
    return t, fake, clock


LEARN = "https://learn.microsoft.com/azure/aks/supported-kubernetes-versions"
RES = "/subscriptions/0000/resourceGroups/rg-demo/providers/Microsoft.ContainerService/managedClusters/aks-demo"


def test_jeton_restreint_au_depot_et_aux_issues(gh):
    t, fake, _ = gh
    t.lister()
    assert fake.token_requests == [{"repositories": ["agent-equipe-ops"], "permissions": {"issues": "write", "metadata": "read"}}]


def test_jeton_reutilise_puis_renouvele(gh):
    t, fake, clock = gh
    t.lister(); t.lister()
    assert len(fake.token_requests) == 1
    clock.t += 3400                       # moins de 5 min avant expiration
    t.lister()
    assert len(fake.token_requests) == 2


def test_creation_structuree_et_signee(gh):
    t, fake, _ = gh
    r = t.creer("AKS aks-demo : version hors support", "Version 1.29 lue dans Azure.", "Haute", RES, [LEARN])
    assert r == {"numero": 1, "url": f"https://github.com/{REPO}/issues/1", "doublon": False}
    issue = fake.issues[0]
    assert [x["name"] for x in issue["labels"]] == ["agent", "severite:haute"]
    assert RES in issue["body"] and LEARN in issue["body"] and tickets.SIGNATURE in issue["body"]


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
    (("Titre suffisamment long", "d", "haute", "", ["https://exemple.com/blog"]), "source non autorisée"),
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


def test_commentaire_seulement_sur_un_ticket_de_l_agent(gh):
    t, fake, _ = gh
    t.creer("Ticket de l'agent ici", "d", "moyenne")
    assert t.commenter(1, "Toujours présent ce matin.")["numero"] == 1
    assert tickets.SIGNATURE in fake.comments[0]["body"]
    with pytest.raises(tickets.TicketRefuse, match="pas créé par l'agent"):
        t.commenter(50, "intrusion")
    assert len(fake.comments) == 1


def test_aucun_geste_de_fermeture_ou_de_suppression(gh):
    t, fake, _ = gh
    t.creer("Ticket de l'agent ici", "d", "moyenne")
    t.commenter(1, "suivi")
    assert all(m in ("GET", "POST") for m, _ in fake.calls)
    assert not any(p.endswith("/1") and m == "POST" for m, p in fake.calls)


def test_depot_invalide_refuse():
    with pytest.raises(ValueError):
        tickets.GitHubTickets("pas-un-depot", "1", PEM)


def _load_server(monkeypatch, tmp_path, avec_tickets):
    import azure.storage.blob

    class FakeContainer:
        def __init__(self, *a, **kw): pass
        def list_blobs(self): return []

    monkeypatch.setattr(azure.storage.blob, "ContainerClient", FakeContainer)
    monkeypatch.setenv("STORAGE_ACCOUNT", "stfake")
    monkeypatch.setenv("AZURE_CLIENT_ID", "00000000-0000-0000-0000-000000000000")
    if avec_tickets:
        key = tmp_path / "private-key"
        key.write_text(PEM)
        monkeypatch.setenv("GITHUB_REPOSITORY", REPO)
        monkeypatch.setenv("GITHUB_APP_ID", "4242")
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY_PATH", str(key))
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
