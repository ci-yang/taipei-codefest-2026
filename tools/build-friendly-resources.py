"""Build the attributed citywide resource union from official source snapshots.

Default: reproducible, offline build. --download refreshes bounded official API
snapshots; resource update dates below were checked on the official catalog on
2026-11-07 and must be rechecked when refreshing at a later date.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import hashlib
import io
import json
import math
import re
import time
import unicodedata
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOTS = ROOT / "docs/prototypes/data/friendly-resources"
OUTPUT = ROOT / "docs/prototypes/friendly-route/resources-data.js"
SOURCE_DEFINITIONS = {
    "friendly": {
        "name": "友善店家清冊（繁體中文）",
        "datasetId": "d807396c-e41f-4005-be42-0160280783a1",
        "resourceId": "5a5b36e0-f870-4b7f-8378-c91ac5f57941",
        "updatedAt": "2026-07-20 11:38:58",
        "provider": "臺北市商業處",
    },
    "toilets": {
        "name": "臺北市公廁點位資訊",
        "datasetId": "ca205b54-a06f-4d84-894c-d6ab5079ce79",
        "resourceId": "9e0e6ad4-b9f9-4810-8551-0cffd1b915b3",
        "updatedAt": "2026-11-05 17:28:37",
        "provider": "臺北市環保局",
    },
    "mrt": {
        "name": "臺北捷運車站無障礙設施資料",
        "datasetId": "3c799405-4e44-40dd-b747-daed09e88cdb",
        "resourceId": "5d45ef49-d60d-4354-b634-8dcf7d28da07",
        "updatedAt": "2026-08-31 09:19:46",
        "provider": "臺北捷運公司",
    },
    "wifi": {
        "name": "臺北市公眾區免費無線上網熱點資料（新版）",
        "datasetId": "6aa6532d-652f-4c1b-814a-4646b75407af",
        "resourceId": "549b3a9b-eb6c-4cb1-848b-8c238735e2db",
        "updatedAt": "2026-07-01 15:32:22",
        "provider": "臺北市資訊局",
    },
    "mrt-stations": {
        "name": "臺北捷運車站資料服務",
        "datasetId": "1eefa68d-7c8d-491b-8e75-66a161947426",
        "resourceId": "c77e91bf-067c-475e-917b-545ff62b7d76",
        "updatedAt": "2026-09-04 14:55:33",
        "provider": "臺北捷運公司",
        "role": "coordinate-join",
    },
}
SERVICE_COLUMNS = {
    "wifi": "Free WiFi（count）",
    "charge": "行動裝置充電（count）",
    "toilet": "友善廁所（count）",
    "accessible": "無障礙友善（count）",
}
COMMON_KNOWLEDGE_RULES = (
    {
        "key": "sit-down-chain",
        "label": "連鎖餐飲內用空間常見服務",
        "pattern": re.compile(
            r"麥當勞|摩斯(?:漢堡)?|星巴克|starbucks|路易莎|肯德基|漢堡王|burger\s*king",
            re.IGNORECASE,
        ),
        "services": ("wifi", "charge", "toilet"),
        "sourceIds": ("friendly", "toilets"),
        "detail": "依連鎖餐飲內用店常見設備推定；可能需消費，且分店、樓層與開放時段有差異。",
    },
    {
        "key": "convenience-chain",
        "label": "連鎖便利商店常見服務",
        "pattern": re.compile(
            r"7\s*[-－]?\s*(?:eleven|11)|統一超商|統一便利|全家(?:便利商店)?|familymart",
            re.IGNORECASE,
        ),
        "services": ("wifi", "charge", "toilet"),
        "sourceIds": ("friendly", "toilets"),
        "detail": "依連鎖便利商店常見服務推定；廁所、網路及充電可能需消費、付費或借用設備，並非每間分店提供。",
    },
    {
        "key": "department-store",
        "label": "百貨與購物中心常見服務",
        "pattern": re.compile(
            r"新光三越|遠東百貨|遠百|(?:太平洋|遠東)?\s*sogo|微風(?:廣場|百貨|南山|信義|南京|松高)?|"
            r"京站時尚廣場|美麗華(?:百樂園)?|(?:台|臺)北\s*101(?:購物中心|觀景台)|"
            r"att\s*4\s*fun|citylink|誠品生活|"
            r"大葉高島屋|bellavita|統領百貨|環球購物中心|宏匯廣場|遠雄廣場",
            re.IGNORECASE,
        ),
        "services": ("wifi", "charge", "toilet"),
        "sourceIds": ("friendly", "toilets"),
        "detail": "依百貨與購物中心常見公共設施推定；服務可能位於特定樓層、服務台或需借用，仍以現場公告為準。",
    },
    {
        "key": "library",
        "label": "圖書館與閱覽室常見服務",
        "pattern": re.compile(r"圖書館|圖書室|閱覽室|市圖", re.IGNORECASE),
        "services": ("wifi", "charge", "toilet"),
        "sourceIds": ("toilets",),
        "detail": "依圖書館與閱覽空間常見設施推定；插座使用規定、座位、開館時間及服務範圍仍以各館公告為準。",
    },
)


def text(value: object) -> str:
    return " ".join(str(value).split()) if value is not None else ""


def coordinate_pair(latitude: object, longitude: object) -> tuple[float | None, float | None]:
    """Blank, nonfinite, invalid WGS84, and placeholder zero pairs stay unlocated."""
    try:
        if isinstance(latitude, bool) or isinstance(longitude, bool):
            return None, None
        lat, lng = float(str(latitude).strip()), float(str(longitude).strip())
    except (TypeError, ValueError):
        return None, None
    if not (math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180):
        return None, None
    if lat == 0 or lng == 0:
        return None, None
    return lat, lng


def normalized_phone(value: object) -> str | None:
    """Extract one complete Taiwan telephone; never concatenate contacts/extensions."""
    raw = unicodedata.normalize("NFKC", text(value))
    for part in re.split(r"[/、,;#]|分機|轉|ext\.?", raw, flags=re.IGNORECASE):
        match = re.search(r"(?<![\dA-Za-z])(?:\+886[\s-]*(?:\(0\))?|\(?0)[\d()\s-]{6,}", part)
        if not match:
            continue
        candidate = match.group(0)
        digits = re.sub(r"\D", "", candidate)
        if candidate.startswith("+886"):
            digits = "0" + digits[3:].lstrip("0")
        # 02 requires eight subscriber digits; accepting generic 9–10 digit
        # numbers would silently make a truncated Taipei number dialable.
        if re.fullmatch(r"09\d{8}|02\d{8}|03\d{7}|04\d{7,8}|0[5-7]\d{7}|08[1-9]\d{6}|080[09]\d{6}", digits):
            return digits
    return None


def source_url(source_id: str) -> str:
    return f"https://data.taipei/dataset/detail?id={SOURCE_DEFINITIONS[source_id]['datasetId']}"


def base_record(source_id: str, identity: object, name: object, address: object = "", phone: object = "") -> dict[str, object]:
    return {
        "id": f"{source_id}-{identity}", "name": text(name), "address": text(address),
        "phone": text(phone), "normalizedPhone": normalized_phone(phone),
        "lat": None, "lng": None, "services": [], "sourceId": source_id,
        "sourceName": SOURCE_DEFINITIONS[source_id]["name"], "sourceUrl": source_url(source_id),
        "updatedAt": SOURCE_DEFINITIONS[source_id]["updatedAt"],
    }


def map_friendly(row: dict[str, object], index: int) -> dict[str, object]:
    record = base_record("friendly", f"{index + 1:04d}", row.get("友善店家名稱"), row.get("地址"), row.get("電話"))
    record["lat"], record["lng"] = coordinate_pair(row.get("緯度"), row.get("經度"))
    record["services"] = [service for service, column in SERVICE_COLUMNS.items() if text(row.get(column)) == "1"]
    record["url"] = text(row.get("友善店家網站個別店家介紹網址"))
    return record


def map_toilet(row: dict[str, object], index: int) -> dict[str, object]:
    record = base_record("toilets", row.get("_id", index + 1), row.get("公廁名稱"), row.get("公廁地址"))
    record["lat"], record["lng"] = coordinate_pair(row.get("緯度"), row.get("經度"))
    record["services"] = ["toilet"]
    count = text(row.get("無障礙廁座數"))
    if re.fullmatch(r"\d+", count) and int(count) > 0:
        record["services"].append("accessible")
    record["accessibilityNote"] = "無障礙廁座標記不代表沿途路徑無障礙"
    return record


def map_wifi(row: dict[str, object], index: int) -> dict[str, object]:
    identity = f"{text(row.get('site_id')) or 'unknown'}-{row.get('_id', index + 1)}"
    record = base_record("wifi", identity, row.get("name"), row.get("addr"))
    record["lat"], record["lng"] = coordinate_pair(row.get("latitude"), row.get("longitude"))
    record["services"] = ["wifi"]
    return record


def strip_cell(value: object) -> str:
    return text(value).strip("'\"")


def station_name(value: object) -> str:
    name = strip_cell(value).strip("{}").split(",", 1)[0].replace("臺", "台")
    return name.removesuffix("站")


def station_codes(value: object) -> list[str]:
    return re.findall(r"[A-Z]{1,2}\d{2}[A-Z]?", strip_cell(value))


def match_station(row: dict[str, object], stations: list[dict[str, object]]) -> tuple[dict[str, object] | None, str | None]:
    """Unique exact code first; exact normalized name is an explicit fallback."""
    name = station_name(row.get("station_name"))
    for code in station_codes(row.get("station_number")):
        matches = [station for station in stations if code in station_codes(station.get("stationid"))
                   and name == station_name(station.get("stationname"))]
        if len(matches) == 1:
            return matches[0], "exact-station-code-and-name"
    matches = [station for station in stations if name and name == station_name(station.get("stationname"))]
    return (matches[0], "exact-normalized-station-name") if len(matches) == 1 else (None, None)


def map_mrt(row: dict[str, object], index: int, stations: list[dict[str, object]]) -> dict[str, object]:
    record = base_record("mrt", row.get("_id", index + 1), row.get("station_name"))
    record["stationCodes"] = station_codes(row.get("station_number"))
    record["services"] = []
    facilities = [row.get("elevator"), row.get("elevator_and_wheelchair_ramps"), row.get("ticket_gates_for_the_disabled")]
    if any(text(value) not in ("", "無", "0", "-", "未提供") for value in facilities):
        record["services"].append("accessible")
    if text(row.get("toilet_facilities_for_disabled")) not in ("", "無", "0", "-", "未提供"):
        record["services"].append("toilet")
    record["accessibilityNote"] = "車站設施標記；車站參考座標不等於無障礙入口，也不代表沿途可通行"
    station, method = match_station(row, stations)
    if station:
        position = strip_cell(station.get("stationposition")).strip("{}").split(",")
        if len(position) == 2:
            record["lat"], record["lng"] = coordinate_pair(position[1], position[0])
        record["address"] = strip_cell(station.get("stationaddress"))
        record["coordinateSource"] = {
            "sourceId": "mrt-stations", "sourceName": SOURCE_DEFINITIONS["mrt-stations"]["name"],
            "sourceUrl": source_url("mrt-stations"), "updatedAt": SOURCE_DEFINITIONS["mrt-stations"]["updatedAt"],
            "recordId": station.get("_id"), "stationId": strip_cell(station.get("stationid")),
            "dataUpdateTime": text(station.get("updatetime")), "method": method,
        }
    return record


def add_common_knowledge(records: list[dict[str, object]]) -> dict[str, int]:
    """Add explicit, reversible service hints without changing official evidence."""
    counts: Counter[str] = Counter()
    for record in records:
        official = list(dict.fromkeys(str(service) for service in record["services"]))
        official_set = set(official)
        inferred: list[str] = []
        matched_rules: list[dict[str, object]] = []
        for rule in COMMON_KNOWLEDGE_RULES:
            if record["sourceId"] not in rule["sourceIds"] or not rule["pattern"].search(str(record["name"])):
                continue
            added = [service for service in rule["services"] if service not in official_set and service not in inferred]
            if not added:
                continue
            inferred.extend(added)
            matched_rules.append({
                "key": rule["key"], "label": rule["label"], "services": added, "detail": rule["detail"],
            })
            counts[str(rule["key"])] += 1
        record["officialServices"] = official
        record["inferredServices"] = inferred
        record["services"] = [*official, *inferred]
        if matched_rules:
            record["inferenceRules"] = matched_rules
    return dict(counts)


def download(url: str) -> bytes:
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "FriendlyResourcesPrototype/1.0 (open-data snapshot builder)"})
            with urllib.request.urlopen(request, timeout=35) as response:
                return response.read()
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(1)
    raise RuntimeError("Download did not return")


def download_source(source_id: str, folder: Path) -> None:
    rid = SOURCE_DEFINITIONS[source_id]["resourceId"]
    if source_id == "friendly":
        url = f"https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid={rid}"
        blob = download(url)
        list(csv.DictReader(io.StringIO(blob.decode("utf-8-sig"))))
        (folder / "friendly.csv").write_bytes(blob)
        (folder / "friendly-fetch.json").write_text(json.dumps({
            "fetchedAt": datetime.now(timezone.utc).isoformat(), "url": url, "sha256": hashlib.sha256(blob).hexdigest(),
        }, ensure_ascii=False) + "\n", encoding="utf-8")
        return
    pages: list[dict[str, object]] = []
    seen: set[str] = set()
    count: int | None = None
    for page_number in range(15):
        url = f"https://data.taipei/api/v1/dataset/{rid}?scope=resourceAquire&limit=1000&offset={len(seen)}"
        blob = download(url)
        response = json.loads(blob)
        result = response["result"]
        count = int(result["count"]) if count is None else count
        if int(result["count"]) != count:
            raise ValueError("Source count changed during pagination")
        batch = result["results"]
        if not batch and len(seen) < count:
            raise ValueError("Unexpected empty API page")
        for row in batch:
            identity = str(row["_id"])
            if identity in seen:
                raise ValueError("Repeated API row; pagination stopped")
            seen.add(identity)
        pages.append({"url": url, "sha256": hashlib.sha256(blob).hexdigest(), "response": response})
        print(f"{source_id}: page {page_number + 1}, {len(seen)}/{count}", flush=True)
        if len(seen) >= count:
            break
    else:
        raise ValueError("API page limit exceeded")
    if len(seen) != count:
        raise ValueError("API result count mismatch")
    payload = {"fetchedAt": datetime.now(timezone.utc).isoformat(), "resourceId": rid, "pages": pages}
    (folder / f"{source_id}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def read_api_snapshot(path: Path) -> tuple[list[dict[str, object]], str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = [row for page in payload["pages"] for row in page["response"]["result"]["results"]]
    expected = int(payload["pages"][0]["response"]["result"]["count"])
    if len(rows) != expected or len({row["_id"] for row in rows}) != expected:
        raise ValueError(f"Incomplete or duplicate snapshot: {path.name}")
    return rows, payload["fetchedAt"]


def build(folder: Path = SNAPSHOTS) -> dict[str, object]:
    with (folder / "friendly.csv").open(encoding="utf-8-sig", newline="") as stream:
        friendly_rows = list(csv.DictReader(stream))
    api_rows, fetched = {}, {}
    for source_id in ("toilets", "mrt", "wifi", "mrt-stations"):
        api_rows[source_id], fetched[source_id] = read_api_snapshot(folder / f"{source_id}.json")
    fetched["friendly"] = json.loads((folder / "friendly-fetch.json").read_text())["fetchedAt"]
    groups = {
        "friendly": [map_friendly(row, index) for index, row in enumerate(friendly_rows)],
        "toilets": [map_toilet(row, index) for index, row in enumerate(api_rows["toilets"])],
        "mrt": [map_mrt(row, index, api_rows["mrt-stations"]) for index, row in enumerate(api_rows["mrt"])],
        "wifi": [map_wifi(row, index) for index, row in enumerate(api_rows["wifi"])],
    }
    stores = [record for records in groups.values() for record in records]
    if len({record["id"] for record in stores}) != len(stores):
        raise ValueError("Resource IDs collide")
    inference_counts = add_common_knowledge(stores)
    sources = []
    for source_id, definition in SOURCE_DEFINITIONS.items():
        filename = "friendly.csv" if source_id == "friendly" else f"{source_id}.json"
        records = groups.get(source_id, [])
        sources.append({
            "id": source_id, **definition, "url": source_url(source_id), "metadataVerifiedAt": "2026-11-07",
            "updatedAtBasis": "官方資源檔案更新時間（Asia/Taipei），不是 API 匯入日或抓取日",
            "fetchedAt": fetched[source_id], "snapshot": filename,
            "sha256": hashlib.sha256((folder / filename).read_bytes()).hexdigest(),
            "license": "政府資料開放授權條款－第1版", "licenseUrl": "https://data.gov.tw/license",
            "recordCount": len(friendly_rows) if source_id == "friendly" else len(api_rows[source_id]),
            "resourceCount": len(records), "locatedCount": sum(record["lat"] is not None for record in records),
        })
    located = [record for record in stores if record["lat"] is not None and record["lng"] is not None]
    bounds = [[min(record["lat"] for record in located), min(record["lng"] for record in located)],
              [max(record["lat"] for record in located), max(record["lng"] for record in located)]]
    service_counts = Counter(service for record in stores for service in record["services"])
    official_service_counts = Counter(service for record in stores for service in record["officialServices"])
    inferred_service_counts = Counter(service for record in stores for service in record["inferredServices"])
    identity = hashlib.sha256(json.dumps({"sources": sources, "stores": stores}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    return {
        "version": f"friendly-resources-v1-{identity}", "fetchedAt": max(fetched.values()),
        "sources": sources,
        "inferenceRules": [{
            "key": rule["key"], "label": rule["label"], "services": list(rule["services"]),
            "sourceIds": list(rule["sourceIds"]), "detail": rule["detail"],
        } for rule in COMMON_KNOWLEDGE_RULES],
        "stores": stores, "bounds": bounds,
        "stats": {"total": len(stores), "located": len(located), "unlocated": len(stores) - len(located),
                  "withServices": sum(bool(record["services"]) for record in stores),
                  "serviceCounts": dict(service_counts), "officialServiceCounts": dict(official_service_counts),
                  "sourceCounts": {key: len(value) for key, value in groups.items()},
                  "inferredRecords": sum(bool(record["inferredServices"]) for record in stores),
                  "inferenceCounts": inference_counts, "inferredServiceCounts": dict(inferred_service_counts),
                  "unlocatedRecords": [{"id": record["id"], "name": record["name"], "sourceId": record["sourceId"]}
                                       for record in stores if record["lat"] is None]},
        "notes": ["不同資料來源保留獨立紀錄，同址可能重疊；不宣稱為去重後場所數。",
                  "友善店家與捷運來源含非臺北市紀錄，保留官方名冊原有涵蓋範圍。",
                  "無座標紀錄保留於名冊，不繪製點位；未以地理編碼或估計位置補點。",
                  "捷運座標依官方站碼與名稱或唯一同名站比對；僅為車站參考位置，不是無障礙入口。",
                  "橘色推定服務只套用於既有官方點位，不新增地點、不改寫官方服務；可能需消費、付費或借用，且分店有差異。",
                  "服務標記不是即時可用、免消費或沿途無障礙保證。"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--snapshots", type=Path, default=SNAPSHOTS)
    parser.add_argument("--out", type=Path, default=OUTPUT)
    args = parser.parse_args()
    args.snapshots.mkdir(parents=True, exist_ok=True)
    if args.download:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda source: download_source(source, args.snapshots), SOURCE_DEFINITIONS))
    payload = build(args.snapshots)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("window.FRIENDLY_RESOURCES = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    (args.snapshots / "build-summary.json").write_text(json.dumps({
        "version": payload["version"], "fetchedAt": payload["fetchedAt"], "sources": payload["sources"],
        "stats": payload["stats"], "bounds": payload["bounds"], "outputBytes": args.out.stat().st_size,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"version": payload["version"], "stats": payload["stats"], "bounds": payload["bounds"],
                      "outputBytes": args.out.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
