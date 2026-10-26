"""Contrôles déterministes faits par l'adaptateur lui-même, en Python.

Pourquoi ici et pas dans les regex YAML des profils NeMo :

- carte bancaire : une regex seule ne sait pas calculer une clé de Luhn. La
  version YAML (`\\b(?:\\d[\\s.\\-]?){12,15}\\d\\b`) bloquait des numéros de
  version, des IP, des dates, des téléphones, des SIRET, des horodatages… Ici :
  groupement de carte reconnu + préfixe émetteur plausible + Luhn valide ;
- messages `tool` : seuls les motifs de secrets s'y appliquent (voir
  `SECRET_PATTERNS`), sans passer par le moteur NeMo ni par un appel LLM.

Le texte est normalisé (NFKC, suppression des caractères de largeur nulle)
avant tout contrôle : chiffres pleine largeur, espaces insécables et U+200B
glissés dans un numéro ne contournent plus la détection.
"""
from __future__ import annotations

import re
import unicodedata

# U+200B..U+200D (ZWSP, ZWNJ, ZWJ), U+2060 (WORD JOINER), U+FEFF (BOM / ZWNBSP),
# U+00AD (trait d'union conditionnel) : invisibles, donc parfaits pour couper
# un numéro aux yeux d'une regex sans gêner le lecteur humain.
_INVISIBLE_CHARS = "".join(map(chr, (0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF, 0x00AD)))
_INVISIBLES = dict.fromkeys(map(ord, _INVISIBLE_CHARS))
_INVISIBLES_AS_SPACE = dict.fromkeys(map(ord, _INVISIBLE_CHARS), " ")


def normalize(text: str) -> str:
    """NFKC (chiffres pleine largeur -> ASCII, espaces exotiques -> espace…)
    puis suppression des caractères invisibles."""
    return unicodedata.normalize("NFKC", text).translate(_INVISIBLES)


# ----------------------------------------------------------- cartes bancaires
CARD_RAIL = "carte bancaire (Luhn)"

# Une suite de groupes de chiffres séparés par n'importe quelle série de
# séparateurs (espaces multiples, `.`, `_`, `/`, `-`). On ne cherche PAS une
# longueur totale : on regarde ensuite si une fenêtre de groupes consécutifs a
# la forme d'une carte. Ainsi « 4111 1111 1111 1111 12/25 » est détecté malgré
# la date d'expiration collée derrière.
_DIGIT_CHAIN = re.compile(r"(?<![0-9])[0-9]+(?:[\s._/\-]+[0-9]+)*(?![0-9])")
_SEP = re.compile(r"[\s._/\-]+")

# Groupements imprimés sur les cartes : 4-4-4-4 (16), 4-6-5 (Amex, 15),
# 4-6-4 (Diners, 14), 4-4-4-4-3 (19). Les découpages exotiques (2-2-2…) ne
# sont volontairement pas reconnus : c'est la forme des numéros de téléphone.
_GROUPINGS = ((4, 4, 4, 4), (4, 6, 5), (4, 6, 4), (4, 4, 4, 4, 3))


def _luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = ord(ch) - 48
        if i % 2:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def _issuer_ok(digits: str) -> bool:
    """Préfixe / longueur plausibles (Visa, Mastercard, Amex, Diners, JCB,
    Discover, Maestro, UnionPay). Écarte les horodatages en ms (« 17… »,
    13 chiffres) et la plupart des SIRET collés (14 chiffres)."""
    n = len(digits)
    if n == 13:
        return digits[0] == "4"
    if n == 14:
        return digits[:2] in {"30", "36", "38", "39"}
    if n == 15:
        return digits[:2] in {"34", "37"}
    return 16 <= n <= 19 and digits[0] in "23456"


def _card_candidates(groups: list[str]):
    lens = [len(g) for g in groups]
    for i in range(len(groups)):
        yield groups[i]                        # numéro sans séparateur
        for shape in _GROUPINGS:
            if tuple(lens[i:i + len(shape)]) == shape:
                yield "".join(groups[i:i + len(shape)])


def find_card(text: str) -> str | None:
    """Renvoie le numéro (chiffres seuls) d'une carte plausible, ou None."""
    # Ici un invisible compte comme séparateur (au lieu d'être supprimé) :
    # sinon « 4111<U+2060>1111 1111<U+FEFF>1111 » devient 8-8 et échappe au
    # contrôle de groupement.
    t = unicodedata.normalize("NFKC", text).translate(_INVISIBLES_AS_SPACE)
    for m in _DIGIT_CHAIN.finditer(t):
        for digits in _card_candidates(_SEP.split(m.group())):
            if 13 <= len(digits) <= 19 and _issuer_ok(digits) and _luhn_ok(digits):
                return digits
    return None


# -------------------------------------------------------------------- secrets
SECRET_RAIL = "secrets (regex)"

# Copie EXACTE des motifs « secrets » de deploy/rails/*/config.yml (un test
# vérifie l'égalité) : ce sont les seuls appliqués aux messages `tool`.
#
# Dernier motif (`clé: valeur`) : la valeur doit faire 8 caractères ou plus,
# ne pas commencer comme un renvoi ou un masque ($VAR, %VAR%, <…>, {…}, […],
# ****) et contenir au moins un chiffre ou un symbole de mot de passe
# (@ # % ^ & + = / \ | ~ _). Ainsi « mot de passe: introuvable » ou
# « secret: confidentiel. » passent, « secret = Azerty12 » est bloqué.
SECRET_PATTERNS: tuple[str, ...] = (
    r"(?i)\bsk-(?:proj-|ant-)?[a-z0-9_-]{20,}",
    r"(?i)\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",
    r"(?i)\b(?:gh[pousr]_[a-z0-9]{36,}|github_pat_[a-z0-9_]{22,})",
    r"(?i)-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----",
    r"(?i)\b(?:api[_-]?key|access[_-]?key|account[_-]?key|client[_-]?secret|secret|token|password|passwd|pwd"
    r"""|mot de passe|mdp)\s*[:=]\s*["']?(?![$%<{\[*])(?=[^\s"']*?[0-9@#%^&+=/\\|~_])[^\s"']{8,}""",
)
_SECRETS = tuple(re.compile(p) for p in SECRET_PATTERNS)


# Aperçu d'un message bloqué pour le tableau de supervision : la donnée sensible
# détectée ne doit pas être recopiée dans les journaux. On masque large (mieux
# vaut trop que pas assez) : secrets connus, suites de 6 chiffres ou plus (carte,
# NIR, IBAN, téléphone), et tout jeton opaque de 24 caractères ou plus.
_PREVIEW_DIGITS = re.compile(r"[0-9](?:[\s.\-_/]?[0-9]){5,}")
_PREVIEW_TOKEN = re.compile(r"\b[A-Za-z0-9_\-]{24,}\b")


def mask_sensitive(text: str, limit: int = 300) -> str:
    t = normalize(text)
    for p in _SECRETS:
        t = p.sub("[SECRET]", t)
    t = _PREVIEW_DIGITS.sub("[NUM]", t)
    t = _PREVIEW_TOKEN.sub("[JETON]", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= limit else t[:limit] + "…"


def find_secret(text: str) -> bool:
    t = normalize(text)
    return any(p.search(t) for p in _SECRETS)
