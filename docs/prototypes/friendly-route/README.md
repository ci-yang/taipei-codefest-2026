# 友善同行 App Prototype v4：附近資源地圖

本資料夾是獨立、可發布的手機 App 討論原型，不變更 `apps/` 的正式服務。第四版只以一張地圖操作：顯示目前位置及資源，點資源就計算前往該資源的路徑；搜尋目的地只加上參考標記。評論與互助只在本機示範，未向真人發送；這不是原生 APK。本次先驗互動，不修改產品規格。

## 開啟

在 repo 根目錄執行 `pnpm prototype`，開啟 `http://localhost:8766`。只需 Python 3；不需啟動 API、Docker 或資料庫，也不需 `.env`。不使用 pnpm 時可直接執行 `python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/prototypes/friendly-route`。結束按 Ctrl+C；8766 已被占用時改用另一個本機 port，不停止別人的服務。

回歸測試：repo 根目錄執行 `pnpm test:prototype`（Node.js ≥ 22）。[v4 交接](../../handoff/2026-11-07-friendly-prototype-v4.md) 記錄這次互動；[原協作交接](../../handoff/2026-11-07-friendly-prototype-collaboration.md) 的分工供參考，其中舊版四頁流程已由這版單頁流程取代。

在本資料夾以 HTTP／HTTPS 提供檔案，再開啟 `index.html`。定位與 Service Worker 需要 HTTPS 或 localhost；定位另需使用者允許。`analysis.html` 是前版提案分析；`spec.html` 與 `proposal.md` 是第二版規格副本，正式來源位於 `.prospec/changes/enable-friendly-routes/`。這些規格檔本輪未改，不能當作第四版已定案規格。

## 第四版互動

1. 開啟地圖，取得裝置位置，查看友善資源；定位拒絕、失敗、精度不足或超出圖資範圍時明示狀態。示範位置必須主動選擇，不冒充 GPS。
2. 點廁所、充電等資源，直接呈現「目前位置 → 該資源」的綠色路線、距離與步行估算，不經過日期、多站、確認或開始頁。
3. 點另一個資源就重新計算到該資源。沿線資源以亮色標記，其餘降低亮度；高亮表示與路線的距離，不是品質或目前可用保證。
4. 搜尋目的地只保留藍色「目」參考標記。即使目的地是台北101，點廁所後綠線仍只到廁所，不延伸至台北101。更換或清除目的地不改資源路線。
5. 重新取得 GPS 後，以新位置更新資源路線。附近清單的直線距離與路線卡的步行路網距離分開標示。卡片可開店家資訊、離線保存及本機互助。

## 地點搜尋 API

`search.js` 將本地名冊與外部地點分開。輸入時只搜尋本地店名／地址；提交搜尋才呼叫 [Photon 公開示範 API](https://github.com/komoot/photon#demo-server)，不需金鑰。搜尋只送出查詢文字與固定臺北區域框，不送出 GPS、行程或評論。

Photon 是開源地理編碼服務，公開示範端點允許合理請求量，但沒有可用性保證。這版有逾時、取消、至少一秒請求間隔及同字詞的記憶快取；遇到服務錯誤仍能查本地名冊。這些是單頁面的限制，不是跨使用者流量控管。正式多人使用應另評估自架服務或有明確容量的服務端點，不能把示範 API 當正式 SLA。

可在載入 `search.js` 前，以 `window.FRIENDLY_SEARCH_CONFIG.endpoint` 指定替代 HTTPS Photon 端點。API 規格見 [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)。外部搜尋結果來自 OpenStreetMap，不自動帶上友善服務標籤。搜尋結果可能超出本地路網範圍；能找到地點不代表這份快照能計算到該地的路線。

## 資料來源

| 資料 | 來源與版本 | 是否模擬 |
|---|---|---|
| 店家、地址、座標、電話、四類服務標記 | [臺北市友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1)，繁中 CSV 更新 2026-07-20 | 否；從 993 筆原始記錄截取 103 筆地方快照 |
| 道路、建物、綠地 | [OpenStreetMap API](https://api.openstreetmap.org/api/0.6/map)，2026-11-07 擷取；© OpenStreetMap contributors，[ODbL-1.0](https://opendatacommons.org/licenses/odbl/1-0/) | 否；地方向量快照，非即時地圖 |
| 資源路線 | 同一批 OSM 官方匯出的地方路網，由目前／明示示範位置前往所選資源 | 計算結果；未實地驗證，非正式／無障礙導航 |
| 目前位置 | 裝置 Geolocation 回傳，附精度與取樣時間 | 否；示範起點另標示，不混稱 GPS |
| 外部目的地搜尋 | [Photon](https://github.com/komoot/photon)／OpenStreetMap，使用者提交時查詢 | 否；非友善店家認證，資料與可用性依服務端狀態 |
| 評論、品質狀態 | 使用者在此瀏覽器的試填 | 是；不預填，不是公開評價或官方認證 |
| 附近協助 | 本機發布者／協助者角色切換 | 是；不通知真人、不代表救援服務 |

範圍：緯度 25.023–25.044、經度 121.546–121.574。這是地理框選的信義／大安東側，不是行政區邊界。全市地址以臺北市／台北市起首有 986 筆；原型沒有載入全市全部資料。

名冊欄位只有標記，空白表示「未標示」。消費條件、實際可用狀態與品質均未由名冊保證。Free WiFi 標記不等於非顧客可免消費使用。資料授權見[臺北市資料大平臺條款](https://data.taipei/rule)。

## 地圖與依賴

Leaflet 1.9.4 採 BSD-2-Clause，授權附於 `vendor/LICENSE-leaflet.txt`。本頁直接讀取本地 GeoJSON，不向圖磚伺服器請求地圖，沒有預抓 OSM 圖磚。`map-data.geojson` 為可再利用的 ODbL 地方資料副本；店家資料與 OSM 資料分屬各自授權。原型程式依專案 AGPL-3.0-or-later，隨報告附上 [LICENSE](LICENSE.txt) 與 [NOTICE](NOTICE.txt)。

資料建立工具在上一層 `build-friendly-data.py`：輸入官方 CSV 與 OSM API XML 匯出，產生 `data.js` 及 `map-data.geojson`。原始 CSV SHA-256 保存在 `FRIENDLY_DATA.source.sha256`；截取時間在 `fetchedAt`。不以爬蟲取得資料。

## 資源路線與位置

`routing-data.js` 是同一批 OSM 資料整理的本地步行候選圖，`routing.js` 在瀏覽器計算路線。第四版直接採用目前位置到所選資源的最短可用候選，最短限定這份路網與連接方式。搜尋目的地不加入路線端點，也不參與距離／時間計算。端點短接線不能代表現場可通行，未提供即時導航或無障礙路由保證。

GPS 超出快照範圍、精度不足或不能接上路網時，讓使用者重新定位或明確進入示範。沒有自動改成展示座標。未選保存前定位只供當次操作；保存離線包時明示包含本次位置及目的地參考標記，資料留在此瀏覽器，不呼叫外部路由服務。離線還原顯示下載時保存的位置，不冒充新取得的 GPS。

## 離線與限制

使用「下載」後才建立當前路線的離線保存狀態。成功應包含頁面、必要資產、本地底圖與店家資料；畫面需顯示保存時間與範圍。手動離線切換是 UI 情境示範，不能取代實際斷網重開測試。瀏覽器可能清除快取；TownPass Android WebView 的保存與重開仍須實機驗證。頁面無雲端 LLM、無真人通知服務。

正式公開評論的身分、檢舉、維護責任及多人互助後端尚未實作。Prototype 不是正式服務完成度宣告。
