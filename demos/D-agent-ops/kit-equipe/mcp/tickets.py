"""Couche « tickets » de l'équipe __EQUIPE__ : des issues GitHub, avec des règles.

Ce que l'équipe a construit autour de GitHub, et pourquoi elle ne branche pas
directement le serveur MCP GitHub générique sur son agent :

  - un seul dépôt : celui de l'équipe (GITHUB_REPOSITORY), jamais un autre ;
  - un jeton d'une heure, restreint à CE dépôt et à la permission issues:write,
    obtenu par l'application GitHub de la plateforme (aucun PAT dans le cluster) ;
  - trois gestes seulement : créer, lister, commenter. Ni fermer, ni supprimer,
    ni toucher au code ;
  - un ticket structuré (sévérité, ressource Azure, sources Microsoft Learn),
    étiqueté « agent », signé par l'agent ;
  - pas de doublon : un ticket ouvert au même titre est renvoyé, pas recréé ;
  - un plafond de créations par fenêtre de temps (un agent qui boucle ne
    remplit pas le dépôt) ;
  - un commentaire uniquement sur un ticket créé par l'agent.
"""
from __future__ import annotations

import os
import re
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any

import httpx
import jwt

API = os.environ.get("GITHUB_API_URL", "https://api.github.com")
SEVERITES = ("basse", "moyenne", "haute", "critique")
ETIQUETTE = "agent"
SIGNATURE = "Créé par l'agent de l'équipe __EQUIPE__ (serveur MCP tickets) — à valider par un humain."


class TicketRefuse(ValueError):
    """Demande refusée par une règle de l'équipe : le message est renvoyé à l'agent."""


