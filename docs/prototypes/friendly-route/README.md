# 人有三急：App 原型

直接開啟 `index.html` 對應的 HTTP／HTTPS 網址，就是 App 首頁：三顆大按鈕「廁所」「充電」「網路」；完整資源地圖是第二層，從「看地圖」進入。手機全螢幕，桌面呈現最大 480px 的 App 視窗；沒有提案側欄或說明頁導覽。

本輪依 Ci 指定的 Stitch 設計更新視覺，沿用 D6／D7 的資料、定位、離線與橋接契約。程式本體仍在這個目錄，使用純 JavaScript、Leaflet 1.9.4、OpenStreetMap 與 SVG 圖示；沒有 Vue 執行期依賴，沒有更動 `apps/web`／`apps/api`。

後續實作先讀 [畫面對照與驗收門檻](../../../.prospec/changes/adopt-stitch-prototype/screen-map.md)、[設計規格](../../../.prospec/changes/adopt-stitch-prototype/design-spec.md)及 [Stitch 截圖來源](../../design/stitch-20261107/README.md)。原型是待 Ci 審閱的基準，不把未接的路由服務宣稱為已完成。

## 主流程

三急流程（`add-three-urgencies-flow`）：

1. **首頁**：三顆大按鈕、一行定位狀態（定位中／成功含精度／精度不足／無法取得定位，附重新定位）、「看地圖」「設定」。首頁沒有地圖、歡迎頁、交通偏好與雷達入口。
2. **結果卡**：按鈕後依目前定位挑該類別**直線**最近一筆（`urgency.js`），顯示名稱、直線距離與方向、無障礙有／未標示、來源與更新日；「換下一家」最多到第三近。精度大於 100 公尺時距離前加「約」。網路類別標「免費 Wi-Fi 熱點，不保證訊號」。沒有有效定位時不出卡、不以地圖中心推估，只顯示「需要定位才能找最近」、重新定位與看地圖。
3. **帶我去**：立即出旋轉箭頭（可啟用方位感測）與「直線 X」；本機步行路網算完後另出「步行 Y · 約 N 分鐘」，失敗或逾時只留箭頭與直線。廁所在導引內接水球倒數（沿用導引路線，位置更新不重算、不重置）；充電在電量低於 20% 或手動試玩時疊生存圈，離開導引即清除。
4. **開口卡**：結果卡與地圖選取卡片都有「開口卡」，開啟全螢幕雙面大字（上半中文給店員、下半母語），文案內建、離線可用、不記錄不送出。關閉回到來源畫面。
5. **看地圖**：既有地圖頁原樣保留（目的地搜尋、多選類別、清單、快取狀態、城市雷達四模式、START 導引）；從結果卡進入時該類別已 highlight、該筆置中並開卡。
6. **返回**：返回堆疊存在 `history.state`，畫面內返回鈕與系統返回一致；首頁 → 結果卡 → 地圖 → 開口卡 連按返回依序回地圖、結果卡、首頁，第四次才離開。
7. **設定**：母語（只列已校對語言）與輪椅／推車偏好，只存本機 `localStorage`（`friendly-native-language-v1`、`friendly-step-free-v1`）。輪椅偏好開啟時只挑有無障礙標記者，沒有就回最近一筆並標「無障礙資料不足」。

地圖頁沿用的既有行為：

- 搜尋目的地先搜尋已下載的名稱／地址，送出後才使用 Photon；離線只查已下載資料，GPS 不附在搜尋請求。
- 底部廁所／充電／Wi-Fi／無障礙可以多選，任一符合就高亮；非符合點位保留淡色。
- 點資源看名稱、類別、來源、官方更新日與「直線距離（非步行路線）」。有有效電話才顯示撥號。
- 導航以 TownPass `launch_map` 送 geo URI，失敗或 5 秒逾時改送 OpenStreetMap URL。一般瀏覽器會說明「需在台北通 App 內使用」，保留地址／電話可複製。

本輪移除評論、品質回報、互助、協助者、求助；沒有安排／確認行程頁。多站與日期歷史是規格中的 P1，未在本輪主流程實作。

## 本機預覽與可分享產物

