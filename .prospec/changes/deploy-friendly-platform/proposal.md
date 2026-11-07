# 友善同行：基礎平台與 App 部署

## Background
Ci 要負責實際前後端、開源地圖、部署及 App 設定，組員繼續改 prototype 與產品規格，並偏好 Cloudflare。現有 GCP 站健康，但 API 仍是骨架及示範點位；需要可由正式前端消費的真實名冊、運行介面與可重現部署。

## Premise
```yaml
problem: "友善資料與路由仍在獨立 prototype，正式站尚未接通對應資料服務與可重現 App 部署。"
source: user-observation
source_ref: "input-evidence.md#本輪指示"
evidence:
  kind: observation
  ref: "input-evidence.md#現況核對"
  result: "API 只有 healthz、places、opendata，線上 places 仍為 seed:demo；已核對原型真實資料、Cloudflare 權限及 App URL 設定。"
withdrawal: "若組員已有相同平台實作或 Ci 改變分工，先整合既有成果，不重複建立；平台條件不符時保留 GCP 基線重議。"
verification:
  status: verified
  by: "Codex 與只讀 explorer；2026-11-07"
  conclusion: "已核對程式、健康端點與工具權限；未驗證產品成效或 Android 實機。"
```

## User Stories
### US-1: 同源 HTTPS 平台 [P0]
作為整合者，我要從同一入口開啟前端並呼叫 API，讓組員可直接接線。
**Acceptance Scenarios:**
- WHEN 開啟首頁、前端深層路由與健康端點，THEN 正確載入資產並回報版本及資料可讀狀態。
- WHEN API 不存在、查詢無效或資料不可讀，THEN 回明確 JSON 與 HTTP 錯誤碼，不回首頁或假店家。
**Independent Test:** 對本機 Worker 與部署網址執行首頁、深層路由、健康與錯誤 API smoke。

### US-2: 可追溯名冊契約 [P0]
作為前端整合者，我要查詢真實店家及來源版本，才能將產品畫面接上資料。
**Acceptance Scenarios:**
- WHEN 依四類服務、附近位置或範圍查詢，THEN 回真實快照的名稱、地址、座標及已標示項目，多選任一符合、查無回空集合，空白不推定可用。
- WHEN 讀取公開設定與來源，THEN 可核對日期、範圍、來源及雜湊，不含 secret；查詢不保存 GPS 或行程。
- WHEN 重跑同版本匯入，THEN 不重複新增店家；失敗不把半份資料標成有效版本。
**Independent Test:** 固定快照核對四類與零筆／無效查詢；重跑匯入比對主鍵、筆數及版本。

### US-3: 地圖、定位與路由介面 [P0]
作為介面整合者，我要透過穩定介面取用位置、資料及路線，讓組員持續調整 UX。
**Acceptance Scenarios:**
- WHEN 在整合頁選服務與起迄點，THEN 地圖清單同步並呈現本地路網候選、距離及資源；出界、不連通不偽造可走直線。
- WHEN 定位拒絕、逾時、低精度、過期或出界，THEN 顯示原因、重試與手動入口，不以展示座標冒充 GPS；晚到不覆蓋手動。
- WHEN 地圖或路網資產失敗，THEN 清單仍可讀並可重試；介面可注入替身測試，不呼叫商用地圖或雲端 LLM。
**Independent Test:** 固定快照對照原型路由結果，注入位置／資產錯誤，手機寬度操作既有樣式的整合頁。

### US-4: 可重現 Android 建置 [P0]
作為 App 整合者，我要明確指定服務位址建置 APK，讓入口連到正確環境。
**Acceptance Scenarios:**
- WHEN 正式建置 App，THEN 要求有效 HTTPS URL，產物附來源 commit 與雜湊，不帶模擬器 HTTP 位址。
- WHEN App 請求定位，THEN manifest 同時宣告 coarse/fine 並保留其他官方服務相容；無實機時明示未驗，不冒稱 GPS／WebGL／離線實機通過。
**Independent Test:** 錯誤 URL 拒絕、APK 建置及 manifest 檢查；有裝置後另外做入口、定位與地圖實測。

