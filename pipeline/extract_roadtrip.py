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

# coordonnées des étapes, déduites du récit de chaque article. Le lieu est
# celui que le billet nomme (M740 : « à Rupert, Idaho, plus précisément »).
ETAPES = {
    "M740": ("Rupert, Idaho", 42.619, -113.677),
    "M983": ("West Yellowstone", 44.662, -111.104),
    "M1010": ("Yellowstone", 44.460, -110.828),
    "M1089": ("Yellowstone", 44.916, -110.420),
    "M1172": ("Yellowstone", 44.460, -110.828),
    "M1359": ("Yellowstone", 44.133, -110.666),
    "M1524": ("Wyoming", 42.834, -108.730),
    "M1954": ("Dead Horse Point", 38.483, -109.741),
    "M2159": ("Canyonlands", 38.327, -109.861),
    "M2275": ("Natural Bridges", 37.601, -110.010),
    "M2483": ("Monument Valley", 36.983, -110.099),
    "M2673": ("Meteor Crater", 35.027, -111.022),
    "M2916": ("Route 66", 35.189, -114.053),
    "M3190": ("Grand Canyon", 36.054, -112.140),
    "M3326": ("Grand Canyon", 36.054, -112.140),
    "M3487": ("Antelope Canyon", 36.862, -111.374),
    "M3495": ("Bryce Canyon", 37.623, -112.166),
    "M3595": ("Zion", 37.202, -112.987),
    "M3840": ("Las Vegas", 36.170, -115.140),
    "M4087": ("Death Valley", 36.462, -116.867),
    "M4345": ("Mammoth Mountain", 37.651, -118.972),
    "M4491": ("Yosemite", 37.746, -119.593),
    "M4972": ("San Francisco", 37.840, -122.292),
}

# Lieux traversés AVANT d'atteindre l'étape, cités dans son billet : le tracé
# passe par eux plutôt que de couper en ligne droite.
VIA = {
    "M740": [("Davis", 38.545, -121.740)],              # « la direction de Davis »
    "M983": [("Idaho Falls", 43.492, -112.034)],        # « le Wall Mart de Idaho Falls »
    "M1954": [("Salt Lake City", 40.761, -111.891)],    # « passé dans la capitale »
    "M2483": [("Vallée des Dieux", 37.260, -109.850),   # « une nuit … dans la Vallée des Dieux »
              ("Goosenecks", 37.170, -109.927)],        # « le Goosenecks State Park »
    "M2673": [("Canyon de Chelly", 36.150, -109.480)],  # M2483 : « la direction du Canyon de Chelly »
    "M2916": [("Sedona", 34.870, -111.761)],            # M2673 : « partis vers Sedona »
    "M4491": [("lac Mono", 38.010, -119.030)],          # « en visitant le lac Mono »
    "M4972": [("Sequoia", 36.486, -118.566)],           # « le parc national des Grands Sequoias »
}


def main() -> None:
    articles = json.loads((ROOT / "content" / "articles.json").read_text())
    # le jour du départ n'est écrit nulle part (M740 : « après 3 jours de
    # route ») : l'étape zéro n'a pas de date
    etapes = [{
        "date": None,
        "miles": 0,
        "lieu": "San Francisco",
        "lat": 37.840, "lon": -122.292,
        "article_id": None, "titre": None,
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
            **({"via": [{"lieu": v, "lat": la, "lon": lo} for v, la, lo in VIA[cle]]}
               if cle in VIA else {}),
        })
    etapes.sort(key=lambda e: e["miles"])
    OUT_PATH.write_text(json.dumps(etapes, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(etapes)} étapes, {etapes[-1]['miles']} miles "
          f"({etapes[1]['date']} → {etapes[-1]['date']}) "
          f"→ {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
