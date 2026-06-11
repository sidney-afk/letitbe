#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Géocodage des escales de route_log.json → content/mouillages.json.

Beaucoup d'escales sont des mouillages minuscules (baies fidjiennes, Inside
Passage canadien) inconnus des géocodeurs : les coordonnées sont donc fournies
par une table curatée (précision ~quelques km, suffisante à l'échelle du
globe), validée par deux contrôles :
  1. cross-check Open-Meteo Geocoding pour les lieux connus (écart < 30 km) ;
  2. cohérence distance orthodromique vs Δlog du bord entre escales
     consécutives (l'orthodromie doit être ≤ distance loguée, et pas
     ridiculement plus courte sur les petites étapes).

Les traversées (type « traversee ») portent les coordonnées de leur point
d'arrivée ; la polyline du globe les interpolera en orthodromie.
"""

import json
import math
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
IN_PATH = ROOT / "content" / "route_log.json"
OUT_PATH = ROOT / "content" / "mouillages.json"

# ---------------------------------------------------------------------------
# Table curatée : nom d'escale (tel que dans les tables de log) → (lat, lon).
# Le mouillage précis est choisi d'après le récit du blog quand il est connu
# (ex. Martinique = Le Marin, base de location ; Gambier = Rikitea).
# ---------------------------------------------------------------------------
COORDS: dict[str, tuple[float, float]] = {
    # Caraïbes 2009
    "Martinique": (14.467, -60.871),            # Le Marin
    "Ste Lucie": (14.075, -60.950),             # Rodney Bay
    "Los Roques": (11.950, -66.670),
    "Los Aves": (11.952, -67.435),              # Aves de Barlovento
    "Aruba": (12.516, -70.041),                 # Oranjestad
    "San Blas": (9.554, -78.947),               # Chichime / El Porvenir
    "Panama": (9.368, -79.950),                 # Colón / Shelter Bay
    "Canal de Panama": (9.120, -79.720),
    "Balboa (l'oeil du tigre)": (8.940, -79.560),
    "Las Perlas": (8.625, -79.034),             # Contadora
    "Galapagos": (-0.748, -90.312),             # Puerto Ayora, Santa Cruz
    # Pacifique 2009-2010
    "Transpacifique": (-23.121, -134.969),      # arrivée Rikitea (Gambier)
    "Gambier": (-23.121, -134.969),             # Rikitea
    "Marquises - Fatu Hiva": (-10.465, -138.668),   # baie de Hanavave
    "Marquises - Tahuata": (-9.905, -139.105),      # Hana Moe Noa
    "Marquises - Hiva Oa": (-9.804, -139.032),      # Atuona
    "Marquises - Nuku Hiva": (-8.918, -140.096),    # Taiohae
    "Marquises - Ua Pou": (-9.352, -140.039),       # Hakahau
    "Marquises - Ua HUka": (-8.934, -139.554),
    "Tuamotu - Kauehi": (-15.849, -145.121),
    "Tuamotu - Fakarava": (-16.061, -145.621),      # Rotoava
    "Tuamotu - Faaite": (-16.687, -145.249),
    "Tuamotu - Toau": (-15.917, -146.002),
    "Tuamotu - Rangiroa": (-14.967, -147.635),      # Tiputa
    "Tuamotu - Tikehau": (-15.119, -148.224),
    "Tahiti": (-17.532, -149.570),              # Papeete
    "Moorea": (-17.490, -149.851),              # baie d'Opunohu
    "Huahine": (-16.718, -151.041),             # Fare
    "Raiatea et Tahaa": (-16.780, -151.440),
    "Raiatea": (-16.780, -151.440),
    "Bora Bora": (-16.500, -151.741),
    "Maupihaa": (-16.820, -153.955),            # Mopelia
    "Cook du sud - Aitutaki": (-18.853, -159.789),
    "Cook du sud - Rarotonga": (-21.203, -159.783),  # Avatiu
    "Beveridge Reef": (-20.000, -167.780),
    "Niue": (-19.052, -169.920),                # Alofi
    "Tonga - Neiafu": (-18.650, -173.983),
    # Fidji 2010
    "Fidji - Savusavu": (-16.779, 179.331),
    "Fidji - Makogai": (-17.434, 178.961),
    "Fidji - Naigani": (-17.583, 178.672),
    "Fidji - Nananu": (-17.305, 178.218),       # Nananu-i-Ra
    "Fidji - Natunuku": (-17.470, 177.935),
    "Fidji - Nadi": (-17.771, 177.382),         # Denarau
    "Fidji - Malakati": (-16.918, 177.383),     # Nacula, Yasawa
    "Fidji - Sawa-I-Lau": (-16.848, 177.473),
    "Fidji - Yasawairara": (-16.712, 177.572),
    "Fidji - Blue Lagoon": (-16.940, 177.368),  # Nanuya Lailai
    "Fidji - Likuliku": (-17.290, 177.140),     # baie de Likuliku, Waya (Yasawa)
    "Fidji - Vanua Lailai": (-17.400, 177.130), # îlot près de Kuata/Wayasewa
    "Fidji - Mana": (-17.672, 177.098),
    "Fidji - Cuvu": (-18.163, 177.387),         # Coral Coast
    "Fidji - Naboutini": (-18.205, 177.660),
    "Fidji - Namalata": (-19.053, 178.157),     # Kadavu, près de Vunisea
    "Fidji - Gasele": (-19.117, 177.983),       # Kadavu sud
    "Fidji - Kavala Bay": (-18.998, 178.420),   # Kadavu est
    "Fidji - Vuro Island": (-18.930, 178.480),  # Ono, Grand récif Astrolabe
    "Fidji - Korolevu Bay": (-18.900, 178.470), # Ono
    "Fidji - Matasawalevu": (-18.880, 178.500), # Ono
    "Fidji - Naqara Bay": (-18.870, 178.480),   # Ono
    "Fidji - Dravuni": (-18.752, 178.521),
    "Fidji - Suva": (-18.130, 178.425),
    # Nouvelle-Zélande 2010-2012
    "Fidji vers Nlle Zélande": (-35.310, 174.121),  # arrivée Opua
    "Nlle Zélande - Opua": (-35.310, 174.121),
    "Nlle Zélande - Whangarei": (-35.725, 174.323),
    "Transpacifique retour": (-23.121, -134.969),   # Opua → Rikitea (Gambier)
    # Polynésie 2012-2013
    "Fakarava": (-16.501, -145.466),            # passe sud, 2012
    "Tahanea": (-16.852, -144.772),
    "Makemo": (-16.626, -143.566),
    "Hiva Oa": (-9.804, -139.032),
    "Tahuata": (-9.905, -139.105),
    "Ua Pou": (-9.352, -140.039),
    "Nuku Hiva": (-8.918, -140.096),
    # Hawaii 2013
    "Nuku Hiva - Hilo": (19.730, -155.066),     # arrivée Hilo
    "Hilo - Big Island": (19.730, -155.066),    # Radio Bay
    "Lahaina - Maui": (20.872, -156.678),
    "Honokahua - Maui": (21.005, -156.660),
    "Puko'o - Molokai": (21.070, -156.800),
    "Ilio Point - Molokai": (21.220, -157.250),
    "Honolulu - Oahu": (21.290, -157.847),      # Ala Wai
    # Colombie-Britannique 2013 (Inside Passage vers le sud)
    "Honolulu (Hawaii) - Prince Rupert (Canada)": (54.317, -130.324),
    "Prince Rupert": (54.317, -130.324),
    "Gunboat Harbour": (53.855, -130.105),
    "Grenville Channel": (53.555, -129.577),    # Lowe Inlet
    "Coghlan Anchorage": (53.390, -129.320),    # près de Hartley Bay
    "Green Spit": (52.950, -128.520),           # Princess Royal Channel
    "Work Bay": (52.600, -128.400),             # Finlayson Channel
    "Unnamed Bay": (52.230, -128.130),
    "Beales Bay": (52.050, -128.020),
    "Fougner Bay": (51.851, -127.870),          # Fitz Hugh Sound
    "Millbrook Cove": (51.310, -127.690),       # Smith Sound
    "Blunden Harbour": (50.905, -127.290),
    "Port Mc Neil": (50.592, -127.088),
    "Port Harvey": (50.563, -126.270),
    "Crawford Anchorage": (50.435, -125.420),   # Cordero Channel
    "Squirel Cove": (50.130, -124.920),         # Cortes Island
    "Cochrane Island": (50.050, -124.730),      # Desolation Sound
    "Nelson Island": (49.720, -124.200),
    "Jedediah Island": (49.500, -124.200),
    "Dolphin Beach": (49.270, -124.130),        # Nanoose Bay
    "Vancouver": (49.290, -123.120),            # False Creek
    "Kendrick Island": (49.130, -123.690),
    "Thetis Island": (48.980, -123.660),
    "Montague Harbour": (48.890, -123.390),
    "Bedwell Harbour": (48.750, -123.230),
    "Sidney": (48.650, -123.390),               # Sidney, BC
    "D'Arcy Island": (48.570, -123.280),
    "Chatham Islands": (48.430, -123.250),      # Oak Bay, Victoria
    "Victoria": (48.424, -123.370),
    # Côte ouest US 2013
    "Port Angeles": (48.125, -123.430),
    "Neah Bay": (48.368, -124.617),
    "Neah Bay to San Francisco": (37.810, -122.442),
    "San Francisco": (37.810, -122.442),        # Aquatic Park / Sausalito
    "San Miguel Island": (34.052, -120.351),    # Cuyler Harbor
    "Santa Cruz Island": (34.020, -119.683),
    "Santa Barbara Island": (33.475, -119.030),
    "Catalina Island": (33.444, -118.498),      # Two Harbors
    "San Diego": (32.720, -117.230),
}

TRAVERSEES = {
    "Transpacifique", "Transpacifique retour", "Fidji vers Nlle Zélande",
    "Nuku Hiva - Hilo", "Honolulu (Hawaii) - Prince Rupert (Canada)",
    "Neah Bay to San Francisco", "Canal de Panama",
}

# chapitres du récit (cf. PLAN.md), par page source
CHAPITRES = {
    "trajetcar.html": "Les Caraïbes",
    "trajetgal.html": "Vers le Pacifique",
    "trajetpac.html": "Le Grand Pacifique",
    "gambier.html": "Le Grand Pacifique",
    "marquises.html": "Le Grand Pacifique",
    "trajetpol.html": "Le Grand Pacifique",
    "trajetcook.html": "Le Grand Pacifique",
    "trajettonga.html": "Le Grand Pacifique",
    "trajetfidji.html": "Le Grand Pacifique",
    "trajetNZ.html": "La Nouvelle-Zélande",
    "trajetpol2012.html": "Le retour en Polynésie",
    "trajethawaii.html": "La remontée vers le nord",
    "trajethawbc.html": "La remontée vers le nord",
    "trajetcanada.html": "Le grand nord",
    "trajetusa.html": "La côte américaine",
}


def haversine_nm(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * 3440.065 * math.asin(math.sqrt(h))


def cross_check(mouillages: list[dict]) -> None:
    """Vérifie la table curatée contre Open-Meteo Geocoding (lieux connus)."""
    verifiables = {
        "Aruba": "Oranjestad", "Galapagos": "Puerto Ayora",
        "Fidji - Savusavu": "Savusavu", "Fidji - Suva": "Suva",
        "Tonga - Neiafu": "Neiafu", "Niue": "Alofi",
        "Nlle Zélande - Opua": "Opua", "Nlle Zélande - Whangarei": "Whangarei",
        "Tahiti": "Papeete", "Bora Bora": "Bora-Bora",
        "Prince Rupert": "Prince Rupert", "Vancouver": "Vancouver",
        "Victoria": "Victoria", "Port Angeles": "Port Angeles",
        "Neah Bay": "Neah Bay", "San Francisco": "San Francisco",
        "San Diego": "San Diego", "Honolulu - Oahu": "Honolulu",
        "Lahaina - Maui": "Lahaina", "Ste Lucie": "Gros Islet",
    }
    print("\nCross-check Open-Meteo (écart admis < 30 km) :")
    for nom, requete in verifiables.items():
        if nom not in COORDS:
            continue
        time.sleep(0.15)
        try:
            r = requests.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": requete, "count": 1}, timeout=15).json()
            res = r.get("results")
        except requests.RequestException as exc:
            print(f"  ?  {nom}: API indisponible ({exc})")
            continue
        if not res:
            print(f"  ?  {nom}: « {requete} » introuvable")
            continue
        d = haversine_nm(COORDS[nom], (res[0]["latitude"], res[0]["longitude"]))
        flag = "OK" if d * 1.852 < 30 else "ÉCART"
        print(f"  {flag:>5}  {nom:<28} {d * 1.852:6.1f} km")


def controle_distances(mouillages: list[dict]) -> None:
    """Orthodromie vs Δlog : signale les géocodages incohérents."""
    print("\nContrôle distance orthodromique vs log du bord :")
    soucis = 0
    for prev, cur in zip(mouillages, mouillages[1:]):
        dlog = cur["log_nm"] - prev["log_nm"]
        if dlog <= 0:
            continue
        ortho = haversine_nm((prev["lat"], prev["lon"]), (cur["lat"], cur["lon"]))
        # l'orthodromie doit être ≤ distance loguée (côtes, zigzags) ;
        # tolérance 25 % pour les arrondis de log et mouillages approchés
        if ortho > dlog * 1.25 + 12:
            print(f"  SUSPECT {prev['nom']} → {cur['nom']}: "
                  f"ortho {ortho:.0f} nm > log {dlog} nm")
            soucis += 1
    print(f"  {soucis} segment(s) suspect(s)" if soucis else "  tout est cohérent")


def main() -> None:
    escales = json.loads(IN_PATH.read_text())
    mouillages = []
    manquants = []
    for e in escales:
        nom = e["lieu"]
        if nom not in COORDS:
            manquants.append(nom)
            continue
        lat, lon = COORDS[nom]
        mouillages.append({
            "nom": nom,
            "lat": lat,
            "lon": lon,
            "log_nm": e["log_nm"],
            "date_arrivee": e["date_arrivee"],
            "date_depart": e["date_depart"],
            "type": "traversee" if nom in TRAVERSEES else "mouillage",
            "chapitre": CHAPITRES.get(e["source"], ""),
            "source": e["source"],
        })
    if manquants:
        print("ESCALES SANS COORDONNÉES :", *manquants, sep="\n  ")
        sys.exit(1)

    OUT_PATH.write_text(json.dumps(mouillages, ensure_ascii=False, indent=1))
    print(f"{len(mouillages)} mouillages géocodés → {OUT_PATH.relative_to(ROOT)}")

    controle_distances(mouillages)
    if "--check" in sys.argv:
        cross_check(mouillages)


if __name__ == "__main__":
    main()
