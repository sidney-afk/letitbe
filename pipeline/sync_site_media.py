#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Copie vers site/public/media les WebP réellement utilisés par le site
(photos des articles rattachés aux escales — la plongée de l'étape 3).

Les originaux font ≤ 800 px : le plein format WebP sert à la fois de
vignette et de plein écran, pas besoin des thumbs.

Prérequis : pipeline/optimize_images.py a déjà généré content/media/.
"""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "content" / "media"
DEST = ROOT / "site" / "public" / "media"


def main() -> None:
    mouillages = json.loads((ROOT / "data" / "mouillages.json").read_text())
    srcs = sorted({im["src"] for m in mouillages
                   for a in m["articles"] for im in a["images"]})
    copies = absents = 0
    octets = 0
    for src in srcs:
        rel = Path(src).with_suffix(".webp")
        origine = MEDIA / rel
        if not origine.exists():
            absents += 1  # 404 sur le site d'origine, recensés au manifeste
            continue
        cible = DEST / rel
        cible.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(origine, cible)
        octets += origine.stat().st_size
        copies += 1
    print(f"{copies} photos copiées ({octets / 1e6:.0f} Mo), "
          f"{absents} introuvables → {DEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
