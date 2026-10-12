"""Le serveur MCP « docs » du modèle d'équipe, avec un conteneur factice."""
import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace

DOCS = Path(__file__).resolve().parents[1] / "template" / "docs"
SERVER = Path(__file__).resolve().parents[1] / "template" / "mcp" / "server.py"


class FakeContainer:
    def __init__(self, *a, **kw):
        self.docs = {p.name: p.read_bytes() for p in DOCS.glob("*.md")}

    def list_blobs(self):
        return [SimpleNamespace(name=n) for n in self.docs]

    def download_blob(self, name):
        return SimpleNamespace(readall=lambda: self.docs[name])


def load(monkeypatch):
    import azure.storage.blob
    monkeypatch.setattr(azure.storage.blob, "ContainerClient", FakeContainer)
    monkeypatch.setenv("STORAGE_ACCOUNT", "stfake")
    spec = importlib.util.spec_from_file_location("docs_server", SERVER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_tools(monkeypatch):
    m = load(monkeypatch)
    assert any(x.startswith("astreinte.md") for x in m.lister_documents())
    assert "Astreinte" in m.lire_document("astreinte.md")
    assert m.lire_document("absent.md").startswith("Document introuvable")
    hits = m.rechercher("Qui répond aux alertes de l'astreinte et en combien de temps ?")
    assert hits[0].startswith("[astreinte.md]")
