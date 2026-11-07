# 友善同行 prototype v4 交接

2026-11-07。Ci 確認採用 A：搜尋目的地只作參考標記；路線只從目前位置到點選的資源。本輪沿用 `feat/prototype-resource-map`，更新獨立 prototype，規格與正式 `apps/` 待後續討論。

## 操作基準

1. 取得目前位置，呈現友善資源與四類篩選。定位不可用時明示問題；示範位置必須自行選擇。
2. 點資源即顯示路線、路網距離、步行估算及資訊，不另做路線確認。
3. 搜尋台北101後保留「目」標記；點廁所畫至廁所，點充電改畫至充電。目的地標記持續保留，不參與路由。
4. 目的地的更換／清除與 GPS 更新分開；GPS 成功更新後重新計算到所選資源。
5. 離線開啟已保存資源路線及參考目的地；標示下載時的位置，不能稱為即時位置。

## 協作範圍

`app.js` 處理狀態與操作；`index.html` 是首頁及抽屜；`map-ui.css` 提供地圖介面；`sw.js` 管理離線資產。`search.js`、路網與開放資料沿用前版。現行 UI 已移除規劃／確認／行程頁；schema 4 離線資料會拒絕舊多站 snapshot。

啟動：`pnpm prototype`。驗證：`pnpm test:prototype`。資料範圍、來源及 API 限制見 [README](../prototypes/friendly-route/README.md)，實際測試結果見 [QA](../prototypes/friendly-route/QA.md)。

## 驗證

46 項 prototype 回歸、workspace typecheck／lint／38 項測試／build 通過；fresh-context reviewer 另以真實路由獨立驗證語意 A、GPS／搜尋競態與離線 schema。Chrome 390px／320px 操作及停止 HTTP 來源後重開驗證通過。GPS、TownPass 及現場通行仍待實機測試。
