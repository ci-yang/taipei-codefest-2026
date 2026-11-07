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

<!-- prospec:evidence-section -->
<!-- prospec:evidence-attempt prospec-verify:316cd484a452e4d44146ff7221d2fa23a36d7588cba9547e14234446957e682a -->
## 2026-11-07 — grade A

<!-- prospec:evidence delta-spec-compliance -->
### delta-spec-compliance — not-adjudicated

**Context ID:** `d47ad1ef2e9a8ccd97441bfb44863153258976f397a4effe34b7eedf64a81198`

**Summary:** 5/5 REQ與10個目前情境符合；獨立smoke29/29、瀏覽器七檔hash吻合；保留late-capture與實機未點按限制。

依指定verify-context逐條核對delta、proposal、plan與目前source。十情境對照：US-1.1/1.3/1.4→REQ-ROUTE-001；US-1.2→REQ-ROUTE-002；US-2.1/2.2→REQ-UI-001；US-2.3→REQ-UI-002；US-3.1/3.2/3.3→REQ-NATIVE-001。未見目前程式語義偏離，scenario_findings為空。此PASS是當前契約獨立判定，不宣稱原始凍結未改：baseline為revision2，前次CLI因acceptance late-capture記delta not-adjudicated，此歷史限制須保留，由CLI處理，不能用本次PASS洗掉。五項皆ADDED、未archive，Feature Specs缺少屬預期；module-map空與product.md不存在屬已揭露baseline。
本次git diff確認網頁runtime未動，native HEAD乾淨。測試只在/private/var/folders/v1/2qrgkmr92mgbc668grwdx09w0000gn/T/prospec-snapshot-verify-grader-2-1-njfvEk執行；已核對主樹與snapshot的app-shell-smoke、smoke-platform.test、smoke-platform、platform-tools四檔bytes一致。獨立node --test scripts/smoke-platform.test.mjs 29/29、0fail、exit0，含20,758,759 bytes圖、25MiB邊界、超宣告量、較低caller上限、API/manifest8MB與hash錯誤。另讀/tmp/tcf-route-release-review-validation.json：真Worker/D1平台整合exit0、25assets、routing hash 1afe78ce7135dcbbc09ac908b85cf9ea74a5fb1eab4a3bc2fd40677f47d5070c、無remote writes。該review snapshot已清除，故不宣稱本次重跑或比對其完整樹；採原始收據與本次source/focused再驗。
本人直接比對browser-final.json sourceBefore及sourceAfter七檔bytes/SHA均與現版一致，82/82結果可適用；未重跑同一瀏覽器。原生採13測試log與現版source核對，未重跑native。仍未取得人工實機首頁→服務→返回、原生視覺、手機性能、OS Dynamic Type或iOS離線成功證據。只判兩個委派維度，不重判machine或design。

#### Requirements Compliance

