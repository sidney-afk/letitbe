#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extraction des articles du blog depuis les pages statiques /Actu/actuNN.html.

Chaque page est l'archive d'une étape (« Archives Actus Tonga - Fidji ») et
contient les articles complets : <p class="titre"><B>date - titre</B></p>
suivi du texte et d'images légendées (<img …><br><i>légende</i>).

Sortie : content/articles.json — liste chronologique d'articles :
    { id, etape, etape_label, date, date_fin, titre, texte, html,
      images: [{src, legende}] }
"""

import json
import re
import unicodedata
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
ACTU_DIR = ROOT / "content" / "site" / "Actu"
OUT_PATH = ROOT / "content" / "articles.json"

MOIS = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11,
    "decembre": 12,
    # abréviations anglaises des billets d'avant départ (2008)
    "jan": 1, "feb": 2, "apr": 4, "jun": 6, "jul": 7,
    "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
MOIS_RE = "|".join(sorted(MOIS, key=len, reverse=True))

# « 27 mai 2009 », « 1er mai 2009 », « 09/07/2017 », « 20-21/01/2014 »,
# « 24 et 25/12/2013 », « du 5 au 12 mars 2010 »…
RE_TITRE = re.compile(
    r'<p\s+class="titre"><B>(.*?)</B></p>', re.I | re.S)
RE_IMG = re.compile(
    r'<img\s+src="([^"]+)"\s*/?>(?:\s*<br\s*/?>\s*<i>(.*?)</i>)?', re.I | re.S)


def sans_accents(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def parse_date(brut: str, annee_defaut: int | None) -> tuple[str | None, str | None]:
    """Renvoie (date_iso, date_fin_iso) ; None si indéchiffrable."""
    s = sans_accents(brut.lower()).replace("1er", "1")
    s = s.replace("&nbsp;", " ").strip()

    if s == "20 jan 2001":
        # coquille du site original : les images de cet article (ski dans le
        # Jura avant le départ) sont dans Tech/Image/Blog/20-01-2009/
        return "2009-01-20", None

    # jj/mm/aaaa, avec plage éventuelle jj-jj/mm/aaaa ou jj et jj/mm/aaaa
    m = re.search(r"(\d{1,2})(?:\s*(?:-|au|et)\s*(\d{1,2}))?/(\d{1,2})/(\d{4})", s)
    if m:
        j1, j2, mois, an = m.groups()
        d1 = f"{an}-{int(mois):02d}-{int(j1):02d}"
        d2 = f"{an}-{int(mois):02d}-{int(j2):02d}" if j2 else None
        return d1, d2

    # « du 5 au 12 mars 2010 », « 5-12 mars 2010 », « 24 et 25 decembre 2013 »
    m = re.search(
        rf"(\d{{1,2}})\s*(?:-|au|et)\s*(\d{{1,2}})\s+({MOIS_RE})\s+(\d{{4}})", s)
    if m:
        j1, j2, mois, an = m.groups()
        d1 = f"{an}-{MOIS[mois]:02d}-{int(j1):02d}"
        d2 = f"{an}-{MOIS[mois]:02d}-{int(j2):02d}"
        return d1, d2

    # « 27 mai 2009 » / « 27 mai » (année héritée de l'article voisin)
    m = re.search(rf"(\d{{1,2}})\s+({MOIS_RE})(?:\s+(\d{{4}}))?", s)
    if m:
        j, mois, an = m.groups()
        an = an or (str(annee_defaut) if annee_defaut else None)
        if an:
            return f"{an}-{MOIS[mois]:02d}-{int(j):02d}", None

    # « jj/mm/aa » court (13/2/2008)
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2})\b", s)
    if m:
        j, mois, an = m.groups()
        return f"20{an}-{int(mois):02d}-{int(j):02d}", None

    if "paques 2008" in s:
        return "2008-03-23", None  # week-end de découverte du bateau

    # « mai 2009 » seul
    m = re.search(rf"({MOIS_RE})\s+(\d{{4}})", s)
    if m:
        mois, an = m.groups()
        return f"{an}-{MOIS[mois]:02d}-01", None

    return None, None


def normalise_src(src: str, page: str) -> str:
    """Chemin site-relatif (« Tech/Blog/Fidji/2010-11-27/P1.JPG »)."""
    src = src.strip().replace("\\", "/")
    src = re.sub(r"^https?://(www\.)?laruel\.be/", "/", src, flags=re.I)
    if src.startswith("/"):
        return src.lstrip("/")
    src = re.sub(r"^(\./)+", "", src)
    base = f"Actu/{page}"
    parts = (Path(base).parent / src).as_posix().split("/")
    out: list[str] = []
    for p in parts:
        if p == "..":
            if out:
                out.pop()
        elif p not in (".", ""):
            out.append(p)
    return "/".join(out)


def extraire_page(path: Path) -> list[dict]:
    raw = path.read_bytes().decode("iso-8859-1")
    etape = path.stem  # actu01 …

    m = re.search(r'<p class="bordered"><B>Archives Actus\s*(.*?)</B></p>', raw)
    etape_label = m.group(1).strip() if m else None

    # Découpe sur les titres ; le bloc de chaque article va jusqu'au titre suivant.
    titres = list(RE_TITRE.finditer(raw))
    articles = []
    for i, mt in enumerate(titres):
        fin = titres[i + 1].start() if i + 1 < len(titres) else len(raw)
        bloc = raw[mt.end():fin]
        # coupe au </td> de fin d'article pour éviter le chrome de page
        bloc = re.split(r"</td>", bloc, maxsplit=1)[0]

        brut_titre = re.sub(r"<[^>]+>", " ", mt.group(1))
        brut_titre = re.sub(r"\s+", " ", brut_titre).strip()
        if " - " in brut_titre:
            date_part, titre = brut_titre.split(" - ", 1)
        else:
            date_part, titre = brut_titre, ""

        images = []
        for src, legende in RE_IMG.findall(bloc):
            leg = re.sub(r"<[^>]+>", " ", legende or "")
            leg = re.sub(r"\s+", " ", leg).strip()
            images.append({"src": normalise_src(src, path.name), "legende": leg})

        soup = BeautifulSoup(f"<div>{bloc}</div>", "lxml")
        texte = re.sub(r"\s+", " ", soup.get_text(" ")).strip()

        articles.append({
            "etape": etape,
            "etape_label": etape_label,
            "date_brute": date_part.strip(),
            "titre": titre.strip(),
            "texte": texte,
            "html": bloc.strip(),
            "images": images,
        })
    return articles


def main() -> None:
    tous: list[dict] = []
    for path in sorted(ACTU_DIR.glob("actu*.html")):
        arts = extraire_page(path)
        # Les pages sont antichronologiques : l'année par défaut d'un article
        # sans année se déduit en remontant depuis les articles datés voisins.
        annee = None
        for a in arts:  # premier passage pour trouver une année de référence
            d, _ = parse_date(a["date_brute"], None)
            if d:
                annee = int(d[:4])
                break
        for a in arts:
            d1, d2 = parse_date(a["date_brute"], annee)
            if not d1:
                # date dans le corps (« GRENADINES » / « Pâques 2008 - … ») :
                # l'intitulé devient le titre, la date vient du texte.
                d1, d2 = parse_date(a["texte"][:120], None)
                if d1 and not a["titre"]:
                    a["titre"] = a["date_brute"].capitalize()
            if d1:
                annee = int(d1[:4])
            a["date"], a["date_fin"] = d1, d2
        tous.extend(arts)
        sans_date = sum(1 for a in arts if not a["date"])
        print(f"{path.name}: {len(arts):3} articles, {sans_date} sans date  [{arts[0]['etape_label']}]")

    tous.sort(key=lambda a: (a["date"] or "9999", a["etape"]))
    for i, a in enumerate(tous):
        a["id"] = i
    OUT_PATH.write_text(json.dumps(tous, ensure_ascii=False, indent=1))
    n_img = sum(len(a["images"]) for a in tous)
    dates = [a["date"] for a in tous if a["date"]]
    print(f"\nTotal : {len(tous)} articles, {n_img} images, de {min(dates)} à {max(dates)}")
    print(f"Écrit : {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
