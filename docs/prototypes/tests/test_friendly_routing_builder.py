"""Builder contract checks against explicitly synthetic OSM XML fixtures."""

import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "build_friendly_routing", ROOT / "docs/prototypes/build-friendly-routing.py"
)
assert SPEC is not None and SPEC.loader is not None
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class RoutingBuilderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "synthetic.osm"

    def write_fixture(self, contents: str) -> None:
        self.path.write_text(
            '<osm version="0.6" generator="synthetic-unit-test">'
            '<meta osm_base="2026-01-01T00:00:00Z" areas="2025-12-31T00:00:00Z"/>'
            + contents + '</osm>', encoding="utf-8",
        )

    def test_preserves_small_components_and_derives_bounds_from_retained_nodes(self) -> None:
        self.write_fixture('''
          <node id="1" lat="25" lon="121.5"/>
          <node id="2" lat="25.001" lon="121.5"/>
          <node id="3" lat="25.002" lon="121.5"/>
          <node id="4" lat="25.2" lon="121.6"/>
          <node id="5" lat="25.201" lon="121.6"/>
          <node id="99" lat="26" lon="122"/>
          <way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/>
            <tag k="highway" v="residential"/></way>
          <way id="20"><nd ref="4"/><nd ref="5"/>
            <tag k="highway" v="footway"/></way>
        ''')
        graph = builder.build_graph([self.path])
        self.assertEqual(graph["osmNodeIds"], ["1", "2", "3", "4", "5"])
        self.assertEqual(graph["policy"]["retainedComponentCount"], 2)
        self.assertEqual(graph["policy"]["largestComponentNodeCount"], 3)
        self.assertFalse(graph["policy"]["largestConnectedComponentOnly"])
        self.assertEqual(graph["bounds"], ((25, 121.5), (25.201, 121.6)))
        self.assertEqual(graph["sources"][0]["inputNodes"], 6)
        self.assertEqual(graph["sources"][0]["osmBaseTimestamp"], "2026-01-01T00:00:00Z")

    def test_blocked_node_tags_survive_streaming_and_never_bridge_the_gap(self) -> None:
        for key, value in [("foot", "no"), ("access", "private")]:
            with self.subTest(key=key):
                self.write_fixture(f'''
                  <node id="1" lat="25" lon="121.5"/>
                  <node id="2" lat="25.001" lon="121.5"/>
                  <node id="3" lat="25.002" lon="121.5"><tag k="{key}" v="{value}"/></node>
                  <node id="4" lat="25.003" lon="121.5"/>
                  <node id="5" lat="25.004" lon="121.5"/>
                  <way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="5"/>
                    <tag k="highway" v="footway"/></way>
                ''')
                graph = builder.build_graph([self.path])
                self.assertNotIn("3", graph["osmNodeIds"])
                self.assertEqual(graph["policy"]["excludedNodes"], 1)
                self.assertEqual(graph["policy"]["retainedComponentCount"], 2)
                self.assertEqual(len(graph["edges"]), 4)

    def test_foot_oneway_applies_and_car_oneway_is_ignored(self) -> None:
        cases = [("oneway:foot", "yes", {(0, 1)}), ("oneway:foot", "-1", {(1, 0)}),
                 ("oneway", "yes", {(0, 1), (1, 0)})]
        for key, value, expected in cases:
            with self.subTest(key=key, value=value):
                self.write_fixture(f'''
                  <node id="1" lat="25" lon="121.5"/>
                  <node id="2" lat="25.001" lon="121.5"/>
                  <way id="10"><nd ref="1"/><nd ref="2"/>
                    <tag k="highway" v="residential"/><tag k="{key}" v="{value}"/></way>
                ''')
                graph = builder.build_graph([self.path])
                self.assertEqual({(edge[0], edge[1]) for edge in graph["edges"]}, expected)

    def test_way_exclusions_remain_in_force(self) -> None:
        cases = [("foot", "no"), ("access", "customers"), ("indoor", "yes"),
                 ("area", "yes"), ("construction", "footway"), ("disused", "yes")]
        for key, value in cases:
            with self.subTest(key=key):
                self.write_fixture(f'''
                  <node id="1" lat="25" lon="121.5"/>
                  <node id="2" lat="25.001" lon="121.5"/>
                  <node id="3" lat="25.002" lon="121.5"/>
                  <way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="footway"/></way>
                  <way id="20"><nd ref="2"/><nd ref="3"/>
                    <tag k="highway" v="footway"/><tag k="{key}" v="{value}"/></way>
                ''')
                graph = builder.build_graph([self.path])
                self.assertEqual(graph["osmNodeIds"], ["1", "2"])

    def test_explicit_bounds_clip_without_reconnecting_outside_nodes(self) -> None:
        self.write_fixture('''
          <node id="1" lat="25" lon="121.5"/>
          <node id="2" lat="25.001" lon="121.5"/>
          <node id="3" lat="25.02" lon="121.5"/>
          <node id="4" lat="25.002" lon="121.5"/>
          <node id="5" lat="25.003" lon="121.5"/>
          <way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="5"/>
            <tag k="highway" v="footway"/></way>
        ''')
        bounds = ((24.99, 121.49), (25.01, 121.51))
        graph = builder.build_graph([self.path], bounds=bounds)
        self.assertEqual(graph["bounds"], bounds)
        self.assertEqual(graph["boundsKind"], "explicit-clip")
        self.assertNotIn("3", graph["osmNodeIds"])
        self.assertEqual(graph["policy"]["retainedComponentCount"], 2)
        with self.assertRaisesRegex(ValueError, "Bounds"):
            builder.build_graph([self.path], bounds=((26, 121), (25, 122)))

    def test_compact_removes_only_provenance_ids_without_changing_route_lengths(self) -> None:
        self.write_fixture('''
          <node id="1" lat="25.0000123" lon="121.5000456"/>
          <node id="2" lat="25.0010234" lon="121.5000678"/>
          <node id="3" lat="25.0020345" lon="121.5000789"/>
          <way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/>
            <tag k="highway" v="footway"/></way>
        ''')
        full = builder.build_graph([self.path])
        compact = builder.build_graph([self.path], compact=True)
        self.assertNotIn("osmNodeIds", compact)
        self.assertEqual(compact["nodes"], full["nodes"])
        self.assertEqual(compact["edges"], [edge[:3] for edge in full["edges"]])
        forward = {(edge[0], edge[1]): edge[2] for edge in compact["edges"]}
        expected = sum(round(builder.distance(a, b), 4)
                       for a, b in zip(full["nodes"], full["nodes"][1:]))
        self.assertEqual(forward[(0, 1)] + forward[(1, 2)], expected)
        self.assertEqual(compact["policy"]["edgeLengthPrecisionDecimals"], 4)

    def test_missing_referenced_nodes_are_rejected(self) -> None:
        self.write_fixture('''
          <node id="1" lat="25" lon="121.5"/>
          <way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="footway"/></way>
        ''')
        with self.assertRaisesRegex(ValueError, "missing referenced nodes"):
            builder.build_graph([self.path])

    def test_overpass_partial_error_is_rejected_even_with_valid_xml(self) -> None:
        self.write_fixture('<remark>runtime error: Query timed out</remark>')
        with self.assertRaisesRegex(ValueError, "Overpass returned a remark"):
            builder.build_graph([self.path])


if __name__ == "__main__":
    unittest.main()
