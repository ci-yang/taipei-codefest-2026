"""Append one OSM region to the offline basemap without rebuilding the resource snapshot."""

import argparse
import importlib.util
import json
from pathlib import Path


def load_builder():
    path = Path(__file__).with_name("build-friendly-data.py")
    spec = importlib.util.spec_from_file_location("build_friendly_data", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


builder = load_builder()
DATA_PREFIX = "window.FRIENDLY_DATA = "


def merge_region(geo: dict[str, object], region: dict[str, object], osm: list[Path]) -> tuple[dict[str, object], int]:
    regions = [r for r in geo.get("regions", [builder.DEMO_REGION]) if r["name"] != region["name"]]
    known = {feature["id"] for feature in geo["features"]}
    added = [feature for feature in builder.load_osm(osm, region)["features"] if feature["id"] not in known]
    merged = {**geo, "features": geo["features"] + added, "regions": regions + [region]}
    return merged, len(added)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--region", nargs=5, metavar=("NAME", "SOUTH", "WEST", "NORTH", "EAST"), required=True)
    parser.add_argument("--osm", type=Path, nargs="+", required=True)
    parser.add_argument("--merge-existing", type=Path, required=True, help="Existing map-data.geojson to extend.")
    parser.add_argument("--data-js", type=Path, required=True, help="data.js whose map, bounds and regions are replaced.")
    args = parser.parse_args()

    name, *edges = args.region
    south, west, north, east = (float(value) for value in edges)
    region = {"name": name, "bounds": [[south, west], [north, east]]}
    geo, added = merge_region(json.loads(args.merge_existing.read_text(encoding="utf-8")), region, args.osm)

    text = args.data_js.read_text(encoding="utf-8")
    if not text.startswith(DATA_PREFIX) or not text.endswith(";\n"):
        raise SystemExit(f"Unexpected data.js shape: {args.data_js}")
    payload = json.loads(text[len(DATA_PREFIX):-2])
    payload = {key: value for key, value in payload.items() if key != "regions"}
    rebuilt = {}
    for key, value in payload.items():
        rebuilt[key] = value
        if key == "bounds":
            rebuilt["bounds"] = builder.envelope(geo["regions"])
            rebuilt["regions"] = geo["regions"]
    rebuilt["map"] = geo

    compact = {"ensure_ascii": False, "separators": (",", ":")}
    args.data_js.write_text(DATA_PREFIX + json.dumps(rebuilt, **compact) + ";\n", encoding="utf-8")
    args.merge_existing.write_text(json.dumps(geo, **compact), encoding="utf-8")
    print(json.dumps({"region": name, "added_features": added, "map_features": len(geo["features"]),
                      "regions": [r["name"] for r in geo["regions"]], "bounds": rebuilt["bounds"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
