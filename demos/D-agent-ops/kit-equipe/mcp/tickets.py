"""Couche « tickets » de l'équipe __EQUIPE__ : des issues GitHub, avec des règles.

Ce que l'équipe a construit autour de GitHub, et pourquoi elle ne branche pas
directement le serveur MCP GitHub générique sur son agent :

  - un seul dépôt : celui de l'équipe (GITHUB_REPOSITORY), jamais un autre ;
  - un jeton d'une heure, déjà restreint à CE dépôt et à issues:write, écrit
    dans le Secret github-token par l'émetteur de la plateforme
    (tools/github-token-issuer). La clé privée de l'application GitHub ne
    quitte jamais le namespace de la plateforme : ni ce code ni l'équipe ne
    peuvent obtenir de jeton pour un autre dépôt ;
  - trois gestes seulement : créer, lister, commenter. Ni fermer, ni supprimer,
    ni toucher au code ;
  - un ticket structuré (sévérité, ressource Azure, sources Microsoft Learn),
    étiqueté « agent », signé par l'agent ;
  - le texte vient d'un modèle, donc potentiellement d'une injection de prompt :
    la description et les commentaires sont publiés dans un bloc de code, donc
    jamais interprétés — ni lien, ni image, ni HTML, ni mention @…, ni
    référence owner/dépôt#1, ni fausse signature hors du bloc ; dans le titre
    (texte brut), les mentions et entités HTML sont neutralisées ; la ressource
    doit être un identifiant Azure valide, les sources des URL Microsoft Learn ;
  - pas de doublon : un ticket ouvert au même titre est renvoyé, pas recréé ;
  - un plafond de créations ET de commentaires par fenêtre de temps (un agent
    qui boucle ne remplit pas le dépôt) ;
  - un commentaire uniquement sur une issue (pas une PR) étiquetée « agent » et
    créée par L'application GitHub de la plateforme — son identifiant est écrit
    par l'émetteur à côté du jeton (clé app-id) ; une issue d'une autre
    application (github-actions…) est refusée.
"""
from __future__ import annotations

import os
import re
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Callable

import httpx

API = os.environ.get("GITHUB_API_URL", "https://api.github.com")
SEVERITES = ("basse", "moyenne", "haute", "critique")
ETIQUETTE = "agent"
SIGNATURE = "Créé par l'agent de l'équipe __EQUIPE__ (serveur MCP tickets) — à valider par un humain."
# /subscriptions/<guid>/resourceGroups/<rg>/providers/<Espace.De.Noms>/<type>/<nom>[/…]
RESSOURCE_ARM = re.compile(
    r"/subscriptions/[0-9a-fA-F-]{36}/resourceGroups/[\w.()\-]{1,90}"
    r"/providers/[A-Za-z]+\.[A-Za-z.]+(/[\w.\-]{1,128}){2,8}"
)
_ZWSP = "​"


class TicketRefuse(ValueError):
    """Demande refusée par une règle de l'équipe : le message est renvoyé à l'agent."""


def neutraliser(texte: str) -> str:
    """Pour le titre (texte brut) : casse les mentions GitHub (@personne,
    @org/équipe) et les entités HTML (&#64;, &#x40;, &commat;…) sans changer ce
    qu'on lit."""
    texte = re.sub(r"&(?=#?[A-Za-z0-9]+;)", "&" + _ZWSP, texte)
    return re.sub(r"@(?=[A-Za-z0-9])", "@" + _ZWSP, texte)


def bloc_de_code(texte: str) -> str:
    """Le texte du modèle, publié tel quel et jamais interprété par GitHub.

    Dans un bloc de code délimité, rien n'est rendu : ni lien, ni image, ni
    HTML, ni entité, ni mention, ni référence. La clôture est plus longue que
    toute suite de ` du texte : le texte ne peut pas fermer le bloc et écrire
    du Markdown après (une fausse signature, par exemple).
    """
    texte = texte.replace("\r\n", "\n").replace("\r", "\n")
    plus_longue = max((len(m) for m in re.findall(r"`+", texte)), default=0)
    cloture = "`" * max(3, plus_longue + 1)
    return f"{cloture}text\n{texte}\n{cloture}"


