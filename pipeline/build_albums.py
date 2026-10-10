#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les albums photo du site laruel.be, rattachés aux escales du voyage.

Chaque album (46, 4 760 photos légendées par la famille) couvre une région
pendant un ou quelques mois. On le rattache aux escales dont le séjour
recoupe sa période ET dont le nom correspond à la région de l'album (table
d'alias ci-dessous) ; à défaut, à l'escale la plus longue de la période.

Le site ne publie pas les 4 760 photos (≈ 400 Mo) : il montre une sélection
de chaque album (les photos légendées d'abord, réparties sur tout l'album)
et renvoie vers l'album complet, toujours en ligne sur laruel.be.

Entrées  : data/albums.json, data/route.json, content/media/ (WebP, voir
           optimize_images.py)
Sorties  : data/albums_escales.json, site/public/media/<photo>.webp,
           site/public/media/vignettes/<photo>.webp

Usage : python3 pipeline/build_albums.py
"""

import json
import re
import shutil
import unicodedata
from datetime import date, timedelta
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "content" / "media"
DEST = ROOT / "site" / "public" / "media"
SELECTION_MAX = 24
LARGEUR_VIGNETTE = 360
QUALITE_VIGNETTE = 72
TOLERANCE = timedelta(days=20)

MOIS = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11,
    "decembre": 12,
}

# Région d'un album → fragments de noms d'escales (texte normalisé).
CANADA = ["prince rupert", "gunboat", "grenville", "coghlan", "green spit",
          "work bay", "unnamed bay", "beales", "fougner", "millbrook",
          "blunden", "port mc neil", "port harvey", "crawford", "squirel",
          "cochrane", "nelson island", "jedediah", "dolphin", "vancouver",
          "kendrick", "thetis", "montague", "bedwell", "sidney", "d'arcy",
          "chatham", "victoria"]
ALIAS = {
    "usa": ["port angeles", "neah bay", "san francisco"],
    "san francisco": ["san francisco"],
    "parcs nationaux us": ["san francisco"],
    "hawaii": ["hilo", "maui", "molokai", "oahu"],
    "traversee hawaii - canada": ["prince rupert"],
    "alaska": ["prince rupert"],
    "canada": CANADA,
    "tuamotu": ["tuamotu", "fakarava", "tahanea", "makemo"],
    "marquises": ["marquises", "hiva oa", "tahuata", "ua pou", "nuku hiva"],
    "iles de la societe": ["tahiti", "moorea", "huahine", "raiatea",
                           "bora bora", "maupihaa"],
    "tahiti": ["tahiti"],
    "iles cook": ["cook du sud"],
    "fidji": ["fidji"],
    "traversee fidji - nlle zelande": ["opua"],
    "nouvelle zelande": ["nlle zelande"],
    "tasmanie": ["whangarei"],
    "australie": ["whangarei"],
    "australie - signes": ["whangarei"],
    "traversee galapagos-gambier": ["gambier"],
    "panama": ["panama", "balboa"],
}


def normalise(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower()).strip()


def periode(texte: str) -> tuple[date, date]:
    """« Mars/Mai 2013 », « Novembre 2012/Février 2013 », « Année 2011 »."""
    t = normalise(texte)
    if t.startswith("annee"):
        an = int(re.search(r"\d{4}", t).group())
        return date(an, 1, 1), date(an, 12, 31)
    morceaux = [m.groups() for m in re.finditer(r"([a-z]+)\s*(\d{4})?", t)
                if m.group(1) in MOIS]
    annees = [int(a) for _, a in morceaux if a]
    debut_mois, debut_an = morceaux[0]
    fin_mois, fin_an = morceaux[-1]
    debut = date(int(debut_an) if debut_an else annees[0], MOIS[debut_mois], 1)
    fin_annee = int(fin_an) if fin_an else annees[-1]
    suivant = date(fin_annee + (MOIS[fin_mois] == 12), MOIS[fin_mois] % 12 + 1, 1)
    return debut, suivant - timedelta(days=1)


def est_legende(legende: str) -> bool:
    return bool(legende) and not re.fullmatch(r"[\w\-_ ()]+\.(jpe?g|png|gif)", legende, re.I)


def selection(photos: list[dict]) -> list[dict]:
    """Jusqu'à SELECTION_MAX photos, légendées d'abord, réparties sur l'album."""
    disponibles = [p for p in photos
                   if (MEDIA / Path(p["src"]).with_suffix(".webp")).exists()]
    legendees = [p for p in disponibles if est_legende(p.get("legende", ""))]
    base = legendees if len(legendees) >= min(SELECTION_MAX, len(disponibles)) // 2 else disponibles
    if len(base) <= SELECTION_MAX:
        choisies = base
    else:
        pas = len(base) / SELECTION_MAX
        choisies = [base[int(i * pas)] for i in range(SELECTION_MAX)]
    ordre = {id(p): i for i, p in enumerate(photos)}
    return sorted(choisies, key=lambda p: ordre[id(p)])


