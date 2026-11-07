# Verify Evidence: improve-route-experience

<!-- prospec:evidence-section -->
<!-- prospec:evidence-attempt prospec-verify:8e2157ca7227d70b3dbcd062f8fd195f53ebed6de33cb637270644f26260fe50 -->
## 2026-11-07 — grade A

<!-- prospec:evidence delta-spec-compliance -->
### delta-spec-compliance — not-adjudicated

**Context ID:** `c2bba6cd6e4ca5e41bb1016405c35d69a2486f2096019b1f7b9df110f69c2b92`

**Summary:** 5/5 REQ 與 10 個凍結情境符合；獨立 focused 52/52、現版瀏覽器 82/82；原生採 13 項測試紀錄，實機點按尚待人工確認。

以指定 frozen context c2bba6cd6e4ca5e41bb1016405c35d69a2486f2096019b1f7b9df110f69c2b92 核對五項 ADDED REQ 與十個凍結 WHEN/THEN；尚未 archive，Feature Spec 不存在是預期狀態。module-map 空、product.md 不存在屬已揭露 baseline，本維度不虛構或重判 Knowledge。測試只在委派 snapshot 執行，16/16 範圍 runtime/test 檔 SHA-256 與主樹一致。已讀目前 source 與獨立現版 browser report，七個 runtime 檔案 sourceBefore/sourceAfter 雜湊均匹配。舊 docs/handoff/evidence 的 app.js hash 已過時，不以該舊 hash 冒充當前版；採 /tmp/tcf-route-design-independent-20261107/report.json。凍結情境對照：US-1.1/1.3/1.4→REQ-ROUTE-001；US-1.2→REQ-ROUTE-002；US-2.1/2.2→REQ-UI-001；US-2.3→REQ-UI-002；US-3.1/3.2/3.3→REQ-NATIVE-001。未見語義偏離，scenario_findings 空。剩餘實機人工確認不等於已驗通；此判定限程式行為及可重現測試，不包含原生視覺、手機實際性能、iOS Service Worker 離線可用性或 OS Dynamic Type。

#### Requirements Compliance

