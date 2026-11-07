"""Create a pedestrian-candidate graph from attributed OSM XML exports.

All weakly connected components are retained. This is an OSM snapshot, not a
surveyed pedestrian or accessible network. No runtime location is involved.
"""

import argparse
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

Point = Tuple[float, float]
Bounds = Tuple[Point, Point]
Way = Tuple[str, List[str]]
HIGHWAYS = frozenset({
    "primary", "primary_link", "secondary", "secondary_link", "tertiary",
    "tertiary_link", "residential", "living_street", "unclassified", "service",
    "pedestrian", "footway", "path", "steps", "track",
})
DENIED = frozenset({"no", "private", "customers", "permit", "delivery"})
DEFAULT_SOURCE = "https://overpass-api.de/api/interpreter"


def distance(a: Point, b: Point) -> float:
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlat, dlng = lat2 - lat1, math.radians(b[1] - a[1])
    hav = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(hav)))


def inside(point: Point, bounds: Bounds) -> bool:
    return (bounds[0][0] <= point[0] <= bounds[1][0]
            and bounds[0][1] <= point[1] <= bounds[1][1])


def tags_of(element: ET.Element) -> Dict[str, str]:
    return {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_osm(
    paths: List[Path],
) -> Tuple[Dict[str, Point], Set[str], Dict[str, Way], List[dict]]:
    """Stream each top-level OSM element; keep node/way tags until its end event."""
    nodes: Dict[str, Point] = {}
    blocked: Set[str] = set()
    ways: Dict[str, Way] = {}
    sources: List[dict] = []
    for path in paths:
        source = {"file": path.name, "sha256": sha256_of(path), "bytes": path.stat().st_size}
        input_nodes = input_ways = 0
        with path.open("rb") as stream:
            events = ET.iterparse(stream, events=("start", "end"))
            _, root = next(events)
            if root.tag != "osm":
                raise ValueError(f"Expected OSM XML, received {root.tag!r}: {path}")
            source["generator"] = root.attrib.get("generator", "")
            for event, element in events:
                if event != "end":
                    continue
                if element.tag == "meta":
                    source["osmBaseTimestamp"] = element.attrib.get("osm_base", "")
                    source["areasBaseTimestamp"] = element.attrib.get("areas", "")
                elif element.tag == "node":
                    input_nodes += 1
                    node_id = element.attrib["id"]
                    point = (float(element.attrib["lat"]), float(element.attrib["lon"]))
                    if not (-90 <= point[0] <= 90 and -180 <= point[1] <= 180):
                        raise ValueError(f"Invalid OSM coordinate for node {node_id}")
                    nodes[node_id] = point
                    tags = tags_of(element)
                    if tags.get("access") in DENIED or tags.get("foot") in DENIED:
                        blocked.add(node_id)
                elif element.tag == "way":
                    input_ways += 1
                    tags = tags_of(element)
                    if (tags.get("highway") in HIGHWAYS
                            and tags.get("foot") not in DENIED
                            and tags.get("access") not in DENIED
                            and tags.get("indoor") != "yes"
                            and tags.get("area") != "yes"
                            and not tags.get("construction")
                            and tags.get("disused") != "yes"):
                        ways[element.attrib["id"]] = (
                            tags.get("oneway:foot", "no"),
                            [nd.attrib["ref"] for nd in element.findall("nd")],
                        )
                elif element.tag == "remark":
                    # Overpass can return HTTP 200 with an error/partial XML body.
                    raise ValueError(f"Overpass returned a remark: {element.text}")
                if element.tag in {"node", "way", "relation", "meta", "bounds", "note"}:
                    element.clear()
                    root.clear()
        source["inputNodes"] = input_nodes
        source["inputWays"] = input_ways
        sources.append(source)
    return nodes, blocked, ways, sources


def component_sizes(ids: List[str], segments: Dict[Tuple[str, str], Tuple[float, str]]) -> List[int]:
    """Count weak components without building a second graph adjacency table."""
    parents = {node_id: node_id for node_id in ids}
    sizes = {node_id: 1 for node_id in ids}

    def find(node_id: str) -> str:
        while parents[node_id] != node_id:
            parents[node_id] = parents[parents[node_id]]
            node_id = parents[node_id]
        return node_id

    for a, b in segments:
        left, right = find(a), find(b)
        if left != right:
            if sizes[left] < sizes[right]:
                left, right = right, left
            parents[right] = left
            sizes[left] += sizes[right]
    return sorted(Counter(find(node_id) for node_id in ids).values(), reverse=True)


def build_graph(
    paths: List[Path],
    bounds: Optional[Bounds] = None,
    compact: bool = False,
    source: str = DEFAULT_SOURCE,
    version: str = "friendly-pedestrian-snapshot-2026-11-07-v2",
    coverage: str = "輸入資料的步行候選道路",
    coverage_label: str = "步行候選道路快照",
) -> dict:
    nodes, blocked, ways, sources = load_osm(paths)
    if bounds is not None and not (
        -90 <= bounds[0][0] <= bounds[1][0] <= 90
        and -180 <= bounds[0][1] <= bounds[1][1] <= 180
    ):
        raise ValueError("Bounds must be valid SOUTH WEST NORTH EAST coordinates")
    segments: Dict[Tuple[str, str], Tuple[float, str]] = {}
    for way_id, (direction, refs) in ways.items():
        if any(ref not in nodes for ref in refs):
            raise ValueError(f"Input is missing referenced nodes for way {way_id}")
        for a, b in zip(refs, refs[1:]):
            if a == b or a in blocked or b in blocked:
                continue
            if bounds is not None and (not inside(nodes[a], bounds) or not inside(nodes[b], bounds)):
                continue
            length = distance(nodes[a], nodes[b])
            if length <= 0:
                continue
            if direction in {"yes", "1", "true"}:
                directed = [(a, b)]
            elif direction == "-1":
                directed = [(b, a)]
            else:
                directed = [(a, b), (b, a)]
            for edge in directed:
                old = segments.get(edge)
                if old is None or length < old[0]:
                    segments[edge] = (length, way_id)
    ids = sorted({node_id for edge in segments for node_id in edge}, key=int)
    if not ids:
        raise ValueError("No routable segments remain after applying pedestrian rules")
    components = component_sizes(ids, segments)
    graph_nodes = [nodes[osm_id] for osm_id in ids]
    derived_bounds = (
        (min(point[0] for point in graph_nodes), min(point[1] for point in graph_nodes)),
        (max(point[0] for point in graph_nodes), max(point[1] for point in graph_nodes)),
    )
    indexes = {osm_id: index for index, osm_id in enumerate(ids)}
    edges = []
    for (a, b), (length, way_id) in sorted(segments.items()):
        edge = [indexes[a], indexes[b], round(length, 4)]
        if not compact:
            edge.append(way_id)
        edges.append(edge)
    payload = {
        "version": version,
        "bounds": bounds if bounds is not None else derived_bounds,
        "boundsKind": "explicit-clip" if bounds is not None else "retained-road-node-envelope",
        "coverage": coverage,
        "coverageLabel": coverage_label,
        "runtimeFormat": "compact-v1" if compact else "osm-attributed-v1",
        "license": "ODbL-1.0",
        "attribution": "© OpenStreetMap contributors",
        "source": source,
        "sources": sources,
        "policy": {
            "allowedHighways": sorted(HIGHWAYS), "deniedAccess": sorted(DENIED),
            "largestConnectedComponentOnly": False,
            "footOnewayApplied": True, "carOnewayIgnored": True,
            "excludedIndoor": True, "excludedAreaWays": True,
            "componentCountBeforeSelection": len(components),
            "retainedComponentCount": len(components),
            "largestComponentNodeCount": components[0],
            "excludedNodes": len(blocked), "maxSnapDistanceM": 120,
            "edgeLengthPrecisionDecimals": 4,
            "note": "未驗證人行穿越、出入口、施工與無障礙；路網原型非導航。",
        },
        "nodes": graph_nodes,
        "edges": edges,
    }
    if not compact:
        payload["osmNodeIds"] = ids
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--osm", type=Path, nargs="+", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--bounds", type=float, nargs=4, metavar=("SOUTH", "WEST", "NORTH", "EAST"))
    parser.add_argument("--compact", action="store_true", help="Omit OSM node and way IDs only")
    parser.add_argument("--source", default=DEFAULT_SOURCE)
    parser.add_argument("--version", default="friendly-pedestrian-snapshot-2026-11-07-v2")
    parser.add_argument("--coverage", default="輸入資料的步行候選道路")
    parser.add_argument("--coverage-label", default="步行候選道路快照")
    parser.add_argument("--query", type=Path, help="The actual query used to retrieve this XML")
    parser.add_argument("--retrieval-metadata", type=Path, help="Verified single-file retrieval receipt")
    args = parser.parse_args()
    bounds = ((args.bounds[0], args.bounds[1]), (args.bounds[2], args.bounds[3])) if args.bounds else None
    payload = build_graph(
        args.osm, bounds, args.compact, args.source, args.version, args.coverage, args.coverage_label,
    )
    if args.query:
        payload["query"] = {"file": args.query.name, "sha256": sha256_of(args.query)}
    if args.retrieval_metadata:
        receipt = json.loads(args.retrieval_metadata.read_text(encoding="utf-8"))
        if len(payload["sources"]) != 1:
            parser.error("A retrieval receipt requires exactly one input XML file")
        source_entry = payload["sources"][0]
        if (receipt.get("sha256") != source_entry["sha256"]
                or receipt.get("bytes") != source_entry["bytes"]
                or ("exitCode" in receipt and receipt["exitCode"] != 0)
                or ("httpStatus" in receipt and not str(receipt["httpStatus"]).startswith("2"))
                or receipt.get("endpoint") != args.source):
            parser.error("Retrieval receipt does not match a successful download of the input XML")
        if args.query and receipt.get("querySha256") != payload["query"]["sha256"]:
            parser.error("Retrieval receipt does not match the supplied query")
        for key in (
            "retrievalStartedAt", "retrievedAt", "retrievalTimestampBasis",
            "retrievalNote", "httpStatus", "elapsedSeconds",
        ):
            if key in receipt:
                source_entry[key] = receipt[key]
    args.out.write_text(
        "window.FRIENDLY_ROUTING_DATA = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "nodes": len(payload["nodes"]), "directedEdges": len(payload["edges"]),
        "components": payload["policy"]["retainedComponentCount"],
        "bytes": args.out.stat().st_size, "sha256": sha256_of(args.out),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
