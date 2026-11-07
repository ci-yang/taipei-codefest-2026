# 友善同行 App Prototype v2

本資料夾是獨立、可發布的手機 App 討論原型，不變更 `apps/` 的正式服務。四頁流程為地圖首頁 → 行程設定 → 路線確認 → 行程地圖；保留四類資源、品質回報、離線及互助。評論與互助只在本機示範，未向真人發送；這不是原生 APK。

## 開啟

在 repo 根目錄執行 `pnpm prototype`，開啟 `http://localhost:8766`。只需 Python 3；不需啟動 API、Docker 或資料庫，也不需 `.env`。不使用 pnpm 時可直接執行 `python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/prototypes/friendly-route`。結束按 Ctrl+C；8766 已被占用時改用另一個本機 port，不停止別人的服務。

回歸測試：repo 根目錄執行 `pnpm test:prototype`（Node.js ≥ 22）。[協作交接](../../handoff/2026-11-07-friendly-prototype-collaboration.md) 列出檔案地盤與待討論項目。此輪先做前端；規格是討論基線，不代表後端契約定案。

在本資料夾以 HTTP／HTTPS 提供檔案，再開啟 `index.html`。定位與 Service Worker 需要 HTTPS 或 localhost；定位另需使用者允許。`analysis.html` 是提案分析；`spec.html` 與 `proposal.md` 是第二版規格副本，正式來源位於 `.prospec/changes/enable-friendly-routes/`。

## 資料來源

| 資料 | 來源與版本 | 是否模擬 |
|---|---|---|
| 店家、地址、座標、電話、四類服務標記 | [臺北市友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1)，繁中 CSV 更新 2026-07-20 | 否；載入全市 993 筆原始記錄 |
| 列管公廁與無障礙廁座 | [臺北市公廁點位資訊](https://data.taipei/dataset/detail?id=ca205b54-a06f-4d84-894c-d6ab5079ce79)，CSV 更新 2026-11-05 | 否；載入全市 1,531 筆，包含 41 間麥當勞、51 間摩斯與 37 座名稱明確為中油加油站的點位 |
| 免費無線上網熱點 | [臺北市公眾區免費無線上網熱點資料（新版）](https://data.taipei/dataset/detail?id=6aa6532d-652f-4c1b-814a-4646b75407af)，CSV 更新 2026-07-01 | 否；載入全市 3,305 個 AP，依類型與地址合併為 2,036 個點位，行政機關亦保留並提醒開放時間限制 |
| 連鎖餐飲常識推定 | 對上述官方點位中的麥當勞、摩斯、星巴克、路易莎、肯德基及漢堡王，補上內用店常見的 Wi-Fi、充電與廁所線索 | **是，明確標「推定」**；139 個既有點位，非單店官方保證，可能需消費且分店有差異 |
| 道路、建物、綠地 | [OpenStreetMap API](https://api.openstreetmap.org/api/0.6/map)，2026-11-07 擷取；© OpenStreetMap contributors，[ODbL-1.0](https://opendatacommons.org/licenses/odbl/1-0/) | 否；地方向量快照，非即時地圖 |
| 路線建議 | 同一批 OSM 官方匯出的地方路網，配合起點與依序目的地計算 | 計算結果；未實地驗證，非正式／無障礙導航 |
| 目前位置 | 裝置 Geolocation 回傳，附精度與取樣時間 | 否；示範起點另標示，不混稱 GPS |
| 行程歷史 | 使用者明確保存的本機行程 | 不預填；展示時建立者僅供測試 |
| 評論、品質狀態 | 使用者在此瀏覽器的試填 | 是；不預填，不是公開評價或官方認證 |
| 附近協助 | 本機發布者／協助者角色切換 | 是；不通知真人、不代表救援服務 |

資源資料已擴為臺北市全市，共 4,560 個官方資源點：993 筆友善店家、1,531 筆列管公廁及 2,036 個 Taipei Free 合併點位。路網及本地向量底圖仍只覆蓋緯度 25.023–25.044、經度 121.546–121.574 的信義安和至台北 101 示範廊帶；全市點位可搜尋與查看，路網外不計算行程。

三種官方資料在畫面中分開標示來源與證據。友善店家清冊的空白欄位表示「未標示」；列管公廁只證明該點在官方公廁資料中；Taipei Free 只證明官方熱點點位。連鎖餐飲的 Wi-Fi、充電與廁所另以橘色「推定」標籤呈現，不與官方證據混同；加油站廁所仍只用列管公廁資料，不推定手機充電或 Wi-Fi。消費條件、營業、實際可用狀態與品質均需現場確認。Free WiFi 標記不等於非顧客可免消費使用。資料授權見[臺北市資料大平臺條款](https://data.taipei/rule)。

## 地圖與依賴

Leaflet 1.9.4 採 BSD-2-Clause，授權附於 `vendor/LICENSE-leaflet.txt`。本頁直接讀取本地 GeoJSON，不向圖磚伺服器請求地圖，沒有預抓 OSM 圖磚。`map-data.geojson` 為可再利用的 ODbL 地方資料副本；店家資料與 OSM 資料分屬各自授權。原型程式依專案 AGPL-3.0-or-later，隨報告附上 [LICENSE](LICENSE.txt) 與 [NOTICE](NOTICE.txt)。

資料建立工具在上一層 `build-friendly-data.py`：輸入友善店家 CSV，並可加入公廁 CSV、Taipei Free CSV 與既有 GeoJSON（或 OSM API XML 匯出），以 `--citywide` 產生全市 `data.js` 及地方 `map-data.geojson`。三份原始 CSV 的 SHA-256 保存在 `FRIENDLY_DATA.sources`；建立時間在 `fetchedAt`。Taipei Free 保留所有官方類型，並合併同類型同址 AP。常識推定規則隨快照保存在 `inferenceRules`，不以爬蟲取得資料。

## 路線比較與位置

`routing-data.js` 是同一批 OSM 資料整理的本地步行候選圖，`routing.js` 在瀏覽器計算路線。最短只在這份可用路網、固定站序與連接方式下比較；資源最多只在本次產生的候選路線中比較，使用相同範圍及所選服務去重計數。沒有更有資源的可用候選時不製造第二條。端點短接線另揭露，不能代表現場可通行。

GPS 超出快照範圍、精度不足或不能接上路網時，讓使用者重新定位、手動選起點或明確進入示範。沒有自動改成展示座標。歷史起點與目前位置分開標示；日期只代表行程日期，不推定店家營業。未選保存前定位只供當次操作；保存行程／離線包時須明示包含起點，所有資料留在此瀏覽器，不呼叫外部路由服務。

## 離線與限制

使用「下載」後才建立當前路線的離線保存狀態。成功應包含頁面、必要資產、本地底圖與店家資料；畫面需顯示保存時間與範圍。手動離線切換是 UI 情境示範，不能取代實際斷網重開測試。瀏覽器可能清除快取；TownPass Android WebView 的保存與重開仍須實機驗證。頁面無雲端 LLM、無真人通知服務。

正式公開評論的身分、檢舉、維護責任及多人互助後端尚未實作。Prototype 不是正式服務完成度宣告。