| REQ ID | Result | Kind | Evidence | Repro |
|---|---|---|---|---|
| REQ-ROUTE-001 | PASS | executable | 獨立在指定 snapshot 執行 focused 指令：52 tests、52 pass、0 fail，exit 0。friendly-route-client.test.cjs:22–90 覆蓋完成、terminate、取消、過期回應、逾時、無 Worker、載圖錯誤、無效回覆、真 Worker 腳本、無效／範圍外座標、250m 邊界、不可連通及最近節點孤立。friendly-app-state.test.cjs:497–535、564–573 覆蓋等待真 GPS、晚到定位補算、更換／清除／定位失敗取消、保留類別及重試。app.js:117–154 將 roadSegments 畫實線、connectors 畫虛線並明示未驗證入口；scheduleRoute 不拿地圖中心當起點。route-client.js:16–48、routing-worker.js:5–12 只建立本機 Worker 並載入打包圖；無遠端路由呼叫。全市圖實跑公開車站到市府測試：271533 nodes、621530 directed edges、4950m、139 道路點、216m 估計接線，非手機效能。對應凍結 US-1.1、US-1.3、US-1.4 均符合。 | `node --test docs/prototypes/tests/friendly-route-client.test.cjs docs/prototypes/tests/friendly-routing.test.cjs docs/prototypes/tests/friendly-taipei-routing.test.cjs docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-ROUTE-002 | PASS | executable | 上述 52 項獨立測試包含 friendly-route-client.test.cjs:66 的 249m 納入／251m 排除，及 friendly-app-state.test.cjs:536–562 的 route IDs、wifi+charge 聯集、移動視窗、地圖 highlight／數量／清單相同集合、切類別不重算、點資源保持目的地線與 storageWrites=0。app.js:80–81、187–202、226–236 共用 routeIds＋matches，空集合顯示空狀態；app.js:102、224、333 保留來源、更新日期、導航與電話。獨立瀏覽器 report 的各類別及 wifi+charge 集合、資源詳情、無新增 Worker 與固定 GPS 未送出外部路由／搜尋檢查皆通過。符合凍結 US-1.2。 | `node --test docs/prototypes/tests/friendly-route-client.test.cjs docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-UI-001 | PASS | executable | 以 /tmp/tcf-route-design-independent-20261107/report.json 的獨立 Chromium 執行證據核對：82/82 checks 通過；本人核對 sourceBefore、sourceAfter 的 index.html、app.js、app-ui.css、route-client.js、routing-worker.js、routing.js、routing-data.js 全部與目前主樹 SHA-256 相同。320×568、390×844、430×932、768×1024、844×390 均無整頁水平溢出、模式文案與 START 單行、pointer 無搜尋焦點、Tab 可見；touch、200% computed text、reduced-motion 檢查亦通過。app.js:268 僅 keyboard 進頁聚焦；app-ui.css:86 保留 focus-visible；friendly-app-state.test.cjs:593 獨立重跑通過。符合凍結 US-2.1、US-2.2。此為桌面瀏覽器模擬，200% computed text 不是 OS Dynamic Type，不擴張成實機驗證。 | `NODE_PATH=/path/to/playwright/node_modules ROUTE_QA_URL=http://127.0.0.1:8883/ node scripts/check-friendly-route-browser.mjs` |
| REQ-UI-002 | PASS | executable | 同一現行 source hash 全符的 /tmp/tcf-route-design-independent-20261107/report.json 證明五種 viewport 展開佔滿可用區域、路線避開浮層、面板收合更新 aria 且無 rendered focusables、Tab 不進隱藏內容、復原尺寸及狀態一致；兩輪展開／收合／還原保留 GPS、目的地、路線、類別、selected resource 及 Leaflet map ID。app.js:157–183 對浮層計算 fitBounds padding、維持單一地圖與 hidden／aria；423 的 ResizeObserver invalidateSize。friendly-app-state.test.cjs:575–591 在本次52項測試中通過。短橫向／減少動態亦有 executable browser checks。符合凍結 US-2.3。 | `NODE_PATH=/path/to/playwright/node_modules ROUTE_QA_URL=http://127.0.0.1:8883/ node scripts/check-friendly-route-browser.mjs` |
| REQ-NATIVE-001 | PASS | executable | 外部 TownPass repo /Users/ciyang/Documents/repos/TownPass-route-experience-20261107 相對 7180078 的 diff 與當前程式已唯讀核對。lib/util/tp_route.dart:65–76 根頁 MainView 並註冊 MainViewController、PinnedServiceWidgetController；main_view_controller.dart 保留 keyHomeIndex，defaultIndex=1 對應 HomeView；home_view.dart 的入口與 tp_route.dart:177 精確服務網址都到 /codefest，其餘網址維持一般 WebView。tp_web_view.dart:256–258 await bridge listener 才呼叫 onWebViewCreated；codefest_view.dart:40–54 的系統返回依 canGoBack、明確按鈕直接 Navigator.pop，97–109 限制定位 origin，21–29 與113以後提供載入失敗重試。讀取 /tmp/tcf-route-native-tests.log：上述 flutter test 13 tests 全通過，含保存起始頁、首頁與服務入口、bridge 順序、返回越過文件歷史、系統返回先 goBack、失敗重試與定位來源限制。此輪本人未在原生主樹重跑；採可檢查的已執行 log 與測試碼核對，符合凍結 US-3.1、US-3.2、US-3.3 的程式行為契約。限制：兩台 iPhone 安裝與 launch 不等於首頁→服務→返回已點按驗通；該人工實機確認仍待使用者完成。 | `flutter test test/codefest_launch_test.dart test/codefest_service_test.dart` |

#### Verification Limitations

acceptance baseline was captured or amended after story stage (late-capture)
<!-- prospec:evidence-end -->

