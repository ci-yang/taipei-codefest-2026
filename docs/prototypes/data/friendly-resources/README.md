# 友善資源官方資料快照

2026-11-07 從官方開放資料 API／下載端點取得。沒有擷取店家網站，也沒有使用地理編碼補點。`build-summary.json` 記錄各來源抓取時間、SHA-256、更新資訊、清洗統計與範圍。

| 原始快照 | 來源 | 資源更新日 | 紀錄數 |
|---|---|---|---:|
| `friendly.csv` | [友善店家清冊（繁體中文）](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1) | 2026-07-20 | 993 |
| `toilets.json` | [臺北市公廁點位資訊](https://data.taipei/dataset/detail?id=ca205b54-a06f-4d84-894c-d6ab5079ce79) | 2026-11-05 | 1,531 |
| `mrt.json` | [臺北捷運車站無障礙設施資料](https://data.taipei/dataset/detail?id=3c799405-4e44-40dd-b747-daed09e88cdb) | 2026-08-31 | 119 |
| `wifi.json` | [臺北市公眾區免費無線上網熱點資料](https://data.taipei/dataset/detail?id=6aa6532d-652f-4c1b-814a-4646b75407af) | 2026-07-01 | 3,305 |
| `mrt-stations.json` | [臺北捷運車站資料服務](https://data.taipei/dataset/detail?id=1eefa68d-7c8d-491b-8e75-66a161947426) | 2026-09-04 | 110，僅用於座標對應 |

更新日取自官方資源下載表的「更新時間」，不是 `_importdate`，也不是抓取時間。官方頁於 2026-11-07 核對；往後重抓資料時，必須同步重新核對這些日期。授權依官方資料平臺的[政府資料開放授權條款－第1版](https://data.gov.tw/license)，應保留來源標示。

## 輸出與清洗

執行 `python3 tools/build-friendly-resources.py`，從本目錄離線重建 `docs/prototypes/friendly-route/resources-data.js`；不需要網路。執行加上 `--download` 才會重新下載官方資料。API 每頁最多 1,000 筆，最多 15 頁；重複 ID、總數變動、未完成分頁都會停止，避免悄悄交付不完整快照。

輸出 `window.FRIENDLY_RESOURCES` 包含 5,948 筆來源紀錄，其中 5,938 筆有座標，10 筆無座標。官方四類標記計數為 Wi-Fi 3,936、廁所 2,109、充電 406、無障礙 1,021；加上明示推定後為 Wi-Fi 4,263、廁所 2,112、充電 738、無障礙 1,021。一筆可同時有多類。不同來源不跨來源去重，同址可能重疊，因此不是實體場所去重後的數量。友善店家與捷運來源含非臺北市紀錄，保留官方名冊原有涵蓋範圍。

常識推定只標註官方來源中已存在的友善店家或列管公廁點位，不自行建立門市位置，也不覆蓋 `officialServices`。目前 332 個點位命中：連鎖餐飲 139、7-ELEVEN／全家 99、百貨與購物中心 39、圖書館與閱覽室 55；同一點位若官方已標示該服務，就不重複列為推定。推定服務保存在 `inferredServices`，畫面以橘色標示並提醒可能需消費、付費或借用，且分店、樓層、開放時間有差異。加油站不推定 Wi-Fi 或充電，其廁所只採官方列管資料。

每筆保留 `sourceId/sourceName/sourceUrl/updatedAt`。`phone` 保留原值，`normalizedPhone` 僅保留第一組完整的臺灣市話或手機；不把多組電話、分機、聯絡人文字串成號碼。其他來源沒有店家電話，不使用資料集維護人電話代替。

捷運設施來源沒有座標，另用官方車站資料進行站碼與站名精確對應；站碼無法匹配時，只接受唯一的正規化同名站。109 筆已對應，保留 `coordinateSource`，其中包含原始站碼、記錄 ID、來源更新日與對應方法。10 筆環狀線紀錄沒有可用對應，座標為 `null`，保留於名冊、不繪製點位。座標是車站參考點，不是無障礙出入口；無障礙標記不保證沿途可通行。

測試：`python3 -m unittest discover -s docs/prototypes/tests -p 'test_friendly_resources.py'`。
