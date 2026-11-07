# 友善同行 Prototype

本資料夾是獨立、可發布的需求討論原型，不變更 `apps/` 的正式服務。五個流程都供操作；評論與互助只在本機示範，未向真人發送。

## 開啟

在本資料夾以 HTTP／HTTPS 提供檔案，再開啟 `index.html`。Service Worker 在 HTTPS 或 localhost 才能註冊。入口 `analysis.html` 是提案分析；`spec.html` 與 `proposal.md` 是第一版規格副本，正式來源位於 `.prospec/changes/enable-friendly-routes/`。

## 資料來源

| 資料 | 來源與版本 | 是否模擬 |
|---|---|---|
| 店家、地址、座標、電話、四類服務標記 | [臺北市友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1)，繁中 CSV 更新 2026-07-20 | 否；從 993 筆原始記錄截取 103 筆地方快照 |
| 道路、建物、綠地 | [OpenStreetMap API](https://api.openstreetmap.org/api/0.6/map)，2026-11-07 擷取；© OpenStreetMap contributors，[ODbL-1.0](https://opendatacommons.org/licenses/odbl/1-0/) | 否；地方向量快照，非即時地圖 |
| 依順序連接的路徑 | 使用上表真實座標的直線連線 | 是；示意連線，不是步行／無障礙導航 |
| 評論、品質狀態 | 使用者在此瀏覽器的試填 | 是；不預填，不是公開評價或官方認證 |
| 附近協助 | 本機發布者／協助者角色切換 | 是；不通知真人、不代表救援服務 |

範圍：緯度 25.023–25.044、經度 121.546–121.574。這是地理框選的信義／大安東側，不是行政區邊界。全市地址以臺北市／台北市起首有 986 筆；原型沒有載入全市全部資料。

名冊欄位只有標記，空白表示「未標示」。消費條件、實際可用狀態與品質均未由名冊保證。Free WiFi 標記不等於非顧客可免消費使用。資料授權見[臺北市資料大平臺條款](https://data.taipei/rule)。

## 地圖與依賴

Leaflet 1.9.4 採 BSD-2-Clause，授權附於 `vendor/LICENSE-leaflet.txt`。本頁直接讀取本地 GeoJSON，不向圖磚伺服器請求地圖，沒有預抓 OSM 圖磚。`map-data.geojson` 為可再利用的 ODbL 地方資料副本；店家資料與 OSM 資料分屬各自授權。原型程式依專案 AGPL-3.0-or-later，隨報告附上 [LICENSE](LICENSE.txt) 與 [NOTICE](NOTICE.txt)。

資料建立工具在上一層 `build-friendly-data.py`：輸入官方 CSV 與 OSM API XML 匯出，產生 `data.js` 及 `map-data.geojson`。原始 CSV SHA-256 保存在 `FRIENDLY_DATA.source.sha256`；截取時間在 `fetchedAt`。不以爬蟲取得資料。

## 離線與限制

使用「下載」後才建立當前路線的離線保存狀態。成功應包含頁面、必要資產、本地底圖與店家資料；畫面需顯示保存時間與範圍。手動離線切換是 UI 情境示範，不能取代實際斷網重開測試。瀏覽器可能清除快取；TownPass Android WebView 的保存與重開仍須實機驗證。頁面無雲端 LLM、無真人通知服務。

正式公開評論的身分、檢舉、維護責任及多人互助後端尚未實作。Prototype 不是正式服務完成度宣告。
