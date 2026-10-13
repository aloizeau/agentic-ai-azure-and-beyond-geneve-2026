"""Serveur MCP « docs » de l'équipe __EQUIPE__.

Lit les documents Markdown du conteneur « documents » de son compte de
stockage, avec l'identité managée de l'équipe (Workload Identity : aucune clé,
aucun secret). Trois outils, en lecture seule.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time

from azure.core.exceptions import AzureError, HttpResponseError
from azure.identity import DefaultAzureCredential
from azure.storage.blob import ContainerClient
from mcp.server.fastmcp import FastMCP

ACCOUNT = os.environ["STORAGE_ACCOUNT"]
CONTAINER = os.environ.get("STORAGE_CONTAINER", "documents")
MAX_CHARS = 20_000
# Bornes du cache : le pod a 256Mi, un conteneur rempli de gros fichiers ne
# doit pas le faire tomber (OOM) ni bloquer chaque appel d'outil.
MAX_BLOB_BYTES = 1024 * 1024  # documents plus gros ignorés
MAX_DOCUMENTS = 200
# Budget total du cache : 200 documents de 1 Mio ne tiennent pas dans 256Mi
# (texte décodé + copie pendant le rafraîchissement). Ajustable par variable.
MAX_TOTAL_BYTES = int(os.environ.get("MAX_TOTAL_BYTES", str(32 * 1024 * 1024)))
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
# retéléchargerait tout le conteneur en parallèle. Pendant un rafraîchissement,
# les autres appels servent le cache précédent au lieu d'attendre (sauf au
# tout premier chargement, où il n'y a rien à servir).
_lock = threading.Lock()


def _telecharger(nom: str) -> str:
    """Contenu d'un blob, borné à MAX_BLOB_BYTES même si la taille annoncée est fausse."""
    try:
        data = container.download_blob(nom, offset=0, length=MAX_BLOB_BYTES).readall()
    except HttpResponseError as e:
        # Un blob vide répond 416 (plage invalide) à une lecture par plage : le
        # SDK ne se rabat sur une lecture complète que sans offset. Vide = "".
        if e.status_code == 416:
            return ""
        raise
    return data[:MAX_BLOB_BYTES].decode("utf-8", "replace")


def _charger() -> dict[str, str]:
    """Les .md du conteneur, dans les bornes ; un blob en erreur est ignoré, pas les autres."""
    docs: dict[str, str] = {}
    total = 0
    for blob in container.list_blobs():
        if not blob.name.lower().endswith(".md"):
            continue
        taille = blob.size or 0
        if taille > MAX_BLOB_BYTES:
            log.warning("document ignoré, trop gros : %s (%s octets)", blob.name, blob.size)
            continue
        if len(docs) >= MAX_DOCUMENTS:
            log.warning("plus de %d documents : les suivants sont ignorés", MAX_DOCUMENTS)
            break
        if total + taille > MAX_TOTAL_BYTES:
            log.warning("budget de %d octets atteint : %s et les suivants sont ignorés", MAX_TOTAL_BYTES, blob.name)
            break
        try:
            texte = _telecharger(blob.name)
        except AzureError as e:   # HttpResponseError compris : un blob illisible n'empêche pas les autres
            log.warning("document ignoré, lecture impossible : %s (%s)", blob.name, e)
            continue
        # Le total compte ce qui a été réellement lu (la taille annoncée peut mentir).
        total += max(taille, len(texte.encode("utf-8")))
        if total > MAX_TOTAL_BYTES:
            log.warning("budget de %d octets atteint avec %s : chargement arrêté", MAX_TOTAL_BYTES, blob.name)
            break
        docs[blob.name] = texte
    return docs


def _documents() -> dict[str, str]:
    """Les .md du conteneur (≤ MAX_DOCUMENTS, ≤ MAX_BLOB_BYTES chacun, ≤ MAX_TOTAL_BYTES en tout), mis en cache 60 s."""
    global _cache, _cache_at
    if time.time() - _cache_at <= 60:
        return _cache
    if not _lock.acquire(blocking=_cache_at == 0.0):
        return _cache   # un autre appel rafraîchit déjà : cache précédent
    try:
        if time.time() - _cache_at > 60:   # peut-être rafraîchi pendant l'attente
            docs = _charger()   # hors de tout état partagé ; échange en une affectation
            _cache, _cache_at = docs, time.time()
        return _cache
    finally:
        _lock.release()


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


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
