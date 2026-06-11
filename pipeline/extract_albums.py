#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extraction des albums photos (deux arborescences : /album/ et /data/album/).

albums.html est l'index : des cellules cliquables (td.albpointeur, onclick
OpenWin('…/index.html')) suivies d'une rangée d'étiquettes (td.LineAlbum :
période + nom). Chaque album est une suite de pages targetN.html (UTF-8)
générées par un logiciel d'album : <span class="textbg">Album -- légende</span>
et l'image dans images/.

Sortie : content/albums.json :
    { id, nom, periode, chemin, photos: [{src, legende, largeur, hauteur}] }
"""

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "content" / "site"
OUT_PATH = ROOT / "content" / "albums.json"

RE_OPENWIN = re.compile(r"OpenWin\('([^']+)'\)")
RE_TARGET_NUM = re.compile(r"target(\d+)\.html$")


def lire(path: Path) -> str:
    raw = path.read_bytes()
    enc = "utf-8" if b"charset=UTF-8" in raw[:600] else "iso-8859-1"
    return raw.decode(enc, errors="replace")


def index_albums() -> list[dict]:
    """Apparie les cellules cliquables et les étiquettes d'albums.html."""
    soup = BeautifulSoup(lire(SITE / "album" / "albums.html"), "lxml")
    albums = []
    rangs = soup.find_all("tr")
    for i, tr in enumerate(rangs):
        pointeurs = tr.find_all("td", class_="albpointeur")
        if not pointeurs:
            continue
        labels = []
        if i + 1 < len(rangs):
            for td in rangs[i + 1].find_all("td", class_="LineAlbum"):
                periode = td.find("p", class_="albumpetit")
                nom = td.find("p", class_="album")
                labels.append((
                    periode.get_text(" ", strip=True) if periode else "",
                    nom.get_text(" ", strip=True) if nom else "",
                ))
        for j, td in enumerate(pointeurs):
            m = RE_OPENWIN.search(td.get("onclick", ""))
            if not m:
                continue
            url = m.group(1)  # ../album/Hawaii/index.html ou ../data/album/…
            chemin = re.sub(r"^(\.\./)+", "", url).rsplit("/", 1)[0]
            periode, nom = labels[j] if j < len(labels) else ("", "")
            albums.append({"chemin": chemin, "nom": nom, "periode": periode})
    return albums


def photos_album(dossier: Path) -> list[dict]:
    cibles = sorted(dossier.glob("target*.html"),
                    key=lambda p: int(RE_TARGET_NUM.search(p.name).group(1)))
    photos = []
    for page in cibles:
        html = lire(page)
        m = re.search(
            r'<img src="(images/[^"]+)"\s+width="(\d+)"\s+height="(\d+)"', html)
        if not m:
            continue
        src, largeur, hauteur = m.groups()
        mt = re.search(r'<span class="textbg">(.*?)</span>', html, re.S)
        legende = ""
        if mt:
            texte = re.sub(r"\s+", " ", mt.group(1)).strip()
            if "--" in texte:
                legende = texte.split("--", 1)[1].strip()
        rel = (dossier.relative_to(SITE) / src).as_posix()
        photos.append({
            "src": rel,
            "legende": legende,
            "largeur": int(largeur),
            "hauteur": int(hauteur),
        })
    return photos


def main() -> None:
    albums = index_albums()
    vus = {a["chemin"] for a in albums}
    # dossiers d'albums orphelins (non référencés par l'index)
    for racine in (SITE / "album", SITE / "data" / "album"):
        for dossier in sorted(racine.iterdir()):
            if not dossier.is_dir():
                continue
            rel = dossier.relative_to(SITE).as_posix()
            if rel not in vus and list(dossier.glob("target*.html")):
                albums.append({"chemin": rel, "nom": dossier.name, "periode": ""})

    total = 0
    for i, alb in enumerate(albums):
        alb["id"] = i
        dossier = SITE / alb["chemin"]
        alb["photos"] = photos_album(dossier) if dossier.is_dir() else []
        total += len(alb["photos"])
        print(f"{len(alb['photos']):4} photos  {alb['periode']:<28} {alb['nom']}  [{alb['chemin']}]")

    OUT_PATH.write_text(json.dumps(albums, ensure_ascii=False, indent=1))
    print(f"\n{len(albums)} albums, {total} photos")
    print(f"Écrit : {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
