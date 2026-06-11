#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Catalogue d'étoiles pour « le vrai ciel » (fonctionnalité 3 du plan).

Télécharge le Yale Bright Star Catalog (bsc5-short, ~9 100 étoiles visibles
à l'œil nu) et le compacte en data/etoiles.json :
    [[ra_deg, dec_deg, magnitude_V, temperature_K], …]
"""

import json
import re
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "etoiles.json"
URL = ("https://raw.githubusercontent.com/brettonw/"
       "YaleBrightStarCatalog/master/bsc5-short.json")

RE_RA = re.compile(r"(\d+)h\s*(\d+)m\s*([\d.]+)s")
RE_DEC = re.compile(r"([+-])(\d+)°\s*(\d+)′\s*([\d.]+)″")


def main() -> None:
    brut = requests.get(URL, timeout=60).json()
    etoiles = []
    for e in brut:
        m_ra = RE_RA.match(e.get("RA", ""))
        m_dec = RE_DEC.match(e.get("Dec", ""))
        if not (m_ra and m_dec and e.get("V")):
            continue
        h, mi, s = m_ra.groups()
        ra = (int(h) + int(mi) / 60 + float(s) / 3600) * 15
        signe, d, mn, sc = m_dec.groups()
        dec = (int(d) + int(mn) / 60 + float(sc) / 3600) * (-1 if signe == "-" else 1)
        etoiles.append([
            round(ra, 3),
            round(dec, 3),
            float(e["V"]),
            int(e.get("K") or 5800),
        ])
    etoiles.sort(key=lambda x: x[2])  # les plus brillantes d'abord
    OUT_PATH.write_text(json.dumps(etoiles, separators=(",", ":")))
    taille = OUT_PATH.stat().st_size / 1e3
    print(f"{len(etoiles)} étoiles ({taille:.0f} Ko) → {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
