"""Offline guards for the Sentinel detail-generation pipeline.

Run with ``python -m unittest pipeline.tests.test_generate_sentinel_details``.
These tests never contact STAC or download imagery; their job is to make the
all-stop coverage and no-write safety promises mechanically verifiable.
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "generate_sentinel_details", ROOT / "pipeline" / "generate_sentinel_details.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class SentinelDetailPlanTests(unittest.TestCase):
    def test_every_selectable_stop_maps_to_one_of_105_physical_crops(self) -> None:
        stops = MODULE.load_stops()
        groups = MODULE.group_by_coordinate(stops)

        self.assertEqual(len(stops), 127)
        self.assertEqual(len(groups), 105)
        self.assertEqual(sum(len(group) for group in groups), len(stops))
        self.assertTrue(all(group[0].key for group in groups))

    def test_shared_coordinates_get_one_deterministic_asset(self) -> None:
        stops = MODULE.load_stops()
        tahiti = [stop for stop in stops if stop.name == "Tahiti"]
        self.assertGreater(len(tahiti), 1)
        grouped = MODULE.group_by_coordinate(tahiti)
        shared = next(group for group in grouped if len(group) > 1)
        self.assertEqual(len({MODULE.asset_name(shared) for _ in shared}), 1)

    def test_no_arguments_is_a_network_free_coverage_plan(self) -> None:
        output = io.StringIO()
        with patch("sys.argv", ["generate_sentinel_details.py"]), \
             patch.object(MODULE, "post_with_retries", side_effect=AssertionError("network call")), \
             contextlib.redirect_stdout(output):
            result = MODULE.main()

        self.assertEqual(result, 0)
        self.assertIn("DRY RUN", output.getvalue())
        self.assertIn("No probe requested", output.getvalue())

    def test_crop_bounds_enclose_the_selected_stop(self) -> None:
        stop = next(stop for stop in MODULE.load_stops() if stop.key == "Galapagos|2009-07-08")
        bounds = MODULE.crop_bounds(stop, 46)

        self.assertLess(bounds.lon_min, stop.lon)
        self.assertGreater(bounds.lon_max, stop.lon)
        self.assertLess(bounds.lat_min, stop.lat)
        self.assertGreater(bounds.lat_max, stop.lat)

    def test_adaptive_crop_plan_only_narrows_the_requested_view(self) -> None:
        self.assertEqual(MODULE.adaptive_ground_spans(46), (46, 30, 24, 20))
        self.assertEqual(MODULE.adaptive_ground_spans(30), (30, 24, 20))
        self.assertEqual(MODULE.adaptive_ground_spans(18), (18,))
        self.assertEqual(MODULE.adaptive_ground_spans(60), (60, 46, 30, 24, 20))

    def test_adaptive_selection_keeps_the_widest_clean_crop(self) -> None:
        reference = next(stop for stop in MODULE.load_stops() if stop.name.endswith("- Opua"))
        candidate = MODULE.CandidateSelection(
            {"id": "clean-30-km", "properties": {}},
            MODULE.np.zeros((2, 2, 3), dtype=MODULE.np.uint8),
            {
                "interiorNoDataFraction": 0.0,
                "noDataFraction": 0.0,
                "cloudFraction": 0.0,
                "cloudShadowFraction": 0.0,
                "p02": 0.0,
                "p98": 0.1,
            },
        )
        args = MODULE.argparse.Namespace(ground_span_km=46)

        def select_for_bounds(_scenes, bounds, _args):
            if bounds == "bounds-46":
                raise MODULE.CandidateRejected("tile-edge no-data")
            self.assertEqual(bounds, "bounds-30")
            return candidate

        with patch.object(MODULE, "crop_bounds", side_effect=lambda _stop, span: f"bounds-{span:g}"), \
             patch.object(MODULE, "select_clean_candidate", side_effect=select_for_bounds), \
             contextlib.redirect_stdout(io.StringIO()):
            selection = MODULE.select_adaptive_candidate([{"id": "scene"}], reference, args)

        self.assertEqual(selection.ground_span_km, 30)
        self.assertEqual(selection.bounds, "bounds-30")
        self.assertIs(selection.candidate, candidate)

    def test_probe_pool_spans_the_available_scene_period(self) -> None:
        scenes = [
            {"id": f"scene-{index}", "properties": {"datetime": f"202{index}-01-01T00:00:00Z"}}
            for index in range(6)
        ]

        selected = MODULE.temporal_probe_pool(scenes, 3)

        self.assertEqual([scene["id"] for scene in selected], ["scene-0", "scene-1", "scene-3"])

    def test_single_candidate_probe_pool_remains_a_list(self) -> None:
        scenes = [
            {"id": "cloudy", "properties": {"datetime": "2024-01-01T00:00:00Z", "eo:cloud_cover": 20}},
            {"id": "clear", "properties": {"datetime": "2024-01-02T00:00:00Z", "eo:cloud_cover": 1}},
        ]

        selected = MODULE.temporal_probe_pool(scenes, 1)

        self.assertEqual([scene["id"] for scene in selected], ["clear"])

    def test_local_ranking_ignores_global_scene_cloud_metadata(self) -> None:
        global_low_but_locally_cloudy = {
            "id": "global-low",
            "properties": {"datetime": "2025-01-01T00:00:00Z", "eo:cloud_cover": 1},
        }
        global_high_but_locally_clear = {
            "id": "global-high",
            "properties": {"datetime": "2025-01-02T00:00:00Z", "eo:cloud_cover": 35},
        }
        cloudy_crop = {
            "interiorNoDataFraction": 0.0,
            "noDataFraction": 0.0,
            "cloudFraction": 0.08,
            "cloudShadowFraction": 0.0,
            "p02": 0.01,
            "p98": 0.25,
        }
        clear_crop = {**cloudy_crop, "cloudFraction": 0.0}

        self.assertLess(
            MODULE.local_quality_key(global_high_but_locally_clear, clear_crop),
            MODULE.local_quality_key(global_low_but_locally_cloudy, cloudy_crop),
        )

    def test_default_cloud_gate_fails_closed_for_visibly_cloudy_crops(self) -> None:
        with patch("sys.argv", ["generate_sentinel_details.py"]):
            args = MODULE.parse_args()

        self.assertEqual(args.max_cloud_fraction, 0.02)


if __name__ == "__main__":
    unittest.main()
