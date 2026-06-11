#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Optimisation des photos pour le site (PLAN : « AVIF/WebP + fallback,
miniatures + plein écran »).

Convertit les images réellement utilisées par le modèle de données
(albums.json, articles.json, bateau.json, cartes des trajets) :
    content/media/<chemin>.webp          — pleine taille (les originaux font
                                           560-800 px, on ne les agrandit pas)
    content/media/thumbs/<chemin>.webp   — miniature 480 px de large

Usage :
    python3 pipeline/optimize_images.py [--avif]   # AVIF en plus du WebP
"""

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "content" / "site"
MEDIA = ROOT / "content" / "media"

QUALITE = 82
LARGEUR_THUMB = 480


def sources() -> list[str]:
    refs: set[str] = set()
    albums = json.loads((ROOT / "content" / "albums.json").read_text())
    for alb in albums:
        refs.update(p["src"] for p in alb["photos"])
    articles = json.loads((ROOT / "content" / "articles.json").read_text())
    for art in articles:
        refs.update(im["src"] for im in art["images"])
    bateau = json.loads((ROOT / "content" / "bateau.json").read_text())
    refs.update(p["src"] for p in bateau["photos_reference"])
    refs.update(p.relative_to(SITE).as_posix()
                for p in (SITE / "Voyages").glob("*.jpg"))
    return sorted(refs)


def convertit(rel: str, avif: bool) -> tuple[int, int]:
    src = SITE / rel
    if not src.exists():
        return 0, 0
    base = Path(rel).with_suffix("")
    sorties = [(MEDIA / base.with_suffix(".webp"), "WEBP", None)]
    sorties.append((MEDIA / "thumbs" / base.with_suffix(".webp"), "WEBP",
                    LARGEUR_THUMB))
    if avif:
        sorties.append((MEDIA / base.with_suffix(".avif"), "AVIF", None))
    octets = faits = 0
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            for dest, fmt, largeur in sorties:
                if dest.exists():
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                out = im
                if largeur and im.width > largeur:
                    h = round(im.height * largeur / im.width)
                    out = im.resize((largeur, h), Image.LANCZOS)
                out.save(dest, fmt, quality=QUALITE, method=4)
                octets += dest.stat().st_size
                faits += 1
    except Exception as exc:
        print(f"  !! {rel}: {exc}", flush=True)
    return faits, octets


def main() -> None:
    avif = "--avif" in sys.argv
    refs = sources()
    print(f"{len(refs)} images sources")
    faits = octets = 0
    for i, rel in enumerate(refs):
        f, o = convertit(rel, avif)
        faits += f
        octets += o
        if (i + 1) % 500 == 0:
            print(f"  …{i + 1}/{len(refs)}", flush=True)
    print(f"{faits} fichiers générés, {octets / 1e6:.0f} Mo → {MEDIA}")


if __name__ == "__main__":
    main()
