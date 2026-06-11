#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Texture « peinte à la main » pour le mode Carnet (l'esthétique solarpunk
voulue par Sidney — référence : globe cartoon, palette chaude, lagons
turquoise, jamais d'espace noir).

Base : Natural Earth III de Tom Patterson (domaine public), une Terre déjà
idéalisée — verte, douce, sans nuages. On y ajoute : océan bleu joyeux avec
un dégradé lagon près des côtes, terres saturées et posterisées en aplats,
liseré de plage crème.

Sortie : site/public/textures/earth_carnet.jpg (4096×2048)
"""

from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT / "site" / "public" / "textures"
SOURCE = TEX / "ne3_8k.jpg"  # non committé (9,5 Mo) : retéléchargé au besoin
URL_NE3 = "https://www.shadedrelief.com/natural3/ne3_data/8192/textures/2_no_clouds_8k.jpg"

LARGEUR = 4096

OCEAN_PROFOND = np.array([44, 108, 178], dtype=np.float32)
OCEAN_MOYEN = np.array([64, 138, 206], dtype=np.float32)
OCEAN_LAGON = np.array([116, 204, 228], dtype=np.float32)
PLAGE = np.array([246, 228, 180], dtype=np.float32)


def telecharge() -> None:
    if SOURCE.exists():
        return
    print("téléchargement de Natural Earth III…")
    r = requests.get(URL_NE3, timeout=120,
                     headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"})
    r.raise_for_status()
    SOURCE.write_bytes(r.content)


def main() -> None:
    telecharge()
    Image.MAX_IMAGE_PIXELS = None
    base = Image.open(SOURCE).convert("RGB").resize(
        (LARGEUR, LARGEUR // 2), Image.LANCZOS)
    rgb = np.asarray(base).astype(np.float32)

    # masque océan : le bleu NE3 est uniforme et très dominant
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    ocean = ((b > r + 18) & (b > g + 8) & (b > 60)).astype(np.float32)

    # --- océan : dégradé par éloignement de la côte, en bandes d'aplats ---
    terre_masque = Image.fromarray(((1 - ocean) * 255).astype(np.uint8))
    proche = np.asarray(terre_masque.filter(
        ImageFilter.GaussianBlur(10))).astype(np.float32) / 255.0
    tres_proche = np.asarray(terre_masque.filter(
        ImageFilter.GaussianBlur(3.5))).astype(np.float32) / 255.0

    t = np.clip(proche * 2.6, 0, 1)
    # bandes douces : large → moyen → lagon
    bande1 = np.clip((t - 0.18) / 0.1, 0, 1)
    bande2 = np.clip((t - 0.55) / 0.12, 0, 1)
    ocean_rgb = (OCEAN_PROFOND[None, None]
                 + (OCEAN_MOYEN - OCEAN_PROFOND)[None, None] * bande1[..., None]
                 + (OCEAN_LAGON - OCEAN_MOYEN)[None, None] * bande2[..., None])

    # --- terres : aplats chauds, saturés, posterisés ---
    terre = base.filter(ImageFilter.MedianFilter(5))
    hsv = np.asarray(terre.convert("HSV")).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    s = np.clip(s * 1.5 + 14, 0, 255)
    v = np.clip(v * 1.16 + 26, 0, 255)
    glace = (v > 190) & (s < 70)
    s[glace] *= 0.3
    hsv2 = np.stack([h, s, v], axis=-1).astype(np.uint8)
    terre = Image.fromarray(hsv2, "HSV").convert("RGB")
    terre = terre.quantize(colors=30, method=Image.MEDIANCUT,
                           dither=Image.Dither.NONE)
    terre = terre.convert("RGB").filter(ImageFilter.ModeFilter(5))
    terre_rgb = np.asarray(terre).astype(np.float32)

    # --- fusion + liseré de plage côté mer ---
    m = ocean[..., None]
    final = terre_rgb * (1 - m) + ocean_rgb * m
    liseret = np.clip((tres_proche - 0.04) / 0.5, 0, 1) * ocean
    final = final * (1 - liseret[..., None] * 0.55) \
        + PLAGE[None, None] * liseret[..., None] * 0.55

    Image.fromarray(np.clip(final, 0, 255).astype(np.uint8)).save(
        TEX / "earth_carnet.jpg", quality=88)
    print(f"écrit : {TEX / 'earth_carnet.jpg'}")


if __name__ == "__main__":
    main()
