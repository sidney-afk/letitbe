#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Texture « peinte à la main » pour le mode Carnet (l'esthétique solarpunk
voulue par Sidney — référence : Breath of the Wild × carte au trésor,
palette chaude, lagons turquoise, jamais d'espace noir).

Base : Natural Earth III de Tom Patterson (domaine public), une Terre déjà
idéalisée — verte, douce, sans nuages. On y ajoute : un océan **très clair
et laiteux** (la demande répétée de Sidney) avec un dégradé lagon près des
côtes, un lavis aquarelle qui respire, de petites vagues gravées façon
vieille carte marine, des terres saturées et posterisées en aplats, et un
liseré de plage crème.

Sortie : site/public/textures/earth_carnet.jpg (8192×4096)
"""

from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT / "site" / "public" / "textures"
SOURCE = TEX / "ne3_8k.jpg"  # non committé (9,5 Mo) : retéléchargé au besoin
URL_NE3 = "https://www.shadedrelief.com/natural3/ne3_data/8192/textures/2_no_clouds_8k.jpg"

LARGEUR = 8192  # plein format NE3 : les atolls restent nets en plongée

# l'océan de la miniature : lumineux, laiteux, jamais marine foncé
OCEAN_PROFOND = np.array([158, 209, 233], dtype=np.float32)
OCEAN_MOYEN = np.array([180, 224, 240], dtype=np.float32)
OCEAN_LAGON = np.array([206, 240, 246], dtype=np.float32)
PLAGE = np.array([248, 230, 184], dtype=np.float32)
ENCRE_VAGUE = np.array([121, 173, 205], dtype=np.float32)  # vaguelettes gravées


def telecharge() -> None:
    if SOURCE.exists():
        return
    print("téléchargement de Natural Earth III…")
    r = requests.get(URL_NE3, timeout=120,
                     headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"})
    r.raise_for_status()
    SOURCE.write_bytes(r.content)


def lavis(forme: tuple[int, int], graine: int, echelle: int) -> np.ndarray:
    """Nuages de bruit doux 0..1, continus au raccord ±180°.

    Le lavis est une matière colorée, non de la géographie. On répète son
    petit motif sur trois périodes avant de le rééchantillonner et de garder
    la période centrale. Le filtre bicubique voit ainsi les mêmes voisins de
    part et d'autre du bord gauche/droit, sans jamais dupliquer, refléter ou
    déplacer une côte dans la texture finale.
    """
    rng = np.random.default_rng(graine)
    petit = rng.random((forme[0] // echelle + 2, forme[1] // echelle + 2),
                       dtype=np.float32)
    repete = np.concatenate([petit, petit, petit], axis=1)
    im = Image.fromarray((repete * 255).astype(np.uint8)).resize(
        (forme[1] * 3, forme[0]), Image.BICUBIC)
    tableau = np.asarray(im, dtype=np.float32)
    largeur = forme[1]
    return tableau[:, largeur:largeur * 2] / 255.0


def vagues_gravees(ocean_profond: np.ndarray, graine: int = 11) -> Image.Image:
    """Petites arches façon vagues de carte ancienne, posées au large.

    Rend un masque L (0 = rien, 255 = trait plein) à fusionner en encre douce.
    """
    h, w = ocean_profond.shape
    calque = Image.new("L", (w, h), 0)
    dessin = ImageDraw.Draw(calque)
    rng = np.random.default_rng(graine)
    pas = 96
    for y in range(pas, h - pas, pas):
        for x in range(0, w, pas):
            # un peu d'aléa pour casser la grille, densité ~1/3
            if rng.random() > 0.34:
                continue
            cx = x + rng.integers(-28, 28)
            cy = y + rng.integers(-28, 28)
            # uniquement au grand large (loin de toute côte)
            y0, x0 = int(np.clip(cy, 0, h - 1)), int(cx) % w
            if ocean_profond[y0, x0] < 0.92:
                continue
            r = int(14 + rng.integers(0, 10))
            ep = 3
            # deux arches sœurs, comme un trait de plume
            dessin.arc([cx - r, cy - r, cx + r, cy + r], 200, 340, 255, ep)
            r2 = r // 2
            dessin.arc([cx + r - 2, cy - r2, cx + r + r2 * 2 - 2, cy + r2],
                       210, 330, 200, ep - 1)
    return calque.filter(ImageFilter.GaussianBlur(1.1))


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
    # bandes douces : large → moyen → lagon (plateau côtier généreux,
    # comme la référence)
    bande1 = np.clip((t - 0.10) / 0.14, 0, 1)
    bande2 = np.clip((t - 0.50) / 0.14, 0, 1)
    ocean_rgb = (OCEAN_PROFOND[None, None]
                 + (OCEAN_MOYEN - OCEAN_PROFOND)[None, None] * bande1[..., None]
                 + (OCEAN_LAGON - OCEAN_MOYEN)[None, None] * bande2[..., None])

    # lavis aquarelle : l'eau respire, des nappes claires dérivent au large
    forme = ocean.shape
    nappe = (lavis(forme, 3, 640) * 0.6 + lavis(forme, 5, 192) * 0.4)
    ocean_rgb *= (0.97 + nappe[..., None] * 0.07)

    # vaguelettes gravées au grand large, en encre très douce
    au_large = np.clip(1 - t, 0, 1)
    vagues = np.asarray(vagues_gravees(au_large)).astype(np.float32) / 255.0
    vagues *= au_large * 0.42
    ocean_rgb = (ocean_rgb * (1 - vagues[..., None])
                 + ENCRE_VAGUE[None, None] * vagues[..., None])
    del nappe, vagues, au_large

    # --- terres : aplats chauds, saturés, posterisés ---
    terre = base.filter(ImageFilter.MedianFilter(5))
    hsv = np.asarray(terre.convert("HSV")).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    s = np.clip(s * 1.5 + 14, 0, 255)
    v = np.clip(v * 1.16 + 26, 0, 255)
    glace = (v > 190) & (s < 70)
    s[glace] *= 0.3
    hsv2 = np.stack([h, s, v], axis=-1).astype(np.uint8)
    del hsv, h, s, v, glace
    terre = Image.fromarray(hsv2, "HSV").convert("RGB")
    terre = terre.quantize(colors=30, method=Image.MEDIANCUT,
                           dither=Image.Dither.NONE)
    terre = terre.convert("RGB").filter(ImageFilter.ModeFilter(5))
    terre_rgb = np.asarray(terre).astype(np.float32)
    # le même lavis sur les terres, plus marqué : la gouache n'est jamais plate
    mottle = (lavis(forme, 7, 448) * 0.65 + lavis(forme, 9, 128) * 0.35)
    terre_rgb *= (0.95 + mottle[..., None] * 0.10)
    del mottle

    # --- fusion + liseré de plage côté mer ---
    m = ocean[..., None]
    final = terre_rgb * (1 - m) + ocean_rgb * m
    del terre_rgb, ocean_rgb
    liseret = np.clip((tres_proche - 0.04) / 0.5, 0, 1) * ocean
    final = final * (1 - liseret[..., None] * 0.55) \
        + PLAGE[None, None] * liseret[..., None] * 0.55

    Image.fromarray(np.clip(final, 0, 255).astype(np.uint8)).save(
        TEX / "earth_carnet.jpg", quality=88)
    print(f"écrit : {TEX / 'earth_carnet.jpg'}")


if __name__ == "__main__":
    main()
