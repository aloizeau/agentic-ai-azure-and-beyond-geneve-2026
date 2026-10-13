"""Émetteur de jetons GitHub de la plateforme (démo D).

Seul détenteur de la clé privée de l'application GitHub « tickets ». À chaque
passage (CronJob, toutes les 30 minutes) et pour chaque namespace d'équipe
(label agentic.io/team), il demande à GitHub un jeton d'installation :
  - valable une heure ;
  - restreint au dépôt <GITHUB_OWNER>/agent-<namespace>, calculé ici — jamais
    lu d'une annotation ou d'un objet qu'une équipe ou le pipeline Agent Ready
    pourrait écrire ;
  - avec issues:write et metadata:read, rien d'autre ;
et l'écrit dans le Secret github-token de ce namespace (créé vide par Agent
Ready). Ses droits Kubernetes : lister les namespaces, lire et modifier les
Secrets nommés github-token. Il ne crée rien et ne lit aucun autre Secret.
"""
from __future__ import annotations

import base64
import logging
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
import jwt

log = logging.getLogger("emetteur-jetons-github")
NOM_EQUIPE = re.compile(r"^[a-z][a-z0-9-]{1,18}[a-z0-9]$")   # même règle que terraform/teams
PERMISSIONS = {"issues": "write", "metadata": "read"}
SECRET = "github-token"


@dataclass
class Kube:
    """Client minimal de l'API Kubernetes, avec le ServiceAccount du pod."""
    http: httpx.Client

    @classmethod
    def dans_le_cluster(cls) -> "Kube":
        sa = Path("/var/run/secrets/kubernetes.io/serviceaccount")
        host = os.environ["KUBERNETES_SERVICE_HOST"]
        port = os.environ.get("KUBERNETES_SERVICE_PORT", "443")
        return cls(httpx.Client(
            base_url=f"https://{host}:{port}",
            headers={"Authorization": f"Bearer {(sa / 'token').read_text().strip()}"},
            verify=str(sa / "ca.crt"),
            timeout=15,
        ))

    def equipes(self) -> list[str]:
        r = self.http.get("/api/v1/namespaces", params={"labelSelector": "agentic.io/team"})
        r.raise_for_status()
        return sorted(ns["metadata"]["name"] for ns in r.json()["items"])

    def ecrire_jeton(self, namespace: str, jeton: str) -> bool:
        """Modifie le Secret existant ; False s'il n'existe pas (Agent Ready pas encore passé)."""
        r = self.http.patch(
            f"/api/v1/namespaces/{namespace}/secrets/{SECRET}",
            json={"data": {"token": base64.b64encode(jeton.encode()).decode()}},
            headers={"Content-Type": "application/merge-patch+json"},
        )
        if r.status_code == 404:
            return False
        r.raise_for_status()
        return True


class GitHubApp:
    def __init__(self, app_id: str, private_key: str, http: httpx.Client | None = None, horloge=time.time) -> None:
        self.app_id, self.private_key, self.now = str(app_id), private_key, horloge
        self.http = http or httpx.Client(base_url=os.environ.get("GITHUB_API_URL", "https://api.github.com"), timeout=15)

    def _entetes(self) -> dict[str, str]:
        t = int(self.now())
        jeton_app = jwt.encode({"iat": t - 60, "exp": t + 540, "iss": self.app_id}, self.private_key, algorithm="RS256")
        return {"Authorization": f"Bearer {jeton_app}", "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"}

    def jeton_pour(self, owner: str, repo: str) -> str | None:
        """Jeton d'installation limité à owner/repo et PERMISSIONS ; None si l'application n'y est pas installée."""
        h = self._entetes()
        r = self.http.get(f"/repos/{owner}/{repo}/installation", headers=h)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        r = self.http.post(f"/app/installations/{r.json()['id']}/access_tokens", headers=h,
                           json={"repositories": [repo], "permissions": PERMISSIONS})
        r.raise_for_status()
        return r.json()["token"]


def passage(kube: Kube, app: GitHubApp, owner: str) -> int:
    """Un passage complet ; renvoie le nombre d'équipes en échec."""
    echecs = 0
    for equipe in kube.equipes():
        if not NOM_EQUIPE.fullmatch(equipe):
            log.warning("namespace %s ignoré : nom d'équipe invalide", equipe)
            continue
        depot = f"agent-{equipe}"
        try:
            jeton = app.jeton_pour(owner, depot)
            if jeton is None:
                log.warning("%s/%s : application non installée, pas de jeton", owner, depot)
                continue
            if kube.ecrire_jeton(equipe, jeton):
                log.info("%s : jeton écrit pour %s/%s (%s)", equipe, owner, depot, ", ".join(f"{k}:{v}" for k, v in PERMISSIONS.items()))
            else:
                log.warning("%s : Secret %s absent, rien écrit", equipe, SECRET)
        except httpx.HTTPError as e:   # une équipe en échec n'empêche pas les autres
            echecs += 1
            log.error("%s : %s", equipe, e)
    return echecs


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    owner = os.environ["GITHUB_OWNER"]
    if not re.fullmatch(r"[A-Za-z0-9-]{1,39}", owner):
        log.error("GITHUB_OWNER invalide : %r", owner)
        return 2
    app = GitHubApp(os.environ["GITHUB_APP_ID"],
                    Path(os.environ.get("GITHUB_APP_PRIVATE_KEY_PATH", "/var/run/github-app/private-key")).read_text())
    return 1 if passage(Kube.dans_le_cluster(), app, owner) else 0


if __name__ == "__main__":
    sys.exit(main())
