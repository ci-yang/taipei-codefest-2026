# 友善同行 App Prototype v3：地圖選資源與目的地搜尋

本資料夾是獨立、可發布的手機 App 討論原型，不變更 `apps/` 的正式服務。第三版以地圖選資源、搜尋目的地與路線預覽為入口；保留行程設定 → 路線確認 → 行程地圖，以及品質回報、離線及互助。評論與互助只在本機示範，未向真人發送；這不是原生 APK。本次先驗互動，不修改產品規格。

## 開啟

在 repo 根目錄執行 `pnpm prototype`，開啟 `http://localhost:8766`。只需 Python 3；不需啟動 API、Docker 或資料庫，也不需 `.env`。不使用 pnpm 時可直接執行 `python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/prototypes/friendly-route`。結束按 Ctrl+C；8766 已被占用時改用另一個本機 port，不停止別人的服務。

回歸測試：repo 根目錄執行 `pnpm test:prototype`（Node.js ≥ 22）。[v3 交接](../../handoff/2026-11-07-friendly-prototype-v3.md) 記錄這次改動與驗證；[原協作交接](../../handoff/2026-11-07-friendly-prototype-collaboration.md) 列出檔案地盤與待討論項目。此輪先做前端；規格是討論基線，不代表後端契約定案。

在本資料夾以 HTTP／HTTPS 提供檔案，再開啟 `index.html`。定位與 Service Worker 需要 HTTPS 或 localhost；定位另需使用者允許。`analysis.html` 是前版提案分析；`spec.html` 與 `proposal.md` 是第二版規格副本，正式來源位於 `.prospec/changes/enable-friendly-routes/`。這些規格檔本輪未改，不能當作第三版已定案規格。

## 第三版互動

1. 在地圖點選廁所、充電等資源，看店家卡片；選好起點後預覽到該資源的路徑。
2. 沿線資源以亮色標記，其餘資源降低亮度。這表示與路線的距離，不是品質等級或目前可用保證。
3. 透過卡片查看店家資訊；沿線店家資訊與更改目的地分開，避免查資訊時改掉原路線。
4. 搜尋目的地或另選起點。GPS 藍點只表示定位結果；明確選「以目前位置為起點」才帶入，重新定位不覆寫已選起點。

## 地點搜尋 API

`search.js` 將本地名冊與外部地點分開。輸入時只搜尋本地店名／地址；提交搜尋才呼叫 [Photon 公開示範 API](https://github.com/komoot/photon#demo-server)，不需金鑰。搜尋只送出查詢文字與固定臺北區域框，不送出 GPS、行程或評論。

Photon 是開源地理編碼服務，公開示範端點允許合理請求量，但沒有可用性保證。這版有逾時、取消、至少一秒請求間隔及同字詞的記憶快取；遇到服務錯誤仍能查本地名冊。這些是單頁面的限制，不是跨使用者流量控管。正式多人使用應另評估自架服務或有明確容量的服務端點，不能把示範 API 當正式 SLA。

可在載入 `search.js` 前，以 `window.FRIENDLY_SEARCH_CONFIG.endpoint` 指定替代 HTTPS Photon 端點。API 規格見 [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)。外部搜尋結果來自 OpenStreetMap，不自動帶上友善服務標籤。搜尋結果可能超出本地路網範圍；能找到地點不代表這份快照能計算到該地的路線。

## 資料來源

| 資料 | 來源與版本 | 是否模擬 |
|---|---|---|
| 店家、地址、座標、電話、四類服務標記 | [臺北市友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1)，繁中 CSV 更新 2026-07-20 | 否；從 993 筆原始記錄截取 103 筆地方快照 |
| 道路、建物、綠地 | [OpenStreetMap API](https://api.openstreetmap.org/api/0.6/map)，2026-11-07 擷取；© OpenStreetMap contributors，[ODbL-1.0](https://opendatacommons.org/licenses/odbl/1-0/) | 否；地方向量快照，非即時地圖 |
| 路線建議 | 同一批 OSM 官方匯出的地方路網，配合起點與依序目的地計算 | 計算結果；未實地驗證，非正式／無障礙導航 |
| 目前位置 | 裝置 Geolocation 回傳，附精度與取樣時間 | 否；示範起點另標示，不混稱 GPS |
| 外部目的地搜尋 | [Photon](https://github.com/komoot/photon)／OpenStreetMap，使用者提交時查詢 | 否；非友善店家認證，資料與可用性依服務端狀態 |
| 行程歷史 | 使用者明確保存的本機行程 | 不預填；展示時建立者僅供測試 |
| 評論、品質狀態 | 使用者在此瀏覽器的試填 | 是；不預填，不是公開評價或官方認證 |
| 附近協助 | 本機發布者／協助者角色切換 | 是；不通知真人、不代表救援服務 |

範圍：緯度 25.023–25.044、經度 121.546–121.574。這是地理框選的信義／大安東側，不是行政區邊界。全市地址以臺北市／台北市起首有 986 筆；原型沒有載入全市全部資料。

名冊欄位只有標記，空白表示「未標示」。消費條件、實際可用狀態與品質均未由名冊保證。Free WiFi 標記不等於非顧客可免消費使用。資料授權見[臺北市資料大平臺條款](https://data.taipei/rule)。

## 地圖與依賴

Leaflet 1.9.4 採 BSD-2-Clause，授權附於 `vendor/LICENSE-leaflet.txt`。本頁直接讀取本地 GeoJSON，不向圖磚伺服器請求地圖，沒有預抓 OSM 圖磚。`map-data.geojson` 為可再利用的 ODbL 地方資料副本；店家資料與 OSM 資料分屬各自授權。原型程式依專案 AGPL-3.0-or-later，隨報告附上 [LICENSE](LICENSE.txt) 與 [NOTICE](NOTICE.txt)。

資料建立工具在上一層 `build-friendly-data.py`：輸入官方 CSV 與 OSM API XML 匯出，產生 `data.js` 及 `map-data.geojson`。原始 CSV SHA-256 保存在 `FRIENDLY_DATA.source.sha256`；截取時間在 `fetchedAt`。不以爬蟲取得資料。

## 路線比較與位置

`routing-data.js` 是同一批 OSM 資料整理的本地步行候選圖，`routing.js` 在瀏覽器計算路線。最短只在這份可用路網、固定站序與連接方式下比較；資源最多只在本次產生的候選路線中比較，使用相同範圍及所選服務去重計數。沒有更有資源的可用候選時不製造第二條。端點短接線另揭露，不能代表現場可通行。

GPS 超出快照範圍、精度不足或不能接上路網時，讓使用者重新定位、手動選起點或明確進入示範。沒有自動改成展示座標。歷史起點與目前位置分開標示；日期只代表行程日期，不推定店家營業。未選保存前定位只供當次操作；保存行程／離線包時須明示包含起點，所有資料留在此瀏覽器，不呼叫外部路由服務。

## 離線與限制

使用「下載」後才建立當前路線的離線保存狀態。成功應包含頁面、必要資產、本地底圖與店家資料；畫面需顯示保存時間與範圍。手動離線切換是 UI 情境示範，不能取代實際斷網重開測試。瀏覽器可能清除快取；TownPass Android WebView 的保存與重開仍須實機驗證。頁面無雲端 LLM、無真人通知服務。

正式公開評論的身分、檢舉、維護責任及多人互助後端尚未實作。Prototype 不是正式服務完成度宣告。
