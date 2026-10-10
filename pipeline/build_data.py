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
import unicodedata
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


# un titre qui dit la mer : « Traversée … », « En mer », « J12 »
MER = re.compile(r"\btravers|\ben mer\b|\bj\d+\b")

# « … vers Beveridge Reef », « En route pour Rangiroa », « Sur la route de
# Port Mc Neil » : ce qui suit est la destination
DESTINATION = re.compile(r"\b(?:vers|pour|route de|route du|route des|direction)\b")

# mots trop communs pour désigner une escale à eux seuls
MOTS_GENERIQUES = {
    "fidji", "tonga", "marquises", "tuamotu", "iles", "island", "islands",
    "bay", "harbour", "cove", "anchorage", "point", "beach", "baie", "port",
    "nlle", "zelande", "big", "santa", "san", "unnamed", "the",
}


def mots(texte: str) -> list[str]:
    t = unicodedata.normalize("NFKD", texte or "").encode("ascii", "ignore").decode().lower()
    return re.findall(r"[a-z]+", t)


def mots_cites(titre: str, nom: str) -> tuple[int, float]:
    """Combien de mots propres à cette escale le titre du billet cite-t-il
    (« Bora Bora, ne croyez pas tout… »), et quelle part de son nom ?
    « Arrivée à Nuku Hiva » cite deux mots de Nuku Hiva ; « Noël à Hiva Oa »
    en cite un de chacune, mais tout le nom de Hiva Oa (« oa » est trop
    court pour compter) et la moitié seulement de celui de Nuku Hiva."""
    propres = {m for m in mots(nom) if len(m) > 3 and m not in MOTS_GENERIQUES}
    # « En route pour Rangiroa. » raconte l'escale d'avant (Toau) : un lieu
    # annoncé comme destination ne désigne pas l'escale du billet
    titre = DESTINATION.split(" ".join(mots(titre)), 1)[0]
    cites = len(propres & set(titre.split()))
    return cites, cites / len(propres) if propres else 0.0


def nomme_escale(titre: str, nom: str) -> bool:
    return mots_cites(titre, nom)[0] > 0


