#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Largeur et hauteur de chaque photo publiée, notées dans les données.

Le carnet réserve ainsi la place exacte de chaque photo avant qu'elle ne
charge : la page ne saute plus pendant la lecture, et un lien vers un billet
précis tombe au bon endroit.

Lit les WebP publiés (site/public/media/) et annote, sur place :
  data/mouillages.json      articles[].images[] → l, h
  data/albums_escales.json  photos[]            → l, h

Appelé à la fin de build_data.py et build_albums.py ; se lance aussi seul :
python3 pipeline/dimensions_photos.py
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "site" / "public" / "media"


def taille(src: str) -> tuple[int, int] | None:
    chemin = MEDIA / Path(src).with_suffix(".webp")
    if not chemin.exists():
        return None
    with Image.open(chemin) as im:
        return im.size


def annote_liste(photos: list) -> int:
    n = 0
    for p in photos:
        t = taille(p["src"])
        if t:
            p["l"], p["h"] = t
            n += 1
    return n


def annote() -> None:
    fichier = ROOT / "data" / "mouillages.json"
    mouillages = json.loads(fichier.read_text())
    n = sum(annote_liste(a["images"]) for m in mouillages for a in m["articles"])
    fichier.write_text(json.dumps(mouillages, ensure_ascii=False, indent=1))
    print(f"mouillages.json : {n} photos mesurées")

    fichier = ROOT / "data" / "albums_escales.json"
    if fichier.exists():
        albums = json.loads(fichier.read_text())
        n = sum(annote_liste(a["photos"]) for a in albums)
        fichier.write_text(json.dumps(albums, ensure_ascii=False, indent=1) + "\n")
        print(f"albums_escales.json : {n} photos mesurées")


if __name__ == "__main__":
    annote()
