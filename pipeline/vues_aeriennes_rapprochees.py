#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vues du ciel rapprochées pour les petites îles.

Toutes les « vues du ciel » (fetch_vues_aeriennes.py) couvrent ~97 km de
côté (zoom 11). Pour un atoll ou un îlot, c'est trop large : Santa Barbara
Island n'y est qu'un point sous l'ancre, Beveridge Reef n'y est pas du tout.
On mesure la part de terre de chaque vue ; celles qui en montrent trop peu
sont refaites plus près, centrées sur le même mouillage :
    moins de 1,25 % de terre → zoom 12 (~48 km de côté)
    et moins de 0,3 %, ou moins de 1 % au centre → zoom 13 (~24 km)
Les autres restent telles quelles. Seules les entrées refaites changent dans
data/vues_aeriennes.json (fichier, bornes, zoom) ; tout autre champ, et toute
autre entrée (dont les vues détaillées revues), est conservé.

Source : Esri World Imagery (créditée dans le carnet de bord).
Usage : python3 pipeline/vues_aeriennes_rapprochees.py [--mesure]
"""

import json
import math
import sys
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "site" / "public"
INDEX = ROOT / "data" / "vues_aeriennes.json"
NB = 5
URL = ("https://server.arcgisonline.com/ArcGIS/rest/services/"
       "World_Imagery/MapServer/tile/{z}/{y}/{x}")


def part_de_terre(chemin: Path) -> tuple[float, float]:
    """Part des pixels qui ne sont pas de la mer profonde (terre, récif),
    dans toute la vue et dans son centre (là où est le mouillage)."""
    im = Image.open(chemin).convert("RGB").resize((128, 128))
    est_terre = lambda p: p[0] + p[1] + p[2] > 190 or p[0] > p[2] + 10 or p[1] > p[2] + 15
    tout = [im.getpixel((i, j)) for i in range(128) for j in range(128)]
    centre = [im.getpixel((i, j)) for i in range(38, 90) for j in range(38, 90)]
    return (sum(map(est_terre, tout)) / len(tout),
            sum(map(est_terre, centre)) / len(centre))


# Seen one by one after a first run (2026-10-10): at the closer zoom these
# show straight-edged patches where Esri's imagery changes source (Gambier's
# lagoon, a corner of Fatu Hiva, the bottom of Ua Huka, the side of
# Rarotonga), or still nothing (Beveridge Reef is under water). They keep
# their wide view.
GARDEES = {
    "Gambier|2009-08-12", "Gambier|2012-06-09",
    "Marquises - Fatu Hiva|2009-12-16", "Marquises - Fatu Hiva|2010-03-01",
    "Marquises - Ua HUka|2010-03-20", "Cook du sud - Rarotonga|2010-07-27",
    "Beveridge Reef|2010-08-13",
}


def zoom_voulu(terre: float, centre: float) -> int:
    if terre >= 0.0125:
        return 11
    # an islet under the anchor (Santa Barbara, Los Aves, a reef): closer still
    return 13 if terre < 0.003 or centre < 0.01 else 12


def tuile_de(lat: float, lon: float, z: int) -> tuple[int, int]:
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    lr = math.radians(lat)
    y = int((1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n)
    return x, y


def bornes(x0: int, y0: int, z: int) -> dict:
    n = 2 ** z
    lat_de = lambda y: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return {"lonMin": x0 / n * 360 - 180, "lonMax": (x0 + NB) / n * 360 - 180,
            "latMax": lat_de(y0), "latMin": lat_de(y0 + NB)}


def main() -> None:
    mesure_seule = "--mesure" in sys.argv
    mouillages = json.loads((ROOT / "data" / "mouillages.json").read_text())
    par_cle = {f"{m['nom']}|{m['date_arrivee']}": m for m in mouillages}
    index = json.loads(INDEX.read_text())
    session = requests.Session()
    session.headers["User-Agent"] = "LeSillage/1.0 (+https://sidney-afk.github.io/letitbe/)"

    refaites = 0
    for cle, vue in index.items():
        fichier = vue.get("fichier", "")
        # only the generated overview tiles; never a reviewed detail view
        if not fichier.startswith("media/aerien/") or vue.get("detailPlongee"):
            continue
        if vue.get("zoom", 11) != 11 or cle in GARDEES:
            continue  # already redone, or kept wide on purpose
        m = par_cle.get(cle)
        if not m:
            continue
        terre, centre = part_de_terre(PUBLIC / fichier)
        z = zoom_voulu(terre, centre)
        if z == 11:
            continue
        print(f"{cle}: {terre:.2%} de terre ({centre:.2%} au centre) → zoom {z}", flush=True)
        if mesure_seule:
            continue
        x1, y1 = tuile_de(m["lat"], m["lon"], z)
        x0, y0 = x1 - NB // 2, y1 - NB // 2
        mosaique = Image.new("RGB", (256 * NB, 256 * NB))
        for dy in range(NB):
            for dx in range(NB):
                for essai in range(3):
                    try:
                        time.sleep(0.05)
                        r = session.get(URL.format(z=z, y=y0 + dy, x=x0 + dx), timeout=30)
                        r.raise_for_status()
                        mosaique.paste(Image.open(BytesIO(r.content)), (dx * 256, dy * 256))
                        break
                    except (requests.RequestException, OSError):
                        if essai == 2:
                            raise
                        time.sleep(2 ** essai)
        nom = Path(fichier).stem.split("-")[0]
        nouveau = f"media/aerien/{nom}-z{z}.webp"
        mosaique.resize((1024, 1024), Image.LANCZOS).save(
            PUBLIC / nouveau, "WEBP", quality=80, method=4)
        vue.update({"fichier": nouveau, **bornes(x0, y0, z), "zoom": z})
        refaites += 1

    if not mesure_seule:
        INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=1))
    print(f"{refaites} vues refaites plus près")


if __name__ == "__main__":
    main()