class Plafond:
    """N événements au plus par fenêtre glissante (en mémoire, par réplica)."""

    def __init__(self, maximum: int, fenetre_s: int, horloge: Callable[[], float]) -> None:
        self.maximum, self.fenetre_s, self.now = maximum, fenetre_s, horloge
        self._t: deque[float] = deque()
        self._lock = threading.Lock()

    def prendre(self, quoi: str) -> None:
        with self._lock:
            t = self.now()
            while self._t and t - self._t[0] > self.fenetre_s:
                self._t.popleft()
            if len(self._t) >= self.maximum:
                raise TicketRefuse(f"plafond atteint : {self.maximum} {quoi} en {self.fenetre_s // 60} min")
            self._t.append(t)


class GitHubTickets:
    def __init__(
        self,
        repository: str,
        jeton: Callable[[], str],
        *,
        application: Callable[[], str] | None = None,
        max_creations: int = 5,
        max_commentaires: int = 10,
        fenetre_s: int = 600,
        client: httpx.Client | None = None,
        horloge: Callable[[], float] = time.time,
    ) -> None:
        if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository or ""):
            raise ValueError(f"GITHUB_REPOSITORY invalide : {repository!r} (attendu owner/dépôt)")
        self.repository = repository
        self.jeton = jeton
        # Identifiant (numérique) de l'application GitHub de la plateforme ;
        # sans lui, aucun commentaire (on ne sait pas reconnaître ses issues).
        self.application = application
        self.http = client or httpx.Client(base_url=API, timeout=15)
        self.creations = Plafond(max_creations, fenetre_s, horloge)
        self.commentaires = Plafond(max_commentaires, fenetre_s, horloge)

    def _api(self, method: str, path: str, **kw: Any) -> Any:
        headers = {
            "Authorization": f"Bearer {self.jeton()}",
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
        titre = neutraliser(" ".join((titre or "").split()))
        severite = (severite or "").lower().strip()
        ressource = (ressource or "").strip()
        sources = [s.strip() for s in (sources or []) if s and s.strip()]
        if not 8 <= len(titre) <= 120:
            raise TicketRefuse("titre : 8 à 120 caractères")
        if severite not in SEVERITES:
            raise TicketRefuse(f"sévérité : {', '.join(SEVERITES)}")
        if not description or len(description) > 6000:
            raise TicketRefuse("description : obligatoire, 6 000 caractères au plus")
        if ressource and not RESSOURCE_ARM.fullmatch(ressource):
            raise TicketRefuse("ressource : identifiant Azure complet (/subscriptions/<id>/resourceGroups/…/providers/…), ou vide")
        for s in sources:
            if not re.fullmatch(r"https://learn\.microsoft\.com/[\w\-./#%?=&]+", s):
                raise TicketRefuse(f"source non autorisée : {s} (Microsoft Learn uniquement)")

        # Pas de doublon : même titre, ticket ouvert → on le renvoie.
        cle = titre.replace(_ZWSP, "").lower()
        for i in self._tickets_agent("open"):
            if i["title"].replace(_ZWSP, "").strip().lower() == cle:
                return {"numero": i["number"], "url": i["html_url"], "doublon": True}

        self.creations.prendre("tickets")
        corps = [f"**Sévérité** : {severite}"]
        if ressource:
            corps.append(f"**Ressource Azure** : `{ressource}`")
        corps += ["", "**Constat et remédiation** (texte de l'agent, publié tel quel) :", bloc_de_code(description.strip())]
        if sources:
            corps += ["", "**Sources (Microsoft Learn)**", *[f"- {s}" for s in sources]]
        corps += ["", "---", f"_{SIGNATURE}_"]
        issue = self._api("POST", "/issues", json={
            "title": titre, "body": "\n".join(corps), "labels": [ETIQUETTE, f"severite:{severite}"],
        })
        return {"numero": issue["number"], "url": issue["html_url"], "doublon": False}

    def _application_attendue(self) -> str:
        """L'identifiant de l'application de la plateforme, ou refus s'il est inconnu."""
        try:
            attendu = self.application() if self.application else ""
        except RuntimeError as e:
            raise TicketRefuse(f"identifiant de l'application GitHub inconnu ({e}) : l'agent ne commente pas")
        if not attendu.isdigit():
            raise TicketRefuse("identifiant de l'application GitHub inconnu : l'agent ne commente pas")
        return attendu

    def commenter(self, numero: int, commentaire: str) -> dict:
        if not commentaire or len(commentaire) > 4000:
            raise TicketRefuse("commentaire : obligatoire, 4 000 caractères au plus")
        issue = self._api("GET", f"/issues/{int(numero)}")
        if "pull_request" in issue:
            raise TicketRefuse(f"#{numero} est une pull request : l'agent n'y écrit pas")
        attendu = self._application_attendue()
        app = issue.get("performed_via_github_app") or {}
        if ETIQUETTE not in [lab["name"] for lab in issue.get("labels", [])] or str(app.get("id")) != attendu:
            # Le label seul ne suffit pas : toute personne en triage peut le poser.
            # « Une » application ne suffit pas : github-actions en est une.
            raise TicketRefuse(f"ticket #{numero} : pas créé par l'agent, l'agent n'y écrit pas")
        self.commentaires.prendre("commentaires")
        c = self._api("POST", f"/issues/{int(numero)}/comments",
                      json={"body": f"{bloc_de_code(commentaire.strip())}\n\n_{SIGNATURE}_"})
        return {"numero": int(numero), "url": c["html_url"]}


def _relu_si_change(path: Path, quoi: str) -> Callable[[], str]:
    """Relit le fichier quand le Secret monté change (l'émetteur le renouvelle toutes les 30 min)."""
    etat: dict[str, Any] = {"mtime": None, "valeur": ""}

    def lire() -> str:
        try:
            mtime = path.stat().st_mtime
            if mtime != etat["mtime"]:
                etat["valeur"], etat["mtime"] = path.read_text().strip(), mtime
        except FileNotFoundError:
            raise RuntimeError(f"{quoi} absent ({path}) : l'émetteur de la plateforme n'est pas encore passé")
        except OSError as e:   # PermissionError : volume monté sans lecture pour l'UID/GID du conteneur
            raise RuntimeError(
                f"{quoi} illisible ({path}) : {e.strerror or e} — vérifier fsGroup: 65532 et "
                "defaultMode (lecture groupe, 0440) du volume github-token") from e
        if not etat["valeur"]:
            raise RuntimeError(f"{quoi} vide : l'émetteur de la plateforme n'est pas encore passé")
        return etat["valeur"]

    return lire


def jeton_depuis_fichier(path: Path) -> Callable[[], str]:
    """Le jeton GitHub, relu quand l'émetteur le renouvelle."""
    return _relu_si_change(path, "jeton GitHub")


def application_depuis_environnement() -> Callable[[], str]:
    """L'identifiant de l'application GitHub : GITHUB_APP_ID, sinon le fichier
    app-id écrit par l'émetteur dans le Secret github-token."""
    fixe = os.environ.get("GITHUB_APP_ID", "").strip()
    if fixe:
        return lambda: fixe
    return _relu_si_change(Path(os.environ.get("GITHUB_APP_ID_PATH", "/var/run/github/app-id")),
                           "identifiant de l'application GitHub")


def depuis_environnement() -> GitHubTickets | None:
    """Configuration posée par le déploiement ; None si l'équipe n'a pas activé les tickets."""
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        return None
    return GitHubTickets(
        repo,
        jeton_depuis_fichier(Path(os.environ.get("GITHUB_TOKEN_PATH", "/var/run/github/token"))),
        application=application_depuis_environnement(),
        max_creations=int(os.environ.get("TICKETS_MAX_CREATIONS", "5")),
        max_commentaires=int(os.environ.get("TICKETS_MAX_COMMENTAIRES", "10")),
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
