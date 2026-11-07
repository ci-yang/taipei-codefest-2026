# Verify Evidence: deploy-friendly-platform

<!-- prospec:evidence-section -->
<!-- prospec:evidence-attempt prospec-verify:dcceffb361a68f61b8aba9082a82a2ff4d925282e4ee3eeac77e52b3ba0b32c2 -->
## 2026-11-07 — grade A

<!-- prospec:evidence delta-spec-compliance -->
### delta-spec-compliance — WARN

**Context ID:** `2d7c8bb0513d86064aa495c9e6d3b22da2de5869d42135522da2eacbd8c47272`

**Summary:** 5 REQs／13 情境已逐條核對；程式契約與測試符合，HTTPS 部署、雲端回退及 APK 交付證據仍待手動操作。

**Repro:** `sed -n '28,45p' docs/handoff/2026-11-07-cloudflare-platform.md; node --test scripts/*.test.mjs`

fresh grader 只在指定 snapshot 執行測試，main 僅讀規格/程式/既有證據。最初 pnpm test 因 snapshot symlink dependencies 觸發 verify-deps，以 ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY 中止；未當成產品失敗或已完成全 suite。改隔離 cache 目錄並直接使用 Vitest binary，web 47 + shared 7 + 相關 API 38 = 92 tests 全通過，另 node --test scripts/*.test.mjs 29 tests 通過。prepared pnpm test passed 屬原有機器紀錄；本 grader 未重跑 PostGIS 全 suite/local D1/瀏覽器/遠端/APK。
逐條核對 frozen baseline：
US-1.1 — WARN — 本機 SPA/API/health 契約與 local D1 證據俱備；尚缺真實 HTTPS 部署 smoke。
US-1.2 — PASS — platform 測試驗 API 404、無效查詢 400、資料錯誤 503 皆 JSON，不回 SPA 或假資料。
US-2.1 — PASS — friendly 測試驗四服務 OR、bbox、附近、空結果與空白服務保持未標示。
US-2.2 — PASS — config 白名單、來源日期/範圍/hash；非 test 日誌確認有 pathname 而無座標 query，GPS 不傳 API。
US-2.3 — PASS — SQLite 真實驗同版本重跑仍一列、衝突保留原版；單列原子寫入與 schema/hash 回讀。
US-3.1 — PASS — web 主流程與 shared 差異測試驗服務/起迄/候選、距離/資源；出界/不連通不造直線，接線分段。
US-3.2 — PASS — location/explorer 測試驗拒絕、逾時、低精度、過期、出界及模擬位置；手選使晚到回覆無效，UI 有重試。
US-3.3 — PASS — WebGL/圖資/路網失敗測試確認清單與重試仍可用；adapter 可注入，MapLibre/OSM，無雲端 LLM。
US-4.1 — WARN — URL parser 與 wrapper 測試符合，但目前沒有實際 APK、URL/來源 SHA/hash 與產物 manifest 收據。
US-4.2 — PASS — 外 repo manifest coarse/fine 並存；既有官方服務 URL 有獨立測試，handoff 揭露無裝置及 debug signing。
US-5.1 — WARN — 四項檢查有紀錄、clean SHA/明確資產流程有測試；發布版本與實際產物收據待 T26。
US-5.2 — WARN — 回退程式與替身測試通過且不回退 DB；缺 Cloudflare 回退/重部署及發布後 GCP 健康收據。
US-5.3 — PASS — git diff HEAD -- docs/prototypes .prospec/changes/enable-friendly-routes deploy 為空；CLOUDFLARE/handoff 有責任表。
未完成 [M] 不阻 code-task gate，但不能使實際交付證據自動變 PASS。尚缺的操作證據以 WARN 保留，未發現程式改寫 acceptance intent。

#### Requirements Compliance

| REQ ID | Result | Kind | Evidence | Repro |
|---|---|---|---|---|
| REQ-FRIENDLY-PLATFORM-001 | WARN | executable | 本 grader 於 snapshot 實跑 platform/friendly/import 三測試檔共 38 tests 通過。edge-app.ts 使用 JSON notFound/onError；routes/friendly.ts 先驗查詢，資料失敗回 503；routes/platform.ts 讀指定版本後回 health/config。wrangler.jsonc run_worker_first 隔開 API/SPA。scripts/test-platform-integration.mjs 與 handoff 有既存 local D1/深層路由證據。但 handoff「部署與 APK 執行紀錄」仍列未發布；T26 待 clean SHA，缺正式 HTTPS 入口 smoke，故 WARN。 | `cd apps/api && node node_modules/vitest/vitest.mjs run test/platform.test.ts` |
| REQ-FRIENDLY-PLATFORM-002 | PASS | executable | 上述 38 tests 在 snapshot 通過：全部資產 hash、來源宣告/量測欄位、OR/bbox/附近/limit/零筆/無效參數及空服務均有斷言。query.ts 僅純讀取；platform.test.ts 在非 test 環境確認真實輸出 pathname 且不含 lat/lng/query，config 僅白名單。import-friendly.ts 單列 INSERT OR IGNORE、回讀驗 hash；migration 阻擋 UPDATE/DELETE；SQLite 實測重跑一列、衝突不覆寫。遠端 --command 測試是替身，未冒稱遠端匯入實跑。README 與 FriendlySources 顯示來源、日期、範圍、hash；explorer 不將 GPS 傳 API。 | `cd apps/api && node node_modules/vitest/vitest.mjs run test/friendly.test.ts test/friendly-import.test.ts test/platform.test.ts` |
| REQ-FRIENDLY-PLATFORM-003 | PASS | executable | snapshot 獨立實跑 web 47 tests、shared 7 tests 全通過。routing.test.ts 與凍結 prototype 比對完整輸出，並驗出界/不連通不回直線；location 測拒絕、12 秒逾時、精度/時效/出界/mock/取消。explorer 測晚到不覆手選、服務變更清路線、圖資失敗留清單/重試；map 測 WebGL/資產失敗、控制器與 connector 分段。friendly-map.ts 使用 MapLibre 本地 OSM 與虛線接線，FriendlySources.vue:26 明示需要網路、尚無完整離線下載。手機瀏覽器實測僅引用 handoff 既有 390×844 紀錄，未冒稱本 grader 重測實機。 | `cd apps/web && node node_modules/vitest/vitest.mjs run; cd ../../packages/shared && node node_modules/vitest/vitest.mjs run` |
| REQ-FRIENDLY-PLATFORM-004 | WARN | executable | snapshot 的 build-townpass 測試通過：轉交單一 URL owner、記雙 repo SHA/dirty、URL 與 APK hash，拒絕未更新/舊 timestamp APK，check/dry-run 不冒稱產物。只讀核對 TownPass-platform/scripts/build-codefest.sh:33 起正式建置拒絕缺漏/無效/非 HTTPS；HTTP 例外限明示 debug emulator。manifest coarse/fine 俱有，/tmp/townpass-platform-review.md 已有 URL 7 tests、Flutter 專用 2 tests 與官方 URL 不變證據。T19/T27 未完，handoff 明示 APK 待發布後建立；compileReleaseKotlin/設定檢查不能代替實際 APK、hash 與產物 manifest。無裝置、GPS/WebGL/離線未驗及 debug signing 已揭露。 | `node --test scripts/build-townpass.test.mjs; sed -n '28,45p' docs/handoff/2026-11-07-cloudflare-platform.md` |
| REQ-FRIENDLY-PLATFORM-005 | WARN | executable | snapshot 獨立跑 29 tooling tests 全通過。release-platform.mjs 驗 clean HEAD、source SHA、限定 build、互斥 lock、每次關鍵動作前核對遠端版本；prepare-platform-assets.mjs 僅驗 hash 並複製四個明確資產。CI 保留 PostGIS、執行四項檢查與 local D1；發布 main/needs verify/concurrency 有測試。release tests 以注入依賴驗失敗回退、不改 DB、首次無前版失敗及不回退別人版本；platform-release-state.mjs 先驗前版快照。prepared test_attempt passed，handoff 有其他檢查紀錄。prototype/spec/deploy 原檔無 diff，責任表清楚。然而尚缺真實發布 SHA/Worker version/rollback/redeploy 及發布後 GCP 健康收據；不能把替身測試當雲端演練，故 WARN。 | `node --test scripts/*.test.mjs; sed -n '28,45p' docs/handoff/2026-11-07-cloudflare-platform.md` |

#### Scenario Deviation Findings

| Scenario ID | Affected REQs | Spec Location | Result | Summary | Evidence |
|---|---|---|---|---|---|
| US-1.1 | REQ-FRIENDLY-PLATFORM-001 | proposal.md:26 | WARN | 本機 SPA/API/health 契約與 local D1 證據俱備；尚缺真實 HTTPS 部署 smoke。 | 此為操作/交付證據尚未完成的限制，非程式改寫情境。本機 SPA/API/health 契約與 local D1 證據俱備；尚缺真實 HTTPS 部署 smoke。 可重查 docs/handoff/2026-11-07-cloudflare-platform.md「部署與 APK 執行紀錄」及 tasks.md T19/T26/T27；完成收據後重新核對。 |
| US-4.1 | REQ-FRIENDLY-PLATFORM-004 | proposal.md:49 | WARN | URL parser 與 wrapper 測試符合，但目前沒有實際 APK、URL/來源 SHA/hash 與產物 manifest 收據。 | 此為操作/交付證據尚未完成的限制，非程式改寫情境。URL parser 與 wrapper 測試符合，但目前沒有實際 APK、URL/來源 SHA/hash 與產物 manifest 收據。 可重查 docs/handoff/2026-11-07-cloudflare-platform.md「部署與 APK 執行紀錄」及 tasks.md T19/T26/T27；完成收據後重新核對。 |
| US-5.1 | REQ-FRIENDLY-PLATFORM-005 | proposal.md:56 | WARN | 四項檢查有紀錄、clean SHA/明確資產流程有測試；發布版本與實際產物收據待 T26。 | 此為操作/交付證據尚未完成的限制，非程式改寫情境。四項檢查有紀錄、clean SHA/明確資產流程有測試；發布版本與實際產物收據待 T26。 可重查 docs/handoff/2026-11-07-cloudflare-platform.md「部署與 APK 執行紀錄」及 tasks.md T19/T26/T27；完成收據後重新核對。 |
| US-5.2 | REQ-FRIENDLY-PLATFORM-005 | proposal.md:57 | WARN | 回退程式與替身測試通過且不回退 DB；缺 Cloudflare 回退/重部署及發布後 GCP 健康收據。 | 此為操作/交付證據尚未完成的限制，非程式改寫情境。回退程式與替身測試通過且不回退 DB；缺 Cloudflare 回退/重部署及發布後 GCP 健康收據。 可重查 docs/handoff/2026-11-07-cloudflare-platform.md「部署與 APK 執行紀錄」及 tasks.md T19/T26/T27；完成收據後重新核對。 |
<!-- prospec:evidence-end -->

<!-- prospec:evidence constitution -->
### constitution — PASS

**Summary:** 依機器 inventory 核對全部 10 條憲章規則，未發現本 change 違反 MUST／SHOULD。

**Repro:** `git diff HEAD -- .env.example package.json .github/workflows/ci.yml; rg -n '^import|: any\b' packages/shared/src apps/api/src/friendly`

採用 prospec-report.json 全部10條規則及既有 severity，逐條記可重查 statement。型別/邊界/依賴/授權/來源/無雲端 LLM/secret 隔離均有程式與測試依據；空 Knowledge 及既有 scaffold 不假造為新增成果，尚未提交的標頭不提前背書。完整 suite provenance 由機器維度判定，此處只引用已有紀錄及獨立契約測試。
<!-- prospec:evidence-end -->

<!-- prospec:evidence design -->
### design — WARN

**Summary:** 主要整合流程與錯誤備援符合設計，23項相關測試通過；服務chip全圓角被頁面按鈕樣式覆蓋，路線比較缺規格指定的計算中狀態。

本次為 fresh-context 的 design 維度核對，依 design-spec.md:2-3、43-44 與 proposal.md 的 partial UI scope，只驗證沿用既有白底綠色樣式的正式 Vue 平台整合頁；組員另外的深色 App prototype、四步產品流程與完整離線不列入本輪必備設計。已讀 HTML adapter；本 change 明訂 spec-only，沒有獨立 prototype 可作像素比對，因此以設計規格、SFC/CSS、實際執行測試與既有 host smoke 分別列證。

驗證方式：
- 本 grader 在 ticket snapshot /private/var/folders/v1/2qrgkmr92mgbc668grwdx09w0000gn/T/prospec-snapshot-verify-grader-design-1-1-RxmCxX 執行 pnpm --filter @app/web exec vitest run test/friendly-explorer.test.ts test/friendly-map.test.ts test/friendly-location.test.ts test/friendly-api.test.ts；2026-11-07 16:06:36 開始，exit 0，4 files／23 tests 通過。測試使用替身 MapLibre／位置 adapter，不算真實 WebGL 或 native GPS 測試。
- 在同一 snapshot 用 vue/compiler-sfc compileStyle 實際編譯 FriendlyMapPage.vue scoped style，輸出 button[data-v-design-check] 的 border-radius: 10px；這是 CSS 靜態編譯證據，非瀏覽器截圖。
- 引用已執行的 host smoke：docs/handoff/2026-11-07-cloudflare-platform.md:24 記錄 Chrome 390×844、最短 1,565m／資源候選 1,975m、候選切換繪圖、Wi-Fi 名冊 103→75、條件改動清除路線、scrollWidth=viewport=390。本 grader 沒有重跑該瀏覽器操作。

| Component | Visual | Interaction | Status |
|---|---|---|---|
| 首頁與共用外框 | PASS：HomePage.vue 的 h1=22px、白底綠色 CTA、主操作 min-height 44px；style.css:3-21 的品牌/文字/輔助/邊框值、系統繁中字體、14px 輔助字與 16px 頁距符合既有樣式。surface/danger 以等值白色與 #b00020 literal 實作，沒有色值偏差。 | PASS：HomePage.vue 提供 /map 與四類服務 query 入口及 /about 來源連結；router.ts 路由對應 FriendlyMapPage、AboutPage；App.vue:7-10 保留固定主選單。屬靜態程式核對。 | PASS |
| 服務篩選 | WARN：四類按鈕、active 品牌弱底、40px 觸控高度符合；但 FriendlyMapPage.vue:75 的 scoped button selector 實際編譯為 button[data-v-*]，specificity (0,1,1) 高於 style.css:19 的 .chip (0,1,0)，使規格 design-spec.md:19 指定的全圓角 999px 被覆蓋為 10px。 | PASS：FriendlyMapPage.vue:29-34 有 aria-pressed、多選切換、載入及名冊錯誤；useFriendlyExplorer.ts:24、41-43 採任一符合且空選顯示全部。friendly-explorer.test.ts 的 loads real data, OR filters, manual points, routes and clears previous route when any input changes 已通過；host smoke 103→75 另有實測紀錄。 | WARN |
| 地圖與名冊 | PASS：FriendlyMapPage.vue:60-63 名稱/地址/服務/選點、77-80 可捲動 10px 卡片與選取樣式；FriendlyMap.vue:38 與 friendly-map.ts:13-22 顯示服務點、起迄點、品牌實線與棕色虛線接線及文字圖例。地圖資料使用本地 GeoJSON 與 OSM attribution。 | PASS：FriendlyMapPage.vue:18 同一 visibleStores／selectedRoute 同步至地圖；FriendlyMap.vue:12-31、35-37 有載入、15秒 ready timeout、錯誤、重試與離頁 abort/destroy。friendly-map.test.ts 的 WebGL failure retry、map asset failure、graph failure retry、connector conversion 四項通過；錯誤時名冊仍保留 103 筆、手動選點及比較仍可用（僅路網失敗時停用比較）。Page:59 有 NoMatch 文案。 | PASS |
| 位置與起迄點 | PASS：FriendlyMapPage.vue:35-53 清楚分區、label/select、16px 字級、44px select；75-81 含 40px 按鈕、disabled 降低透明度、3px focus-visible。 | PASS：useFriendlyExplorer.ts:17 起點初始 null；selectStart 取消舊請求；locate 用 generation/abort 阻止晚到；friendly-location.ts:4、14-30、32-65 區分拒絕/12秒逾時/精度/時效/範圍/模擬位置。friendly-location.test.ts 11 項、friendly-explorer.test.ts 晚到/拒絕/模擬位置測試實際通過；Page:37 loading disabled、38-39 可讀原因與來源、41-47 手動起迄點始終可選。 | PASS |
| 路線候選 | PASS：FriendlyRouteResults.vue:12-19 列距離、估時、資源數、接線與 warning；25-26 白底卡片及 active 品牌邊框符合。 | WARN：Page:55 綁定候選選取，FriendlyMap.vue:29 更新地圖；routing.ts:106 無第二條時明示未找到增加資源替代路線，:57 不連通明示改選地點；缺起迄點由 canCompare 停用。這些通過測試/靜態核對及既有候選切換 host smoke。但是 design-spec.md:35 要求 loading「計算中」，目前 useFriendlyExplorer.ts:98-103 為同步直接 compare，未有 comparing state；Page:53 按鈕文字固定「比較路線」，FriendlyRouteResults.vue:7-20 僅空/錯誤/結果分支，無計算中可感知狀態。 | WARN |
| 來源與限制 | PASS：FriendlySources.vue:10-21 呈現可點來源、更新/擷取日期、地方 bounds、版本、授權、校驗值；:32 長 hash 可斷行，原生 a 保持底線。 | PASS：FriendlySources.vue:24-26 有載入/錯誤/retry、網路需求與裝置計算限制；AboutPage.vue 的 load、catch、retry 綁定與 abort 可查，useFriendlyExplorer.ts:81-87 不以預設成功來源替代錯誤；App.vue 固定 /about 入口。此元件流程屬靜態核對，API timeout/error 另外由 friendly-api.test.ts 執行通過。 | PASS |
| 手機版、鍵盤與 safe-area | PASS：style.css:13-20 border-box、頁面 16px padding/max-width 640、chips flex-wrap；Page:72-80 grid 單欄、select width100%/min-width0、store-actions wrap；FriendlyMap.vue:43 地圖 width100%；style.css:17 與 App.vue:22 為內容/底欄同時保留 safe-area。 | PASS：原生 button/select/link 支援鍵盤，篩選和候選有 aria-pressed，定位/載入/錯誤 role=status，結果 aria-live=polite；無必須長按/滑動才可完成的主操作。390px 的真 Chrome 無橫向 overflow 有 host 紀錄；360/430px 與非零 safe-area 僅靜態 CSS 覆核，沒有冒稱逐尺寸或實機已操作。 | PASS |

兩項 WARN 均為已明訂設計細節與實作的輕微落差；沒有擴張為另一輪開放式 code review，亦沒有將測試成功當作消除設計落差。可重現檢查：sed -n '69,82p' apps/web/src/pages/FriendlyMapPage.vue；sed -n '17,21p' apps/web/src/style.css；sed -n '98,107p' apps/web/src/composables/useFriendlyExplorer.ts；sed -n '7,20p' apps/web/src/components/FriendlyRouteResults.vue。

限制與待驗：依 interaction-spec.md:37-40 與 handoff:36，Android 實機／WebView／native GPS／WebGL 尚無裝置可驗；本次不把桌面 Chrome、替身測試或 APK 建置等同實機通過。360/430px 精確像素與真實 safe-area 裝置仍可追加 UI smoke；此處只對可查的結構與既有 390px 紀錄作判斷。
<!-- prospec:evidence-end -->
<!-- prospec:evidence-section-end -->

<!-- prospec:evidence-section -->
<!-- prospec:evidence-attempt prospec-verify:9bf2b34a7de05d2378e2911bc0da2f9a7bbde7b00a9f1ebb3d3115655264c98b -->
## 2026-11-07 — grade A

<!-- prospec:evidence delta-spec-compliance -->
### delta-spec-compliance — WARN

**Context ID:** `47961b4fd9f75e8ecd312ed1feebab28f92fa50643b8d5ef0840e1aadb672bcc`

**Summary:** 匯入進度輸出修正通過重新驗證；5 REQs／13 情境維持原判定，部署、回退及 APK 交付證據仍待補。

**Repro:** `sed -n '28,45p' docs/handoff/2026-11-07-cloudflare-platform.md; node --test scripts/*.test.mjs`

本輪由同一獨立 grader 重新核對，未參與程式實作。已重讀 prospec-verify、prepared context 與最新 diff；proposal/delta-spec/plan/tasks/Constitution 相對 HEAD 無變更，13 frozen scenarios 與上一輪一致。唯一 runtime diff 為 import-friendly.ts 的 execute 回傳 string，INSERT --file 不再解析進度 stdout，SELECT --command 仍嚴格整份 JSON、success/results、單列、hash/schema 驗證後才輸出 ok。snapshot 新跑 API 三檔 41 tests 及工具 29 tests 全通過；首次啟動因 snapshot 依賴準備路徑錯誤未執行，修正依賴後才得到上述結果。unchanged web/shared 的上一輪獨立結果為47/7，非本輪重跑；新版 prepared test_attempt 401dba50-3e18-4e6f-9004-818eb75658ee 為 pnpm test passed。
遠端收據 .artifacts/remote-import-check.json 記錄 2026-11-07T08:13:41.319984+00:00 成功、103筆、contentHash 49094577adde6acbc2bdb6355766b3766f8eed2ca030dfe67c230dcadc31fdcd；獨立計算 importerSha256 與現行檔案一致。這是既存外部實跑紀錄，本 grader 未重做遠端操作，未將單份收據說成兩次獨立收據；sourceTreeDirty=true 如實保留。D1 成功不代表 Worker 已發布、回退或 APK 已完成。
逐條核對 frozen baseline：
US-1.1 — WARN — 本機 SPA/API/health 契約與 local D1 證據俱備；尚缺真實 HTTPS 部署 smoke。
US-1.2 — PASS — platform 測試驗 API 404、無效查詢 400、資料錯誤 503 皆 JSON，不回 SPA 或假資料。
US-2.1 — PASS — friendly 測試驗四服務 OR、bbox、附近、空結果與空白服務保持未標示。
US-2.2 — PASS — config 白名單、來源日期/範圍/hash；非 test 日誌確認有 pathname 而無座標 query，GPS 不傳 API。
US-2.3 — PASS — 本輪 SQLite/CLI 測試通過；遠端成功收據及對應 importer hash 已核對；重跑/衝突/單列與 hash/schema 契約保持。
US-3.1 — PASS — web 主流程與 shared 差異測試驗服務/起迄/候選、距離/資源；出界/不連通不造直線，接線分段。
US-3.2 — PASS — location/explorer 測試驗拒絕、逾時、低精度、過期、出界及模擬位置；手選使晚到回覆無效，UI 有重試。
US-3.3 — PASS — WebGL/圖資/路網失敗測試確認清單與重試仍可用；adapter 可注入，MapLibre/OSM，無雲端 LLM。
US-4.1 — WARN — URL parser 與 wrapper 測試符合，但目前沒有實際 APK、URL/來源 SHA/hash 與產物 manifest 收據。
US-4.2 — PASS — 外 repo manifest coarse/fine 並存；既有官方服務 URL 有獨立測試，handoff 揭露無裝置及 debug signing。
US-5.1 — WARN — 四項檢查有紀錄、clean SHA/明確資產流程有測試；發布版本與實際產物收據待 T26。
US-5.2 — WARN — 回退程式與替身測試通過且不回退 DB；缺 Cloudflare 回退/重部署及發布後 GCP 健康收據。
US-5.3 — PASS — git diff HEAD -- docs/prototypes .prospec/changes/enable-friendly-routes deploy 為空；CLOUDFLARE/handoff 有責任表。
未完成 [M] 不阻 code-task gate，但不能使實際交付證據自動變 PASS。尚缺的操作證據以 WARN 保留，未發現程式改寫 acceptance intent。

#### Requirements Compliance

| REQ ID | Result | Kind | Evidence | Repro |
|---|---|---|---|---|
| REQ-FRIENDLY-PLATFORM-001 | WARN | executable | 本 grader 於 snapshot 實跑 platform/friendly/import 三測試檔共 41 tests 通過。edge-app.ts 使用 JSON notFound/onError；routes/friendly.ts 先驗查詢，資料失敗回 503；routes/platform.ts 讀指定版本後回 health/config。wrangler.jsonc run_worker_first 隔開 API/SPA。scripts/test-platform-integration.mjs 與 handoff 有既存 local D1/深層路由證據。但 handoff「部署與 APK 執行紀錄」仍列未發布；T26 待 clean SHA，缺正式 HTTPS 入口 smoke，故 WARN。 | `cd apps/api && node node_modules/vitest/vitest.mjs run test/platform.test.ts` |
| REQ-FRIENDLY-PLATFORM-002 | PASS | executable | 本輪 snapshot 獨立執行 platform/friendly/friendly-import 三檔共41 tests 通過。除原有來源 hash、OR/bbox/nearby/零筆/日誌/config/原子匯入證據，新測試驗混合進度 INSERT 後完整 SELECT 回讀才能成功；空 readback、SELECT 子程序失敗及非純 JSON 都拒絕。execute 保留 timeout/exit 錯誤遮蔽；resultRows 只處理 --command，仍檢查 success/results、單列、content_hash/schema，沒有因忽略 INSERT stdout 放寬成功契約。.artifacts/remote-import-check.json 已記成功遠端匯入103筆及 contentHash；獨立 SHA-256 核對 importerSha256=c0812548d04a40290cd6f2d16352de07e84b2e87a035b53588ccae11fd415977 與本輪檔案一致。收據保留 sourceTreeDirty=true，本 grader 未重跑遠端。sources/config/GPS 行為與上輪無 diff。 | `cd apps/api && node node_modules/vitest/vitest.mjs run test/friendly.test.ts test/friendly-import.test.ts test/platform.test.ts` |
| REQ-FRIENDLY-PLATFORM-003 | PASS | executable | snapshot 獨立實跑 web 47 tests、shared 7 tests 全通過。routing.test.ts 與凍結 prototype 比對完整輸出，並驗出界/不連通不回直線；location 測拒絕、12 秒逾時、精度/時效/出界/mock/取消。explorer 測晚到不覆手選、服務變更清路線、圖資失敗留清單/重試；map 測 WebGL/資產失敗、控制器與 connector 分段。friendly-map.ts 使用 MapLibre 本地 OSM 與虛線接線，FriendlySources.vue:26 明示需要網路、尚無完整離線下載。手機瀏覽器實測僅引用 handoff 既有 390×844 紀錄，未冒稱本 grader 重測實機。 | `cd apps/web && node node_modules/vitest/vitest.mjs run; cd ../../packages/shared && node node_modules/vitest/vitest.mjs run` |
| REQ-FRIENDLY-PLATFORM-004 | WARN | executable | snapshot 的 build-townpass 測試通過：轉交單一 URL owner、記雙 repo SHA/dirty、URL 與 APK hash，拒絕未更新/舊 timestamp APK，check/dry-run 不冒稱產物。只讀核對 TownPass-platform/scripts/build-codefest.sh:33 起正式建置拒絕缺漏/無效/非 HTTPS；HTTP 例外限明示 debug emulator。manifest coarse/fine 俱有，/tmp/townpass-platform-review.md 已有 URL 7 tests、Flutter 專用 2 tests 與官方 URL 不變證據。T19/T27 未完，handoff 明示 APK 待發布後建立；compileReleaseKotlin/設定檢查不能代替實際 APK、hash 與產物 manifest。無裝置、GPS/WebGL/離線未驗及 debug signing 已揭露。 | `node --test scripts/build-townpass.test.mjs; sed -n '28,45p' docs/handoff/2026-11-07-cloudflare-platform.md` |
| REQ-FRIENDLY-PLATFORM-005 | WARN | executable | snapshot 獨立跑 29 tooling tests 全通過。release-platform.mjs 驗 clean HEAD、source SHA、限定 build、互斥 lock、每次關鍵動作前核對遠端版本；prepare-platform-assets.mjs 僅驗 hash 並複製四個明確資產。CI 保留 PostGIS、執行四項檢查與 local D1；發布 main/needs verify/concurrency 有測試。release tests 以注入依賴驗失敗回退、不改 DB、首次無前版失敗及不回退別人版本；platform-release-state.mjs 先驗前版快照。prepared test_attempt passed，handoff 有其他檢查紀錄。prototype/spec/deploy 原檔無 diff，責任表清楚。然而尚缺真實發布 SHA/Worker version/rollback/redeploy 及發布後 GCP 健康收據；不能把替身測試當雲端演練，故 WARN。 本輪重新實跑29 tooling tests 通過；D1 有實際成功匯入收據，但 Worker 未發布，部署/回退交付限制不變。 | `node --test scripts/*.test.mjs; sed -n '28,45p' docs/handoff/2026-11-07-cloudflare-platform.md` |

#### Scenario Deviation Findings

| Scenario ID | Affected REQs | Spec Location | Result | Summary | Evidence |
|---|---|---|---|---|---|
| US-1.1 | REQ-FRIENDLY-PLATFORM-001 | proposal.md:26 | WARN | 本機 SPA/API/health 契約與 local D1 證據俱備；尚缺真實 HTTPS 部署 smoke。 | 此為操作/交付證據尚未完成的限制，非程式改寫情境。本機 SPA/API/health 契約與 local D1 證據俱備；尚缺真實 HTTPS 部署 smoke。 可重查 docs/handoff/2026-11-07-cloudflare-platform.md「部署與 APK 執行紀錄」及 tasks.md T19/T26/T27；完成收據後重新核對。 |
| US-4.1 | REQ-FRIENDLY-PLATFORM-004 | proposal.md:49 | WARN | URL parser 與 wrapper 測試符合，但目前沒有實際 APK、URL/來源 SHA/hash 與產物 manifest 收據。 | 此為操作/交付證據尚未完成的限制，非程式改寫情境。URL parser 與 wrapper 測試符合，但目前沒有實際 APK、URL/來源 SHA/hash 與產物 manifest 收據。 可重查 docs/handoff/2026-11-07-cloudflare-platform.md「部署與 APK 執行紀錄」及 tasks.md T19/T26/T27；完成收據後重新核對。 |
| US-5.1 | REQ-FRIENDLY-PLATFORM-005 | proposal.md:56 | WARN | 四項檢查有紀錄、clean SHA/明確資產流程有測試；發布版本與實際產物收據待 T26。 | 此為操作/交付證據尚未完成的限制，非程式改寫情境。四項檢查有紀錄、clean SHA/明確資產流程有測試；發布版本與實際產物收據待 T26。 可重查 docs/handoff/2026-11-07-cloudflare-platform.md「部署與 APK 執行紀錄」及 tasks.md T19/T26/T27；完成收據後重新核對。 |
| US-5.2 | REQ-FRIENDLY-PLATFORM-005 | proposal.md:57 | WARN | 回退程式與替身測試通過且不回退 DB；缺 Cloudflare 回退/重部署及發布後 GCP 健康收據。 | 此為操作/交付證據尚未完成的限制，非程式改寫情境。回退程式與替身測試通過且不回退 DB；缺 Cloudflare 回退/重部署及發布後 GCP 健康收據。 可重查 docs/handoff/2026-11-07-cloudflare-platform.md「部署與 APK 執行紀錄」及 tasks.md T19/T26/T27；完成收據後重新核對。 |
<!-- prospec:evidence-end -->

<!-- prospec:evidence constitution -->
### constitution — PASS

**Summary:** 重新核對10條憲章規則；匯入修正保留輸入驗證及錯誤遮蔽，無新增違規。

**Repro:** `git diff HEAD -- .env.example package.json .github/workflows/ci.yml; rg -n '^import|: any\b' packages/shared/src apps/api/src/friendly`

採用最新 prospec-report.json 同一10條inventory/severity。與上輪完整獨立核對相比，只有 importer、測試及繁中說明變動，未新增依賴、改資料來源/地圖/LLM/secret/分層。新 commit 0a4e487 格式符合；本次修正未提交。全部 rule statements 重新核對，遠端匯入不當發布、回退或APK完成證據。
<!-- prospec:evidence-end -->

<!-- prospec:evidence design -->
### design — WARN

**Summary:** 第二輪核對44個UI、測試、shared與依賴檔案均與首輪一致；chip全圓角覆蓋及路線缺計算中狀態仍在，設計維度維持WARN。

第二輪重新判定（verify-grader-design-2-1）

本輪已重新讀取 prospec-verify 設計維度規則、delegated schema、目前 design-spec.md／interaction-spec.md，並直接檢查目前 FriendlyMapPage.vue 樣式及 useFriendlyExplorer.ts compare 實作。兩項既有設計落差尚未修正，因此維持 WARN；importer runtime 修正不改變此判斷。

比較證據：首輪 snapshot 已由流程清除；未將不存在的快照聲稱為已比較。改以首輪 ticket 的 checkpoint.entries SHA-256（當時變更檔）及 ticket.pre_spawn.head.commit=5d94fc508d09ca15aa460b752a20afab6c435c92 的 git blob（當時未變更檔）重建逐檔基準，與新 ticket snapshot /private/var/folders/v1/2qrgkmr92mgbc668grwdx09w0000gn/T/prospec-snapshot-verify-grader-design-2-1-CE1uDN 比較。apps/web/src、apps/web/test、packages/shared/src 全部40檔，以及 apps/web/package.json、apps/web/vite.config.ts、packages/shared/package.json、pnpm-lock.yaml，合計44檔全部 hash 相同；另40個原始碼／測試檔與目前 main 工作目錄逐位元組相同。新 ticket checkpoint 僅列 scripts/import-friendly.ts、apps/api/test/friendly-import.test.ts、docs/CLOUDFLARE.md，沒有 UI 改動。

本輪以目前內容重核設計、以已證明相同的 UI 輸入保留首輪元件表與相關測試證據；沒有重跑23項測試，也沒有新的瀏覽器或實機測試，下文明列的測試時間與 Chrome 驗收均為首輪／既有結果。Prepared verification context 由主協調者提供為 47961b4fd9f75e8ecd312ed1feebab28f92fa50643b8d5ef0840e1aadb672bcc；本 grader 僅判 design，不代判 importer、delta-spec 或 machine test-provenance。

以下為逐檔確認仍適用的首輪設計證據與元件判定：

本次為 fresh-context 的 design 維度核對，依 design-spec.md:2-3、43-44 與 proposal.md 的 partial UI scope，只驗證沿用既有白底綠色樣式的正式 Vue 平台整合頁；組員另外的深色 App prototype、四步產品流程與完整離線不列入本輪必備設計。已讀 HTML adapter；本 change 明訂 spec-only，沒有獨立 prototype 可作像素比對，因此以設計規格、SFC/CSS、實際執行測試與既有 host smoke 分別列證。

驗證方式：
- 本 grader 在 ticket snapshot /private/var/folders/v1/2qrgkmr92mgbc668grwdx09w0000gn/T/prospec-snapshot-verify-grader-design-1-1-RxmCxX 執行 pnpm --filter @app/web exec vitest run test/friendly-explorer.test.ts test/friendly-map.test.ts test/friendly-location.test.ts test/friendly-api.test.ts；2026-11-07 16:06:36 開始，exit 0，4 files／23 tests 通過。測試使用替身 MapLibre／位置 adapter，不算真實 WebGL 或 native GPS 測試。
- 在同一 snapshot 用 vue/compiler-sfc compileStyle 實際編譯 FriendlyMapPage.vue scoped style，輸出 button[data-v-design-check] 的 border-radius: 10px；這是 CSS 靜態編譯證據，非瀏覽器截圖。
- 引用已執行的 host smoke：docs/handoff/2026-11-07-cloudflare-platform.md:24 記錄 Chrome 390×844、最短 1,565m／資源候選 1,975m、候選切換繪圖、Wi-Fi 名冊 103→75、條件改動清除路線、scrollWidth=viewport=390。本 grader 沒有重跑該瀏覽器操作。

| Component | Visual | Interaction | Status |
|---|---|---|---|
| 首頁與共用外框 | PASS：HomePage.vue 的 h1=22px、白底綠色 CTA、主操作 min-height 44px；style.css:3-21 的品牌/文字/輔助/邊框值、系統繁中字體、14px 輔助字與 16px 頁距符合既有樣式。surface/danger 以等值白色與 #b00020 literal 實作，沒有色值偏差。 | PASS：HomePage.vue 提供 /map 與四類服務 query 入口及 /about 來源連結；router.ts 路由對應 FriendlyMapPage、AboutPage；App.vue:7-10 保留固定主選單。屬靜態程式核對。 | PASS |
| 服務篩選 | WARN：四類按鈕、active 品牌弱底、40px 觸控高度符合；但 FriendlyMapPage.vue:75 的 scoped button selector 實際編譯為 button[data-v-*]，specificity (0,1,1) 高於 style.css:19 的 .chip (0,1,0)，使規格 design-spec.md:19 指定的全圓角 999px 被覆蓋為 10px。 | PASS：FriendlyMapPage.vue:29-34 有 aria-pressed、多選切換、載入及名冊錯誤；useFriendlyExplorer.ts:24、41-43 採任一符合且空選顯示全部。friendly-explorer.test.ts 的 loads real data, OR filters, manual points, routes and clears previous route when any input changes 已通過；host smoke 103→75 另有實測紀錄。 | WARN |
| 地圖與名冊 | PASS：FriendlyMapPage.vue:60-63 名稱/地址/服務/選點、77-80 可捲動 10px 卡片與選取樣式；FriendlyMap.vue:38 與 friendly-map.ts:13-22 顯示服務點、起迄點、品牌實線與棕色虛線接線及文字圖例。地圖資料使用本地 GeoJSON 與 OSM attribution。 | PASS：FriendlyMapPage.vue:18 同一 visibleStores／selectedRoute 同步至地圖；FriendlyMap.vue:12-31、35-37 有載入、15秒 ready timeout、錯誤、重試與離頁 abort/destroy。friendly-map.test.ts 的 WebGL failure retry、map asset failure、graph failure retry、connector conversion 四項通過；錯誤時名冊仍保留 103 筆、手動選點及比較仍可用（僅路網失敗時停用比較）。Page:59 有 NoMatch 文案。 | PASS |
| 位置與起迄點 | PASS：FriendlyMapPage.vue:35-53 清楚分區、label/select、16px 字級、44px select；75-81 含 40px 按鈕、disabled 降低透明度、3px focus-visible。 | PASS：useFriendlyExplorer.ts:17 起點初始 null；selectStart 取消舊請求；locate 用 generation/abort 阻止晚到；friendly-location.ts:4、14-30、32-65 區分拒絕/12秒逾時/精度/時效/範圍/模擬位置。friendly-location.test.ts 11 項、friendly-explorer.test.ts 晚到/拒絕/模擬位置測試實際通過；Page:37 loading disabled、38-39 可讀原因與來源、41-47 手動起迄點始終可選。 | PASS |
| 路線候選 | PASS：FriendlyRouteResults.vue:12-19 列距離、估時、資源數、接線與 warning；25-26 白底卡片及 active 品牌邊框符合。 | WARN：Page:55 綁定候選選取，FriendlyMap.vue:29 更新地圖；routing.ts:106 無第二條時明示未找到增加資源替代路線，:57 不連通明示改選地點；缺起迄點由 canCompare 停用。這些通過測試/靜態核對及既有候選切換 host smoke。但是 design-spec.md:35 要求 loading「計算中」，目前 useFriendlyExplorer.ts:98-103 為同步直接 compare，未有 comparing state；Page:53 按鈕文字固定「比較路線」，FriendlyRouteResults.vue:7-20 僅空/錯誤/結果分支，無計算中可感知狀態。 | WARN |
| 來源與限制 | PASS：FriendlySources.vue:10-21 呈現可點來源、更新/擷取日期、地方 bounds、版本、授權、校驗值；:32 長 hash 可斷行，原生 a 保持底線。 | PASS：FriendlySources.vue:24-26 有載入/錯誤/retry、網路需求與裝置計算限制；AboutPage.vue 的 load、catch、retry 綁定與 abort 可查，useFriendlyExplorer.ts:81-87 不以預設成功來源替代錯誤；App.vue 固定 /about 入口。此元件流程屬靜態核對，API timeout/error 另外由 friendly-api.test.ts 執行通過。 | PASS |
| 手機版、鍵盤與 safe-area | PASS：style.css:13-20 border-box、頁面 16px padding/max-width 640、chips flex-wrap；Page:72-80 grid 單欄、select width100%/min-width0、store-actions wrap；FriendlyMap.vue:43 地圖 width100%；style.css:17 與 App.vue:22 為內容/底欄同時保留 safe-area。 | PASS：原生 button/select/link 支援鍵盤，篩選和候選有 aria-pressed，定位/載入/錯誤 role=status，結果 aria-live=polite；無必須長按/滑動才可完成的主操作。390px 的真 Chrome 無橫向 overflow 有 host 紀錄；360/430px 與非零 safe-area 僅靜態 CSS 覆核，沒有冒稱逐尺寸或實機已操作。 | PASS |

兩項 WARN 均為已明訂設計細節與實作的輕微落差；沒有擴張為另一輪開放式 code review，亦沒有將測試成功當作消除設計落差。可重現檢查：sed -n '69,82p' apps/web/src/pages/FriendlyMapPage.vue；sed -n '17,21p' apps/web/src/style.css；sed -n '98,107p' apps/web/src/composables/useFriendlyExplorer.ts；sed -n '7,20p' apps/web/src/components/FriendlyRouteResults.vue。

限制與待驗：依 interaction-spec.md:37-40 與 handoff:36，Android 實機／WebView／native GPS／WebGL 尚無裝置可驗；本次不把桌面 Chrome、替身測試或 APK 建置等同實機通過。360/430px 精確像素與真實 safe-area 裝置仍可追加 UI smoke；此處只對可查的結構與既有 390px 紀錄作判斷。

第二輪逐檔 SHA-256 清單：
- apps/web/src/App.vue: 7aa332c19bb7784b8a933ef86a6f7e869fe8b87d8ba60d773f6ab79b24bc6923
- apps/web/src/components/FriendlyMap.vue: 4a2eac51be7de985f2c98691e87c38b9a4fbb05b013a54312328537f98e74eef
- apps/web/src/components/FriendlyRouteResults.vue: 6db162f26cb86dd9b708d7e1e2038a1212b8646eb8739b071873c15339114836
- apps/web/src/components/FriendlySources.vue: 9be6c1d7c7f8f27fd309b41431504f46c62aa63392e2d35141e269f265e97f68
- apps/web/src/composables/mockTownPassBridge.ts: 786230cee141f5f858b041bd9819bd596a0ef7e003255f81b651b33cb7f2b5eb
- apps/web/src/composables/useFriendlyExplorer.ts: 9304993c49b7dec10f6ac12fb8560b5eeadc27e39c253f68ab3e747442927ddb
- apps/web/src/composables/useTownPassBridge.ts: 2706f64085c521bc57fa79f6d435ae77ef6923c7fd2549368996aa39388cb646
- apps/web/src/env.d.ts: 495bc6291784edae53cb91ba0783ede95408cbe6f2060e87ebd39f79627d7c03
- apps/web/src/lib/api.ts: e885d3d2bcb91d66ac76e827f23f4aab9cd4881e103283ac5156f10a7e9f67e3
- apps/web/src/lib/features.ts: 3c4f1e5840141fc68c14f29f2a076e53420ad6ee8d2f5865a6ecbfbf42709a16
- apps/web/src/lib/friendly-data.ts: 26a3445d273e984fc8d658154a64b6f4b597af8a3c768786507ae35e51e85bcb
- apps/web/src/lib/friendly-location.ts: 4a478acdade5896b76c85d141ddb3f06de9c24dc16087744d4737c9f583979df
- apps/web/src/lib/friendly-map-data.ts: 876371fec4f292b67567ca4ae6ff89ef10eec8b6fdca36b2f0f4f6bb57aef0ff
- apps/web/src/lib/friendly-map.ts: d53a8971d65992110585a6e32fcf19a957f64ea10a0981156c70e6455cd1aced
- apps/web/src/lib/locate.ts: 56b0500b68fd12f3be776f4df7ffa6f2af49e1d7afca703081824a123226260e
- apps/web/src/main.ts: 007a084e3c209bea2474a9b8f70c83a8d4c3c2977ad19d5e999d6afeb5dad035
- apps/web/src/pages/AboutPage.vue: b0efecdaa1db20bb6e3a34f786306a3bb654ed638b3f754e4f4b03d1e0b5a98f
- apps/web/src/pages/FriendlyMapPage.vue: 51d2c548326247b17c489bdb44d0bbd396274f3b870151c90c49d6752c23e978
- apps/web/src/pages/HomePage.vue: 558d9bdfb5e9d803a8f06f1097a48f7b9990b059caae8aeca3f263bedd04e6d3
- apps/web/src/pages/MapPage.vue: c35c21b24ba663fa90c033285922bc03c4c72bd8749fb276c95815a280b6b10d
- apps/web/src/router.ts: 860317cf59cd3238de0027d2b9857f509fd49eceb33b52c65b535cb3b141b68e
- apps/web/src/stores/places.ts: 1a19579a60fe8aa7836f39c4cd2bd74622e0c4e9edde3ea6e95638177c3e611f
- apps/web/src/style.css: 474bb1346a5bf8ea2e247cb151cefebf9e8b7ce78e4d55f510c8b3df491e0bba
- apps/web/test/features.test.ts: 2da13d87dfdc9f766e3ff128a3e770fc65fd8fdac140265d70e472dd5133c8c0
- apps/web/test/friendly-api.test.ts: 63b29bbd6273f19fb76856ad88950dcb89dfc9c2723d86447df71b92c4c3955d
- apps/web/test/friendly-explorer.test.ts: d3a9c4b3eece2e932f490d09dd70d3cbfb8ac77100c03557cfccd925e74d5799
- apps/web/test/friendly-fixtures.ts: 19ccaca2851c515425bbadfdd7f930bcaa839d14191d695d9acde8e9e0234bd7
- apps/web/test/friendly-location.test.ts: 0b0b6208e7d5991012f6b4ef35414f0cb5b58960f1d04f7afdf35532e2e47749
- apps/web/test/friendly-map.test.ts: 8b2f05c1b8a2b8e6e1b84b09296eff13beca3899522f79f3b261229c999fbeef
- apps/web/test/locate.test.ts: 6bf6d73bad56907a250d728bb459f2623245287d32b14f9ee4d0d52cecb8bf4f
- apps/web/test/useTownPassBridge.test.ts: 2aad206cdc5620af587c0284bd67d6fd3eb0c9627909cab61c3ff25a3697eee5
- packages/shared/src/friendly.ts: 5f71c5f9e0845ce3fdc49ad5b53caa5b5263f112cdd1df77c7cfdee3d02ec207
- packages/shared/src/health.ts: 24f1dac57abd95da28652e09543d15db9aedceb60e12683a93babe4ebdb13b7f
- packages/shared/src/index.ts: a88d7b230b81af3d01334bf7937d7202d42f99e5a0d306dc6013a181fcc96e7b
- packages/shared/src/opendata.ts: 935649bd9b419143a7ac7bc858a0b85be9e2bde23b8f5c9897d7822baaee65d0
- packages/shared/src/places.ts: 8e5f48ac4ad89f3941fafb37f81099a18429b5b39b41d192c6ef1e36322f80eb
- packages/shared/src/platform.ts: f42f89332fd0dc4126d27a2e3701aef78117057e4b7ed1b17c9e49d6429ee445
- packages/shared/src/routing-geometry.ts: 3fbfb424db3c47a3d6b92d2c02e192892059172bb6e2ddbf9471593944aeb196
- packages/shared/src/routing-graph.ts: 902f82c04d2395df8bc154e75991df8e6c8716c3ef5bcf13c7b1f4ff6b8c848f
- packages/shared/src/routing.ts: 022ea13683c9aa66a22e6548c22a7588bf992abfdcc1aae282af566e4abb6364
- apps/web/package.json: fce77f1124df4e280deaa18621559be8c8059b00e253cc03fb68ca1d156a50fa
- apps/web/vite.config.ts: 343215c54af77a8689dea5a9886a6254a007c3c70267a25af4c8ebf77f03b493
- packages/shared/package.json: af3b0a9bcb708f9ca2bb2b588f7514cccb23c1fbb1533dd143e72a4204a7e56a
- pnpm-lock.yaml: 9c0cec6191169512d5d5547d8af0311f92b7ddb1e89464c488d820494df47340
<!-- prospec:evidence-end -->
<!-- prospec:evidence-section-end -->