<!-- prospec:evidence constitution -->
### constitution — PASS

**Summary:** 依 CLI inventory 逐條核對 10/10 規則，未發現本輪違反；不重判 machine 或 design 維度。

規則名稱與 severity 採主樹 prospec-report.json structural.constitution.rules；共10條，均有具體原碼、命令、資料來源或測試佐證。MUST／SHOULD 未改權重，沒有宣告 check_id 的機械規則需要覆判。本輪新增功能與 plan 呼叫鏈相符；既存空 Knowledge／英文樣板沒有冒稱補齊。主樹與外部原生 repo 全程唯讀；只在指定 snapshot 執行測試，唯一主樹寫入為本委派 payload。
<!-- prospec:evidence-end -->

<!-- prospec:evidence design -->
### design — WARN

**Summary:** 網頁四類局部設計與五種視窗驗證符合規格，獨立重跑 82/82 通過；TownPass 首頁入口與返回列有程式證據，但尚缺實機首頁→友善同行→返回點按與原生視覺核對，保留 WARN。

**Repro:** `python3 -c "import json; p=json.load(open('/tmp/tcf-route-design-independent-20261107/report.json')); print(p['passed'],p['failed']); assert p['passed']==82 and p['failed']==0"`

驗證範圍與方法

本次僅判 design 維度，未重做開放式缺陷搜尋。已讀 prospec/index.md、prospec-verify 的第 6 維度與 delegated-evidence-format、HTML adapter、design-spec.md、interaction-spec.md、proposal.md、baseline.md 及 baseline.json。HTML adapter 不需 MCP；docs/prototypes/friendly-route 的 HTML/CSS/JS 即目前部署原型，沒有另一份設計工具產物可冒稱雙畫面比對。因此以設計規格逐項對照 DOM、CSS、互動與實際截圖。

所有執行測試在 /private/var/folders/v1/2qrgkmr92mgbc668grwdx09w0000gn/T/prospec-snapshot-verify-grader-design-1-1-TndoHg，使用獨立 localhost:8897 服務；未修改主樹、Git 狀態或原生原始碼。獨立執行 scripts/check-friendly-route-browser.mjs，NODE_PATH=/Users/ciyang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules、ROUTE_QA_URL=http://127.0.0.1:8897/、ROUTE_QA_OUTPUT=/tmp/tcf-route-design-independent-20261107。結果 82 通過、0 失敗，證據 /tmp/tcf-route-design-independent-20261107/report.json。測後逐一比對 index.html、app.js、app-ui.css、route-client.js、routing-worker.js、routing.js、routing-data.js SHA-256，全部與主樹相符。臨時 HTTP 服務已停止。

