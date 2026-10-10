#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""La carte plate du repli 2D (appareils sans WebGL) : la même peinture que
le globe Carnet, recadrée sur la moitié du monde que le voyage a parcourue.

Projection équirectangulaire, longitudes 140° E → 50° O (à travers la ligne
de changement de date), latitudes 65° N → 50° S. Les mêmes bornes sont
utilisées par site/src/main.js pour placer la route sur l'image.

Entrée  : site/public/textures/earth_carnet.jpg (8192 × 4096)
Sortie  : site/public/textures/carte_pacifique.jpg (1600 × 1150)
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT / "site" / "public" / "textures"
LON_OUEST, LARGEUR_LON = 140.0, 170.0   # 140° E, sur 170° vers l'est
LAT_NORD, LAT_SUD = 65.0, -50.0
LARGEUR = 1600


def main() -> None:
    src = Image.open(TEX / "earth_carnet.jpg").convert("RGB")
    w, h = src.size
    px_deg = w / 360.0
    x0 = round((LON_OUEST + 180.0) * px_deg)
    largeur_px = round(LARGEUR_LON * px_deg)
    y0 = round((90.0 - LAT_NORD) * h / 180.0)
    y1 = round((90.0 - LAT_SUD) * h / 180.0)
    # la fenêtre traverse le bord droit de l'image (180°) : deux morceaux
    morceau = Image.new("RGB", (largeur_px, y1 - y0))
    droite = min(largeur_px, w - x0)
    morceau.paste(src.crop((x0, y0, x0 + droite, y1)), (0, 0))
    if droite < largeur_px:
        morceau.paste(src.crop((0, y0, largeur_px - droite, y1)), (droite, 0))
    hauteur = round(LARGEUR * morceau.height / morceau.width)
    morceau.resize((LARGEUR, hauteur), Image.LANCZOS).save(
        TEX / "carte_pacifique.jpg", quality=80, optimize=True, progressive=True)
    print(f"carte_pacifique.jpg : {LARGEUR} × {hauteur}")


if __name__ == "__main__":
    main()
