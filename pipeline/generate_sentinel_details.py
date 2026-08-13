#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepare real, surface-bound Sentinel detail imagery for Le Sillage stops.

This is deliberately a *pipeline*, not a browser-time map-tile dependency.  It
queries the public Element 84 STAC catalogue for Copernicus Sentinel-2 L2A
scenes, reads the public COG RGB bands, and makes static WebP crops that can be
served by GitHub Pages.  The browser still owns the final texture mapping.

Safety model
============

* With no flags this command only prints a coverage plan.  It makes no network
  request and writes nothing.
* ``--only`` is a read-only pilot by default: it queries and evaluates a scene,
  but still writes nothing.  Add ``--write`` to persist a reviewed pilot.
  For a non-site proof asset, combine that with ``--artifact-output``; it may
  write only beneath ``artifacts/`` and marks its manifest preview-only.
* A broad write requires an explicit ``--all --write``.  It never rewrites the
  hand-curated ``data/vues_aeriennes.json``; it writes a separate generated
  overlay manifest for a later, reviewable merge.
* Each coordinate tries the requested widest crop and then a small, fixed
  sequence of narrower windows (46, 30, 24, and 20 km by default).  It keeps
  the widest clean result, but may shrink past a Sentinel tile edge rather
  than publishing a rectangular no-data artefact.
* Every bounded candidate is first probed over the actual requested crop.  A
  crop is rejected if its COG data are missing or its Sentinel scene-
  classification layer contains too much cloud.  The cleanest local candidates
  are then rendered at full size and ranked again before one is written.  That
  prevents the dark / rectangular no-data failures that prompted this
  replacement without assuming that a scene's global cloud percentage says
  anything useful about one small island.

Licensing and provenance
========================

Every generated entry records the exact Sentinel scene, scene timestamp,
global cloud cover, source endpoint, and the mandatory "Contains modified
Copernicus Sentinel data" notice.  ``--write`` also creates a separate
attribution text file next to the generated assets.  The code intentionally
does not fetch or redistribute commercial map tiles.

Required Python packages for a probing or write run:

    requests pillow numpy rasterio

The repository's normal site build does not need these packages.  In this
Codex workspace, the bundled rasterio package can be supplied with:

    $env:PYTHONPATH = 'C:\\Users\\Sidney\\CACHE\\Temp\\letitbe-rasterio'

Examples
========

    # Safe candidate evaluation, no files changed.
    python pipeline/generate_sentinel_details.py --only "Galapagos|2009-07-08"

    # Persist one reviewed pilot and a separate overlay manifest.
    python pipeline/generate_sentinel_details.py --only "Galapagos|2009-07-08" --write

    # Generate every non-curated stop only after pilot review.
    python pipeline/generate_sentinel_details.py --all --write
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import requests
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
MOUILLAGES_PATH = ROOT / "data" / "mouillages.json"
EXISTING_MANIFEST_PATH = ROOT / "data" / "vues_aeriennes.json"
DEFAULT_OUTPUT_DIR = ROOT / "site" / "public" / "media" / "aerien-detail" / "sentinel"
DEFAULT_MANIFEST_PATH = ROOT / "data" / "vues_aeriennes_sentinel.generated.json"
DEFAULT_ATTRIBUTION_PATH = DEFAULT_OUTPUT_DIR / "ATTRIBUTION-SENTINEL-GENERATED.txt"

STAC_ENDPOINT = "https://earth-search.aws.element84.com/v1/search"
STAC_COLLECTION = "sentinel-2-l2a"
SENTINEL_NOTICE_URL = "https://cds.climate.copernicus.eu/licences/ec-sentinel"
SENTINEL_NOTICE = "Contains modified Copernicus Sentinel data"
EARTH_RADIUS_M = 6_378_137.0
DEFAULT_ADAPTIVE_GROUND_SPANS_KM = (46.0, 30.0, 24.0, 20.0)


@dataclass(frozen=True)
class Stop:
    """One selectable anchorage, represented exactly as its site manifest key."""

    key: str
    name: str
    date: str
    lat: float
    lon: float
    index: int


@dataclass(frozen=True)
class Bounds:
    """A square Web-Mercator crop plus the equivalent manifest coordinates."""

    left: float
    bottom: float
    right: float
    top: float
    lon_min: float
    lon_max: float
    lat_min: float
    lat_max: float


@dataclass(frozen=True)
class CandidateSelection:
    """One accepted scene rendered at the requested output resolution."""

    feature: dict[str, Any]
    image: np.ndarray
    stats: dict[str, float]


@dataclass(frozen=True)
class AdaptiveSelection:
    """The widest clean crop chosen for a physical-coordinate group."""

    ground_span_km: float
    bounds: Bounds
    candidate: CandidateSelection


