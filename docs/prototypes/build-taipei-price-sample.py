#!/usr/bin/env python3
"""Rebuild the offline Taipei housing sample from the preserved official snapshot."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SNAPSHOT = ROOT / "data" / "taipei-price-20261107"
EXPECTED_CSV_SHA256 = "0c355797e8f77190fb5753072e9e043405b57981259dad5dcca6b42f5b2d4c2c"
ARCHIVE_SHA256 = "4787d9784cc7953c71e746ff805a53e6421dcadb254756e231871f0ee652326b"
TRANSACTION_START = date(2026, 1, 1)
TRANSACTION_END = date(2026, 10, 31)
DISTRICTS = (
    "中山區", "中正區", "信義區", "內湖區", "北投區", "南港區",
    "士林區", "大同區", "大安區", "文山區", "松山區", "萬華區",
)
FILTERS = (
    "主要用途等於住家用；交易標的等於房地(土地+建物)",
    "成交日期為2026-01-01至2026-10-31（民國1150101至1151031）",
    "交易筆棟數中建物數等於1、車位數等於0",
    "車位移轉總面積平方公尺及車位總價元皆等於0",
    "總價元與建物移轉總面積平方公尺皆大於0",
    "備註去除前後空白後為空字串；所有有備註交易皆排除",
)


@dataclass(frozen=True)
class Transaction:
    district: str
    total: int
    transaction_date: date
    record_id: str
    csv_row: int


def roc_date(value: str) -> date:
    """Convert a seven-digit Republic of China transaction date without guessing."""
    if not re.fullmatch(r"\d{7}", value):
        raise ValueError(f"Invalid ROC date: {value!r}")
    return date(int(value[:3]) + 1911, int(value[3:5]), int(value[5:7]))


def number(row: dict[str, str], key: str) -> Decimal:
    """Require finite source numbers; empty or malformed fields never become zero."""
    try:
        result = Decimal(row[key].strip())
    except (InvalidOperation, KeyError, AttributeError) as error:
        raise ValueError(f"Invalid numeric field {key!r}") from error
    if not result.is_finite():
        raise ValueError(f"Non-finite numeric field {key!r}")
    return result


def eligible_transaction(row: dict[str, str], csv_row: int) -> Transaction | None:
    if row["主要用途"].strip() != "住家用":
        return None
    if row["交易標的"].strip() != "房地(土地+建物)" or row["備註"].strip():
        return None
    transaction_date = roc_date(row["交易年月日"].strip())
    if not TRANSACTION_START <= transaction_date <= TRANSACTION_END:
        return None
    counts = re.fullmatch(r"土地\d+建物(\d+)車位(\d+)", row["交易筆棟數"].strip())
    if not counts or (int(counts[1]), int(counts[2])) != (1, 0):
        return None
    if number(row, "車位移轉總面積平方公尺") != 0 or number(row, "車位總價元") != 0:
        return None
    total = number(row, "總價元")
    if total <= 0 or number(row, "建物移轉總面積平方公尺") <= 0:
        return None
    if total != total.to_integral_value():
        raise ValueError(f"Non-integer total price at CSV row {csv_row}")
    district = row["鄉鎮市區"].strip()
    if district not in DISTRICTS:
        raise ValueError(f"Unknown Taipei district at CSV row {csv_row}: {district}")
    return Transaction(district, int(total), transaction_date, row["編號"], csv_row)


def registration_period(xml_path: Path) -> tuple[str, str]:
    text = ET.parse(xml_path).getroot().findtext("lvr_time", "")
    match = re.search(r"登記日期\s*(\d+)年(\d+)月(\d+)日至\s*(\d+)年(\d+)月(\d+)日之買賣案件", text)
    if not match:
        raise ValueError("Missing official registration period in build_time.xml")
    values = tuple(int(part) for part in match.groups())
    return (
        date(values[0] + 1911, values[1], values[2]).isoformat(),
        date(values[3] + 1911, values[4], values[5]).isoformat(),
    )


def build_sample(snapshot: Path = SNAPSHOT) -> dict[str, object]:
    csv_path = snapshot / "a_lvr_land_a.csv"
    csv_hash = hashlib.sha256(csv_path.read_bytes()).hexdigest()
    if csv_hash != EXPECTED_CSV_SHA256:
        raise ValueError(
            "Snapshot SHA-256 mismatch; update provenance deliberately for a new batch"
        )
    registration_start, registration_end = registration_period(
        snapshot / "build_time.xml"
    )
    groups: dict[str, list[Transaction]] = defaultdict(list)
    record_count = 0
    with csv_path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        english_header = next(reader)
        if english_header["編號"] != "serial number":
            raise ValueError("Expected the official English column-name row")
        for row in reader:
            record_count += 1
            transaction = eligible_transaction(row, reader.line_num)
            if transaction:
                groups[transaction.district].append(transaction)
    transactions = tuple(item for items in groups.values() for item in items)
    if not transactions:
        raise ValueError("No eligible housing transactions in the source snapshot")
    districts = []
    for district in DISTRICTS:
        items = groups.get(district, [])
        if not items:
            continue  # Absence remains missing, never a synthetic zero-price record.
        highest = max(items, key=lambda item: (item.total, -item.csv_row))
        districts.append({
            "district": district,
            "maxTotalPrice": highest.total,
            "sampleCount": len(items),
            "recordId": highest.record_id,
            "sourceCsvRow": highest.csv_row,
            "transactionDate": highest.transaction_date.isoformat(),
        })
    return {
        "source": {
            "name": "內政部地政司・本期發布之不動產買賣實價登錄批次資料",
            "url": "https://data.gov.tw/dataset/25119",
            "downloadUrl": "https://plvr.land.moi.gov.tw/opendata/lvr_landAcsv.zip",
            "usageUrl": "https://plvr.land.moi.gov.tw/DownloadOpenData",
            "registrationPeriod": f"{registration_start} 至 {registration_end}",
            "registrationPeriodBasis": "官方build_time.xml之買賣案件登記日期，非成交日期",
            "transactionPeriod": (
                f"{TRANSACTION_START.isoformat()} 至 {TRANSACTION_END.isoformat()}"
            ),
            "observedTransactionPeriod": (
                f"{min(item.transaction_date for item in transactions)} 至 "
                f"{max(item.transaction_date for item in transactions)}"
            ),
            "fetchedAt": "2026-11-07",
            "license": "政府資料開放授權條款－第1版",
            "licenseUrl": "https://data.gov.tw/license",
            "archiveSha256": ARCHIVE_SHA256,
            "archiveBytes": 1133568,
            "csvFilename": "a_lvr_land_a.csv",
            "csvSha256": csv_hash,
            "csvBytes": csv_path.stat().st_size,
            "csvRowNumberBasis": "含中文欄名第1列、英文欄名第2列的原始CSV實體列號；從1起算",
            "recordCount": record_count,
            "sampleCount": len(transactions),
            "filters": list(FILTERS),
            "limitations": [
                "僅為本次下載批次、符合篩選條件的住宅最高總價，非全年最高或完整市場行情",
                "所有非空白備註皆排除，會排除部分正常交易",
                "住宅依主要用途判定；使用分區為商的住家用住宅仍可能納入",
                "沒有符合資料的行政區留白，不以其他行政區或零元補值",
            ],
        },
        "assumptions": {
            "ltv": 0.8, "annualRate": 0.025, "years": 30, "daysPerMonth": 30
        },
        "label": "本批篩選住宅最高總價",
        "notice": "房貸趣味換算；貸款條件為示範假設，非廁所或停留空間價值。",
        "districts": districts,
    }


def render(sample: dict[str, object]) -> str:
    payload = json.dumps(sample, ensure_ascii=False, indent=2)
    return (
        "// Generated by ../build-taipei-price-sample.py "
        "from the preserved official CSV.\n"
        "(function (root) {\n  'use strict';\n  const sample = " + payload + ";\n"
        "  if (root) root.FRIENDLY_PRICE_SAMPLE = sample;\n"
        "  if (typeof module === 'object' && module.exports) module.exports = sample;\n"
        "})(typeof window === 'undefined' ? null : window);\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true",
        help="Check the generated file without writing it",
    )
    parser.add_argument(
        "--json", action="store_true", help="Print data as JSON without writing files"
    )
    args = parser.parse_args()
    sample = build_sample()
    if args.json:
        print(json.dumps(sample, ensure_ascii=False))
        return
    output = ROOT / "friendly-route" / "price-data.js"
    rendered = render(sample)
    if args.check:
        if not output.exists() or output.read_text(encoding="utf-8") != rendered:
            raise SystemExit("price-data.js differs from the verified source snapshot")
    else:
        output.write_text(rendered, encoding="utf-8")
    source = sample["source"]
    print(
        f"來源交易 {source['recordCount']} 筆；篩選住宅 {source['sampleCount']} 筆；"
        f"涵蓋 {len(sample['districts'])} 區"
    )
    print(f"CSV SHA-256: {source['csvSha256']}")
    print("重建檢查通過" if args.check else f"已產生 {output}")


if __name__ == "__main__":
    main()
