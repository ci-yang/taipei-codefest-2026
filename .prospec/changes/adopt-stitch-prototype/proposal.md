# 依 Stitch 設計稿更新友善同行 App 原型

## Background
Ci 在 2026-11-07 指定 Stitch 專案 14902006353412021038，要求先截圖、透過 prospec-design 建立規格並取代目前 prototype，個人帳號排除。已從該專案匯出六個非帳號畫面的 HTML／PNG；現行原型為深綠地圖單頁，新稿包含淺色首頁、資源探索、目的地、資源連線、店家詳情與全螢幕導引。本次交付可操作的設計原型供 Ci 審閱，尚不代表道路路由或正式實作計畫完成。

## Premise
```yaml
problem: "目前原型的視覺與畫面組織不同於 Ci 指定的 Stitch 設計，需要可操作原型及後續實作可逐張核對的基準。"
source: user-observation
source_ref: "Ci 2026-11-07 本輪指示；https://stitch.withgoogle.com/projects/14902006353412021038"
evidence:
  kind: observation
  ref: "../../../docs/design/stitch-20261107/manifest.json；docs/prototypes/friendly-route/index.html（基底 06cd21e）"
  result: "以 OpenCLI hcxs5tb4 取得瀏覽器截圖，透過 Stitch Export 匯出 HTML／PNG；畫布七個 App 畫面中排除個人帳號，其餘六個已保存檔案雜湊。"
withdrawal: "若 Ci 指定其他設計版本或撤回本方向，停止以此封存稿作為實作基準，記錄替代來源。"
verification:
  status: verified
  by: "Codex；2026-11-07；實際瀏覽與匯出檔核對"
  conclusion: "僅驗證設計來源存在及與原型有差異，不把 Stitch 生成的商家、評分、路況或數字當成真實資料。"
```

## User Stories

### US-1: 由首頁進入附近資源地圖 [P0]
作為外出尋找充電、網路或廁所的市民，我想從簡潔首頁進入地圖，以便切換需求並找到資源。
**Acceptance Scenarios:**
- WHEN 開啟原型，THEN 顯示 S01 的淺色首頁、橘色出發鈕與兩張資訊卡；卡片使用實際名冊與快取狀態，沒有帳號入口、評分或未證實的認證比例。
- WHEN 按出發，THEN 進入 S02 的地圖、浮動搜尋與右上定位鈕，下方為橫滑類別、橫滑資源卡、探索操作與交通偏好，不經確認路線頁。
- WHEN 切換類別或定位失敗，THEN 保留任一符合的多選 highlight、零筆結果與「非目前位置」提示，距離來源清楚可見。
**Independent Test:** 開啟、出發、四類切換與取消、重新定位；320／390／430px 無整頁水平溢出，全部操作可觸及。

### US-2: 搜尋目的地並查看資源詳情 [P0]
作為前往目的地途中需要資源的市民，我想在同一張地圖搜尋地點並點店家，以便比較可取得的服務。
**Acceptance Scenarios:**
- WHEN 選擇搜尋目的地，THEN 依 S03 顯示獨立旗標與可修改搜尋膠囊，不取代原選資源及其連線。
- WHEN 點資源，THEN 呈現 S05 的中央白卡與灰色遮罩，包含真實名稱、服務、直線距離、來源與更新日；未知營業時間及條件標為待確認，不顯示虛構評分、速度或免費保證。
- WHEN 關閉卡片、導航或撥號，THEN 回到原地圖狀態或沿用既有裝置橋接與失敗退路；無電話不顯示撥號，無座標不畫連線。
**Independent Test:** 搜尋本機點位、保留已選資源、開關詳情與遮罩、無電話／無座標及無 bridge；核對來源欄位。

### US-3: 切換自由探索與全螢幕方位導引 [P0]
作為需快速找到資源的市民，我想從資源卡進入全螢幕導引，以便專注查看方向與距離。
**Acceptance Scenarios:**
- WHEN 選資源並開始導引，THEN 參照 S04／S06 的橘紫視覺與白卡呈現實際直線距離及正北基準方位，不生成未驗證的轉彎指令、步行時間或無障礙路況。
- WHEN 自由探索模式開始，THEN 進入滿版附近地圖，不要求目的地；選資源才有對應方位，無 GPS 不假裝取得目前位置。
- WHEN 切換交通偏好或結束導引，THEN 選項有選取狀態但不捏造路線，明示直線距離與交通路線不同；結束後保留搜尋目的地、類別與已選資源。
**Independent Test:** 自由探索、選資源、導引、結束、定位失敗及四種交通偏好；核對同座標計算的距離。

