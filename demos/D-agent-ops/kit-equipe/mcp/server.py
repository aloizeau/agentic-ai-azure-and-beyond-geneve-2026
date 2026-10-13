"""Serveur MCP de l'équipe __EQUIPE__ : ses documents, et ses tickets.

Documents : le conteneur « documents » de son compte de stockage, lu avec
l'identité managée de l'équipe (Workload Identity : aucune clé, aucun secret).
Tickets : les issues GitHub du dépôt de l'équipe, avec ses règles (tickets.py),
activés dès que le déploiement pose GITHUB_REPOSITORY. Le reste de ce fichier
est celui du modèle d'équipe (terraform/teams/template/mcp/server.py).
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time

from azure.identity import DefaultAzureCredential
from azure.storage.blob import ContainerClient
from mcp.server.fastmcp import FastMCP

import tickets as tickets_github

ACCOUNT = os.environ["STORAGE_ACCOUNT"]
CONTAINER = os.environ.get("STORAGE_CONTAINER", "documents")
MAX_CHARS = 20_000
# Bornes du cache : le pod a 256Mi, un conteneur rempli de gros fichiers ne
# doit pas le faire tomber (OOM) ni bloquer chaque appel d'outil.
MAX_BLOB_BYTES = 1024 * 1024  # documents plus gros ignorés
MAX_DOCUMENTS = 200
MAX_QUESTION_CHARS = 500

log = logging.getLogger("docs-mcp")

container = ContainerClient(
    account_url=f"https://{ACCOUNT}.blob.core.windows.net",
    container_name=CONTAINER,
    credential=DefaultAzureCredential(exclude_interactive_browser_credential=True),
)
mcp = FastMCP("docs-__EQUIPE__", host="0.0.0.0", port=8080, stateless_http=True)

_cache: dict[str, str] = {}
_cache_at = 0.0
# Un seul rafraîchissement à la fois : sans verrou, chaque requête concurrente
# retéléchargerait tout le conteneur en parallèle.
_lock = threading.Lock()


def _documents() -> dict[str, str]:
    """Les .md du conteneur (≤ MAX_DOCUMENTS, ≤ MAX_BLOB_BYTES chacun), mis en cache 60 s."""
    global _cache, _cache_at
    with _lock:
        if time.time() - _cache_at > 60:
            docs = {}
            for blob in container.list_blobs():
                if not blob.name.lower().endswith(".md"):
                    continue
                if (blob.size or 0) > MAX_BLOB_BYTES:
                    log.warning("document ignoré, trop gros : %s (%s octets)", blob.name, blob.size)
                    continue
                if len(docs) >= MAX_DOCUMENTS:
                    log.warning("plus de %d documents : les suivants sont ignorés", MAX_DOCUMENTS)
                    break
                # length : borne même si la taille annoncée par list_blobs est fausse.
                data = container.download_blob(blob.name, offset=0, length=MAX_BLOB_BYTES).readall()
                docs[blob.name] = data[:MAX_BLOB_BYTES].decode("utf-8", "replace")
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
    question = question[:MAX_QUESTION_CHARS]  # borne le coût du scoring
    words = {w for w in re.findall(r"\w{4,}", question.lower())}
    scored = []
    for name, text in _documents().items():
        for block in re.split(r"\n(?=#)|\n\s*\n", text):
            score = sum(block.lower().count(w) for w in words)
            if score:
                scored.append((score, name, block.strip()))
    scored.sort(key=lambda x: -x[0])
    return [f"[{name}] {block[:800]}" for _, name, block in scored[:4]] or ["Aucun passage pertinent."]


# Les tickets : trois outils de plus, seulement si le déploiement les a configurés.
_tickets = tickets_github.depuis_environnement()
if _tickets:
    tickets_github.enregistrer(mcp, _tickets)


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