| REQ ID | Result | Kind | Evidence | Repro |
|---|---|---|---|---|
| REQ-ROUTE-001 | PASS | executable | 已直接核對app.js:117–155實線道路／虛線估計接線、真GPS前置、generation失效處理與重試；route-client.js:16–48的本機Worker、terminate、逾時、回覆驗證；routing-worker.js:5–12只載打包圖並shortestOnly。friendly-route-client.test.cjs:22–89涵蓋取消、舊回覆、缺Worker、載圖錯誤、無效／範圍外座標、不連通及多候選接線；friendly-app-state.test.cjs:497–535、564–573涵蓋晚到GPS、替換／清除／定位失敗。已讀獨立review原始收據/tmp/tcf-route-release-review-validation.json，focused 52/52；本次未重跑未變動runtime suite。現版hash吻合的browser-final.json有真Worker跨區道路證據。新增發布smoke由本人在指定snapshot重跑29/29，合法20,758,759 bytes路網能讀取而25MiB、manifest bytes及hash限制保留。US-1.1／1.3／1.4符合；不宣稱iOS離線成功。 | `node --test docs/prototypes/tests/friendly-route-client.test.cjs docs/prototypes/tests/friendly-routing.test.cjs docs/prototypes/tests/friendly-taipei-routing.test.cjs docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-ROUTE-002 | PASS | executable | app.js:80–81、187–202、226–236共用routeIds與matches類別聯集；資源選取線與destinationRouteLayer分離，sourceHtml與詳情維持來源／更新日／導航／電話。已讀friendly-app-state.test.cjs:536–562與route-client corridor測試：249m納入、251m排除、wifi+charge聯集、視窗外沿線、選資源保留路線、類別不重算及storageWrites=0。獨立review focused收據52/52與現版browser-final 82/82支持；座標僅在本機記憶體與Worker傳遞。本次smoke未新增runtime網路／持久儲存。US-1.2符合。 | `node --test docs/prototypes/tests/friendly-route-client.test.cjs docs/prototypes/tests/friendly-routing.test.cjs docs/prototypes/tests/friendly-taipei-routing.test.cjs docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-UI-001 | PASS | executable | app.js:268只在keyboard模式聚焦，pointerdown切pointer；app-ui.css:235–244採minmax(0,1fr) auto、44px觸控高度及START單行。browser-final.json 82/82涵蓋320×568、390×844、430×932、768×1024、844×390無整頁水平溢出、主文案與START單行、pointer無初始搜尋焦點、Tab可見、touch、200% computed text與reduced-motion。本人重新核對七個runtime檔sourceBefore／sourceAfter的bytes及SHA-256全部與現版符合；本次未重跑同一瀏覽器測試。US-2.1／2.2符合；桌面文字放大不等於OS Dynamic Type或實機驗證。 | `NODE_PATH=/path/to/playwright/node_modules ROUTE_QA_URL=http://127.0.0.1:8883/ node scripts/check-friendly-route-browser.mjs` |
| REQ-UI-002 | PASS | executable | app.js:157–183依浮層調整fitBounds padding、同步hidden／aria；411–423變更mapExpanded／panelCollapsed、invalidateSize及ResizeObserver而保留同一地圖。friendly-app-state.test.cjs:575–591含狀態保留，獨立review focused52項收據通過。現版hash相符的browser-final.json證明五viewport展開、浮層避讓、收合renderedFocusables=0、Tab不進隱藏內容、兩次復原保留GPS／目的地／路線／類別／資源／map ID，短橫向及減少動態可操作。US-2.3符合。 | `NODE_PATH=/path/to/playwright/node_modules ROUTE_QA_URL=http://127.0.0.1:8883/ node scripts/check-friendly-route-browser.mjs` |
| REQ-NATIVE-001 | PASS | executable | 唯讀核對TownPass外部repo HEAD 8f106f6ba082bf8f66f266c87ca7a0c1f819a0c6且git status乾淨。tp_route.dart:65–76為MainView與必要bindings；lib/page/main/main_view_controller.dart保留keyHomeIndex，defaultIndex=1對應HomeView；home_view.dart:54與tp_route.dart:177精確服務URL皆到CodefestView。tp_web_view.dart:256–258 await bridge listener後載入；codefest_view.dart:40–54系統返回走canGoBack、明確按鈕直接Navigator.pop，97–109限制origin，21–29及錯誤遮罩保留重試。讀取test/codefest_launch_test.dart／codefest_service_test.dart及/tmp/tcf-route-native-tests.log，13項全通過，含偏好、入口、bridge順序、返回與錯誤。此輪未重跑native。US-3.1／3.2／3.3程式契約符合；人工實機首頁→服務→返回及原生視覺仍未驗，安裝／launch不得替代，保留design WARN。 | `flutter test test/codefest_launch_test.dart test/codefest_service_test.dart` |

#### Verification Limitations

acceptance baseline was captured or amended after story stage (late-capture)
<!-- prospec:evidence-end -->

<!-- prospec:evidence constitution -->
### constitution — PASS

**Summary:** 依CLI inventory完成10/10憲法規則核對；未發現本輪違反，保留既有知識缺口與證據限制。

