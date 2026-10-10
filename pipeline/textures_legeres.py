#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les textures du mode réaliste en demi-taille, pour les téléphones.

Les téléphones peignent déjà le globe Carnet en 4096 px ; le mode réaliste
leur faisait pourtant télécharger et décoder la carte du jour en 5400 px
(2,5 Mo, environ 58 Mo de mémoire graphique). Ces copies réduites (moitié
de la largeur) sont choisies par site/src/globe.js sur les appareils légers.

Entrée  : site/public/textures/earth_day_5400.jpg, earth_night_3600.jpg
Sortie  : site/public/textures/earth_day_2700.jpg, earth_night_1800.jpg
"""

from pathlib import Path

from PIL import Image

TEX = Path(__file__).resolve().parent.parent / "site" / "public" / "textures"


def reduit(source: str, cible: str, largeur: int) -> None:
    with Image.open(TEX / source) as im:
        im = im.convert("RGB")
        hauteur = round(im.height * largeur / im.width)
        im.resize((largeur, hauteur), Image.LANCZOS).save(
            TEX / cible, quality=86, optimize=True, progressive=True)
    print(f"{cible} : {largeur} × {hauteur}, {(TEX / cible).stat().st_size // 1024} Ko")


def main() -> None:
    reduit("earth_day_5400.jpg", "earth_day_2700.jpg", 2700)
    reduit("earth_night_3600.jpg", "earth_night_1800.jpg", 1800)


if __name__ == "__main__":
    main()
