#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extraction de la route du voilier depuis les tables de log des pages
/Voyages/*.html (« La ligne verte provient de notre logiciel de navigation »).

Chaque table contient Date / Lieu / Log (milles nautiques cumulés depuis la
Martinique, log 0 → ~24 500 nm). Le log cumulé fournit l'ordre global des
escales ; les années manquantes sont inférées par progression chronologique.

Sortie : content/route_log.json — escales ordonnées :
    { lieu, log_nm, date_arrivee, date_depart, source }
"""

import json
import re
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
VOY_DIR = ROOT / "content" / "site" / "Voyages"
OUT_PATH = ROOT / "content" / "route_log.json"

RE_JM = re.compile(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?")


def parse_jma(token: str, annee: int | None) -> date | None:
    m = RE_JM.search(token)
    if not m:
        return None
    j, mo, an = m.groups()
    if an:
        an = int(an)
        if an < 100:
            an += 2000
    elif annee:
        an = annee
    else:
        return None
    try:
        return date(an, int(mo), int(j))
    except ValueError:
        return None


def parse_periode(brut: str) -> tuple[str | None, str | None]:
    """« 8/7 au 23/7 », « 27/5 », « 24/7/09 au 12/8/09 » → (arrivée, départ).
    Les années absentes restent à résoudre (renvoyées brutes)."""
    morceaux = re.split(r"\s*(?:au|-|et)\s*", brut.strip())
    morceaux = [x for x in morceaux if RE_JM.search(x)]
    if not morceaux:
        return None, None
    return morceaux[0], morceaux[-1] if len(morceaux) > 1 else None


def extraire_tables() -> list[dict]:
    escales = []
    for path in sorted(VOY_DIR.glob("*.html")):
        if path.name == "voyindex.html":
            continue
        soup = BeautifulSoup(path.read_bytes().decode("iso-8859-1"), "lxml")
        for table in soup.find_all("table", class_="log"):
            for tr in table.find_all("tr"):
                cells = [re.sub(r"\s+", " ", td.get_text(" ")).strip()
                         for td in tr.find_all("td")]
                if len(cells) < 3 or cells[0].lower().startswith("date"):
                    continue
                date_brute, lieu, log_brut = cells[0], cells[1], cells[2]
                m = re.search(r"(\d[\d\s.,]*)", log_brut.replace("&nbsp;", " "))
                if not m or not lieu:
                    continue
                log_nm = int(re.sub(r"[^\d]", "", m.group(1)))
                arr, dep = parse_periode(date_brute)
                escales.append({
                    "lieu": lieu,
                    "log_nm": log_nm,
                    "date_brute": date_brute,
                    "_arr": arr,
                    "_dep": dep,
                    "source": path.name,
                })
    return escales


def resoudre_dates(escales: list[dict]) -> None:
    """Tri par log cumulé puis inférence des années par progression."""
    escales.sort(key=lambda e: e["log_nm"])
    courante = date(2009, 5, 1)  # le départ de Martinique est fin mai 2009
    for e in escales:
        for cle_brute, cle in (("_arr", "date_arrivee"), ("_dep", "date_depart")):
            brut = e.pop(cle_brute)
            if not brut:
                e[cle] = None
                continue
            d = parse_jma(brut, None)
            if d is None:
                # pas d'année explicite : même année que la date courante,
                # ou la suivante si le mois a « rebouclé »
                d = parse_jma(brut, courante.year)
                if d and d < courante:
                    d2 = parse_jma(brut, courante.year + 1)
                    # tolère un léger chevauchement de quelques jours dans
                    # les tables (escales secondaires antidatées)
                    if d2 and (courante - d).days > 45:
                        d = d2
            if d:
                courante = max(courante, d)
                e[cle] = d.isoformat()
            else:
                e[cle] = None


def main() -> None:
    escales = extraire_tables()
    resoudre_dates(escales)
    # à log égal (traversée + arrivée), l'ordre chronologique tranche
    escales.sort(key=lambda e: (e["log_nm"], e["date_arrivee"] or "9999"))
    OUT_PATH.write_text(json.dumps(escales, ensure_ascii=False, indent=1))
    print(f"{len(escales)} escales, log 0 → {max(e['log_nm'] for e in escales)} nm")
    for e in escales:
        print(f"{e['log_nm']:>6} nm  {e['date_arrivee'] or '????-??-??'}"
              f"{' → ' + e['date_depart'] if e['date_depart'] else '':<14}"
              f"  {e['lieu']}  [{e['source']}]")
    print(f"\nÉcrit : {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