名稱與MUST／SHOULD嚴重度採prospec-report.json structural.constitution.rules十條，不自訂權重。每條statement均有source、diff或可執行證據；無declared check需覆判。report僅顯示產物，不把其他change的review-provenance／test-provenance改寫或代替CLI live gate。主樹及外部native全程唯讀；唯一主樹寫入為本ticket指定payload，未寫source、Git index、refs、stash、config或fetch。
<!-- prospec:evidence-end -->

<!-- prospec:evidence design -->
### design — WARN

**Summary:** 七個 runtime hash 與既有 82/82 瀏覽器證據一致，網頁設計核對通過；原生首頁→服務→返回仍缺實機點按與當前版視覺證據，保留 WARN。

**Repro:** `python3 -c "import json; d=json.load(open('.prospec/changes/improve-route-experience/evidence/browser-final.json')); print(d['passed'],d['failed'],d['sourceAfter'])"`

本輪為 fresh-context 設計維度重驗，已讀 prospec/index.md、Constitution、核心 conventions、prospec-verify 第 6 維度與 delegated-evidence-format、HTML adapter Verify Phase，以及本 change 的 proposal/design-spec/interaction-spec。CLI 2.6.0 與 status 在指定 snapshot 確認。本輪未重跑整套 browser；採現版既有可查證執行證據，重新核對內容雜湊、DOM/CSS／互動程式與實際截圖。未對其他維度下判定。

證據適用性：.prospec/changes/improve-route-experience/evidence/browser-final.json 記錄 Chromium、2026-11-07T14:18:41.688Z 至 14:18:53.893Z、82/82 checks 通過。本次逐檔計算主樹和 snapshot SHA-256，皆同該 receipt sourceBefore/sourceAfter；因此發布檢查器大小修正沒有讓此七檔 runtime 證據失效。不將舊 handoff browser.json 的不同版本雜湊當作現版證據。以下是本輪重新計算的結果：

| Runtime 檔案 | SHA-256 | 主樹／snapshot／receipt 前後 |
|---|---|---|
| index.html | b970be73cc2139c4123adaab91542ff21ea109c44945788529a7579146370e08 | 一致 |
| app.js | 4779c20f6e79969e692c3d77f8a7c61e3a9ce7ee3f4ba0cc6d7e72667dafd0d8 | 一致 |
| app-ui.css | f780f18043b05465b2b64679842891989f46d7682d670a04c94285b91ef51d3c | 一致 |
| route-client.js | 49011fc0c7789f745ce4ebcc51cb9a31133aa3793673d00c7cc92e1aa8e95407 | 一致 |
| routing-worker.js | 062637a788346249dfd9b12e76d0b9d260af2b91860ee8ef52d3f38b3e544b74 | 一致 |
| routing.js | 2019738e91962b069ac16d0d89b4d2c9dbc348eec0a34c272db4f581019ba235 | 一致 |
| routing-data.js | 1afe78ce7135dcbbc09ac908b85cf9ea74a5fb1eab4a3bc2fd40677f47d5070c | 一致 |

