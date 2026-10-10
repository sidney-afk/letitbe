#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""La petite carte du roadtrip de l'automne 2013, pour le carnet de San
Francisco : la même peinture que le globe Carnet, recadrée sur l'Ouest
américain et un peu pâlie, comme une carte glissée entre les pages.

Projection équirectangulaire corrigée de la latitude moyenne (les distances
est-ouest sont multipliées par cos 40°), pour que l'Utah ne soit pas étiré.
Les mêmes bornes sont utilisées par site/src/roadtrip.js pour y poser le
trajet du camping-car.

Entrée  : site/public/textures/earth_carnet.jpg (8192 × 4096)
Sortie  : site/public/textures/carte_ouest.jpg
"""

import math
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT / "site" / "public" / "textures"
LON_OUEST, LON_EST = -124.6, -106.6
LAT_NORD, LAT_SUD = 46.4, 33.6
COS = math.cos(math.radians(40.0))
LARGEUR = 760
PARCHEMIN = (244, 233, 207)
PALEUR = 0.24


def main() -> None:
    src = Image.open(TEX / "earth_carnet.jpg").convert("RGB")
    w, h = src.size
    px = w / 360.0
    boite = (round((LON_OUEST + 180) * px), round((90 - LAT_NORD) * px),
             round((LON_EST + 180) * px), round((90 - LAT_SUD) * px))
    hauteur = round(LARGEUR * (LAT_NORD - LAT_SUD) / ((LON_EST - LON_OUEST) * COS))
    carte = src.crop(boite).resize((LARGEUR, hauteur), Image.BICUBIC)
    carte = carte.filter(ImageFilter.GaussianBlur(0.8))
    carte = Image.blend(carte, Image.new("RGB", carte.size, PARCHEMIN), PALEUR)
    carte.save(TEX / "carte_ouest.jpg", quality=82, optimize=True, progressive=True)
    print(f"carte_ouest.jpg : {LARGEUR} × {hauteur}, "
          f"{(TEX / 'carte_ouest.jpg').stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