class CandidateRejected(RuntimeError):
    """A real Sentinel scene exists, but is not clean enough to publish."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create quality-gated Copernicus Sentinel detail crops for Le Sillage.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    scope = parser.add_argument_group("scope")
    scope.add_argument(
        "--only",
        action="append",
        metavar="STOP",
        help="exact 'name|date' key or a unique case-insensitive name fragment; repeatable",
    )
    scope.add_argument(
        "--all",
        action="store_true",
        help="probe every selectable stop (required for a broad --write)",
    )
    scope.add_argument(
        "--replace-existing",
        action="store_true",
        help="include entries already marked detailPlongee (normally preserved as curated)",
    )

    render = parser.add_argument_group("rendering")
    render.add_argument(
        "--ground-span-km",
        type=float,
        default=46.0,
        help=(
            "widest ground width of each square crop; if it fails the quality gate, "
            "the pipeline tries narrower safe spans down to 20 km"
        ),
    )
    render.add_argument(
        "--size",
        type=int,
        default=2048,
        help="square output size in pixels",
    )
    render.add_argument(
        "--quality",
        type=int,
        default=90,
        help="lossy WebP quality (the source is not artificially recoloured)",
    )
    render.add_argument(
        "--exposure",
        type=float,
        default=1.0,
        help="neutral linear exposure before standard sRGB encoding",
    )

    scenes = parser.add_argument_group("scene selection and quality gates")
    scenes.add_argument("--start", default="2024-01-01", help="earliest scene date (UTC)")
    scenes.add_argument(
        "--end",
        default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        help="latest scene date (UTC)",
    )
    scenes.add_argument(
        "--max-scene-cloud-cover",
        type=float,
        default=35.0,
        help="global STAC cloud-cover threshold used only to seed the local-quality candidate pool",
    )
    scenes.add_argument(
        "--candidate-count",
        type=int,
        default=10,
        help="maximum STAC scenes locally probed per physical coordinate",
    )
    scenes.add_argument(
        "--max-items-per-search",
        type=int,
        default=100,
        help="STAC page size before local quality ranking; may exceed --candidate-count",
    )
    scenes.add_argument(
        "--quality-probe-size",
        type=int,
        default=384,
        help="square pixel size for bounded local candidate-quality probes",
    )
    scenes.add_argument(
        "--finalist-count",
        type=int,
        default=3,
        help="clean local candidates re-rendered at full output size before final ranking",
    )
    scenes.add_argument(
        "--max-cloud-fraction",
        type=float,
        default=0.02,
        help="maximum crop fraction classified as cloud/cirrus by Sentinel SCL; fail closed rather than publish visible cloud",
    )
    scenes.add_argument(
        "--max-nodata-fraction",
        type=float,
        default=0.001,
        help="maximum crop fraction without valid RGB data (prevents no-data rectangles)",
    )
    scenes.add_argument(
        "--http-timeout-seconds",
        type=int,
        default=30,
        help="GDAL HTTP request timeout for a COG range read",
    )
    scenes.add_argument(
        "--read-block-size",
        type=int,
        default=256,
        help="output tile size used for bounded COG range reads",
    )

    output = parser.add_argument_group("output")
    output.add_argument(
        "--write",
        action="store_true",
        help="write accepted WebP crops plus a separate generated manifest",
    )
    output.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="asset directory, relative to the repository unless absolute",
    )
    output.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST_PATH,
        help="new overlay manifest; the existing application manifest is never rewritten",
    )
    output.add_argument(
        "--attribution",
        type=Path,
        default=DEFAULT_ATTRIBUTION_PATH,
        help="new generated-attribution file, written only with --write",
    )
    output.add_argument(
        "--overwrite",
        action="store_true",
        help="allow replacement of a generated asset with the same deterministic filename",
    )
    output.add_argument(
        "--artifact-output",
        action="store_true",
        help="allow an --only pilot to write under artifacts/ without producing a browser-loadable manifest",
    )

    args = parser.parse_args()
    if args.only and args.all:
        parser.error("choose --only pilots or --all, not both")
    if args.write and not (args.only or args.all):
        parser.error("refusing a broad write without explicit --all")
    if args.artifact_output and (not args.only or args.all):
        parser.error("--artifact-output is only for explicit --only pilot renders")
    if args.ground_span_km <= 0 or args.size < 128 or args.quality_probe_size < 128:
        parser.error("--ground-span-km must be positive and image sizes must be at least 128")
    if not 1 <= args.quality <= 100 or args.exposure <= 0:
        parser.error("--quality must be 1..100 and --exposure must be positive")
    if not 0 <= args.max_cloud_fraction <= 1 or not 0 <= args.max_nodata_fraction <= 1:
        parser.error("crop fractions must be between 0 and 1")
    if (args.candidate_count < 1 or args.finalist_count < 1 or args.max_items_per_search < 1
            or args.http_timeout_seconds < 1 or args.read_block_size < 32):
        parser.error("candidate counts, --http-timeout-seconds, and --read-block-size must be positive")
    return args


def repo_path(path: Path) -> Path:
    """Resolve relative output flags consistently regardless of the shell CWD."""

    return path if path.is_absolute() else ROOT / path


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_stops() -> list[Stop]:
    raw = load_json(MOUILLAGES_PATH)
    stops: list[Stop] = []
    for index, point in enumerate(raw):
        if point.get("type") == "traversee":
            continue
        try:
            name = str(point["nom"])
            date = str(point["date_arrivee"])
            lat = float(point["lat"])
            lon = float(point["lon"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"invalid mouillage at index {index}: {error}") from error
        stops.append(Stop(f"{name}|{date}", name, date, lat, lon, index))
    return stops


def select_stops(stops: list[Stop], selectors: list[str] | None) -> list[Stop]:
    """Resolve pilots predictably: exact key first, then a unique name fragment."""

    if not selectors:
        return stops
    chosen: dict[str, Stop] = {}
    for selector in selectors:
        folded = selector.casefold().strip()
        exact = [stop for stop in stops if stop.key.casefold() == folded]
        matches = exact or [stop for stop in stops if folded in stop.key.casefold()]
        if not matches:
            raise ValueError(f"--only {selector!r} does not match a selectable stop")
        for stop in matches:
            chosen[stop.key] = stop
    return sorted(chosen.values(), key=lambda stop: stop.index)


def coordinate_key(stop: Stop) -> tuple[float, float]:
    """Exact coordinate reuse is intentional: 127 stops reduce to 105 real crops."""

    return (round(stop.lat, 6), round(stop.lon, 6))


def group_by_coordinate(stops: Iterable[Stop]) -> list[list[Stop]]:
    grouped: dict[tuple[float, float], list[Stop]] = defaultdict(list)
    for stop in stops:
        grouped[coordinate_key(stop)].append(stop)
    return sorted(grouped.values(), key=lambda group: group[0].index)


def slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return normalized[:34] or "stop"


def asset_name(group: list[Stop]) -> str:
    first = group[0]
    digest = hashlib.sha1(f"{first.lat:.6f}|{first.lon:.6f}".encode("utf-8")).hexdigest()[:10]
    return f"sentinel-{slug(first.name)}-{digest}.webp"


def lon_lat_to_web_mercator(lon: float, lat: float) -> tuple[float, float]:
    lat = max(min(lat, 85.05112878), -85.05112878)
    x = EARTH_RADIUS_M * math.radians(lon)
    y = EARTH_RADIUS_M * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def web_mercator_to_lon_lat(x: float, y: float) -> tuple[float, float]:
    lon = math.degrees(x / EARTH_RADIUS_M)
    lat = math.degrees(2 * math.atan(math.exp(y / EARTH_RADIUS_M)) - math.pi / 2)
    return lon, lat


def crop_bounds(stop: Stop, ground_span_km: float) -> Bounds:
    """Make a true-ground-width crop while retaining an EPSG:3857 output grid.

    The site shader uses Mercator coordinates, while a 46 km visual window
    should remain 46 km on the ground at both Fiji and British Columbia.  Web
    Mercator expands distances by 1/cos(latitude), hence the correction here.
    """

    x, y = lon_lat_to_web_mercator(stop.lon, stop.lat)
    projected_span = ground_span_km * 1000.0 / max(math.cos(math.radians(stop.lat)), 0.05)
    half = projected_span / 2
    left, right, bottom, top = x - half, x + half, y - half, y + half
    lon_min, lat_min = web_mercator_to_lon_lat(left, bottom)
    lon_max, lat_max = web_mercator_to_lon_lat(right, top)
    return Bounds(left, bottom, right, top, lon_min, lon_max, lat_min, lat_max)


def adaptive_ground_spans(ground_span_km: float) -> tuple[float, ...]:
    """Return the widest-first, bounded retry plan for one crop.

    Sentinel RGB COGs are projected in individual UTM tiles.  A crop centred
    near one tile's boundary can therefore be perfectly valid at 20 km but
    contain a hard no-data band at 46 km.  The fixed fallback list makes that
    recovery reproducible and deliberately modest: it never widens a caller's
    requested framing and it never tries an unbounded ladder of sizes.
    """

    spans = [ground_span_km]
    for fallback in DEFAULT_ADAPTIVE_GROUND_SPANS_KM:
        if fallback < ground_span_km and not math.isclose(fallback, ground_span_km):
            spans.append(fallback)
    return tuple(spans)


def as_rfc3339(value: str, *, end: bool) -> str:
    value = value.strip()
    if "T" in value:
        return value if value.endswith("Z") else f"{value}Z"
    suffix = "23:59:59Z" if end else "00:00:00Z"
    return f"{value}T{suffix}"


def post_with_retries(session: requests.Session, body: dict[str, Any]) -> dict[str, Any]:
    for attempt in range(3):
        try:
            response = session.post(STAC_ENDPOINT, json=body, timeout=45)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("STAC response was not an object")
            return payload
        except (requests.RequestException, ValueError) as error:
            if attempt == 2:
                raise RuntimeError(f"STAC search failed after 3 attempts: {error}") from error
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def scene_cloud_cover(feature: dict[str, Any]) -> float:
    value = feature.get("properties", {}).get("eo:cloud_cover")
    try:
        return float(value)
    except (TypeError, ValueError):
        return 1_000.0


def scene_datetime(feature: dict[str, Any]) -> str:
    """Return a sortable acquisition timestamp without trusting STAC ordering."""

    properties = feature.get("properties", {})
    return str(properties.get("datetime") or properties.get("start_datetime") or "")


def search_scenes(session: requests.Session, stop: Stop, args: argparse.Namespace) -> list[dict[str, Any]]:
    base = {
        "collections": [STAC_COLLECTION],
        "intersects": {"type": "Point", "coordinates": [stop.lon, stop.lat]},
        "datetime": f"{as_rfc3339(args.start, end=False)}/{as_rfc3339(args.end, end=True)}",
        # Ask for a complete ranked pool. STAC commonly returns results newest
        # first, so a low page size can accidentally exclude a beautiful older
        # dry-season scene despite `candidate_count` allowing it.
        "limit": args.max_items_per_search,
        "query": {"eo:cloud_cover": {"lte": args.max_scene_cloud_cover}},
    }
    # Seed the local inspection pool with reasonably clear global scenes, but
    # always supplement it with an unfiltered request.  The latter matters for
    # a small island: a tile can be globally cloudy away from it and still be
    # its best usable crop.  The bounded pixel probes below make the decision.
    preferred = list(post_with_retries(session, base).get("features", []))
    base.pop("query", None)
    fallback = list(post_with_retries(session, base).get("features", []))
    unique: dict[str, dict[str, Any]] = {}
    for feature in [*preferred, *fallback]:
        identifier = str(feature.get("id", ""))
        if identifier:
            unique[identifier] = feature
    features = list(unique.values())
    # A scene-wide cloud percentage is only a coarse search filter. A "1%"
    # tile can have its only cloud directly over the anchorage, while a "20%"
    # tile can be clear at the island. Keep a stable chronological list and
    # defer the actual ranking until the local RGB/SCL crop is inspected.
    return sorted(features, key=lambda feature: (scene_datetime(feature), str(feature.get("id", ""))))


def temporal_probe_pool(features: list[dict[str, Any]], count: int) -> list[dict[str, Any]]:
    """Choose a bounded pool which retains the clearest global candidates.

    Global cloud metadata may not pick the winner, but it is a useful cheap
    pre-filter for the limited expensive COG probes.  Reserve roughly half of
    the budget for the lowest global-cloud scenes and use the rest to sample
    the time range, so dry-season candidates cannot be skipped just because a
    chronology-only sample happened to land on wet dates.
    """

    if len(features) <= count:
        return features
    if count == 1:
        return [min(features, key=lambda feature: (scene_cloud_cover(feature), scene_datetime(feature)))]

    clear_count = max(1, math.ceil(count / 2))
    selected: dict[str, dict[str, Any]] = {}
    for feature in sorted(features, key=lambda item: (scene_cloud_cover(item), scene_datetime(item)))[:clear_count]:
        selected[str(feature.get("id", ""))] = feature

    remaining = count - len(selected)
    if remaining:
        indexes = {
            round(index * (len(features) - 1) / (remaining - 1))
            for index in range(remaining)
        } if remaining > 1 else {len(features) // 2}
        for index in sorted(indexes):
            feature = features[index]
            selected.setdefault(str(feature.get("id", "")), feature)

    # If a seasonal sample duplicated a clear candidate, keep filling with the
    # next-clearest scenes until we honour the requested bounded probe count.
    for feature in sorted(features, key=lambda item: (scene_cloud_cover(item), scene_datetime(item))):
        if len(selected) >= count:
            break
        selected.setdefault(str(feature.get("id", "")), feature)
    return sorted(selected.values(), key=lambda feature: (scene_datetime(feature), str(feature.get("id", ""))))


def local_quality_key(feature: dict[str, Any], stats: dict[str, float]) -> tuple[float | str, ...]:
    """Rank clean scenes by actual selected-crop pixels, not STAC metadata."""

    tonal_spread = max(0.0, stats["p98"] - stats["p02"])
    return (
        stats["interiorNoDataFraction"],
        stats["noDataFraction"],
        stats["cloudFraction"],
        stats["cloudShadowFraction"],
        -tonal_spread,
        scene_datetime(feature),
        str(feature.get("id", "")),
    )


def quality_summary(stats: dict[str, float]) -> str:
    return (
        f"local cloud {stats['cloudFraction']:.2%}; "
        f"shadow {stats['cloudShadowFraction']:.2%}; "
        f"no-data {stats['noDataFraction']:.2%} "
        f"(interior {stats['interiorNoDataFraction']:.2%})"
    )


def require_rasterio() -> tuple[Any, Any, Any]:
    try:
        import rasterio
        from rasterio.enums import Resampling
        from rasterio.transform import from_bounds
        from rasterio.vrt import WarpedVRT
    except ImportError as error:
        raise RuntimeError(
            "rasterio is required for Sentinel probes. Install it in a pipeline environment, "
            "or use the workspace bundle documented in this file."
        ) from error
    return rasterio, Resampling, (from_bounds, WarpedVRT)


def read_band(
    href: str,
    bounds: Bounds,
    size: int,
    *,
    resampling: Any,
    rasterio: Any,
    from_bounds: Any,
    WarpedVRT: Any,
    environment: dict[str, str],
    block_size: int,
) -> np.ma.MaskedArray:
    transform = from_bounds(bounds.left, bounds.bottom, bounds.right, bounds.top, size, size)
    # A COG read is a remote range request.  Keep the GDAL environment open
    # around the reads themselves, not merely while sources are constructed;
    # otherwise GDAL may fall back to an unbounded global HTTP timeout.
    # Retrying a band is deliberate: the open public COG service occasionally
    # drops one range response even while the same scene succeeds moments
    # later. The GDAL timeouts in `environment` keep each HTTP request bounded
    # without leaving an abandoned background thread behind.
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            with rasterio.Env(**environment):
                with rasterio.open(href) as source:
                    with WarpedVRT(
                        source,
                        crs="EPSG:3857",
                        transform=transform,
                        width=size,
                        height=size,
                        resampling=resampling,
                        src_nodata=source.nodata,
                        nodata=0,
                    ) as warped:
                        # A single full-frame read can translate into an
                        # enormous COG range request and hang behind an
                        # intermediary cache. Fixed output windows keep every
                        # request small and bounded; the concatenated result is
                        # pixel-identical to one full read.
                        output = np.ma.masked_all((size, size), dtype=np.uint16)
                        for row in range(0, size, block_size):
                            height = min(block_size, size - row)
                            for column in range(0, size, block_size):
                                width = min(block_size, size - column)
                                window = ((row, row + height), (column, column + width))
                                output[row:row + height, column:column + width] = warped.read(
                                    1, window=window, masked=True,
                                )
                        return output
        except Exception as error:  # rasterio uses several GDAL exception types
            last_error = error
        if attempt == 0:
            time.sleep(1)
    raise CandidateRejected(f"bounded COG range reads failed: {last_error}")


def render_candidate(
    feature: dict[str, Any], bounds: Bounds, args: argparse.Namespace, *, size: int | None = None,
) -> tuple[np.ndarray, dict[str, float]]:
    """Read RGB + SCL, then reject any crop that could show a tile artefact.

    A low-resolution probe is sufficient to rank the actual island crop, while
    finalists are rendered again at the requested full output size before one
    can be written.  Both passes use identical reprojection and gates.
    """

    rasterio, Resampling, (from_bounds, WarpedVRT) = require_rasterio()
    target_size = size or args.size
    assets = feature.get("assets", {})
    required = {name: assets.get(name, {}).get("href") for name in ("red", "green", "blue")}
    absent = [name for name, href in required.items() if not href]
    if absent:
        raise CandidateRejected(f"scene has no {'/'.join(absent)} RGB COG asset")

    environment = {
        "AWS_NO_SIGN_REQUEST": "YES",
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "GDAL_HTTP_MULTIRANGE": "YES",
        "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
        "GDAL_HTTP_TIMEOUT": str(args.http_timeout_seconds),
        "GDAL_HTTP_CONNECTTIMEOUT": str(min(args.http_timeout_seconds, 10)),
        "GDAL_HTTP_MAX_RETRY": "1",
        "GDAL_HTTP_RETRY_DELAY": "1",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    }
    channels = [
        read_band(
            str(required[name]), bounds, target_size,
            resampling=Resampling.bilinear,
            rasterio=rasterio, from_bounds=from_bounds, WarpedVRT=WarpedVRT,
            environment=environment,
            block_size=args.read_block_size,
        )
        for name in ("red", "green", "blue")
    ]
    raw = np.ma.stack(channels)
    invalid = np.any(np.ma.getmaskarray(raw), axis=0)
    raw_values = np.asarray(raw.filled(0), dtype=np.float32)
    invalid |= np.all(raw_values <= 0, axis=0)

    scl_href = assets.get("scl", {}).get("href")
    cloud_fraction = 0.0
    if scl_href:
        scl = read_band(
            str(scl_href), bounds, target_size,
            resampling=Resampling.nearest,
            rasterio=rasterio, from_bounds=from_bounds, WarpedVRT=WarpedVRT,
            environment=environment,
            block_size=args.read_block_size,
        )
        scl_values = np.asarray(scl.filled(0), dtype=np.uint8)
        # Sentinel-2 L2A SCL: 0 no data, 1 saturated/defective, 8/9 cloud,
        # and 10 cirrus.  We do not reject ordinary terrain shadow (3), as
        # that would incorrectly discard mountainous islands.
        invalid |= np.ma.getmaskarray(scl) | np.isin(scl_values, (0, 1))
        cloud = np.isin(scl_values, (8, 9, 10))
        cloud_fraction = float(np.mean(cloud))
        cloud_shadow_fraction = float(np.mean(scl_values == 3))
    else:
        cloud_shadow_fraction = 0.0

    nodata_fraction = float(np.mean(invalid))
    # Sentinel tiles are deliberately rectangular while a real circular globe
    # crop may extend a little past a UTM-zone edge.  That is harmless as long
    # as it is a clean edge band: the image can be cropped in the shader.  A
    # hole or interior rectangle, however, is a visible broken detail and must
    # reject the scene.  Gate the interior separately from unavoidable outer
    # coverage trim.
    interior_inset = max(2, min(target_size // 16, 64))
    interior_invalid = invalid[interior_inset:-interior_inset, interior_inset:-interior_inset]
    interior_nodata_fraction = float(np.mean(interior_invalid)) if interior_invalid.size else nodata_fraction
    if interior_nodata_fraction > args.max_nodata_fraction:
        raise CandidateRejected(
            f"{interior_nodata_fraction:.2%} interior no-data pixels exceeds "
            f"{args.max_nodata_fraction:.2%} gate"
        )
    if cloud_fraction > args.max_cloud_fraction:
        raise CandidateRejected(
            f"{cloud_fraction:.2%} cloud/cirrus pixels exceeds {args.max_cloud_fraction:.2%} gate"
        )

    # Sentinel L2A RGB bands are bottom-of-atmosphere reflectance, scaled by
    # 10,000.  Convert that physical value to standard sRGB only; no palette,
    # hue, contrast, or map-style enhancement is applied.
    linear = np.clip(raw_values / 10_000.0 * args.exposure, 0.0, 1.0)
    srgb = np.where(
        linear <= 0.0031308,
        linear * 12.92,
        1.055 * np.power(linear, 1 / 2.4) - 0.055,
    )
    image = np.rint(np.clip(srgb, 0.0, 1.0) * 255.0).astype(np.uint8).transpose(1, 2, 0)
    statistics = {
        "noDataFraction": nodata_fraction,
        "interiorNoDataFraction": interior_nodata_fraction,
        "cloudFraction": cloud_fraction,
        "cloudShadowFraction": cloud_shadow_fraction,
        "p02": float(np.quantile(linear, 0.02)),
        "p98": float(np.quantile(linear, 0.98)),
    }
    return image, statistics


def relative_web_path(output_dir: Path, filename: str, *, artifact_output: bool) -> str:
    public_root = ROOT / "site" / "public"
    try:
        return (output_dir / filename).resolve().relative_to(public_root.resolve()).as_posix()
    except ValueError as error:
        if not artifact_output:
            raise ValueError("--output-dir must stay under site/public so the browser can load it") from error
        artifact_root = (ROOT / "artifacts").resolve()
        try:
            preview_path = (output_dir / filename).resolve().relative_to(artifact_root).as_posix()
        except ValueError as artifact_error:
            raise ValueError("--artifact-output must stay under artifacts/") from artifact_error
        # This deliberately is not a web path. A future runtime merge cannot
        # accidentally ship a local proof asset in place of a site image.
        return f"preview://{preview_path}"


def scene_provenance(feature: dict[str, Any], stats: dict[str, float]) -> dict[str, Any]:
    properties = feature.get("properties", {})
    timestamp = str(properties.get("datetime") or properties.get("created") or "")
    year = timestamp[:4] if re.match(r"^\d{4}", timestamp) else str(datetime.now(timezone.utc).year)
    return {
        "provider": "Copernicus Sentinel-2 L2A",
        "collection": STAC_COLLECTION,
        "scene": feature.get("id"),
        "datetime": timestamp,
        "sceneCloudCover": scene_cloud_cover(feature),
        "stac": STAC_ENDPOINT,
        "licence": SENTINEL_NOTICE_URL,
        "notice": f"{SENTINEL_NOTICE} {year}",
        "processing": "RGB B04/B03/B02 crop, EPSG:3857 reprojection, standard sRGB encoding",
        **stats,
    }


def manifest_entry(
    stop: Stop, bounds: Bounds, path: str, provenance: dict[str, Any], *, artifact_output: bool,
) -> dict[str, Any]:
    return {
        "fichier": path,
        **({"previewOnly": True} if artifact_output else {}),
        "detailPlongee": True,
        "lonMin": bounds.lon_min,
        "lonMax": bounds.lon_max,
        "latMax": bounds.lat_max,
        "latMin": bounds.lat_min,
        "focusLat": stop.lat,
        "focusLon": stop.lon,
        "source": provenance["notice"],
        "provenance": provenance,
    }


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def write_webp_atomic(path: Path, image: np.ndarray, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    Image.fromarray(image, "RGB").save(temporary, "WEBP", quality=quality, method=6)
    os.replace(temporary, path)


def write_attribution(path: Path, generated: dict[str, dict[str, Any]]) -> None:
    scenes = sorted({
        (entry["provenance"]["scene"], entry["provenance"]["datetime"])
        for entry in generated.values()
    })
    years = sorted({entry["provenance"]["notice"] for entry in generated.values()})
    lines = [
        "Le Sillage generated Sentinel detail imagery",
        "",
        "Source: Copernicus Sentinel-2 L2A data via Element 84 Earth Search.",
        *years,
        "The imagery was cropped, reprojected, and encoded for Le Sillage.",
        f"Licence: Copernicus Sentinel Data Legal Notice — {SENTINEL_NOTICE_URL}",
        "",
        "Scenes:",
        *[f"- {scene} ({timestamp})" for scene, timestamp in scenes],
        "",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def describe_group(group: list[Stop]) -> str:
    names = ", ".join(stop.key for stop in group)
    return f"{names} @ {group[0].lat:.6f}, {group[0].lon:.6f}"


def select_clean_candidate(
    scenes: list[dict[str, Any]],
    bounds: Bounds,
    args: argparse.Namespace,
) -> CandidateSelection:
    """Probe, then fully render the cleanest usable scene for one fixed crop.

    This routine has no I/O beyond the bounded COG reads performed by
    ``render_candidate``.  Keeping a fixed-size selection self-contained lets
    the outer adaptive loop distinguish a legitimate smaller framing from an
    otherwise unusable source tile without weakening either quality gate.
    """

    probes: list[tuple[dict[str, Any], dict[str, float]]] = []
    rejection_reasons: list[str] = []
    for feature in temporal_probe_pool(scenes, args.candidate_count):
        scene_id = str(feature.get("id", "unknown-scene"))
        try:
            _, stats = render_candidate(feature, bounds, args, size=args.quality_probe_size)
            probes.append((feature, stats))
            print(f"    probe {scene_id}: {quality_summary(stats)}")
        except (CandidateRejected, RuntimeError, OSError) as error:
            rejection_reasons.append(f"{scene_id}: {error}")

    if not probes:
        message = "; ".join(rejection_reasons) or "no usable candidate"
        raise CandidateRejected(message)

    # A full-size COG resample can expose a small coverage issue hidden by a
    # low-resolution probe.  Re-render a few locally clean finalists, then
    # rank them on those final measurements as well.
    finalists = sorted(probes, key=lambda candidate: local_quality_key(*candidate))[:args.finalist_count]
    rendered: list[CandidateSelection] = []
    for feature, _ in finalists:
        scene_id = str(feature.get("id", "unknown-scene"))
        try:
            image, stats = render_candidate(feature, bounds, args)
            rendered.append(CandidateSelection(feature, image, stats))
            print(f"    finalist {scene_id}: {quality_summary(stats)}")
        except (CandidateRejected, RuntimeError, OSError) as error:
            rejection_reasons.append(f"{scene_id} (full render): {error}")

    if not rendered:
        message = "; ".join(rejection_reasons) or "no usable full-size candidate"
        raise CandidateRejected(message)

    return min(rendered, key=lambda candidate: local_quality_key(candidate.feature, candidate.stats))


def select_adaptive_candidate(
    scenes: list[dict[str, Any]],
    reference: Stop,
    args: argparse.Namespace,
) -> AdaptiveSelection:
    """Find the widest clean crop without publishing a no-data tile seam.

    The first accepted span wins.  It is intentionally not a global
    scorecard: a 46 km clean crop conveys the place better than a technically
    slightly cleaner 20 km crop.  Narrower spans are only recovery paths when
    the wider crop cannot meet the exact same cloud and no-data gates.
    """

    rejected: list[str] = []
    for ground_span_km in adaptive_ground_spans(args.ground_span_km):
        bounds = crop_bounds(reference, ground_span_km)
        print(f"  crop {ground_span_km:g} km")
        try:
            candidate = select_clean_candidate(scenes, bounds, args)
        except CandidateRejected as error:
            rejected.append(f"{ground_span_km:g} km: {error}")
            print(f"    rejected: {error}")
            continue
        return AdaptiveSelection(ground_span_km, bounds, candidate)
    raise CandidateRejected("; ".join(rejected) or "no clean crop span")


def main() -> int:
    args = parse_args()
    output_dir = repo_path(args.output_dir)
    manifest_path = repo_path(args.manifest)
    attribution_path = repo_path(args.attribution)
    stops = load_stops()
    existing_manifest = load_json(EXISTING_MANIFEST_PATH)
    selected = select_stops(stops, args.only)

    # Preserve a prior human-approved scene unless an explicit replacement is
    # requested.  This currently preserves the Makogai reference treatment.
    pending = [
        stop for stop in selected
        if args.replace_existing or not existing_manifest.get(stop.key, {}).get("detailPlongee")
    ]
    preserved = len(selected) - len(pending)
    all_groups = group_by_coordinate(stops)
    pending_groups = group_by_coordinate(pending)

    mode = "WRITE" if args.write else "DRY RUN"
    print(f"{mode}: {len(selected)} selected stops; {len(pending_groups)} physical crop(s); "
          f"{preserved} curated stop(s) preserved.")
    print(f"Coverage: {len(stops)} selectable stops collapse to {len(all_groups)} unique coordinates.")
    print(f"Output (only with --write): {output_dir}")
    print(f"Overlay manifest (only with --write): {manifest_path}")

    # The zero-argument command is intentionally a free coverage plan, not a
    # surprise 105-scene network job.  --only and --all opt into probing.
    if not args.only and not args.all:
        print("No probe requested: pass --only 'name|date' for one safe candidate, or --all to probe all.")
        print("Sample coordinate groups:")
        for group in all_groups[:8]:
            print(f"  - {describe_group(group)}")
        return 0
    if not pending_groups:
        print("Nothing to generate: every selected stop is already human-curated. Use --replace-existing to probe it.")
        return 0

    session = requests.Session()
    session.headers.update({"User-Agent": "LeSillageSentinelPipeline/1.0 (+https://github.com/sidney-afk/letitbe)"})
    generated: dict[str, dict[str, Any]] = {}
    failures: list[str] = []

    for position, group in enumerate(pending_groups, start=1):
        reference = group[0]
        print(f"[{position}/{len(pending_groups)}] {describe_group(group)}")
        try:
            scenes = search_scenes(session, reference, args)
        except RuntimeError as error:
            failures.append(f"{reference.key}: {error}")
            print(f"  rejected: {error}")
            continue
        if not scenes:
            message = "no Sentinel-2 L2A scene found in the requested date range"
            failures.append(f"{reference.key}: {message}")
            print(f"  rejected: {message}")
            continue

        try:
            selection = select_adaptive_candidate(scenes, reference, args)
        except CandidateRejected as error:
            failures.append(f"{reference.key}: {error}")
            print(f"  rejected: {error}")
            continue

        bounds = selection.bounds
        feature = selection.candidate.feature
        image = selection.candidate.image
        stats = selection.candidate.stats
        filename = asset_name(group)
        asset_path = output_dir / filename
        web_path = relative_web_path(output_dir, filename, artifact_output=args.artifact_output)
        provenance = scene_provenance(feature, stats)
        print(
            f"  accepted {provenance['scene']} | cloud {provenance['sceneCloudCover']:.1f}% "
            f"| crop {selection.ground_span_km:g} km | {quality_summary(stats)}"
        )

        if args.write:
            if asset_path.exists() and not args.overwrite:
                failures.append(f"{reference.key}: asset already exists ({asset_path}); pass --overwrite to replace it")
                print("  not written: deterministic asset already exists (use --overwrite)")
                continue
            write_webp_atomic(asset_path, image, args.quality)
            print(f"  wrote {asset_path.relative_to(ROOT)}")

        for stop in group:
            generated[stop.key] = manifest_entry(
                stop, bounds, web_path, provenance, artifact_output=args.artifact_output,
            )

    if args.write and generated:
        # The application continues to use its manually reviewed base manifest.
        # This separate overlay is the reviewable handoff for the integration
        # change that enables each accepted detail stop.
        write_json_atomic(manifest_path, generated)
        write_attribution(attribution_path, generated)
        print(f"Wrote overlay manifest: {manifest_path.relative_to(ROOT)}")
        print(f"Wrote attribution: {attribution_path.relative_to(ROOT)}")

    if failures:
        print("\nNo output was created for these quality-gated failures:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    if not args.write:
        print("\nDry run passed; no files were written. Review a capture before repeating with --write.")
    else:
        print(f"\nWrote {len(generated)} stop manifest entries from {len(pending_groups)} crop(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