| 元件 | 視覺核對 | 互動核對 | 判定 |
|---|---|---|---|
| 搜尋與目的地路線摘要 | app-ui.css:8–41 的六色、14/12px、4/8/16/24px 與16/999px token 符合設計；index.html:67、92–95 的搜尋、地圖控制、路線摘要與重試按鈕結構相符。本人重新觀看 route-ready.png：橘色路線與步行距離、沿線數量、250m非可達保證提示；430x932-expanded-collapsed.png 可辨實線與終點虛線。route-resource-details.png 可見真實來源及更新日期，背景路線仍在。 | app.js:117–154 分離 roadSegments/connectors，等待定位、計算中、錯誤、重試有明確文案，generation 忽略過時結果。browser-final.json 的道路接線、六組類別集合一致、開詳情保留路線、清除取消與狀態保留檢查均通過；此輪讀取結果而非宣稱重跑。app.js:230附近有沿線零筆文字；closeSheet 與 friendly-app-state.test.cjs:593 的鍵盤／pointer分流有對應。 | PASS |
| 緊湊探索模式 | app-ui.css:235–244 為 minmax(0,1fr) auto、44px最小高度、14px START、16px箭頭；app.js:243短文案符合。已重看320x568-normal.png、390x844-normal.png、768x1024-normal.png，模式與橘色 START 不互擠。既有量測五視窗主文案與START皆單行，320px按鈕高44px、寬86.53px。 | app-ui.css:83–86保留disabled、短按壓與focus-visible；:456減少動態移除transform。320x568-text-200-percent.png可見模式文字自然換行，頁面縱向延伸；receipt 的200% computed text及touch/reduced-motion檢查通過。這不是OS Dynamic Type。 | PASS |
| 地圖與浮動面板 | app-ui.css:158、182–188工具最小44px、展開100dvh、浮層限高可捲；:446–454橫向右側面板。已重看320x568-expanded-collapsed.png、430x932-expanded-collapsed.png與844x390-expanded-collapsed.png，還原鈕、搜尋、收合後狀態列可見，路線保留；768x1024-normal.png呈手機寬置中。route-selected-restored.png還原後保留目的地、兩類別、已選資源與摘要。 | app.js:171–184同步aria-expanded／label、panel-content.hidden並invalidateSize；:423 ResizeObserver。receipt五視窗皆證明展開尺寸、路線避開浮層、hidden後Tab不進內容、復原狀態一致；兩次展開收合復原保留GPS／目的地／路線／類別／資源／map instance。精細指標hover限定於app-ui.css:409。 | PASS |
| TownPass首頁入口與返回列 | 唯讀核對外部TownPass lib/page/home/home_view.dart:27–65，上方入口沿用TPColors、FilledButton與56px最小高度，保留後續首頁內容；codefest_view.dart:46–60原生AppBar返回列在WebView/body Stack之外。此輪沒有當前版原生首頁→服務→返回的實際畫面與點按證據，不能判實機視覺通過。 | tp_route.dart:65–76維持MainView根頁、註冊codefest；:177–178及home_view.dart:54兩入口同容器。codefest_view.dart:40–54系統返回先goBack，明確返回直接pop，:113以後失敗可重試。讀取/tmp/tcf-route-native-tests.log的13項通過紀錄，包含保留起始頁、橋接順序、雙入口、歷史返回與重試；本輪沒有重跑或實機點按。安裝及launch無法替代proposal US-3指定實機首頁到服務再返回。 | WARN |

視覺證據均位於 /tmp/tcf-route-design-independent-20261107，本輪實際重看的檔案：320x568-normal.png、390x844-normal.png、768x1024-normal.png、320x568-expanded-collapsed.png、430x932-expanded-collapsed.png、844x390-expanded-collapsed.png、route-ready.png、route-resource-details.png、route-selected-restored.png、320x568-text-200-percent.png。其餘尺寸互動以同receipt具名檢查與數值為證，沒有冒稱逐張檢視。

限制：既有browser是桌面模擬，以固定公共座標、真Worker與本機圖執行，阻擋外部請求且停用Service Worker；不可推論真實手機GPS、底圖網路完整性、離線快取或行動效能。docs/handoff/evidence/2026-11-07-ios-device/{verification,iphone13-verification}.json 明列舊nativeCommit 7180078；不能用其visualVerification=true認證委派所指8f106f6版原生新入口／返回。依唯讀委派不執行Git操作，native commit身分沿用委派資訊，未自行以Git查證。此次只讀當前原生碼與既有測試log，保留實機證據缺口。

唯一設計WARN待補：在當前原生版實際點按預設首頁→友善同行→返回台北通，保存首頁、服務容器、返回結果；同時確認載入／失敗時返回列仍可見可按，並區分有文件歷史的系統返回與直接返回。完成前不可將design升為PASS。此輪未修改source、Git、原生repo或runtime，主樹唯一產物為委派payload。
<!-- prospec:evidence-end -->
<!-- prospec:evidence-section-end -->
