"""Independent mapping checks using official snapshots and explicit test fixtures."""

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "build_friendly_resources", ROOT / "tools/build-friendly-resources.py"
)
assert SPEC is not None and SPEC.loader is not None
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class ResourceMappingTests(unittest.TestCase):
    def test_phone_uses_first_complete_number_without_joining_contacts(self) -> None:
        cases = {
            "02-2764-9060/徐先生0937079009": "0227649060",
            "02-2722-7526/總公司02-2772-6222＃957(郭小姐)": "0227227526",
            "0917 220 661": "0917220661",
            "(02) 2720-8889 分機 123": "0227208889",
            "+886-2-2720-8889": "0227208889",
            "０９１２－３４５－６７８": "0912345678",
            "02-2243-2853*24/02-2500-6850(店家)": "0222432853",
            "": None,
            "分機 123": None,
            "12345": None,
            "02 2720 8889 123": None,
            "02272088890912345678": None,
            "02-2720-888": None,
            "03-123-4567": "031234567",
            "04-2234-5678": "0422345678",
            "0800-123-456": "0800123456",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(builder.normalized_phone(raw), expected)

    def test_invalid_or_missing_coordinate_pair_stays_null(self) -> None:
        for lat, lng in [("", "121.5"), (None, 121.5), ("NaN", "121"),
                         (25, "Infinity"), (91, 121), (25, 181), (0, 0), (True, 121)]:
            with self.subTest(lat=lat, lng=lng):
                self.assertEqual(builder.coordinate_pair(lat, lng), (None, None))
        self.assertEqual(builder.coordinate_pair("25.033", "121.5654"), (25.033, 121.5654))

    def test_toilet_accessibility_requires_positive_official_count(self) -> None:
        base = {"公廁名稱": "測試公廁", "公廁地址": "測試地址", "緯度": "25", "經度": "121"}
        for count, expected in [("0", ["toilet"]), ("", ["toilet"]),
                                ("不明", ["toilet"]), ("2", ["toilet", "accessible"])]:
            row = builder.map_toilet({**base, "無障礙廁座數": count}, 0)
            self.assertEqual(row["services"], expected)
            self.assertEqual(row["phone"], "")
            self.assertIsNone(row["normalizedPhone"])

    def test_wifi_has_only_wifi_and_does_not_inherit_agency_contact(self) -> None:
        row = builder.map_wifi({"_id": 5, "site_id": "TEST", "name": "測試熱點", "addr": "測試地址",
                                "latitude": "25.03", "longitude": "121.56", "agency": "測試單位"}, 0)
        self.assertEqual(row["id"], "wifi-TEST-5")
        self.assertEqual(row["services"], ["wifi"])
        self.assertIsNone(row["normalizedPhone"])
        self.assertEqual((row["lat"], row["lng"]), (25.03, 121.56))

    def test_friendly_services_only_follow_exact_source_flags(self) -> None:
        row = builder.map_friendly({"友善店家名稱": "測試", "電話": "02-2720-8889",
                                     "Free WiFi（count）": "1", "行動裝置充電（count）": "0",
                                     "無障礙友善（count）": "", "友善廁所（count）": "1"}, 0)
        self.assertEqual(row["services"], ["wifi", "toilet"])
        self.assertIsNone(row["lat"])
        self.assertEqual(row["phone"], "02-2720-8889")
        self.assertEqual(row["normalizedPhone"], "0227208889")

    def test_common_knowledge_is_explicit_scoped_and_does_not_replace_official_services(self) -> None:
        records = [
            {**builder.base_record("toilets", 1, "麥當勞測試店"), "services": ["toilet"]},
            {**builder.base_record("toilets", 2, "7-ELEVEN 測試門市"), "services": ["toilet"]},
            {**builder.base_record("toilets", 3, "新光三越測試館"), "services": ["toilet"]},
            {**builder.base_record("toilets", 4, "市立圖書館測試分館"), "services": ["toilet", "accessible"]},
            {**builder.base_record("toilets", 5, "中油測試站"), "services": ["toilet"]},
            {**builder.base_record("wifi", 6, "圖書館測試熱點"), "services": ["wifi"]},
        ]

        counts = builder.add_common_knowledge(records)

        self.assertEqual(counts, {
            "sit-down-chain": 1, "convenience-chain": 1, "department-store": 1, "library": 1,
        })
        for record in records[:4]:
            self.assertIn("toilet", record["officialServices"])
            self.assertEqual(record["inferredServices"], ["wifi", "charge"])
            self.assertEqual(record["services"], [*record["officialServices"], "wifi", "charge"])
        self.assertEqual(records[4]["inferredServices"], [])
        self.assertEqual(records[4]["services"], ["toilet"])
        self.assertEqual(records[5]["inferredServices"], [])
        self.assertEqual(records[5]["services"], ["wifi"])

    def test_station_join_uses_matching_code_and_name_and_records_provenance(self) -> None:
        fixture = {"_id": 7, "stationid": "'BR09,R05'", "stationname": "'{大安,Daan}'",
                   "stationposition": "'{121.543,25.033}'", "stationaddress": "'測試地址'", "updatetime": "20260902"}
        source = {"_id": 2, "station_number": "BR09/R05", "station_name": "大安站", "elevator": "有",
                  "toilet_facilities_for_disabled": "大廳層"}
        row = builder.map_mrt(source, 0, [fixture])
        self.assertEqual((row["lat"], row["lng"]), (25.033, 121.543))
        self.assertEqual(row["coordinateSource"]["recordId"], 7)
        self.assertEqual(row["coordinateSource"]["method"], "exact-station-code-and-name")
        self.assertEqual(row["services"], ["accessible", "toilet"])
        self.assertIsNone(builder.map_mrt({**source, "station_name": "不同車站"}, 0, [fixture])["lat"])

    def test_station_name_fallback_must_be_unique_and_never_guesses(self) -> None:
        station = {"stationid": "'G01A'", "stationname": "'{小碧潭,Xiaobitan}'", "stationposition": "'{121.5,25}'"}
        source = {"station_number": "G03A", "station_name": "小碧潭站"}
        self.assertEqual(builder.match_station(source, [station])[1], "exact-normalized-station-name")
        self.assertEqual(builder.match_station(source, [station, station]), (None, None))
        self.assertIsNone(builder.map_mrt(source, 0, [])["lat"])

    def test_full_union_keeps_all_sources_unique_ids_and_nullable_unlocated_stations(self) -> None:
        result = builder.build()
        stores = result["stores"]
        self.assertEqual(len(stores), sum(result["stats"]["sourceCounts"].values()))
        self.assertEqual(len(stores), len({record["id"] for record in stores}))
        self.assertEqual(set(result["stats"]["sourceCounts"]), {"friendly", "toilets", "mrt", "wifi"})
        self.assertTrue(all(record["sourceUrl"].startswith("https://data.taipei/dataset/detail?id=") for record in stores))
        self.assertTrue(all(record["updatedAt"] and record["sourceName"] for record in stores))
        self.assertTrue(all("officialServices" in record and "inferredServices" in record for record in stores))
        self.assertGreater(result["stats"]["inferredRecords"], 139)
        self.assertEqual(set(result["stats"]["inferenceCounts"]), {
            "sit-down-chain", "convenience-chain", "department-store", "library",
        })
        wifi = [record for record in stores if record["sourceId"] == "wifi"]
        self.assertEqual(len(wifi), result["stats"]["sourceCounts"]["wifi"])
        self.assertTrue(all(record["services"] == ["wifi"] and not record["inferredServices"] and not record["phone"] for record in wifi))
        unlocated = [record for record in stores if record["lat"] is None]
        self.assertEqual(len(unlocated), result["stats"]["unlocated"])
        self.assertTrue(all(record["lng"] is None for record in unlocated))
        self.assertTrue(all("coordinateSource" in record for record in stores if record["sourceId"] == "mrt" and record["lat"] is not None))

    def test_update_date_is_resource_metadata_not_import_or_retrieval_date(self) -> None:
        result = builder.build()
        toilet = next(record for record in result["stores"] if record["sourceId"] == "toilets")
        raw = json.loads((builder.SNAPSHOTS / "toilets.json").read_text())
        imported = raw["pages"][0]["response"]["result"]["results"][0]["_importdate"]["date"]
        self.assertEqual(toilet["updatedAt"], "2026-11-05 17:28:37")
        self.assertNotEqual(toilet["updatedAt"], imported)
        self.assertNotEqual(toilet["updatedAt"], result["fetchedAt"])


if __name__ == "__main__":
    unittest.main()
