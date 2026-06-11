#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Assemble le modèle de données final du site (cf. PLAN.md) :

  data/route.json      — polyline horodatée : la séquence des escales avec
                         coordonnées, dates, log ; les traversées s'interpolent
                         en orthodromie côté rendu.
  data/mouillages.json — chaque escale enrichie des articles du blog écrits
                         sur place (extraits + images légendées).
  data/albums.json     — albums photos avec leurs périodes.

La partie camping-car (USA 2013 / route vers le Costa Rica) reste à
reconstituer depuis les articles 2014+ — voir PLAN.md.
"""

import json
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
DATA = ROOT / "data"

FIN_BATEAU = date(2014, 1, 13)  # San Diego, fin du chapitre bateau


def charge(nom: str):
    return json.loads((CONTENT / nom).read_text())


def extrait(texte: str, longueur: int = 320) -> str:
    if len(texte) <= longueur:
        return texte
    coupe = texte[:longueur]
    coupe = coupe[:coupe.rfind(" ")]
    return coupe + "…"


def main() -> None:
    mouillages = charge("mouillages.json")
    articles = charge("articles.json")
    albums = charge("albums.json")
    DATA.mkdir(exist_ok=True)

    # --- data/route.json ---------------------------------------------------
    route = [{
        "nom": m["nom"],
        "lat": m["lat"],
        "lon": m["lon"],
        "log_nm": m["log_nm"],
        "date_arrivee": m["date_arrivee"],
        "date_depart": m["date_depart"],
        "type": m["type"],
        "chapitre": m["chapitre"],
    } for m in mouillages]
    (DATA / "route.json").write_text(
        json.dumps(route, ensure_ascii=False, indent=1))

    # --- jointure articles → mouillages (par date, fenêtre la plus précise) -
    def intervalle(i: int, m) -> tuple[date, date] | None:
        if not m["date_arrivee"]:
            return None
        a = date.fromisoformat(m["date_arrivee"])
        d = date.fromisoformat(m["date_depart"]) if m["date_depart"] else a
        # l'escale reste « active » jusqu'au départ réel : trou long = bateau
        # immobile (hivernage à Whangarei pendant les voyages NZ/Australie) ;
        # trou avant une traversée = attente au mouillage (préparatifs)
        if i + 1 < len(mouillages) and mouillages[i + 1]["date_arrivee"]:
            suivant = mouillages[i + 1]
            narr = date.fromisoformat(suivant["date_arrivee"])
            if (narr - d).days > 30 or suivant["type"] == "traversee":
                d = max(d, narr - timedelta(days=1))
        return a, d

    pour_mouillage: dict[int, list[dict]] = {i: [] for i in range(len(mouillages))}
    non_rattaches = 0
    for art in articles:
        if not art["date"]:
            continue
        d = date.fromisoformat(art["date"])
        if d > FIN_BATEAU + timedelta(days=2):
            continue  # ère Costa Rica : hors route bateau
        candidats = []
        for i, m in enumerate(mouillages):
            iv = intervalle(i, m)
            if not iv:
                continue
            a, fin = iv
            if a - timedelta(days=1) <= d <= fin + timedelta(days=1):
                candidats.append((i, (fin - a).days))
        if candidats:
            # fenêtre la plus courte = escale la plus spécifique
            # (ex. Faaite pendant le séjour à Fakarava)
            i = min(candidats, key=lambda c: c[1])[0]
            pour_mouillage[i].append(art)
        elif d >= date(2009, 5, 27):
            # article écrit en mer (« Traversée vers les Galapagos J3 ») ou
            # dans un trou entre escales : rattaché à la destination
            suivants = [i for i, m in enumerate(mouillages)
                        if m["date_arrivee"] and
                        date.fromisoformat(m["date_arrivee"]) >= d]
            if suivants:
                art["en_mer"] = True
                pour_mouillage[suivants[0]].append(art)
            else:
                non_rattaches += 1

    # --- data/mouillages.json ----------------------------------------------
    enrichis = []
    total_arts = 0
    for i, m in enumerate(mouillages):
        arts = sorted(pour_mouillage[i], key=lambda a: a["date"])
        total_arts += len(arts)
        enrichis.append({
            **{k: m[k] for k in ("nom", "lat", "lon", "log_nm", "date_arrivee",
                                 "date_depart", "type", "chapitre")},
            "articles": [{
                "id": a["id"],
                "date": a["date"],
                "titre": a["titre"],
                "extrait": extrait(a["texte"]),
                "texte": a["texte"],
                "images": a["images"],
                **({"en_mer": True} if a.get("en_mer") else {}),
            } for a in arts],
        })
    (DATA / "mouillages.json").write_text(
        json.dumps(enrichis, ensure_ascii=False, indent=1))

    # --- data/albums.json ----------------------------------------------------
    (DATA / "albums.json").write_text(
        json.dumps(albums, ensure_ascii=False, indent=1))

    avec_articles = sum(1 for e in enrichis if e["articles"])
    print(f"route.json      : {len(route)} points")
    print(f"mouillages.json : {len(enrichis)} escales, {avec_articles} avec articles, "
          f"{total_arts} articles rattachés, {non_rattaches} articles bateau non rattachés")
    print(f"albums.json     : {len(albums)} albums")


if __name__ == "__main__":
    main()
