#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vues aériennes haute définition des mouillages (idée de Sidney : les
endroits cliquables sont connus d'avance, alors on précharge pour chacun une
imagerie fine qui s'affiche quand on plonge — fini le zoom pixelisé).

Source : Esri World Imagery (usage autorisé avec attribution — créditée dans
le carnet de bord). Mosaïque 5×5 tuiles au zoom 11 (~76 m/px, ~97 km de côté)
centrée sur chaque mouillage, réduite à 1024².

Sorties :
    site/public/media/aerien/<i>.webp   (1024², ~100-250 Ko)
    data/vues_aeriennes.json            clé escale → fichier + bornes lat/lon
"""

import json
import math
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "site" / "public" / "media" / "aerien"
INDEX = ROOT / "data" / "vues_aeriennes.json"

Z = 11
NB = 5
URL = ("https://server.arcgisonline.com/ArcGIS/rest/services/"
       "World_Imagery/MapServer/tile/{z}/{y}/{x}")


def tuile_de(lat: float, lon: float) -> tuple[int, int]:
    n = 2 ** Z
    x = int((lon + 180) / 360 * n)
    lr = math.radians(lat)
    y = int((1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n)
    return x, y


def bornes(x0: int, y0: int, nb: int) -> dict:
    n = 2 ** Z
    lon_min = x0 / n * 360 - 180
    lon_max = (x0 + nb) / n * 360 - 180
    lat_de = lambda y: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return {"lonMin": lon_min, "lonMax": lon_max,
            "latMax": lat_de(y0), "latMin": lat_de(y0 + nb)}


def main() -> None:
    mouillages = json.loads((ROOT / "data" / "mouillages.json").read_text())
    DEST.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers["User-Agent"] = "LeSillage/1.0 (+sidney.laruel@gmail.com)"

    index = {}
    rate = 0
    for i, m in enumerate(mouillages):
        if m["type"] == "traversee":
            continue
        cle = f"{m['nom']}|{m['date_arrivee']}"
        fichier = DEST / f"{i}.webp"
        x1, y1 = tuile_de(m["lat"], m["lon"])
        x0, y0 = x1 - NB // 2, y1 - NB // 2
        index[cle] = {"fichier": f"media/aerien/{i}.webp", **bornes(x0, y0, NB)}
        if fichier.exists():
            continue
        mosaique = Image.new("RGB", (256 * NB, 256 * NB))
        ok = True
        for dy in range(NB):
            for dx in range(NB):
                for essai in range(3):
                    try:
                        time.sleep(0.04)
                        r = session.get(URL.format(z=Z, y=y0 + dy, x=x0 + dx),
                                        timeout=30)
                        r.raise_for_status()
                        mosaique.paste(Image.open(BytesIO(r.content)),
                                       (dx * 256, dy * 256))
                        break
                    except (requests.RequestException, OSError):
                        if essai == 2:
                            ok = False
                        time.sleep(2 ** essai)
        if ok:
            mosaique = mosaique.resize((1024, 1024), Image.LANCZOS)
            mosaique.save(fichier, "WEBP", quality=80, method=4)
            rate += 1
            if rate % 20 == 0:
                print(f"  …{rate} vues", flush=True)
        else:
            del index[cle]
            print(f"  !! échec : {cle}", flush=True)

    INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=1))
    total = sum(f.stat().st_size for f in DEST.glob("*.webp"))
    print(f"{len(index)} vues aériennes ({total / 1e6:.0f} Mo) → {DEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