```sh
pnpm prototype
# http://127.0.0.1:8766

# 對外分享前必須打包，依檔案內容產生新快取版本。
python3 tools/package-friendly-prototype.py /tmp/friendly-app-package
python3 -m http.server 8776 --bind 127.0.0.1 --directory /tmp/friendly-app-package
```

`package-friendly-prototype.py` 只輸出執行用的 15 個檔案（含 SW 與授權），不包含舊提案頁、分析頁或歷史路由資產。快取清單含入口的兩種 URL，計 14 項；最終大小以打包指令實測輸出為準。

`pnpm prototype` 直接使用原始碼的固定 Service Worker 版本。第一次快取後，修改 JS／資料可能仍看到舊內容；請先在瀏覽器開發工具清除該 localhost 網站的 Service Worker 與快取，再重開頁面。要驗證版本更新，先重新打包到預覽目錄再啟動 HTTP server；打包版本會依內容雜湊更新。設定頁的「重新檢查與下載」只補齊目前版本，不等於清除開發快取。

部署／分享沿用 `publish-report`，先發布到私有主台，再由 `share.sh` 產生隔離連結。正式部署網址及 APK 本輪不變。

## 開放資料

資料快照與清洗證據在 [`../data/friendly-resources/README.md`](../data/friendly-resources/README.md)，產生資料由 `resources-data.js` 載入。以下皆為官方資料，非模擬。

