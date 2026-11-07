"""Build an attributed, local prototype snapshot from official CSV and OSM API exports."""

import argparse
import csv
import hashlib
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--osm", type=Path, nargs="+", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    bounds = [[25.023, 121.546], [25.044, 121.574]]
    fields = {
        "wifi": "Free WiFi（count）",
        "charge": "行動裝置充電（count）",
        "toilet": "友善廁所（count）",
        "accessible": "無障礙友善（count）",
    }
    stores = []
    with args.csv.open(encoding="utf-8-sig", newline="") as source:
        for index, row in enumerate(csv.DictReader(source)):
            lat, lng = float(row["緯度"]), float(row["經度"])
            if not (bounds[0][0] <= lat <= bounds[1][0]
                    and bounds[0][1] <= lng <= bounds[1][1]):
                continue
            stores.append({
                "id": f"tpe-{index + 1:04d}",
                "name": " ".join(row["友善店家名稱"].split()),
                "address": row["地址"].strip(),
                "phone": row["電話"].strip(),
                "lat": lat, "lng": lng,
                "services": [key for key, col in fields.items() if row[col] == "1"],
                "url": row["友善店家網站個別店家介紹網址"].strip(),
            })
    nodes = {}
    ways = {}
    for path in args.osm:
        tree = ET.parse(path)
        for node in tree.findall("node"):
            nodes[node.attrib["id"]] = [float(node.attrib["lon"]), float(node.attrib["lat"])]
        for way in tree.findall("way"):
            tags = {item.attrib["k"]: item.attrib["v"] for item in way.findall("tag")}
            if "highway" in tags or tags.get("leisure") == "park" or "building" in tags:
                ways[way.attrib["id"]] = (tags, [nd.attrib["ref"] for nd in way.findall("nd")])
    features = []
    for osm_id, (tags, refs) in ways.items():
        if any(ref not in nodes for ref in refs):
            continue
        coordinates = [nodes[ref] for ref in refs]
        if len(coordinates) < 2:
            continue
        # Complete intersecting OSM ways can extend outside the requested box.
        if not any(bounds[0][1] <= x <= bounds[1][1] and bounds[0][0] <= y <= bounds[1][0]
                   for x, y in coordinates):
            continue
        polygon = ("building" in tags or tags.get("leisure") == "park") and refs[0] == refs[-1]
        features.append({
            "type": "Feature", "id": f"way/{osm_id}",
            "properties": {key: tags[key] for key in ("name", "highway", "building", "leisure") if key in tags},
            "geometry": {"type": "Polygon" if polygon else "LineString",
                         "coordinates": [coordinates] if polygon else coordinates},
        })
    geo = {"type": "FeatureCollection", "features": features,
           "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors",
           "source": "https://api.openstreetmap.org/api/0.6/map"}
    demo_names = ["新東陽忠孝店", "布納咖啡館", "新東陽101專櫃"]
    payload = {
        "version": "friendly-route-2026-11-07-v1", "bounds": bounds,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": {"name": "友善店家清冊（繁體中文）", "updatedAt": "2026-07-20",
                   "url": "https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1",
                   "sha256": hashlib.sha256(args.csv.read_bytes()).hexdigest()},
        "stores": stores,
        "demoRoute": [next(store["id"] for store in stores if store["name"] == name) for name in demo_names],
        "map": geo,
    }
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "data.js").write_text("window.FRIENDLY_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    (args.out / "map-data.geojson").write_text(json.dumps(geo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"stores": len(stores), "map_features": len(features), "demoRoute": payload["demoRoute"]}))


if __name__ == "__main__":
    main()
