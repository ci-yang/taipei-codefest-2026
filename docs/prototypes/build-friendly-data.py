"""Build an attributed, local prototype snapshot from official CSV and OSM exports."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


DEMO_BOUNDS = [[25.023, 121.546], [25.044, 121.574]]
DEMO_REGION = {"name": "信義／大安東", "bounds": DEMO_BOUNDS}
FRIENDLY_SOURCE = {
    "key": "friendly-store",
    "name": "臺北市友善店家清冊",
    "label": "友善店家清冊標示",
    "updatedAt": "2026-07-20",
    "url": "https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1",
}
TOILET_SOURCE = {
    "key": "public-toilet",
    "name": "臺北市公廁點位資訊",
    "label": "臺北市列管公廁",
    "updatedAt": "2026-11-05",
    "url": "https://data.taipei/dataset/detail?id=ca205b54-a06f-4d84-894c-d6ab5079ce79",
}
WIFI_SOURCE = {
    "key": "taipei-free",
    "name": "臺北市公眾區免費無線上網熱點資料（新版）",
    "label": "Taipei Free 官方熱點",
    "updatedAt": "2026-07-01",
    "url": "https://data.taipei/dataset/detail?id=6aa6532d-652f-4c1b-814a-4646b75407af",
}
COMMON_KNOWLEDGE_RULES = (
    {
        "key": "sit-down-chain",
        "label": "連鎖餐飲內用空間常見服務",
        "pattern": re.compile(
            r"麥當勞|摩斯(?:漢堡)?|星巴克|starbucks|路易莎|"
            r"肯德基|漢堡王|burger\s*king",
            re.IGNORECASE,
        ),
        "services": ("wifi", "charge", "toilet"),
        "detail": "依連鎖餐飲內用店常見設備推定；不是單店官方保證，可能需消費且分店有差異。",
    },
)


def in_bounds(lat: float, lng: float, bounds: list[list[float]] = DEMO_BOUNDS) -> bool:
    return bounds[0][0] <= lat <= bounds[1][0] and bounds[0][1] <= lng <= bounds[1][1]


def include_point(lat: float, lng: float, citywide: bool) -> bool:
    return citywide or in_bounds(lat, lng)


def count_value(value: str | None) -> int:
    try:
        return int((value or "0").strip())
    except ValueError:
        return 0


def stable_id(prefix: str, *parts: str) -> str:
    value = "\x1f".join(part.strip() for part in parts)
    return f"{prefix}-{hashlib.sha1(value.encode('utf-8')).hexdigest()[:10]}"


def source_record(source: dict[str, str], path: Path) -> dict[str, str]:
    return {**source, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def load_friendly_stores(path: Path, citywide: bool = False) -> list[dict[str, object]]:
    fields = {
        "wifi": "Free WiFi（count）",
        "charge": "行動裝置充電（count）",
        "toilet": "友善廁所（count）",
        "accessible": "無障礙友善（count）",
    }
    stores: list[dict[str, object]] = []
    with path.open(encoding="utf-8-sig", newline="") as source:
        for index, row in enumerate(csv.DictReader(source)):
            lat, lng = float(row["緯度"]), float(row["經度"])
            if not include_point(lat, lng, citywide):
                continue
            services = [key for key, col in fields.items() if row[col] == "1"]
            stores.append({
                "id": f"tpe-{index + 1:04d}",
                "name": " ".join(row["友善店家名稱"].split()),
                "address": row["地址"].strip(),
                "phone": row["電話"].strip(),
                "lat": lat,
                "lng": lng,
                "services": services,
                "officialServices": services,
                "inferredServices": [],
                "url": row["友善店家網站個別店家介紹網址"].strip(),
                "recordType": "friendly-store",
                "sourceKey": FRIENDLY_SOURCE["key"],
                "sourceLabel": FRIENDLY_SOURCE["label"],
                "sourceUpdatedAt": FRIENDLY_SOURCE["updatedAt"],
                "sourceUrl": FRIENDLY_SOURCE["url"],
                "sourceDetail": "店家申請的友善服務標示；消費條件、營業與現場狀態仍需確認。",
            })
    return stores


def load_public_toilets(path: Path, citywide: bool = False) -> list[dict[str, object]]:
    resources: list[dict[str, object]] = []
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            lat, lng = float(row["緯度"]), float(row["經度"])
            if not include_point(lat, lng, citywide):
                continue
            services = ["toilet"]
            if count_value(row.get("無障礙廁座數")) > 0:
                services.append("accessible")
            grades = [label for label, column in (
                ("特優", "特優級"), ("優等", "優等級"), ("普通", "普通級"), ("改善", "改善級 "),
            ) if count_value(row.get(column)) > 0]
            details = [row["公廁類別"].strip()]
            if grades:
                details.append(f"公廁評等：{'、'.join(grades)}")
            if count_value(row.get("親子廁座數")) > 0:
                details.append("設有親子廁座")
            resources.append({
                "id": stable_id("toilet", row["公廁名稱"], row["公廁地址"]),
                "name": " ".join(row["公廁名稱"].split()),
                "address": row["公廁地址"].strip(),
                "phone": "",
                "lat": lat,
                "lng": lng,
                "services": services,
                "officialServices": services,
                "inferredServices": [],
                "url": "",
                "recordType": "public-toilet",
                "sourceKey": TOILET_SOURCE["key"],
                "sourceLabel": TOILET_SOURCE["label"],
                "sourceUpdatedAt": TOILET_SOURCE["updatedAt"],
                "sourceUrl": TOILET_SOURCE["url"],
                "sourceDetail": "・".join(filter(None, details)),
            })
    return resources


def normalized_wifi_address(address: str) -> str:
    return re.sub(r"^\d{3}", "", " ".join(address.split()))


def load_wifi_hotspots(path: Path, citywide: bool = False) -> tuple[list[dict[str, object]], int]:
    groups: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            lat, lng = float(row["LATITUDE"]), float(row["LONGITUDE"])
            if not include_point(lat, lng, citywide):
                continue
            address = normalized_wifi_address(row["ADDR"])
            groups[(row["STYPE"].strip(), address)].append(row)

    resources: list[dict[str, object]] = []
    for (place_type, address), rows in groups.items():
        representative = min(rows, key=lambda row: (len(row["NAME"]), row["NAME"]))
        count_note = f"；同址合併 {len(rows)} 個 AP" if len(rows) > 1 else ""
        access_note = "；行政機關室內點位可能受開放時段與門禁限制" if place_type == "行政機關" else ""
        resources.append({
            "id": stable_id("wifi", place_type, address),
            "name": " ".join(representative["NAME"].split()),
            "address": address,
            "phone": "",
            "lat": float(representative["LATITUDE"]),
            "lng": float(representative["LONGITUDE"]),
            "services": ["wifi"],
            "officialServices": ["wifi"],
            "inferredServices": [],
            "url": "",
            "recordType": "wifi-hotspot",
            "sourceKey": WIFI_SOURCE["key"],
            "sourceLabel": WIFI_SOURCE["label"],
            "sourceUpdatedAt": WIFI_SOURCE["updatedAt"],
            "sourceUrl": WIFI_SOURCE["url"],
            "sourceDetail": f"{place_type}；{representative['AGENCY'].strip()}{count_note}{access_note}",
        })
    return sorted(resources, key=lambda item: (str(item["name"]), str(item["address"]))), sum(len(rows) for rows in groups.values())


def add_common_knowledge(resources: list[dict[str, object]]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for resource in resources:
        name = str(resource["name"])
        official = set(resource["officialServices"])
        inferred: set[str] = set()
        matched_rules: list[dict[str, str]] = []
        for rule in COMMON_KNOWLEDGE_RULES:
            if not rule["pattern"].search(name):
                continue
            added = set(rule["services"]) - official
            inferred.update(added)
            if added:
                matched_rules.append({
                    "key": str(rule["key"]),
                    "label": str(rule["label"]),
                    "detail": str(rule["detail"]),
                })
                counts[str(rule["key"])] += 1
        resource["inferredServices"] = sorted(inferred)
        resource["services"] = list(dict.fromkeys([*resource["officialServices"], *sorted(inferred)]))
        if matched_rules:
            resource["inferenceRules"] = matched_rules
    return dict(counts)


def envelope(regions: list[dict[str, object]]) -> list[list[float]]:
    corners = [region["bounds"] for region in regions]
    return [[min(b[0][0] for b in corners), min(b[0][1] for b in corners)],
            [max(b[1][0] for b in corners), max(b[1][1] for b in corners)]]


def load_osm(paths: list[Path], region: dict[str, object] = DEMO_REGION) -> dict[str, object]:
    nodes: dict[str, list[float]] = {}
    ways: dict[str, tuple[dict[str, str], list[str]]] = {}
    for path in paths:
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
        if not any(in_bounds(y, x, region["bounds"]) for x, y in coordinates):
            continue
        polygon = ("building" in tags or tags.get("leisure") == "park") and refs[0] == refs[-1]
        features.append({
            "type": "Feature",
            "id": f"way/{osm_id}",
            "properties": {key: tags[key] for key in ("name", "highway", "building", "leisure") if key in tags},
            "geometry": {"type": "Polygon" if polygon else "LineString",
                         "coordinates": [coordinates] if polygon else coordinates},
        })
    return {"type": "FeatureCollection", "features": features, "regions": [region],
            "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors",
            "source": "https://api.openstreetmap.org/api/0.6/map"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, required=True)
    map_group = parser.add_mutually_exclusive_group(required=True)
    map_group.add_argument("--osm", type=Path, nargs="+")
    map_group.add_argument("--map-geojson", type=Path)
    parser.add_argument("--public-toilets", type=Path)
    parser.add_argument("--wifi-hotspots", type=Path)
    parser.add_argument("--citywide", action="store_true",
                        help="Keep every official Taipei record; the local route map remains the demo corridor.")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    stores = load_friendly_stores(args.csv, args.citywide)
    sources = [source_record(FRIENDLY_SOURCE, args.csv)]
    counts = {"friendly-store": len(stores)}
    if args.public_toilets:
        toilets = load_public_toilets(args.public_toilets, args.citywide)
        stores.extend(toilets)
        sources.append(source_record(TOILET_SOURCE, args.public_toilets))
        counts["public-toilet"] = len(toilets)
    if args.wifi_hotspots:
        hotspots, hotspot_aps = load_wifi_hotspots(args.wifi_hotspots, args.citywide)
        stores.extend(hotspots)
        sources.append(source_record(WIFI_SOURCE, args.wifi_hotspots))
        counts["taipei-free"] = len(hotspots)
        counts["taipei-free-aps"] = hotspot_aps

    inference_counts = add_common_knowledge(stores)

    if args.map_geojson:
        geo = json.loads(args.map_geojson.read_text(encoding="utf-8"))
    else:
        geo = load_osm(args.osm)

    demo_names = ["新東陽忠孝店", "布納咖啡館", "新東陽101專櫃"]
    payload = {
        "version": "friendly-route-2026-11-07-v3",
        "bounds": envelope(geo.get("regions", [DEMO_REGION])),
        "regions": geo.get("regions", [DEMO_REGION]),
        "resourceScope": "臺北市全市" if args.citywide else "信義／大安東側示範區",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": sources[0],
        "sources": sources,
        "resourceCounts": counts,
        "inferenceRules": [{key: value for key, value in rule.items() if key != "pattern"}
                           for rule in COMMON_KNOWLEDGE_RULES],
        "inferenceCounts": inference_counts,
        "stores": stores,
        "demoRoute": [next(store["id"] for store in stores if store["name"] == name) for name in demo_names],
        "map": geo,
    }
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "data.js").write_text(
        "window.FRIENDLY_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    (args.out / "map-data.geojson").write_text(
        json.dumps(geo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8",
    )
    print(json.dumps({"stores": len(stores), "resourceCounts": counts,
                      "map_features": len(geo["features"]), "demoRoute": payload["demoRoute"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
