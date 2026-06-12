#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Carte d'élévation pour le relief sculpté du globe (mode Carnet).

Source : la bump map dérivée des données SRTM/NASA du projet webgl-earth
(github.com/turban/webgl-earth, textures de planetpixelemporium — libres
avec crédit). On la nettoie pour l'usage diorama : niveau de la mer à zéro
franc, léger lissage pour des montagnes rondes plutôt que des pics bruités.

Sortie : site/public/textures/earth_elev_2048.jpg (2048×1024, niveaux de gris)
"""

from io import BytesIO
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SORTIE = ROOT / "site" / "public" / "textures" / "earth_elev_2048.jpg"
URL = ("https://raw.githubusercontent.com/turban/webgl-earth/"
       "master/images/elev_bump_4k.jpg")

NIVEAU_MER = 26  # la source code l'océan autour de ~24, on coupe juste au-dessus


def main() -> None:
    print("téléchargement de la carte d'élévation…")
    r = requests.get(URL, timeout=120)
    r.raise_for_status()
    im = Image.open(BytesIO(r.content)).convert("L")

    e = np.asarray(im).astype(np.float32)
    e = np.clip((e - NIVEAU_MER) / (255.0 - NIVEAU_MER), 0, 1) * 255.0
    im = Image.fromarray(e.astype(np.uint8))
    # montagnes rondes et douces : c'est une figurine, pas un MNT
    im = im.filter(ImageFilter.GaussianBlur(1.6)).resize((2048, 1024), Image.LANCZOS)
    im.save(SORTIE, quality=88)
    print(f"écrit : {SORTIE}")


if __name__ == "__main__":
    main()
