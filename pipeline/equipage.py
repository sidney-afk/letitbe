#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Portraits de l'équipage et photos du bateau pour « À propos », tirés des
pages « L'équipage » (People/equipage.html) et « Le bateau »
(Navigation/batindex.html) de laruel.be.

Les portraits du site d'origine portent un cadre noir de 11 px : il est
retiré, le site dessine le sien.

Sortie : site/public/media/equipage/*.webp
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "content" / "site"
DEST = ROOT / "site" / "public" / "media" / "equipage"

PHOTOS = {
    "cecile": ("Tech/Image/Equipage/CaptCecile.jpg", 16),
    "eric": ("Tech/Image/Equipage/LtEric.jpg", 16),
    "kenya": ("Tech/Image/Equipage/MousseKen.jpg", 16),
    "sidney": ("Tech/Image/Equipage/MousseSid.jpg", 16),
    "syrdaria": ("Tech/Image/Equipage/MousseSyr.jpg", 16),
    "bateau-sous-voile": ("Navigation/images/bateau1.jpg", 0),
    "bateau-clef-de-sol": ("Navigation/images/bateau9.jpg", 0),
}


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for nom, (src, cadre) in PHOTOS.items():
        with Image.open(SITE / src) as im:
            im = im.convert("RGB")
            if cadre:
                # (the bottom edge of the original frame is a little thicker)
                im = im.crop((cadre, cadre, im.width - cadre, im.height - cadre - 6))
            im.save(DEST / f"{nom}.webp", "WEBP", quality=84, method=6)
        print(f"{nom}.webp ← {src}")


if __name__ == "__main__":
    main()
