"""L'émetteur de jetons, contre des API GitHub et Kubernetes simulées."""
import base64
import importlib.util
import json
from pathlib import Path

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

spec = importlib.util.spec_from_file_location("issuer", Path(__file__).resolve().parents[1] / "issuer.py")
issuer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(issuer)

_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PEM = _key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
                         serialization.NoEncryption()).decode()
INSTALLES = {"agent-equipe-ops", "agent-equipe-docs"}


def github(requetes):
    def handler(req: httpx.Request) -> httpx.Response:
        requetes.append(req)
        claims = jwt.decode(req.headers["authorization"].removeprefix("Bearer "), _key.public_key(),
                            algorithms=["RS256"], options={"verify_iat": False, "verify_exp": False})
        assert claims["iss"] == "4242" and claims["exp"] - claims["iat"] <= 600
        p = req.url.path
        if p.endswith("/installation"):
            repo = p.split("/")[3]
            return httpx.Response(200, json={"id": 7}) if repo in INSTALLES else httpx.Response(404)
        if p == "/app/installations/7/access_tokens":
            body = json.loads(req.content)
            return httpx.Response(201, json={"token": f"ghs_{body['repositories'][0]}"})
        return httpx.Response(404)
    return httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(handler))


def kube(namespaces, secrets, patches):
    def handler(req: httpx.Request) -> httpx.Response:
        if req.method == "GET" and req.url.path == "/api/v1/namespaces":
            assert req.url.params["labelSelector"] == "agentic.io/team"
            return httpx.Response(200, json={"items": [{"metadata": {"name": n}} for n in namespaces]})
        if req.method == "PATCH":
            ns, name = req.url.path.split("/")[4], req.url.path.split("/")[6]
            assert name == "github-token"
            if ns not in secrets:
                return httpx.Response(404)
            data = json.loads(req.content)["data"]
            assert set(data) == {"token", "app-id"}, data
            # L'identifiant de l'application accompagne le jeton : tickets.py n'accepte que ses issues.
            assert base64.b64decode(data["app-id"]).decode() == "4242"
            patches[ns] = base64.b64decode(data["token"]).decode()
            return httpx.Response(200, json={})
        return httpx.Response(405)
    return issuer.Kube(httpx.Client(base_url="https://k8s", transport=httpx.MockTransport(handler)))


def test_un_jeton_par_equipe_limite_a_son_depot():
    req, patches = [], {}
    app = issuer.GitHubApp("4242", PEM, http=github(req))
    k = kube(["equipe-ops", "equipe-docs"], {"equipe-ops", "equipe-docs"}, patches)
    assert issuer.passage(k, app, "contoso") == 0
    assert patches == {"equipe-ops": "ghs_agent-equipe-ops", "equipe-docs": "ghs_agent-equipe-docs"}
    corps = [json.loads(r.content) for r in req if r.method == "POST"]
    assert corps == [{"repositories": ["agent-equipe-docs"], "permissions": {"issues": "write", "metadata": "read"}},
                     {"repositories": ["agent-equipe-ops"], "permissions": {"issues": "write", "metadata": "read"}}]
    assert all(r.url.path.startswith("/repos/contoso/agent-") for r in req if r.method == "GET")


def test_le_depot_vient_du_nom_du_namespace_jamais_d_ailleurs():
    req, patches = [], {}
    app = issuer.GitHubApp("4242", PEM, http=github(req))
    # Un nom qui n'est pas un nom d'équipe valide (tentative de viser un autre dépôt) est ignoré.
    k = kube(["equipe-ops", "x/../plateforme", "Equipe-Ops"], {"equipe-ops"}, patches)
    issuer.passage(k, app, "contoso")
    assert list(patches) == ["equipe-ops"]
    assert {r.url.path for r in req if r.method == "GET"} == {"/repos/contoso/agent-equipe-ops/installation"}


def test_application_non_installee_ou_secret_absent():
    req, patches = [], {}
    app = issuer.GitHubApp("4242", PEM, http=github(req))
    k = kube(["equipe-inconnue", "equipe-docs"], set(), patches)   # aucun Secret créé par Agent Ready
    assert issuer.passage(k, app, "contoso") == 0
    assert patches == {}


def test_une_equipe_en_echec_n_arrete_pas_les_autres():
    patches = {}
    def handler(req):
        if "agent-equipe-a" in req.url.path:
            return httpx.Response(500)
        if req.url.path.endswith("/installation"):
            return httpx.Response(200, json={"id": 7})
        return httpx.Response(201, json={"token": "ghs_b"})
    app = issuer.GitHubApp("4242", PEM, http=httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(handler)))
    k = kube(["equipe-a", "equipe-b"], {"equipe-a", "equipe-b"}, patches)
    assert issuer.passage(k, app, "contoso") == 1
    assert patches == {"equipe-b": "ghs_b"}


def test_main_refuse_un_owner_invalide(monkeypatch):
    monkeypatch.setenv("GITHUB_OWNER", "contoso/plateforme")
    monkeypatch.setenv("GITHUB_APP_ID", "1")
    assert issuer.main() == 2


def test_main_refuse_un_app_id_non_numerique(monkeypatch):
    monkeypatch.setenv("GITHUB_OWNER", "contoso")
    monkeypatch.setenv("GITHUB_APP_ID", "Iv1.0123456789abcdef")
    assert issuer.main() == 2
