# 友善平台需求差異

## ADDED

### REQ-FRIENDLY-PLATFORM-001: 同源平台與錯誤
**Feature:** friendly-platform
**Story:** US-1
**Description:** 前端與 API 由同一 HTTPS 入口提供，健康資訊包含部署版本與資料可讀狀態。
**Acceptance Criteria:**
1. 首頁與前端深層路由載入正確資產；健康端點可核對版本及資料。
2. 未知 API、無效查詢及資料失敗回 JSON 與對應 HTTP 錯誤碼，不回 SPA 或假資料。
**Priority:** High

### REQ-FRIENDLY-PLATFORM-002: 真實名冊與來源
**Feature:** friendly-platform
**Story:** US-2
**Description:** 真實地方快照可依服務、附近或範圍查詢，來源與版本公開可核對。
**Acceptance Criteria:**
1. 名稱、地址、座標及 wifi/charge/toilet/accessible 依來源；多選任一符合、查無回空，空白不推定可用。
2. 公開設定與來源包含日期、範圍、來源及 hash，沒有 secret；不保存 GPS／行程，應用 log 不記座標 query。
3. 同版本同內容匯入可重跑、無重複；不同內容拒絕覆寫，失敗不啟用半份資料。
**Priority:** High

### REQ-FRIENDLY-PLATFORM-003: 開源地圖與位置路由
**Feature:** friendly-platform
**Story:** US-3
**Description:** Vue 整合頁使用開源地圖與可注入 adapter，裝置端比較地方路網候選。
**Acceptance Criteria:**
1. 服務／起迄點選擇同步地圖清單，顯示候選距離及資源；出界或不連通明示無可用路線，接線與已知路網區分。
2. 定位拒絕、逾時、低精度、過期、出界有原因及重試／手動入口；展示座標不冒充 GPS，晚到回覆不覆蓋手動。
3. 地圖或圖資失敗保留清單與重試；不呼叫商用地圖或雲端 LLM，未完成離線包時明示網路需求。
**Priority:** High

### REQ-FRIENDLY-PLATFORM-004: Android 建置契約
**Feature:** friendly-platform
**Story:** US-4
**Description:** 外部 TownPass repo 使用明確 HTTPS URL 建置並交付可追溯 APK。
**Acceptance Criteria:**
1. 正式建置拒絕缺漏／無效／非 HTTPS URL，產物記 URL、來源 commit 與 SHA-256。
2. coarse/fine 權限並存、保留其他官方服務相容；沒有裝置時 GPS／WebGL／離線列未驗，debug signing 如實揭露。
**Priority:** High

### REQ-FRIENDLY-PLATFORM-005: 可重現部署與回退
**Feature:** friendly-platform
**Story:** US-5
**Description:** 從明確版本部署並保留前版 Worker 與 GCP 基線，分工可直接交接。
**Acceptance Criteria:**
1. typecheck/lint/test/build 有真實結果，發布明確 commit 與產物，不無差別打包未追蹤檔或 secret。
2. 新版失敗可回退先前 Worker；明示資料庫不隨之回退，保留前版快照、GCP 站與資料。
3. 不覆寫組員 prototype／產品規格；交接列正式程式、契約、部署責任與未驗項。
**Priority:** High

## MODIFIED
無；目前 trust zone 尚無既有 Feature Spec。

## REMOVED
無。
