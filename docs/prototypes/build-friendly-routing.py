"""Create a bounded pedestrian-candidate graph from attributed OSM XML exports.

This graph is a prototype snapshot, not a surveyed pedestrian or accessible network.
"""

import argparse
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set, Tuple

BOUNDS = ((25.023, 121.546), (25.044, 121.574))
HIGHWAYS = frozenset({
    "primary", "primary_link", "secondary", "secondary_link", "tertiary",
    "tertiary_link", "residential", "living_street", "unclassified", "service",
    "pedestrian", "footway", "path", "steps", "track",
})
DENIED = frozenset({"no", "private", "customers", "permit", "delivery"})


def distance(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlat, dlng = lat2 - lat1, math.radians(b[1] - a[1])
    hav = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(hav)))


def inside(point: Tuple[float, float]) -> bool:
    return (BOUNDS[0][0] <= point[0] <= BOUNDS[1][0]
            and BOUNDS[0][1] <= point[1] <= BOUNDS[1][1])


def tags_of(element: ET.Element) -> Dict[str, str]:
    return {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--osm", type=Path, nargs="+", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    nodes: Dict[str, Tuple[float, float]] = {}
    blocked: Set[str] = set()
    ways: Dict[str, Tuple[Dict[str, str], List[str]]] = {}
    sources = []
    for path in args.osm:
        sources.append({"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        tree = ET.parse(path)
        for node in tree.findall("node"):
            node_id = node.attrib["id"]
            point = (float(node.attrib["lat"]), float(node.attrib["lon"]))
            if inside(point):
                nodes[node_id] = point
                tags = tags_of(node)
                if tags.get("access") in DENIED or tags.get("foot") in DENIED:
                    blocked.add(node_id)
        for way in tree.findall("way"):
            tags = tags_of(way)
            if tags.get("highway") not in HIGHWAYS:
                continue
            if (tags.get("foot") in DENIED or tags.get("access") in DENIED
                    or tags.get("indoor") == "yes" or tags.get("area") == "yes"
                    or tags.get("construction") or tags.get("disused") == "yes"):
                continue
            ways[way.attrib["id"]] = (tags, [nd.attrib["ref"] for nd in way.findall("nd")])
    segments: Dict[Tuple[str, str], Tuple[float, str]] = {}
    connected: Dict[str, Set[str]] = defaultdict(set)
    for way_id, (tags, refs) in ways.items():
        for a, b in zip(refs, refs[1:]):
            if a == b or a not in nodes or b not in nodes or a in blocked or b in blocked:
                continue
            length = distance(nodes[a], nodes[b])
            if length <= 0:
                continue
            direction = tags.get("oneway:foot", "no")
            directed = [(a, b)] if direction in {"yes", "1", "true"} else [(b, a)] if direction == "-1" else [(a, b), (b, a)]
            for edge in directed:
                old = segments.get(edge)
                if old is None or length < old[0]:
                    segments[edge] = (length, way_id)
            connected[a].add(b)
            connected[b].add(a)
    remaining = set(connected)
    largest: Set[str] = set()
    component_count = 0
    while remaining:
        start = next(iter(remaining))
        component = {start}
        stack = [start]
        remaining.remove(start)
        while stack:
            for neighbor in connected[stack.pop()]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    stack.append(neighbor)
        component_count += 1
        if len(component) > len(largest):
            largest = component
    ids = sorted(largest, key=int)
    indexes = {osm_id: index for index, osm_id in enumerate(ids)}
    edges = [[indexes[a], indexes[b], round(length, 4), way_id]
             for (a, b), (length, way_id) in sorted(segments.items())
             if a in largest and b in largest]
    payload = {
        "version": "friendly-pedestrian-snapshot-2026-11-07-v1",
        "bounds": BOUNDS,
        "license": "ODbL-1.0",
        "attribution": "© OpenStreetMap contributors",
        "source": "https://api.openstreetmap.org/api/0.6/map",
        "sources": sources,
        "policy": {
            "allowedHighways": sorted(HIGHWAYS), "deniedAccess": sorted(DENIED),
            "largestConnectedComponentOnly": True,
            "footOnewayApplied": True, "carOnewayIgnored": True,
            "excludedIndoor": True, "excludedAreaWays": True,
            "componentCountBeforeSelection": component_count,
            "excludedNodes": len(blocked), "maxSnapDistanceM": 120,
            "note": "未驗證人行穿越、出入口、施工與無障礙；路網原型非導航。",
        },
        "nodes": [nodes[osm_id] for osm_id in ids],
        "osmNodeIds": ids, "edges": edges,
    }
    args.out.write_text("window.FRIENDLY_ROUTING_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(json.dumps({"nodes": len(ids), "directedEdges": len(edges), "components": component_count,
                      "bytes": args.out.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
