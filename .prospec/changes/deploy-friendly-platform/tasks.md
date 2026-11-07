# 平台實作工作單
> 依最終 plan 單列 immutable D1 snapshot；候選 batch 不實作。各項括號標示 plan step；REQ 縮寫 001–005 均指 REQ-FRIENDLY-PLATFORM 前綴。
> 空 module-map：以下依實際檔案與 import 方向排序。新檔均由本輪建立，既有 owner 依 plan 重用。Tests 雖集中列出，撰寫時先建立失敗案例再實作。

## 共用契約與純函式
- [x] T01 定義 shared friendly/platform Zod schemas、命名型別與公開匯出，含四類、查詢、來源、版本（step 1；REQ-FRIENDLY-PLATFORM-001、REQ-FRIENDLY-PLATFORM-002）。
- [x] T02 抽出純路網型別、圖資料驗證、鄰接與最短路徑，保留原型語意（step 1；REQ-FRIENDLY-PLATFORM-003）。
- [x] T03 抽出候選比較、沿線資源及接線／出界結果，不依賴 window（step 1；REQ-FRIENDLY-PLATFORM-003）。
- [x] T04 建立 data/friendly 固定名冊／圖資與 manifest 的準備程式，分開來源 hash 與實測 hash，保留 provenance（step 1；REQ-FRIENDLY-PLATFORM-002）。

## 資料與後端
- [x] T05 實作 FriendlyRepository、snapshot adapter 與純查詢，OR／bbox／附近／零筆／無效查詢一致（step 2；REQ-FRIENDLY-PLATFORM-002）。
- [x] T06 實作 D1 snapshot table migration 與 readonly adapter，缺版本／錯誤資料 fail closed（step 2；REQ-FRIENDLY-PLATFORM-002）。
- [x] T07 實作 friendly routes、sources、public config、health、JSON errors 與 Worker 組裝（step 2；REQ-FRIENDLY-PLATFORM-001、REQ-FRIENDLY-PLATFORM-002）。
- [x] T08 Node 掛共用 friendly/config route，兩入口的 log 只記 pathname，不破壞舊 PostGIS route（step 2；REQ-FRIENDLY-PLATFORM-001、REQ-FRIENDLY-PLATFORM-002）。
- [x] T09 實作 idempotent 匯入 CLI：一列原子 INSERT、同版本異 hash 拒絕、回讀驗證，無公開寫入 API（step 2；REQ-FRIENDLY-PLATFORM-002）。

## 前端 adapter 與整合
- [x] T10 延伸 apiGet 支援取消／15秒逾時，友善名冊及圖資 adapter 以 shared schema 驗證（step 3；REQ-FRIENDLY-PLATFORM-002、REQ-FRIENDLY-PLATFORM-003）。
- [x] T11 位置 adapter／composable 重用 bridge，驗精度／時效／範圍，12秒逾時、generation 防晚到、手選入口（step 3；REQ-FRIENDLY-PLATFORM-003）。
- [x] T12 開源地圖 adapter：重用 MapLibre worker，載入 OSM GeoJSON、服務點、錯誤清單與重試（step 3；REQ-FRIENDLY-PLATFORM-003；design 地圖與名冊）。
- [x] T13 路線 adapter 與地圖 route／connector 圖層，候選卡切換距離與資源（step 3；REQ-FRIENDLY-PLATFORM-003；design 路線候選）。
- [x] T14 整合頁控制狀態與互動：四服務、起迄點、定位／手動與路線比較（step 3；REQ-FRIENDLY-PLATFORM-003；design 服務篩選、位置與起迄點；以既有 HTML/CSS 值核對）。
- [x] T15 整合頁呈現、router／首頁連結與 About 真來源，手機單欄、safe-area、錯誤／空／loading 與來源限制（step 3；REQ-FRIENDLY-PLATFORM-001、REQ-FRIENDLY-PLATFORM-003；design 全元件）。

