#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Route du camping-car (roadtrip des parcs de l'Ouest, sept-oct 2013).

Les articles du blog portent le compteur de miles cumulé dans leur titre
(« M2275 - Natural Bridges ») — l'équivalent terrestre du log du bord.
Le bateau attendait à San Francisco (Emery Cove, Emeryville).

Sortie : data/roadtrip.json — étapes ordonnées { date, miles, lieu, lat, lon,
article_id, titre }.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "roadtrip.json"

# coordonnées des étapes, déduites du récit de chaque article
ETAPES = {
    "M740": ("Vers Yellowstone (Idaho, via Davis)", 42.56, -114.47),
    "M983": ("West Yellowstone", 44.662, -111.104),
    "M1010": ("Yellowstone", 44.460, -110.828),
    "M1089": ("Yellowstone — safari", 44.916, -110.420),
    "M1172": ("Yellowstone — pluie", 44.460, -110.828),
    "M1359": ("Yellowstone — shutdown fédéral", 44.133, -110.666),
    "M1524": ("À travers le Wyoming", 42.834, -108.730),
    "M1954": ("Dead Horse Point", 38.483, -109.741),
    "M2159": ("Canyonlands", 38.327, -109.861),
    "M2275": ("Natural Bridges", 37.601, -110.010),
    "M2483": ("Monument Valley (Goosenecks, Vallée des Dieux)", 36.983, -110.099),
    "M2673": ("Meteor Crater (après Canyon de Chelly)", 35.027, -111.022),
    "M2916": ("Route 66, Kingman-Oatman", 35.189, -114.053),
    "M3190": ("Grand Canyon", 36.054, -112.140),
    "M3326": ("Grand Canyon (suite)", 36.054, -112.140),
    "M3487": ("Antelope Canyon (Page)", 36.862, -111.374),
    "M3495": ("Bryce Canyon", 37.623, -112.166),
    "M3595": ("Zion", 37.202, -112.987),
    "M3840": ("Las Vegas", 36.170, -115.140),
    "M4087": ("Death Valley", 36.462, -116.867),
    "M4345": ("Mammoth Mountain", 37.651, -118.972),
    "M4491": ("Yosemite", 37.746, -119.593),
    "M4972": ("Retour San Francisco (via Sequoia NP)", 37.840, -122.292),
}


def main() -> None:
    articles = json.loads((ROOT / "content" / "articles.json").read_text())
    etapes = [{
        "date": "2013-09-25",
        "miles": 0,
        "lieu": "Départ Emeryville (San Francisco)",
        "lat": 37.840, "lon": -122.292,
        "article_id": None, "titre": "Départ du roadtrip",
    }]
    for art in articles:
        m = re.match(r"^(M\d+)\s*-\s*(.*)", art["titre"] or "")
        if not m:
            continue
        cle, _ = m.groups()
        if cle not in ETAPES:
            print(f"  ?? étape sans coordonnées : {art['titre']}")
            continue
        lieu, lat, lon = ETAPES[cle]
        etapes.append({
            "date": art["date"],
            "miles": int(cle[1:]),
            "lieu": lieu,
            "lat": lat, "lon": lon,
            "article_id": art["id"],
            "titre": art["titre"],
        })
    etapes.sort(key=lambda e: e["miles"])
    OUT_PATH.write_text(json.dumps(etapes, ensure_ascii=False, indent=1))
    print(f"{len(etapes)} étapes, {etapes[-1]['miles']} miles "
          f"({etapes[0]['date']} → {etapes[-1]['date']}) "
          f"→ {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