### US-4: 讓組員依同一設計基準實作 [P0]
作為接續開發的組員，我想取得來源截圖與規格對照，以便照原型實作而不重新猜測。
**Acceptance Scenarios:**
- WHEN 交付原型，THEN 六個來源畫面有名稱、節點識別、PNG、原始 HTML 與雜湊，並有 design-spec、interaction-spec 及畫面對照表。
- WHEN 原型採用不同於原稿的資料或互動，THEN 對照表列明原因、處理及後續驗收；帳號列為排除，不新增收藏、歷史、評論或互助。
- WHEN 後續驗收，THEN 必須依同尺寸截圖、設計 token 與操作案例核對；Ci 尚未審閱前標為待審基準，不宣稱正式產品規格已核准。
**Independent Test:** 核對來源雜湊、文件與六種狀態；比對 390×884 原型截圖和原稿。

## Stated Assumptions
1. 名稱 adopt-stitch-prototype，scale 為 standard：限純 JS 原型與設計文件，不變更後端、部署或裝置協定。
2. 「開心規格」解讀為新增畫面開新規格。本 change 獨立於凍結 proposal（blob 6da4a77f904db5877d10fe8a54adf90356a178dc），不修改原文。
3. 採畫布當下六個非帳號稿；同名「3」分為詳情與導引。首頁為 App 進入畫面，不加入提案／說明頁。
4. 新稿取代深綠視覺與啟動畫面；D6 的不做評論、回報、互助及原 GPS／離線／來源規則保留。
5. 道路路由、估時、轉彎導航、多站停靠留待後續計畫；此版交通列為偏好選擇，導引為直線距離及方位。
6. 不沿用無來源的店名、評分與數值。首頁曲線僅為裝飾，不當成真實地理路徑。
7. 以 390×884 比對，支援 320–480px 與桌面置中。保留使用者縮放，以系統字型維持離線，字型替換列為差異。
8. 設計 HTML 輸出沿用 docs/prototypes/friendly-route；來源存 docs/design/stitch-20261107。先分享獨立預覽，不替換 production 或重包 APK。

## Edge Cases
- 定位拒絕／逾時：保留探索與地圖中心估算，標示非本人位置。
- 離線或快取部分失敗：顯示真實狀態，不假裝全部完成，保留重試。
- 無座標、無電話、無條件：明示缺漏，不補寫店家能力。
- 小螢幕與放大文字：可直向捲動；橫滑只限類別／卡片區，主要操作可觸及。
- 原稿「100%」「已認證」「即時路況最佳化」等無證據文案：移除或替換為可查證資訊。

## Functional Requirements
- FR-001：首頁、附近探索、目的地、資源連線、詳情、導引六種視覺狀態（US-1～US-3）。
- FR-002：保留既有資料、搜尋、GPS、highlight、來源、橋接與失敗退路（US-1、US-2）。
- FR-003：自由探索／資源導引切換及交通偏好，不造路線或估時（US-3）。
- FR-004：保留真實快取狀態、離線重開與方位退路，不新增 runtime 字型／樣式 CDN（US-1～US-3）。
- FR-005：來源封存、設計與互動規格、差異表、同尺寸截圖驗收（US-4）。

## Success Criteria
- SC-001：六個來源畫面檔案與雜湊齊全；帳號明列排除。
- SC-002：proposal 與 design-spec 結構檢查通過，無未解阻擋標記。
- SC-003：新主流程、既有 prototype 與打包測試通過。
- SC-004：獨立審查核對截圖、來源與差異表；390×884 可完成主流程。
- SC-005：分享網址直接進入新版 App，既有 production 未改版。

## Related Modules
已讀 prospec/index.md，module-map 尚空且 prospec/specs/features 不存在，Knowledge 比對記 WARN。影響為 docs/prototypes/friendly-route、其測試、docs/design 與本 change；不宣稱模組已註冊。

## Open Questions
本版為 Ci 審閱原型；路由供應者與正式導引能力留待後續計畫，不阻擋本次已界定範圍。

## Constitution Check
繁中、真實開放資料、開源免費地圖；無 runtime 雲端推論、secret 或帳號／互助。故事都有可觀察驗收；共用狀態依賴以固定輸入分別測試。Knowledge 尚空記 WARN，不把結構檢查當成使用者成效。

## UI Scope
**Scope:** full
六種手機狀態及既有搜尋、設定、離線退路；參照 S01–S06、design-spec 與 interaction-spec。排除帳號、收藏歷史、評分評論、多站停靠與未證實的即時導航內容。