## 建置與部署入口
- [x] T16 Wrangler Assets/D1/版本配置與明確資產準備，API worker-first、SPA 深層路由、公開 config 白名單（step 4；REQ-FRIENDLY-PLATFORM-001、REQ-FRIENDLY-PLATFORM-005）。
- [x] T17 Cloudflare release／rollback 腳本與 smoke，dirtytree 拒絕、環境互斥／版本前置檢查、有限逾時，首次失敗保留 GCP（step 4；REQ-FRIENDLY-PLATFORM-005）。
- [x] T18 CI 保留 PostGIS、加入 D1 與部署 smoke，發布 concurrency 與 commit/artifact metadata（step 4；REQ-FRIENDLY-PLATFORM-005）。
- [x] T19 [M] 重用外 repo TownPass-platform 的 HTTPS parser、coarse/fine 與建置腳本成果；依最終已驗 URL 交接，主 repo wrapper 不另寫 URL parser（step 5；REQ-FRIENDLY-PLATFORM-004）。

## Tests
- [x] T20 Vitest shared schema／query 與固定路由差異、出界／無路線測試；核對正式 data manifest/hash，不修改 prototype（step 6；REQ-FRIENDLY-PLATFORM-002、REQ-FRIENDLY-PLATFORM-003；shared/data）。
- [x] T21 Vitest Node/Worker routes、零筆／無效／資料失敗與非 test log 遮蔽，沿用舊 API 測試（step 6；REQ-FRIENDLY-PLATFORM-001、REQ-FRIENDLY-PLATFORM-002；API）。
- [x] T22 寫真實 local D1／Wrangler integration：migration、兩次匯入、異 hash／缺版本、API404 與 SPA deep link，覆蓋 scripts/CI 配置（step 6；REQ-FRIENDLY-PLATFORM-001、REQ-FRIENDLY-PLATFORM-002、REQ-FRIENDLY-PLATFORM-005）。
- [x] T23 Vitest Vue adapter／主流程：GPS拒絕、逾時、低精度、過期、出界、晚到；圖資／WebGL錯誤、清單與重試、選點路線（step 6；REQ-FRIENDLY-PLATFORM-003；web）。
- [x] T24 [V] 獨立複核 TownPass Python URL 與 Flutter 專用測試／manifest，記錄既有失敗與未驗實機；不把外 repo 測試當本 repo 覆蓋（step 5、6；REQ-FRIENDLY-PLATFORM-004）。
- [x] T25 [V] workspace typecheck/lint/test/build、手機寬度瀏覽器 smoke、fresh review／Claude 協作與文件來源核對（step 6；REQ-FRIENDLY-PLATFORM-001 至 REQ-FRIENDLY-PLATFORM-005；所有責任區含 docs）。

## 交付與紀錄
- [x] T26 [M] 建獨立 Cloudflare D1/Worker、匯入並部署明確 commit，驗 health/版本/來源/API；回退與重部署演練，核對 GCP仍健康（step 4、6；REQ-FRIENDLY-PLATFORM-001、REQ-FRIENDLY-PLATFORM-005）。
- [x] T27 [M] 對已驗 HTTPS 入口建 APK，核對 manifest、來源 SHA 與產物 hash；無實機時記待驗，不冒稱通過（step 5；REQ-FRIENDLY-PLATFORM-004）。
- [x] T28 更新 README／RUNBOOK／DECISIONS／handoff：端點契約、部署責任、正式／prototype 邊界、來源授權、APK 證據與未驗清單（step 6；REQ-FRIENDLY-PLATFORM-002、REQ-FRIENDLY-PLATFORM-004、REQ-FRIENDLY-PLATFORM-005）。

## Summary
- **Total Tasks:** 28
- 未加行數或平行標記；原型／圖資原樣搬移不以生成檔行數估計任務大小。T02/T03、T12/T13、T14/T15 以可獨立驗證界線拆分；程式超過 200 行時繼續在該項內拆函式與檔案，不合併責任。
