#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Crawler de laruel.be pour le projet « Le Sillage ».

Le site est un assemblage artisanal de pages HTML 4 (ISO-8859-1) reliées par
des iframes et des onclick JavaScript (ChangeSrc('...')). Le blog WordPress
/blogactu/ est cassé côté serveur (HTTP 500, PHP 8 incompatible) mais son
contenu intégral existe en statique dans /Actu/actuNN.html.

Usage :
    python3 pipeline/crawl.py pages    # crawl récursif des pages (html/php/css/js)
    python3 pipeline/crawl.py assets   # téléchargement des images/médias découverts
    python3 pipeline/crawl.py report   # statistiques du manifeste

Sortie :
    content/site/<chemin>   — miroir fidèle (octets bruts, encodage préservé)
    content/manifest.json   — url -> {path, status, type, size, sha1}
"""

import hashlib
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote

import requests

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "content" / "site"
MANIFEST_PATH = ROOT / "content" / "manifest.json"

BASE = "https://www.laruel.be/"
HOSTS = {"www.laruel.be", "laruel.be"}
DELAY = 0.1  # politesse : ~10 req/s max sur ce petit Apache personnel
TIMEOUT = 30

SEEDS = [
    "indexLIB.html",
    "index.html",
    "tabs.html",
    "Home/home.html",
    "Home/homindex.php",
    "album/albindex.html",
    "Navigation/navindex.html",
    "People/balindex.html",
    "Voyages/voyindex.html",
    "Sponsors/map.html",
    "Actu/actu.html",
] + [f"Actu/actu{n:02d}.html" for n in range(1, 19)]

PAGE_EXTS = {".html", ".htm", ".php", ".css", ".js"}
ASSET_EXTS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".pdf", ".kml", ".kmz", ".gpx", ".zip",
    ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mp3", ".wav",
}

# href/src classiques + URLs dans le JavaScript inline (ChangeSrc, window.open…)
# + url() des CSS. On ratisse large puis on filtre par extension/hôte.
URL_PATTERNS = [
    re.compile(r"""(?:href|src|background)\s*=\s*["']([^"'<>]+)["']""", re.I),
    re.compile(r"""(?:href|src)\s*=\s*([^"'\s<>]+)""", re.I),
    re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", re.I),
    re.compile(r"""['"]([^'"<>]+\.(?:html?|php|jpe?g|png|gif|css|js|pdf|km[lz]|gpx|mp4|avi|mov|wmv|ico)(?:\?[^'"<>]*)?)['"]""", re.I),
]

SKIP_SUBSTRINGS = [
    "google-analytics.com",
    "blogactu",  # WordPress HS (HTTP 500) — contenu repris dans /Actu/
]


def normalize(url: str) -> str | None:
    """Résout et filtre une URL ; renvoie l'URL absolue https ou None."""
    url = url.strip()
    if not url or url.startswith(("mailto:", "javascript:", "#", "data:")):
        return None
    parts = urlsplit(url)
    if parts.scheme not in ("", "http", "https"):
        return None
    if parts.netloc and parts.netloc.lower() not in HOSTS:
        return None
    absolute = urljoin(BASE, url)
    parts = urlsplit(absolute)
    if parts.netloc.lower() not in HOSTS:
        return None
    path = re.sub(r"/{2,}", "/", parts.path) or "/"
    # normalise les /../ restés littéraux
    while "/../" in path:
        path = re.sub(r"/[^/]+/\.\./", "/", path, count=1)
    norm = "https://www.laruel.be" + path
    if parts.query:
        norm += "?" + parts.query
    lowered = norm.lower()
    if any(s in lowered for s in SKIP_SUBSTRINGS):
        return None
    return norm


def classify(url: str) -> str:
    path = urlsplit(url).path
    ext = Path(unquote(path)).suffix.lower()
    if ext in PAGE_EXTS or ext == "":
        return "page"
    if ext in ASSET_EXTS:
        return "asset"
    return "other"


def local_path(url: str) -> Path:
    parts = urlsplit(url)
    rel = unquote(parts.path).lstrip("/") or "index.html"
    if rel.endswith("/"):
        rel += "index.html"
    if parts.query:
        safe = re.sub(r"[^A-Za-z0-9=._-]", "_", parts.query)
        rel += "__" + safe
    return SITE_DIR / rel


def extract_links(content: bytes, page_url: str) -> set[str]:
    try:
        text = content.decode("iso-8859-1")
    except UnicodeDecodeError:
        return set()
    found: set[str] = set()
    for pattern in URL_PATTERNS:
        for match in pattern.findall(text):
            resolved = urljoin(page_url, match.strip())
            norm = normalize(resolved)
            if norm:
                found.add(norm)
    return found


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {}


