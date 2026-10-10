#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les films YouTube de la famille, rattachés aux escales où ils ont été
tournés (content/videos.json, 14 vidéos datées au mois).

Le rattachement est explicite : seule une vidéo dont le titre ou le
commentaire nomme le lieu est placée dans un carnet (« Sous l'eau »,
juillet 2010, ne dit pas où : elle n'est rattachée à aucune escale). Les
vidéos d'avant le départ (2007-2009) restent hors du voyage.

Sorties : data/videos_escales.json et site/public/media/videos/<id>.webp
(la vignette est hébergée avec le site : rien n'est demandé à YouTube tant
que personne n'appuie sur lecture).

Usage : python3 pipeline/build_videos.py
"""

import io
import json
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "site" / "public" / "media" / "videos"

# youtube_id → escales (« nom|date_arrivee » de data/route.json) ; la raison
# du rattachement est dans le titre ou le commentaire de la vidéo.
RATTACHEMENTS = {
    "50C8CxbYhj8": ["Tahanea|2012-09-24"],          # « … à Tahanea »
    "GYFF_zDOL-s": ["Tahanea|2012-09-24"],          # « … à Tahanea »
    "gwDMhpZos7g": ["Moorea|2012-07-31", "Moorea|2012-08-19"],  # lagon de Moorea, août 2012
    "6IwA3kknCZQ": ["Tahiti|2012-07-18"],           # « … à Tahiti », juillet 2012
    "JhHEzS0qK-A": ["Gambier|2012-06-09"],          # transpacifique NZ → Gambier
    "CP4LheX4T8I": ["Tonga - Neiafu|2010-08-31"],   # « … aux Tonga »
    "TZ3-QWYpkiw": ["Martinique|2009-05-27"],       # mai 2009, au Marin
    "sERTSJJk2DU": ["Martinique|2009-05-27"],       # « Le port du Marin … »
}


def main() -> None:
    videos = json.loads((ROOT / "content" / "videos.json").read_text())
    route = json.loads((ROOT / "data" / "route.json").read_text())
    cles = {f"{e['nom']}|{e['date_arrivee']}" for e in route}
    DEST.mkdir(parents=True, exist_ok=True)

    sortie = []
    for v in videos:
        escales = RATTACHEMENTS.get(v["youtube_id"])
        if not escales:
            continue
        inconnues = [c for c in escales if c not in cles]
        if inconnues:
            raise SystemExit(f"escale inconnue pour {v['youtube_id']} : {inconnues}")
        vignette = DEST / f"{v['youtube_id']}.webp"
        if not vignette.exists():
            r = requests.get(f"https://i.ytimg.com/vi/{v['youtube_id']}/hqdefault.jpg", timeout=30)
            r.raise_for_status()
            with Image.open(io.BytesIO(r.content)) as im:
                im.convert("RGB").save(vignette, "WEBP", quality=78, method=6)
        sortie.append({**v, "escales": escales})
        print(f"{v['date']}  {v['titre']:<36} → {', '.join(escales)}")

    (ROOT / "data" / "videos_escales.json").write_text(
        json.dumps(sortie, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(sortie)} vidéos rattachées → data/videos_escales.json")


if __name__ == "__main__":
    main()