| 元件 | 視覺核對 | 互動核對 | 判定 |
|---|---|---|---|
| 搜尋與目的地路線摘要 | app-ui.css:8-41 與設計色彩、字級、間距及圓角 token 相符；app.js:116-130 用 #ff5e3a 實線道路及 4 7 虛線接線，摘要顯示步行距離、沿線數與「路線兩側250m，非可達保證」。已實際檢視 map-expanded.png、route-ready.png 的線型及摘要。 | app.js:136-155 有 waiting-location/loading/ready/error 及重試；generation 忽略舊結果；app.js:87-92、268、427 依 keyboard/pointer 管理焦點。獨立 browser report 證實 pointer/touch 初始搜尋無焦點框、Tab 可見焦點、道路與接線有不同 dashArray、六種類別集合在 highlight/count/list 一致、詳情不移除路線、clear 保留類別。 | PASS |
| 緊湊探索模式 | app-ui.css:235-244 使用 minmax(0,1fr) auto、44px 最小高度、14px START 與16px箭頭；app.js:243 短文案相符。基線 START 寬 111.59～130.09px；本輪五尺寸量測為86.53～90.53px，均高44px、說明及START均一行。explore-320.png 可見模式與橘色按鈕未互擠。 | button 原生 disabled 與 CSS disabled/active/focus-visible 保留；按壓 .97、減少動態停用 transform。獨立測試包含觸控、200% computed text 與 reduced motion，文字允許換行且無整頁水平溢出。 | PASS |
| 地圖與浮動面板 | app-ui.css:148-188 一般地圖360px、展開100dvh、浮層max-width456px與46dvh上限；:446-454 橫向改右側300px面板。五尺寸320×568、390×844、430×932、768×1024、844×390均無整頁水平溢出；展開尺寸等於視窗且還原鈕可見。已實際檢視獨立產出的844x390-expanded-collapsed.png，頂部搜尋、定位、復原與收合面板均可見。 | app.js:171-184 同步 aria-expanded、label 與 hidden；:411-423 只變更版面狀態並 invalidateSize，ResizeObserver 更新地圖。獨立測試證實收合內容 rendered focusables=0、Tab不進隱藏內容、展開路線避開浮層、兩次收合與復原保留GPS/目的地/路線/類別/選取資源/同一地圖實例；:233 有沿線零資源文字。 | PASS |
| TownPass 首頁入口與返回列 | 唯讀核對外部 TownPass 專案 home_view.dart:27-35 保留首頁內容且入口置前；:50-65 入口沿用 TPColors、FilledButton，最小56px；codefest_view.dart:46-60 原生AppBar有「返回台北通」與服務標題，body另置 SafeArea，不被其錯誤遮罩覆蓋。未取得原生實際畫面，不能判視覺完成。 | main.dart:71、tp_route.dart:65-76 保留 MainView 根頁與獨立 CodefestView；main_view_controller.dart 保留起始頁偏好，tp_bottom_navigation_factory.dart:31,37 預設首頁；home_view.dart:54 與 tp_route.dart:178 皆導同一 codefest。codefest_view.dart:41-44 系統返回處理文件歷史，:54 頂部返回直接pop，:64-124 失敗重試在body內。實機已安裝啟動不等於首頁→入口→返回點按通過；本驗證者未執行此原生流程。 | WARN |

實際檢視的圖片清單

- docs/handoff/evidence/2026-11-07-route-experience/map-expanded.png：橘色道路與虛線接線、紫色資源、浮動收合面板及還原鈕。
- docs/handoff/evidence/2026-11-07-route-experience/explore-320.png：320px一般頁，模式文案與START緊湊單行，垂直可捲動。
- /tmp/tcf-route-qa-city-fixed/route-ready.png：摘要、250m限制說明及沿線資源。
- /tmp/tcf-route-qa-city-fixed/844x390-expanded-collapsed.png：橫向地圖與右側收合面板。
- /tmp/tcf-route-qa-city-fixed/320x568-text-200-percent.png：放大文字允許換行，START保持可讀；此為computed font模擬。
- /tmp/tcf-route-design-independent-20261107/844x390-expanded-collapsed.png：獨立重跑產物，橫向版面與上述規格一致。

證據限制與處理

瀏覽器結果是 Chromium 桌面模擬與觸控模擬，不是 iOS/Android WebView 或 OS Dynamic Type；200%僅倍增computed font。測試擋外部請求、停用Service Worker，故不證明離線快取持續性、Photon或線上圖磚狀態。既有帶道路底圖截圖僅作實際已見視覺證據；獨立重跑截圖未載入線上圖磚。loading/error/empty 的存在由程式對照確認，本次未另宣稱逐一取得其動態截圖。一般頁自然垂直捲動、既有資源輪播及既有深色主題不因本輪局部要求擴成重設計範圍。

WARN唯一待補：在原生實機實際操作預設首頁→友善同行→頂部返回台北通，記錄首頁/服務畫面/返回結果；同時核對載入或失敗時返回列可見可按，以及系統返回與頂部直接返回的差異。完成此證據前，不能將原生互動或整體 design 升為PASS。
<!-- prospec:evidence-end -->
<!-- prospec:evidence-section-end -->
