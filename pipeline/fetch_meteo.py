#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Précalcul de la météo réellement vécue le long de la route (PLAN étape 4).

Construit d'abord la trace quotidienne du voyage : aux mouillages, la position
du jour est celle de l'escale ; en traversée, les positions sont interpolées
en orthodromie entre le départ et l'arrivée. Puis interroge les API gratuites
Open-Meteo (réanalyse ERA5, archive-api) et Marine (vagues) en regroupant les
jours consécutifs au même point en une seule requête.

Sortie : content/meteo.json — un enregistrement par jour de voyage :
    { date, lat, lon, lieu, en_mer,
      vent_max_kmh, rafales_max_kmh, dir_vent_deg, temp_min_c, temp_max_c,
      nebulosite_pct, pluie_mm, vague_max_m, periode_vague_s }
"""

import json
import math
import time
from datetime import date, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
IN_PATH = ROOT / "content" / "mouillages.json"
OUT_PATH = ROOT / "content" / "meteo.json"

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
MARINE = "https://marine-api.open-meteo.com/v1/marine"
DAILY_VARS = ("wind_speed_10m_max,wind_gusts_10m_max,"
              "wind_direction_10m_dominant,temperature_2m_min,"
              "temperature_2m_max,cloud_cover_mean,precipitation_sum")
MARINE_VARS = "wave_height_max,wave_period_max"
DELAY = 0.12


def jiso(d: date) -> str:
    return d.isoformat()


def interpole_ortho(a: dict, b: dict, t: float) -> tuple[float, float]:
    """Point intermédiaire (fraction t) sur l'orthodromie a→b."""
    la1, lo1 = math.radians(a["lat"]), math.radians(a["lon"])
    la2, lo2 = math.radians(b["lat"]), math.radians(b["lon"])
    d = 2 * math.asin(math.sqrt(
        math.sin((la2 - la1) / 2) ** 2
        + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))
    if d == 0:
        return a["lat"], a["lon"]
    fa = math.sin((1 - t) * d) / math.sin(d)
    fb = math.sin(t * d) / math.sin(d)
    x = fa * math.cos(la1) * math.cos(lo1) + fb * math.cos(la2) * math.cos(lo2)
    y = fa * math.cos(la1) * math.sin(lo1) + fb * math.cos(la2) * math.sin(lo2)
    z = fa * math.sin(la1) + fb * math.sin(la2)
    return (math.degrees(math.atan2(z, math.hypot(x, y))),
            math.degrees(math.atan2(y, x)))


def trace_quotidienne(mouillages: list[dict]) -> list[dict]:
    """Une position par jour, du départ de Martinique à San Diego."""
    jours: dict[str, dict] = {}

    def pose(d: date, lat: float, lon: float, lieu: str, en_mer: bool) -> None:
        jours[jiso(d)] = {"date": jiso(d), "lat": round(lat, 3),
                          "lon": round(lon, 3), "lieu": lieu, "en_mer": en_mer}

    for i, m in enumerate(mouillages):
        arr = date.fromisoformat(m["date_arrivee"]) if m["date_arrivee"] else None
        dep = date.fromisoformat(m["date_depart"]) if m["date_depart"] else arr
        if arr is None:
            continue
        dep = dep or arr
        if m["type"] == "traversee" and i > 0 and (dep - arr).days > 1:
            # les dates d'une traversée couvrent le temps de mer :
            # interpolation du mouillage précédent vers le point d'arrivée
            prev = mouillages[i - 1]
            total = (dep - arr).days
            for k in range(total + 1):
                t = k / total
                lat, lon = interpole_ortho(prev, m, t)
                lieu = m["nom"] if k == total else f"En mer ({m['nom']})"
                pose(arr + timedelta(days=k), lat, lon, lieu, k < total)
        else:
            d = arr
            while d <= dep:
                pose(d, m["lat"], m["lon"], m["nom"], False)
                d += timedelta(days=1)
        # trou jusqu'à l'escale suivante : courte durée = jours en mer ;
        # longue durée = le bateau n'a pas bougé (famille à terre, hivernage
        # à Whangarei pendant les voyages en NZ/Australie)
        if i + 1 < len(mouillages):
            n = mouillages[i + 1]
            narr = (date.fromisoformat(n["date_arrivee"])
                    if n["date_arrivee"] else None)
            if narr and (narr - dep).days > 1:
                total = (narr - dep).days
                for k in range(1, total):
                    if total <= 30 and n["type"] != "traversee":
                        t = k / total
                        lat, lon = interpole_ortho(m, n, t)
                        pose(dep + timedelta(days=k), lat, lon,
                             f"En mer ({m['nom']} → {n['nom']})", True)
                    elif total > 30:
                        pose(dep + timedelta(days=k), m["lat"], m["lon"],
                             m["nom"], False)
    return [jours[k] for k in sorted(jours)]


