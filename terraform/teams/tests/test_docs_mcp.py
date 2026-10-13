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
        return [SimpleNamespace(name=n, size=len(b)) for n, b in self.docs.items()]

    def download_blob(self, name, offset=0, length=None):
        data = self.docs[name][offset:]
        return SimpleNamespace(readall=lambda: data[:length] if length is not None else data)


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


def test_size_and_count_caps(monkeypatch):
    m = load(monkeypatch)
    m.container.docs = {"gros.md": b"x" * (m.MAX_BLOB_BYTES + 1), "petit.md": b"# Petit"}
    m.container.docs.update({f"doc{i:03}.md": b"ok" for i in range(m.MAX_DOCUMENTS + 10)})
    docs = m._documents()
    assert "gros.md" not in docs                     # trop gros : jamais téléchargé
    assert len(docs) == m.MAX_DOCUMENTS


def test_download_is_length_bounded(monkeypatch):
    # Taille annoncée fausse (0) : le téléchargement reste borné par `length`.
    m = load(monkeypatch)
    m.container.docs = {"menteur.md": b"y" * (m.MAX_BLOB_BYTES * 2)}
    m.container.list_blobs = lambda: [SimpleNamespace(name="menteur.md", size=0)]
    assert len(m._documents()["menteur.md"]) == m.MAX_BLOB_BYTES


def test_question_is_truncated(monkeypatch):
    m = load(monkeypatch)
    # Le mot-clé au-delà de 500 caractères n'est pas pris en compte.
    assert m.rechercher(" " * m.MAX_QUESTION_CHARS + "astreinte") == ["Aucun passage pertinent."]
