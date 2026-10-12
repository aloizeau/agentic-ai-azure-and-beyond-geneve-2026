"""Serveur MCP « docs » de l'équipe __EQUIPE__.

Lit les documents Markdown du conteneur « documents » de son compte de
stockage, avec l'identité managée de l'équipe (Workload Identity : aucune clé,
aucun secret). Trois outils, en lecture seule.
"""
from __future__ import annotations

import os
import re
import time

from azure.identity import DefaultAzureCredential
from azure.storage.blob import ContainerClient
from mcp.server.fastmcp import FastMCP

ACCOUNT = os.environ["STORAGE_ACCOUNT"]
CONTAINER = os.environ.get("STORAGE_CONTAINER", "documents")
MAX_CHARS = 20_000

container = ContainerClient(
    account_url=f"https://{ACCOUNT}.blob.core.windows.net",
    container_name=CONTAINER,
    credential=DefaultAzureCredential(exclude_interactive_browser_credential=True),
)
mcp = FastMCP("docs-__EQUIPE__", host="0.0.0.0", port=8080, stateless_http=True)

_cache: dict[str, str] = {}
_cache_at = 0.0


def _documents() -> dict[str, str]:
    """Tous les .md du conteneur, mis en cache 60 s (quelques dizaines de documents)."""
    global _cache, _cache_at
    if time.time() - _cache_at > 60:
        docs = {}
        for blob in container.list_blobs():
            if blob.name.lower().endswith(".md"):
                docs[blob.name] = container.download_blob(blob.name).readall().decode("utf-8", "replace")
        _cache, _cache_at = docs, time.time()
    return _cache


@mcp.tool()
def lister_documents() -> list[str]:
    """Liste les documents disponibles (nom et taille)."""
    return [f"{name} ({len(text)} caractères)" for name, text in sorted(_documents().items())]


@mcp.tool()
def lire_document(nom: str) -> str:
    """Renvoie le contenu d'un document (nom exact, tel que listé)."""
    docs = _documents()
    if nom not in docs:
        return f"Document introuvable : {nom}. Documents : {', '.join(sorted(docs))}"
    return docs[nom][:MAX_CHARS]


@mcp.tool()
def rechercher(question: str) -> list[str]:
    """Trouve les passages les plus pertinents pour une question (mots-clés)."""
    words = {w for w in re.findall(r"\w{4,}", question.lower())}
    scored = []
    for name, text in _documents().items():
        for block in re.split(r"\n(?=#)|\n\s*\n", text):
            score = sum(block.lower().count(w) for w in words)
            if score:
                scored.append((score, name, block.strip()))
    scored.sort(key=lambda x: -x[0])
    return [f"[{name}] {block[:800]}" for _, name, block in scored[:4]] or ["Aucun passage pertinent."]


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