def groupes_consecutifs(trace: list[dict]):
    """Regroupe les jours consécutifs à la même position (une requête API)."""
    groupe = [trace[0]]
    for rec in trace[1:]:
        same = (rec["lat"], rec["lon"]) == (groupe[-1]["lat"], groupe[-1]["lon"])
        consecutif = (date.fromisoformat(rec["date"])
                      - date.fromisoformat(groupe[-1]["date"])).days == 1
        if same and consecutif:
            groupe.append(rec)
        else:
            yield groupe
            groupe = [rec]
    yield groupe


def fetch_groupe(session: requests.Session, groupe: list[dict]) -> None:
    lat, lon = groupe[0]["lat"], groupe[0]["lon"]
    d1, d2 = groupe[0]["date"], groupe[-1]["date"]
    for url, vars_, prefixe in ((ARCHIVE, DAILY_VARS, ""),
                                (MARINE, MARINE_VARS, "")):
        for attempt in range(4):
            time.sleep(DELAY * (1 + attempt * 3))
            try:
                r = session.get(url, params={
                    "latitude": lat, "longitude": lon,
                    "start_date": d1, "end_date": d2, "daily": vars_,
                }, timeout=30)
                if r.status_code == 429:
                    time.sleep(5)
                    continue
                r.raise_for_status()
                daily = r.json().get("daily", {})
                break
            except requests.RequestException:
                daily = {}
        cles = {
            "wind_speed_10m_max": "vent_max_kmh",
            "wind_gusts_10m_max": "rafales_max_kmh",
            "wind_direction_10m_dominant": "dir_vent_deg",
            "temperature_2m_min": "temp_min_c",
            "temperature_2m_max": "temp_max_c",
            "cloud_cover_mean": "nebulosite_pct",
            "precipitation_sum": "pluie_mm",
            "wave_height_max": "vague_max_m",
            "wave_period_max": "periode_vague_s",
        }
        dates_api = daily.get("time", [])
        index = {d: i for i, d in enumerate(dates_api)}
        for rec in groupe:
            i = index.get(rec["date"])
            for api_k, k in cles.items():
                if api_k in daily and i is not None:
                    v = daily[api_k][i]
                    rec[k] = round(v, 1) if isinstance(v, float) else v


def main() -> None:
    mouillages = json.loads(IN_PATH.read_text())
    trace = trace_quotidienne(mouillages)
    print(f"Trace quotidienne : {len(trace)} jours "
          f"({trace[0]['date']} → {trace[-1]['date']})")

    # reprise : récupère les jours déjà renseignés d'une exécution précédente
    if OUT_PATH.exists():
        deja = {r["date"]: r for r in json.loads(OUT_PATH.read_text())
                if r.get("vent_max_kmh") is not None}
        for rec in trace:
            if rec["date"] in deja and deja[rec["date"]]["lat"] == rec["lat"]:
                rec.update(deja[rec["date"]])
        print(f"  reprise : {len(deja)} jours déjà renseignés")

    groupes = list(groupes_consecutifs(trace))
    print(f"{len(groupes)} requêtes de groupe (×2 API)")
    session = requests.Session()
    for i, g in enumerate(groupes):
        if all(r.get("vent_max_kmh") is not None for r in g):
            continue  # déjà renseigné (les vagues sont best-effort : points
            # côtiers/terrestres hors de la grille du modèle de vagues)
        fetch_groupe(session, g)
        if (i + 1) % 25 == 0:
            print(f"  …{i + 1}/{len(groupes)}", flush=True)
            OUT_PATH.write_text(json.dumps(trace, ensure_ascii=False, indent=1))

    OUT_PATH.write_text(json.dumps(trace, ensure_ascii=False, indent=1))
    avec_vent = sum(1 for r in trace if r.get("vent_max_kmh") is not None)
    avec_vague = sum(1 for r in trace if r.get("vague_max_m") is not None)
    print(f"Météo : {avec_vent}/{len(trace)} jours avec vent, "
          f"{avec_vague} avec vagues → {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
