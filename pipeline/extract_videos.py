#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extraction des vidéos YouTube référencées par /album/videolist.html,
avec titres et commentaires de /album/videocom.html.

Sortie : content/videos.json — { youtube_id, titre, date (AAAA-MM, déduite de
l'ancre AAAAMMJJ), commentaire }.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "content" / "site" / "album"
OUT_PATH = ROOT / "content" / "videos.json"

RE_SETMOVIE = re.compile(
    r"SetMovie\('(?:http://youtu\.be/|http://www\.youtube\.com/v/)"
    r"([A-Za-z0-9_-]+)','\./videocom\.html#(\d{8})'\);\">([^<]+)</a>")
RE_COM = re.compile(
    r'<a name="(\d{8})">([^<]*)</a></B></p>\s*<p class="std">(.*?)</p>', re.S)


def lire(nom: str) -> str:
    return (SITE / nom).read_bytes().decode("iso-8859-1")


def main() -> None:
    commentaires = {}
    for ancre, titre, com in RE_COM.findall(lire("videocom.html")):
        com = re.sub(r"<[^>]+>", " ", com)
        commentaires[ancre] = (titre.strip(), re.sub(r"\s+", " ", com).strip())

    videos = []
    for vid, ancre, libelle in RE_SETMOVIE.findall(lire("videolist.html")):
        titre, com = commentaires.get(ancre, (libelle.strip(), ""))
        videos.append({
            "youtube_id": vid,
            "titre": titre or libelle.strip(),
            "date": f"{ancre[:4]}-{ancre[4:6]}",
            "commentaire": com,
        })

    OUT_PATH.write_text(json.dumps(videos, ensure_ascii=False, indent=1))
    print(f"{len(videos)} vidéos → {OUT_PATH.relative_to(ROOT)}")
    for v in videos:
        print(f"  {v['date']}  {v['titre']}  (youtu.be/{v['youtube_id']})")


if __name__ == "__main__":
    main()