def main() -> None:
    albums = json.loads((ROOT / "data" / "albums.json").read_text())
    route = json.loads((ROOT / "data" / "route.json").read_text())

    escales = []
    for i, e in enumerate(route):
        if e["type"] == "traversee" or not e["date_arrivee"]:
            continue
        arrivee = date.fromisoformat(e["date_arrivee"])
        depart = date.fromisoformat(e["date_depart"]) if e["date_depart"] else arrivee
        # séjour prolongé jusqu'à l'arrivée suivante (hivernages, roadtrip)
        suivant = next((r for r in route[i + 1:] if r["date_arrivee"]), None)
        if suivant:
            depart = max(depart, date.fromisoformat(suivant["date_arrivee"]) - timedelta(days=1))
        escales.append({"cle": f"{e['nom']}|{e['date_arrivee']}", "nom": normalise(e["nom"]),
                        "debut": arrivee, "fin": depart})

    sortie = []
    vignettes = copies = 0
    for album in albums:
        if not album["photos"]:
            continue
        debut, fin = periode(album["periode"])
        nom = normalise(album["nom"])
        fragments = ALIAS.get(nom, [nom])
        recouvrent = [e for e in escales
                      if e["debut"] - TOLERANCE <= fin and e["fin"] + TOLERANCE >= debut]
        # mots entiers : « tonga » ne doit pas désigner « Rarotonga »
        rattachees = [e for e in recouvrent
                      if any(re.search(rf"(?<![a-z]){re.escape(f)}(?![a-z])", e["nom"])
                             for f in fragments)]
        if not rattachees and recouvrent:
            rattachees = [max(recouvrent, key=lambda e: min(e["fin"], fin) - max(e["debut"], debut))]
        choisies = selection(album["photos"])
        for p in choisies:
            rel = Path(p["src"]).with_suffix(".webp")
            cible = DEST / rel
            if not cible.exists():
                cible.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(MEDIA / rel, cible)
                copies += 1
            vignette = DEST / "vignettes" / rel
            if not vignette.exists():
                vignette.parent.mkdir(parents=True, exist_ok=True)
                with Image.open(MEDIA / rel) as im:
                    im = im.convert("RGB")
                    if im.width > LARGEUR_VIGNETTE:
                        im = im.resize((LARGEUR_VIGNETTE,
                                        round(im.height * LARGEUR_VIGNETTE / im.width)),
                                       Image.LANCZOS)
                    im.save(vignette, "WEBP", quality=QUALITE_VIGNETTE, method=6)
                vignettes += 1
        sortie.append({
            "id": album["id"],
            "nom": album["nom"],
            "periode": album["periode"],
            "debut": debut.isoformat(),
            "url": f"https://www.laruel.be/{album['chemin']}/index.html",
            "total": len(album["photos"]),
            "photos": [{"src": p["src"],
                        "legende": p["legende"] if est_legende(p.get("legende", "")) else ""}
                       for p in choisies],
            "escales": [e["cle"] for e in rattachees],
        })
        print(f"{album['nom']:<32} {album['periode']:<28} {len(choisies):>2}/{len(album['photos']):<3}"
              f" → {', '.join(e['cle'].split('|')[0] for e in rattachees) or '—'}")

    sortie.sort(key=lambda a: (a["debut"], a["id"]))
    (ROOT / "data" / "albums_escales.json").write_text(
        json.dumps(sortie, ensure_ascii=False, indent=1) + "\n")
    print(f"\n{len(sortie)} albums, {sum(len(a['photos']) for a in sortie)} photos choisies ; "
          f"{copies} photos et {vignettes} vignettes ajoutées → {DEST.relative_to(ROOT)}")

    from dimensions_photos import annote
    annote()


if __name__ == "__main__":
    main()
