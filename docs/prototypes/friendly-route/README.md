# 友善同行：App 原型

直接開啟 `index.html` 對應的 HTTP／HTTPS 網址，就是資源地圖 App。手機全螢幕，桌面呈現最大 480px 的 App 視窗；沒有提案側欄或說明頁導覽。

本輪依 Ci 交接的 D6／D7 與凍結 proposal 實作。程式本體仍在這個目錄，使用純 JavaScript、Leaflet 1.9.4、OpenStreetMap 與 Phosphor 官方圖示；沒有 Vue 執行期依賴，沒有更動 `apps/web`／`apps/api`。

## 主流程

1. 開啟即要求定位；精度與取得時間顯示在地圖上。精度大於 100 公尺仍保留位置並提示。失敗時明示非目前位置，距離依地圖中心估算。
2. 搜尋目的地，先搜尋已下載的名稱／地址，送出後才使用 Photon。離線只查已下載資料，GPS 不附在搜尋請求。
3. 底部廁所／充電／Wi-Fi／無障礙可以多選，任一符合就高亮；再按取消，非符合點位保留淡色。
4. 點資源看名稱、類別、來源、官方更新日與「直線距離（非步行路線）」。有有效電話才顯示撥號。
5. 導航以 TownPass `launch_map` 送 geo URI，失敗或 5 秒逾時改送 OpenStreetMap URL。一般瀏覽器會說明「需在台北通 App 內使用」，保留地址／電話可複製。

本輪移除評論、品質回報、互助、協助者、求助；沒有安排／確認行程頁。多站與日期歷史是規格中的 P1，未在本輪主流程實作。

## 本機預覽與可分享產物

```sh
pnpm prototype
# http://127.0.0.1:8766

# 對外分享前必須打包，依檔案內容產生新快取版本。
python3 tools/package-friendly-prototype.py /tmp/friendly-app-package
python3 -m http.server 8776 --bind 127.0.0.1 --directory /tmp/friendly-app-package
```

`package-friendly-prototype.py` 只輸出執行用的 14 個檔案（含 SW），不包含舊提案頁、分析頁或歷史路由資產。快取清單含入口的兩種 URL，計 14 項。整合成員的 `data.js` 後，公開資料與頁面約 8.3 MB；最終大小以打包指令實測輸出為準。

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

每筆保留 `sourceId/sourceName/sourceUrl/updatedAt`；捷運座標另有 `coordinateSource`。電話原文與 `normalizedPhone` 分開，避免把分機或多組電話串成錯誤號碼。服務標記不代表目前可用、免消費、營業中或路線無障礙。

成員 `21bc1f3` 的 `build-friendly-data.py` 與 `data.js` 保留全市匯入及 Wi-Fi 同址彙整歷史；現行 App 只從 `data.js` 讀取地方底圖，點位／搜尋／四類篩選一律使用 `resources-data.js`。歷史品牌推定沒有進入現行分類。

離線重建／重新下載：

```sh
python3 tools/build-friendly-resources.py
python3 tools/build-friendly-resources.py --download
```

## 離線邊界

首次連線會自動快取全市點位與 app shell，全部必要項目成功才顯示「已快取」、時間與底圖範圍。失敗會列缺項，保留既有完整資料；版本與 URL scope 隔離。

離線快照底圖目前限信義區及大安東側（25.023–25.044 N、121.546–121.574 E），是已取得的 OSM 官方 GeoJSON。其他區域保留全市資源點位，缺底圖時使用方向與距離。線上 OSM raster tiles 僅用於當下互動視窗，不預抓、不收入離線包，遵伺服器 HTTP 快取設定。

定位離線仍可重試；不把 GPS、目的地或搜尋紀錄持久儲存。方向以正北為基準，不依賴羅盤；只有主動啟用且收到有效方位訊號才轉動箭頭，沒有位置不顯示箭頭。直線方向不保證現場道路可通行。

TownPass WebView 斷網重開、實際外部地圖／撥號與方位感測仍須 Android 實機驗證。沒有將瀏覽器與模擬 bridge 測試當成實機通過。

## 驗證與規格

```sh
pnpm test:prototype
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`friendly-app-state` 是 Node VM 的明示 DOM／Leaflet 替身；bridge 與 SW 測試分開，另有資料清洗測試。瀏覽器實測與限制詳見 [`QA-v6.md`](QA-v6.md)。舊路由計算保留作 P1 歷史資產，不在本輪 UI 或分享套件執行。

規格位於 `.prospec/changes/enable-friendly-routes/proposal.md`，blob `6da4a77f904db5877d10fe8a54adf90356a178dc`。已用 CLI 建立 acceptance revision 3；正式 Prospec validation 仍被既有 abandoned history 衝突阻擋，不宣稱計畫／驗證站完成，也不把主工作樹的 placeholder plan／delta 當成定案。