def save_manifest(manifest: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=1, sort_keys=True, ensure_ascii=False))


def fetch(session: requests.Session, url: str) -> tuple[int, bytes, str]:
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=TIMEOUT)
            return resp.status_code, resp.content, resp.headers.get("content-type", "")
        except requests.RequestException as exc:
            if attempt == 2:
                print(f"  !! {url}: {exc}", flush=True)
                return 0, b"", ""
            time.sleep(2 ** attempt)
    return 0, b"", ""


def crawl_pages() -> None:
    manifest = load_manifest()
    session = requests.Session()
    session.headers["User-Agent"] = "LeSillage-archiveur-familial/1.0 (+sidney.laruel@gmail.com)"

    queue = [normalize(BASE + s) for s in SEEDS]
    queue = [u for u in queue if u]
    seen = set(queue)
    pages = assets = 0

    while queue:
        url = queue.pop(0)
        entry = manifest.get(url)
        kind = classify(url)
        if kind == "asset":
            continue  # phase « assets »
        path = local_path(url)
        if entry and entry.get("status") == 200 and path.exists():
            content = path.read_bytes()
            status = 200
        else:
            time.sleep(DELAY)
            status, content, ctype = fetch(session, url)
            manifest[url] = {
                "path": str(path.relative_to(ROOT)),
                "status": status,
                "type": kind,
                "size": len(content),
            }
            if status == 200:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
                manifest[url]["sha1"] = hashlib.sha1(content).hexdigest()
            print(f"{status} {len(content):>8} {url}", flush=True)
        if status != 200:
            continue
        pages += 1
        for link in sorted(extract_links(content, url)):
            if link in seen:
                continue
            seen.add(link)
            link_kind = classify(link)
            if link_kind == "page":
                queue.append(link)
            elif link_kind == "asset":
                manifest.setdefault(link, {
                    "path": str(local_path(link).relative_to(ROOT)),
                    "status": None,
                    "type": "asset",
                    "size": 0,
                })
                assets += 1
        if pages % 25 == 0:
            save_manifest(manifest)

    save_manifest(manifest)
    pending = sum(1 for e in manifest.values() if e["type"] == "asset" and e["status"] is None)
    print(f"\nPages crawlées : {pages} ; assets découverts (à télécharger) : {pending}")


def crawl_assets() -> None:
    manifest = load_manifest()
    session = requests.Session()
    session.headers["User-Agent"] = "LeSillage-archiveur-familial/1.0 (+sidney.laruel@gmail.com)"

    todo = [u for u, e in manifest.items()
            if e["type"] == "asset" and (e["status"] is None or (e["status"] == 0))]
    print(f"Assets à télécharger : {len(todo)}")

    from concurrent.futures import ThreadPoolExecutor

    def one(url: str) -> None:
        path = local_path(url)
        if path.exists() and path.stat().st_size > 0:
            manifest[url].update(status=200, size=path.stat().st_size)
            return
        time.sleep(DELAY)
        status, content, _ = fetch(session, url)
        manifest[url].update(status=status, size=len(content))
        if status == 200:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            manifest[url]["sha1"] = hashlib.sha1(content).hexdigest()

    done = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        for _ in pool.map(one, sorted(todo)):
            done += 1
            if done % 200 == 0:
                save_manifest(manifest)
                print(f"  …{done}/{len(todo)}", flush=True)
    save_manifest(manifest)
    ok = sum(1 for e in manifest.values() if e["type"] == "asset" and e["status"] == 200)
    ko = sum(1 for e in manifest.values() if e["type"] == "asset" and e["status"] not in (200, None))
    print(f"Assets OK : {ok} ; en erreur : {ko}")


def report() -> None:
    manifest = load_manifest()
    by = {}
    for url, e in manifest.items():
        key = (e["type"], e["status"])
        by.setdefault(key, [0, 0])
        by[key][0] += 1
        by[key][1] += e.get("size", 0) or 0
    for (kind, status), (count, size) in sorted(by.items(), key=str):
        print(f"{kind:6} {str(status):>5} : {count:5} fichiers, {size/1e6:8.1f} Mo")
    errors = [u for u, e in manifest.items() if e["status"] not in (200, None)]
    if errors:
        print(f"\n{len(errors)} URL en erreur :")
        for u in sorted(errors)[:40]:
            print(f"  {manifest[u]['status']} {u}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "pages"
    {"pages": crawl_pages, "assets": crawl_assets, "report": report}[cmd]()