def phrase_qui_cite(blocs: list, propres: set[str]) -> str | None:
    """La première phrase d'un billet qui nomme ce lieu, mot pour mot ;
    rognée autour du nom (« … ») si elle est très longue."""
    for bloc in blocs:
        if not isinstance(bloc, str):
            continue
        for phrase in re.split(r"(?<=[.!?…])\s+", bloc.strip()):
            if not propres <= set(mots(phrase)):
                continue
            if len(phrase) <= 280:
                return phrase
            # autour du premier mot du nom, coupé entre deux mots
            plat = unicodedata.normalize("NFKD", phrase).encode("ascii", "ignore").decode().lower()
            ici = min(plat.find(m) for m in propres if m in plat)
            ici = round(ici * len(phrase) / max(len(plat), 1))
            # de préférence à une virgule, un peu après le nom
            virgule = phrase.find(",", ici + 40)
            if ici < 200 and 0 < virgule <= 300:
                return phrase[:virgule] + "…"
            a = phrase.rfind(" ", 0, max(0, ici - 130)) + 1
            b = phrase.find(" ", min(len(phrase), ici + 130))
            b = len(phrase) if b < 0 else b
            return ("…" if a > 0 else "") + phrase[a:b].strip(" ,;:") + ("…" if b < len(phrase) else "")
    return None


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

    def en_traversee(d: date) -> bool:
        return any(m["type"] == "traversee" and m["date_arrivee"] and m["date_depart"]
                   and date.fromisoformat(m["date_arrivee"]) < d
                   < date.fromisoformat(m["date_depart"])
                   for m in mouillages)

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
            # une traversée n'a pas de carnet à ouvrir : ses billets vont à
            # l'escale où elle mène (ci-dessous, « écrit en mer »)
            if m["type"] == "traversee":
                continue
            iv = intervalle(i, m)
            if not iv:
                continue
            a, fin = iv
            if a - timedelta(days=1) <= d <= fin + timedelta(days=1):
                candidats.append((i, (fin - a).days))
        if candidats:
            # un billet qui nomme une escale dans son titre lui revient
            # (« Nananu, ça sent la pizza », daté du jour où l'on quitte
            # Naigani pour Nananu), même écrit un ou deux jours après l'avoir
            # quittée (« Vanua Lailai, beau au-dessus, beau en-dessous. »,
            # daté du lendemain, au mouillage suivant) ; sinon, fenêtre la
            # plus courte = escale la plus spécifique (ex. Faaite pendant le
            # séjour à Fakarava)
            dans = {c[0] for c in candidats}
            voisines = [(i, 0) for i, m in enumerate(mouillages)
                        if i not in dans and m["type"] != "traversee"
                        and m["date_arrivee"]
                        and abs((date.fromisoformat(m["date_arrivee"]) - d).days) <= 3]
            cites = {c[0]: mots_cites(art["titre"], mouillages[c[0]]["nom"])
                     for c in candidats + voisines}
            nommees = [c for c in candidats + voisines if cites[c[0]][0]]
            if nommees:
                # le plus de mots cités, puis la plus grande part du nom,
                # puis une escale où l'on était ce jour-là, la plus précise
                i = min(nommees, key=lambda c: (-cites[c[0]][0], -cites[c[0]][1],
                                                c[0] not in dans, c[1]))[0]
            else:
                i = min(candidats, key=lambda c: c[1])[0]
            pour_mouillage[i].append(art)
        elif d >= date(2009, 5, 27):
            # article écrit dans un trou entre escales ou en mer (« Traversée
            # vers les Galapagos J3 ») : à l'escale que son titre nomme si
            # elle est toute proche (« San Blas - Repli stratégique »), sinon
            # à la destination
            proches = [(abs((date.fromisoformat(m["date_arrivee"]) - d).days), i)
                       for i, m in enumerate(mouillages)
                       if m["type"] != "traversee" and m["date_arrivee"]
                       and abs((date.fromisoformat(m["date_arrivee"]) - d).days) <= 10
                       and nomme_escale(art["titre"], m["nom"])]
            suivants = [i for i, m in enumerate(mouillages)
                        if m["date_arrivee"] and m["type"] != "traversee" and
                        date.fromisoformat(m["date_arrivee"]) >= d]
            cible = min(proches)[1] if proches else (suivants[0] if suivants else None)
            if cible is not None:
                # « écrit en mer » seulement quand c'est vrai : pendant une
                # traversée du log, ou quand le titre le dit
                if en_traversee(d) or MER.search(" ".join(mots(art["titre"]))):
                    art["en_mer"] = True
                pour_mouillage[cible].append(art)
            else:
                non_rattaches += 1

    # Photos dont l'original manque dans le miroir (404 sur laruel.be,
    # recensées au manifeste) : on les retire, et les blocs avec elles, pour
    # qu'aucun billet n'affiche un cadre vide ni ne déclenche de 404.
    def photos_presentes(a: dict) -> tuple[list, list]:
        garde: dict[int, int] = {}
        images = []
        for i, im in enumerate(a["images"]):
            if (ROOT / "content" / "site" / im["src"]).exists():
                garde[i] = len(images)
                images.append(im)
        blocs = [b if isinstance(b, str) else garde[b]
                 for b in a.get("blocs", []) if isinstance(b, str) or b in garde]
        return images, blocs

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
                # le billet dans son ordre : paragraphes (chaînes) et photos
                # (indices dans `images`), là où les parents les avaient mises
                "blocs": photos_presentes(a)[1],
                "images": photos_presentes(a)[0],
                **({"en_mer": True} if a.get("en_mer") else {}),
            } for a in arts],
        })
    # Une escale sans billet à elle est parfois évoquée dans un billet écrit
    # tout près (« … en la prestigieuse île d'Arcy. ») : on garde la phrase,
    # telle quelle, et le billet où la lire. Jamais un billet d'une autre
    # visite au même lieu (« Retour à Moorea », une semaine plus tard).
    for e in enrichis:
        if e["articles"] or e["type"] != "mouillage":
            continue
        propres = {m for m in mots(e["nom"]) if len(m) > 3 and m not in MOTS_GENERIQUES}
        if not propres:
            continue
        debut = date.fromisoformat(e["date_arrivee"])
        fin = date.fromisoformat(e["date_depart"]) if e["date_depart"] else debut
        evoque = []
        for autre in enrichis:
            if autre["nom"] == e["nom"]:
                continue
            for art in autre["articles"]:
                d = date.fromisoformat(art["date"])
                if not debut - timedelta(days=2) <= d <= fin + timedelta(days=7):
                    continue
                phrase = phrase_qui_cite(art["blocs"], propres)
                if phrase:
                    evoque.append({
                        "id": art["id"], "date": art["date"], "titre": art["titre"],
                        "escale": autre["nom"], "escale_arrivee": autre["date_arrivee"],
                        "phrase": phrase,
                    })
        if evoque:
            e["evoque"] = sorted(evoque, key=lambda x: x["date"])[:3]
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

    # la place de chaque photo, réservée dans le carnet avant son chargement
    from dimensions_photos import annote
    annote()


if __name__ == "__main__":
    main()