| 資料集 | 官方資源更新日 | 來源紀錄 |
|---|---|---:|
| [友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1) | 2026-07-20 | 993 |
| [臺北市公廁點位](https://data.taipei/dataset/detail?id=ca205b54-a06f-4d84-894c-d6ab5079ce79) | 2026-11-05 | 1,531 |
| [臺北捷運車站無障礙設施](https://data.taipei/dataset/detail?id=3c799405-4e44-40dd-b747-daed09e88cdb) | 2026-08-31 | 119 |
| [公眾免費無線上網熱點](https://data.taipei/dataset/detail?id=6aa6532d-652f-4c1b-814a-4646b75407af) | 2026-07-01 | 3,305 |
| [臺北捷運車站資料服務](https://data.taipei/dataset/detail?id=1eefa68d-7c8d-491b-8e75-66a161947426) | 2026-09-04 | 座標補充來源 |

合計 5,948 筆來源紀錄，其中 5,938 筆有座標；109 筆捷運資料以官方站碼或唯一站名對應座標，其餘 10 筆保留無座標，不補造位置。保留官方資料中的少量非北市紀錄；不同來源未當作同一場所去重，計數代表來源紀錄，不是不同店家的數量。

### 開口卡文案校對

文案在 `speak-card-strings.js`，不呼叫線上翻譯或 LLM。`reviewed: false` 的語言不會出現在語言清單；校對人與日期以句庫的 `reviewedBy`／`reviewedOn` 為準，未填者寫「待補」。

| 語言 | 上架 | 校對人 | 校對日期 |
|---|---|---|---|
| 中文（原文） | 是 | 待補 | 待補 |
| English | 否，待母語者校對 | 待補 | 待補 |
| Bahasa Indonesia | 否，待母語者校對 | 待補 | 待補 |
| Tiếng Việt | 否，待母語者校對 | 待補 | 待補 |

每筆保留 `sourceId/sourceName/sourceUrl/updatedAt`；捷運座標另有 `coordinateSource`。電話原文與 `normalizedPhone` 分開，避免把分機或多組電話串成錯誤號碼。服務標記不代表目前可用、免消費、營業中或路線無障礙。

成員 `21bc1f3` 的 `build-friendly-data.py` 與 `data.js` 保留全市匯入及 Wi-Fi 同址彙整歷史；現行 App 只從 `data.js` 讀取地方底圖，點位／搜尋／四類篩選一律使用 `resources-data.js`。現行資料管線另對官方資料中已存在的 332 個點位加入橘色常識推定：連鎖餐飲 139、7-ELEVEN／全家 99、百貨與購物中心 39、圖書館與閱覽室 55。推定不新增門市位置、不覆蓋官方服務，且畫面明示可能需消費、付費或借用，分店與開放時段也可能不同；加油站不推定 Wi-Fi 或充電。

離線重建／重新下載：

```sh
python3 tools/build-friendly-resources.py
python3 tools/build-friendly-resources.py --download
```

## 離線邊界

首次連線會自動快取全市點位與 app shell，全部必要項目成功才顯示「已快取」、時間與底圖範圍。失敗會列缺項，保留既有完整資料；版本與 URL scope 隔離。

離線快照底圖分成兩塊，記在 `data.js` 的 `regions`。`bounds` 只是兩塊的外包矩形，App 判斷「有沒有離線底圖」看的是 `regions`，兩塊之間仍算沒有底圖。

| 區域 | 範圍 | 來源與時間 |
| --- | --- | --- |
| 信義／大安東 | 25.023–25.044 N、121.546–121.574 E | OSM API `map` 匯出，2026-11-07；原始 XML 未留存，8,985 個 features |
| 北投學園路（demo 會場周邊） | 25.121–25.148 N、121.454–121.484 E | Overpass 一次 GET，OSM 基準 `2026-11-08T01:40:06Z`；XML 1,395,978 bytes，SHA-256 `35ab50a41510c0d7a66139e5dbc9e296ce142ef1472e15a4c30e2df5f365df7e`；1,979 個 features |

北投那塊的查詢選 bbox 內所有 `highway`、`building` 與 `leisure=park` 的 way 及其完整節點，對應 `load_osm` 會保留的類別。道路沒有套用步行路網的白名單，因為信義那塊同樣保留了 `trunk`、`cycleway` 等全部道路，兩塊才會畫得一致。第一次以 Python urllib 送出時 TLS 握手失敗，請求沒有送達；之後改用 curl 送出唯一一次 GET，HTTP 200，耗時約 36 秒。原始 XML 與下載紀錄在 `/tmp/basemap-beitou/`（`beitou-20261108.osm`、`retrieval.json`，內含查詢原文），未提交 repository。

其他區域保留全市資源點位，缺底圖時使用方向與距離。線上 OSM raster tiles 僅用於當下互動視窗，不預抓、不收入離線包，遵伺服器 HTTP 快取設定。

追加一塊區域時，在 repository 根目錄執行下列指令。它會用 `build-friendly-data.py` 的 `load_osm` 轉換新 OSM，把 features 接在既有 `map-data.geojson` 後面，再只替換 `data.js` 的 `map`、`bounds`、`regions`，其他欄位原樣保留：

```sh
python3 docs/prototypes/build-basemap-region.py \
  --region 北投學園路 25.121 121.454 25.148 121.484 \
  --osm /tmp/basemap-beitou/beitou-20261108.osm \
  --merge-existing docs/prototypes/friendly-route/map-data.geojson \
  --data-js docs/prototypes/friendly-route/data.js
```

同名區域重跑會取代該區域的範圍，已存在的 feature id 不會重複加入。平台 API 用的 `data/friendly/map-data.geojson` 不由這支指令更新。

定位離線仍可重試；不把 GPS、目的地或搜尋紀錄持久儲存。方向以正北為基準，不依賴羅盤；只有主動啟用且收到有效方位訊號才轉動箭頭，沒有位置不顯示箭頭。直線方向不保證現場道路可通行。

TownPass WebView 斷網重開、實際外部地圖／撥號與方位感測仍須 Android 實機驗證。沒有將瀏覽器與模擬 bridge 測試當成實機通過。

## 驗證與規格

```sh
pnpm test:prototype
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`friendly-app-state` 是 Node VM 的明示 DOM／Leaflet 替身；bridge 與 SW 測試分開，另有資料清洗測試。瀏覽器實測與限制詳見 [`QA-v6.md`](QA-v6.md)。舊路由計算保留作 P1 歷史資產，不在本輪 UI 或分享套件執行。

原規格位於 `.prospec/changes/enable-friendly-routes/proposal.md`，blob `6da4a77f904db5877d10fe8a54adf90356a178dc`，本次未修改。新視覺及新增畫面由 `.prospec/changes/adopt-stitch-prototype/` 獨立記錄。新工作樹的 history 權限差異已依 canonical 權限修正，proposal 與 design-spec 結構檢查可執行；仍不宣稱正式計畫／實作／驗證站完成。