class GitHubTickets:
    def __init__(
        self,
        repository: str,
        app_id: str,
        private_key: str,
        *,
        max_creations: int = 5,
        fenetre_s: int = 600,
        client: httpx.Client | None = None,
        horloge=time.time,
    ) -> None:
        if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository or ""):
            raise ValueError(f"GITHUB_REPOSITORY invalide : {repository!r} (attendu owner/dépôt)")
        self.repository = repository
        self.owner, self.repo = repository.split("/")
        self.app_id = str(app_id)
        self.private_key = private_key
        self.max_creations = max_creations
        self.fenetre_s = fenetre_s
        self.http = client or httpx.Client(base_url=API, timeout=15)
        self.now = horloge
        self._token: str | None = None
        self._token_exp = 0.0
        self._creations: deque[float] = deque()
        self._lock = threading.Lock()

    # --- Authentification : application GitHub → jeton d'installation restreint ----
    def _jwt_app(self) -> str:
        t = int(self.now())
        return jwt.encode({"iat": t - 60, "exp": t + 540, "iss": self.app_id}, self.private_key, algorithm="RS256")

    def _jeton(self) -> str:
        with self._lock:
            if self._token and self.now() < self._token_exp - 300:
                return self._token
            app = {"Authorization": f"Bearer {self._jwt_app()}", "Accept": "application/vnd.github+json"}
            r = self.http.get(f"/repos/{self.repository}/installation", headers=app)
            if r.status_code == 404:
                raise RuntimeError(f"application GitHub non installée sur {self.repository}")
            r.raise_for_status()
            # Le jeton ne vaut que pour CE dépôt et ces permissions, même si
            # l'application est installée sur toute l'organisation.
            r = self.http.post(
                f"/app/installations/{r.json()['id']}/access_tokens",
                headers=app,
                json={"repositories": [self.repo], "permissions": {"issues": "write", "metadata": "read"}},
            )
            r.raise_for_status()
            self._token = r.json()["token"]
            self._token_exp = self.now() + 3600
            return self._token

    def _api(self, method: str, path: str, **kw: Any) -> Any:
        headers = {
            "Authorization": f"Bearer {self._jeton()}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        r = self.http.request(method, f"/repos/{self.repository}{path}", headers=headers, **kw)
        r.raise_for_status()
        return r.json()

    # --- Les trois gestes ------------------------------------------------------
    def _tickets_agent(self, etat: str = "open") -> list[dict]:
        issues = self._api("GET", "/issues", params={"labels": ETIQUETTE, "state": etat, "per_page": 50})
        return [i for i in issues if "pull_request" not in i]   # l'API mêle issues et PR

    def lister(self, etat: str = "open") -> list[dict]:
        if etat not in ("open", "closed", "all"):
            raise TicketRefuse("etat : open, closed ou all")
        return [
            {"numero": i["number"], "titre": i["title"], "etat": i["state"], "url": i["html_url"],
             "etiquettes": [lab["name"] for lab in i.get("labels", [])]}
            for i in self._tickets_agent(etat)
        ]

    def creer(self, titre: str, description: str, severite: str, ressource: str = "", sources: list[str] | None = None) -> dict:
        titre = " ".join((titre or "").split())
        severite = (severite or "").lower().strip()
        sources = [s.strip() for s in (sources or []) if s and s.strip()]
        if not 8 <= len(titre) <= 120:
            raise TicketRefuse("titre : 8 à 120 caractères")
        if severite not in SEVERITES:
            raise TicketRefuse(f"sévérité : {', '.join(SEVERITES)}")
        if not description or len(description) > 6000:
            raise TicketRefuse("description : obligatoire, 6 000 caractères au plus")
        if ressource and not ressource.startswith("/subscriptions/"):
            raise TicketRefuse("ressource : identifiant Azure complet (/subscriptions/…), ou vide")
        for s in sources:
            if not re.match(r"^https://learn\.microsoft\.com/", s):
                raise TicketRefuse(f"source non autorisée : {s} (Microsoft Learn uniquement)")

        # Pas de doublon : même titre, ticket ouvert → on le renvoie.
        for i in self._tickets_agent("open"):
            if i["title"].strip().lower() == titre.lower():
                return {"numero": i["number"], "url": i["html_url"], "doublon": True}

        with self._lock:
            t = self.now()
            while self._creations and t - self._creations[0] > self.fenetre_s:
                self._creations.popleft()
            if len(self._creations) >= self.max_creations:
                raise TicketRefuse(f"plafond atteint : {self.max_creations} tickets en {self.fenetre_s // 60} min")
            self._creations.append(t)

        corps = [f"**Sévérité** : {severite}"]
        if ressource:
            corps.append(f"**Ressource Azure** : `{ressource}`")
        corps += ["", description.strip()]
        if sources:
            corps += ["", "**Sources (Microsoft Learn)**", *[f"- {s}" for s in sources]]
        corps += ["", "---", f"_{SIGNATURE}_"]
        issue = self._api("POST", "/issues", json={
            "title": titre, "body": "\n".join(corps), "labels": [ETIQUETTE, f"severite:{severite}"],
        })
        return {"numero": issue["number"], "url": issue["html_url"], "doublon": False}

    def commenter(self, numero: int, commentaire: str) -> dict:
        if not commentaire or len(commentaire) > 4000:
            raise TicketRefuse("commentaire : obligatoire, 4 000 caractères au plus")
        issue = self._api("GET", f"/issues/{int(numero)}")
        if ETIQUETTE not in [lab["name"] for lab in issue.get("labels", [])]:
            raise TicketRefuse(f"ticket #{numero} : pas créé par l'agent, l'agent n'y écrit pas")
        c = self._api("POST", f"/issues/{int(numero)}/comments", json={"body": f"{commentaire.strip()}\n\n_{SIGNATURE}_"})
        return {"numero": int(numero), "url": c["html_url"]}


def depuis_environnement() -> GitHubTickets | None:
    """Configuration posée par le déploiement ; None si l'équipe n'a pas activé les tickets."""
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        return None
    key = Path(os.environ.get("GITHUB_APP_PRIVATE_KEY_PATH", "/var/run/github-app/private-key")).read_text()
    return GitHubTickets(
        repo,
        os.environ["GITHUB_APP_ID"],
        key,
        max_creations=int(os.environ.get("TICKETS_MAX_CREATIONS", "5")),
        fenetre_s=int(os.environ.get("TICKETS_FENETRE_S", "600")),
    )


def enregistrer(mcp, tickets: GitHubTickets) -> None:
    """Ajoute les trois outils au serveur MCP de l'équipe."""

    def refus(e: TicketRefuse) -> dict:
        return {"refuse": str(e)}

    @mcp.tool()
    def creer_ticket(titre: str, description: str, severite: str, ressource_azure: str = "", sources_learn: list[str] | None = None) -> dict:
        """Crée un ticket (issue GitHub) dans le dépôt de l'équipe.

        severite : basse, moyenne, haute ou critique. ressource_azure : identifiant
        complet /subscriptions/… de la ressource concernée. sources_learn : URL
        Microsoft Learn qui justifient la remédiation. Un ticket ouvert au même
        titre est renvoyé au lieu d'être recréé.
        """
        try:
            return tickets.creer(titre, description, severite, ressource_azure, sources_learn)
        except TicketRefuse as e:
            return refus(e)

    @mcp.tool()
    def lister_tickets(etat: str = "open") -> list[dict] | dict:
        """Liste les tickets créés par l'agent (etat : open, closed ou all)."""
        try:
            return tickets.lister(etat)
        except TicketRefuse as e:
            return refus(e)

    @mcp.tool()
    def commenter_ticket(numero: int, commentaire: str) -> dict:
        """Ajoute un commentaire à un ticket créé par l'agent (suivi d'un diagnostic)."""
        try:
            return tickets.commenter(numero, commentaire)
        except TicketRefuse as e:
            return refus(e)