### US-5: 部署、回退與分工 [P0]
作為維運者，我要從明確版本部署並能回退，避免帶入組員未完成的編輯。
**Acceptance Scenarios:**
- WHEN 驗證與部署，THEN 型別、lint、測試及建置有真實結果，發布明確產物與版本；不把 secret 或未追蹤檔無差別打包。
- WHEN 新版驗證失敗，THEN 可回復先前 Worker，明示不回復 DB；既有 GCP 站與資料保留。
- WHEN 組員修改 prototype／產品規格，THEN 本輪不覆寫其檔案，交接有正式程式、契約與部署責任表。
**Independent Test:** 記錄 Git SHA／部署版本，執行部署 smoke、回退與重部署，核對 GCP 仍健康。

## Stated Assumptions
1. 名稱 deploy-friendly-platform；full，跨前後端、資料、CI／部署與 App，無 tracker。
2. 此輪是可執行基礎平台，不代表七故事正式產品全部完成；`docs/prototypes/**` 與 enable-friendly-routes 規格屬組員，不修改。
3. Cloudflare 優先；先部署隔離測試網址。正式 hostname 待 Ci 回覆，GCP 不停機不刪資料。
4. 沿用已驗證的地方快照與裝置端路由，不藉調大 bounds 冒充全市路由；全市路由另需可用引擎與資料。
5. 評論、真人求助、身分及治理由產品規格定案後接寫入 API，本輪不擅定營運政策。
6. 正式 Vue 尚未驗證整包離線時明示需要網路；不把原型離線成果算成正式版。
7. Android 工具鏈存在、adb 無裝置；交付 APK 與待實機清單，iOS 不在本輪範圍。

## Edge Cases
無效座標／半徑／服務回錯誤；資料空或不可讀不回 demo seed；API 不被 SPA fallback 吃掉；Worker 回退與 DB 變更分開，本輪匯入可重跑且非破壞性；GPS、歷史與求助不因部署而上傳。

## Functional Requirements
- FR-001：同源資產、健康、版本與 JSON 錯誤（US-1）。
- FR-002：真名冊、四類查詢、來源與可重跑匯入（US-2）。
- FR-003：開源地圖、位置／路由 adapter 與整合頁（US-3）。
- FR-004：HTTPS APK 建置及權限／產物證據（US-4）。
- FR-005：CI、部署、回退、責任交接（US-5）。

## Success Criteria
- SC-001：本機及部署入口的首頁、深層路由、健康、有效／錯誤 API smoke 通過。
- SC-002：名冊四類對照、來源／雜湊及匯入重跑測試通過。
- SC-003：正式路由對照原型、GPS 錯誤及過期測試通過，手機寬度可操作整合頁。
- SC-004：APK 建置完成且有 URL／commit／SHA-256，manifest 核對 coarse/fine，實機缺口明示。
- SC-005：workspace 四項檢查、部署與回退有結果；產品 prototype/spec 無本輪 diff。

## Related Modules
Knowledge index／module-map 尚空，無 Feature Spec。候選路徑為 apps/api、apps/web、packages/shared、deploy／CI；TownPass 為獨立 repo，不假登錄為本 repo 模組。

## Open Questions
- NEEDS CLARIFICATION：正式 hostname 選擇；可先部署隔離測試網址。
- 正式多人寫入／全市路由的產品決策由組員規格確認。
- Knowledge WARN：尚無已登錄模組，計畫引用實際路徑。

## Constitution Check
五故事可各自驗證，部署與 APK 需依 URL 先後整合，INVEST 記依賴。繁中、開源地圖、可追溯資料、secret 隔離、不呼叫執行期雲端 LLM，保留 GCP。

## UI Scope
**Scope:** partial
沿用既有 Vue 地圖頁樣式，提供資料／定位／路由整合操作；組員的手機 prototype 不改版。
