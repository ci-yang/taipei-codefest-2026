# Verify Evidence: add-three-urgencies-flow

<!-- prospec:evidence-section -->
<!-- prospec:evidence-attempt prospec-verify:f501a41c14b40377bf76bf7ccfe27f1d3564d8b67bc0b55f965d112bc84c7b68 -->
## 2026-11-07 — grade A

<!-- prospec:evidence delta-spec-compliance -->
### delta-spec-compliance — WARN

**Context ID:** `d92ac309eff4e4a1e316448685d74b7a997b1ad526b917be883fb665e2f896a7`

**Summary:** 11 條 REQ：9 PASS、2 WARN、0 FAIL。WARN 為導引倒數遇位置更新沒有已提交測試（REQ-3U-003）與 Android 系統返回未實機驗證（REQ-3U-006）；熱點不出開口卡已依修訂規格判通過

**Repro:** `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && pnpm test:prototype && pnpm test:tooling`

初評 HEAD b224061。pnpm test:prototype：node 134 pass／0 fail，python 17 OK；pnpm test:tooling：77 pass。scripts/check-three-urgencies-browser.mjs 在 8769 實跑 30 項全 PASS、pageErrors 為空（截圖輸出到 scratchpad，沒有寫回 repo）。grader 另寫兩支 Playwright 腳本（scratchpad/grader-card-net.mjs、grader-timer-move.mjs）驗離線開口卡零請求、網路結果卡動作鈕，以及倒數遇位置更新的行為。tasks.md 的 T23–T25（[V]/[M]）仍未勾選，T25 Android 實機為唯一未驗項。 第二輪（同一 HEAD b224061）：依 lead 修訂的 delta-spec REQ-3U-002 AC2、REQ-3U-006 AC3、REQ-3U-102 場景與 proposal US-1.2、US-3.2（revision 2）重判，熱點例外與規格一致，移除 US-1.2、US-2.1、US-3.2 三條場景偏差。US-2.1 原文未改，但開口卡按鈕只在卡片提供時才按得到，修訂後的 US-1.2 與 US-3.2 已界定按鈕何時出現，兩者不衝突。 第三輪：HEAD 5da7250（多一個 commit：結束導引一次回結果卡、reload 還原 guide 時重建結果清單、guide 換目標的清理）。重跑 pnpm test:prototype 得 node 137 pass／0 fail、python 17 OK，pnpm test:tooling 77 pass，check-three-urgencies-browser.mjs 31 項全 PASS、pageErrors 為空。items 沒有引用 app.js 行號（都以函式名引用）；app-state 測試第 650 行、highlights.js:14、highlights.css:2 在 5da7250 都沒有漂移，判定不變。

#### Requirements Compliance

| REQ ID | Result | Kind | Evidence | Repro |
|---|---|---|---|---|
| REQ-3U-001 | PASS | executable | AC1：index.html 首個 section 為 #home-screen，三顆 button 帶 data-urgency toilet／charge／wifi；app.js initScreen 無 history.state 時 replaceState home 再 applyScreen；測試「home is the first screen with three urgencies」斷言 #app[data-view]=home、三個 data-urgency 順序。AC2：app.js locationLine 產生「正在定位…」「已定位 · ±N m」「精度不足 · ±N m」「無法取得定位 · 原因」四態，#home-gps 重新定位常駐；測試覆蓋定位中、±15 m、精度不足（accuracy 180）、GEO_DENIED 的「無法取得定位 · 定位權限未開啟」且 dataset.state=failed。AC3：同一測試斷言 #enter-app、#highlight-launch、#welcome-screen、#transport-status、[data-transport] 皆為 null，#explore-screen hidden；grader 另以 Playwright 390px 實跑首頁，#map 無 client rect、無「出發」與交通偏好文字（scratchpad/grader-card-net.mjs）。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && node --test --test-name-pattern="home is the first screen" docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-3U-002 | PASS | executable | AC1、AC6：urgency.js rankNearest 依 distance 排序、同距離以輸入 index 穩定，limit 3；friendly-urgency.test.cjs 六案例（程式外重算最近者、第二第三近、同距離穩定、無定位空）全綠；app-state「each urgency button…」逐類別點擊並驗換下一家第二、第三近、第三筆後按鈕 disabled。AC2：renderResult 輸出名稱、「直線 X」、方向、「無障礙 · 有標示／未標示」、sourceHtml 來源與更新日、帶我去與看地圖；approx() 在 accuracy>100 加「約」（測試「accuracy above 100 m…」）。**規格修訂後（delta-spec REQ-3U-002 AC2、proposal US-1.2 revision 2）**：公眾 Wi-Fi 熱點（sourceId 為 wifi）不顯示「開口卡」已寫進 AC2。實作 speakCategory 對 sourceId wifi 回 null，結果卡只剩帶我去與看地圖，與新文字一致；grader 實跑網路類別得 actions ["go","map","next"]，app-state 測試第 650 行斷言 speak 按鈕只在 sourceId 不是 wifi 時出現。AC3：測試「step-free preference…」驗有標記者只回 accessible，fixture 無標記時回最近並顯示「無障礙資料不足」。AC4：測試「without a valid location…」驗無卡、需要定位、看地圖，且不以地圖中心排序。AC5：wifi 卡片標「免費 Wi-Fi 熱點，不保證訊號」，撥號只在 phoneFor 有效時出現。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && node --test --test-name-pattern="each urgency button" docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-3U-003 | WARN | executable | AC1：app.js renderGuidance 在 setView 同輪設 #guide-arrow transform（arrowRotation 在啟用方位感測時扣 heading），#guidance-distance 為「直線 X」；orientation() 在 guide 時重繪。測試「guide draws the arrow…」斷言 rotate 與「直線」、#guide-walk 初始 hidden。AC2：scheduleGuideRoute 成功才顯示「步行 Y · 約 N 分鐘」，直線字樣保留；失敗時 guideStatus=error，只剩箭頭與直線並出重算鈕（測試「a guide route that arrives after leaving guide…」）。AC3：獨立 guideRouteClient 與 guideGeneration；測試斷言進 guide 不改 routeGeneration（目的地路線不被取消），位置更新後 guide route 請求數不增。AC4：只在路線成功後呼叫 highlights.openToilet；之前 #guide-timer-status 顯示「步行路線計算中」或「需要步行路線才能倒數」，#guide-timer 為空（測試「toilet guide hands the countdown…」用 highlights stub）。**覆蓋缺口**：「位置更新不重置倒數」由 highlights.js update() 的 injectedRoute 判斷實作，app-state harness 只注入 stub，沒有已提交的測試覆蓋真 highlights.js 這條路徑；check-three-urgencies-browser.mjs 也沒有在倒數中移動位置。grader 自行以 Playwright 實跑 scratchpad/grader-timer-move.mjs：倒數開始後改 geolocation 並重新定位，倒數由 00:27 續到 00:25（狀態仍為倒數中），步行數字不變，沒有新 Worker，所以行為正確，只是缺測試。AC5：highlights.js guideLayer 在 guide＋charge＋budget.active 時繪製，離開 guide 時 pauseGuide 與 update() 清除；瀏覽器腳本 PASS「charge guide draws survival mask (manual 18%)」與「no survival mask after leaving guide · 0 px」。真實電量低於 20% 的分支只有程式路徑（batteryChanged 呼叫 drawGuide），沒有自動化證據，Android 實機項 T25 尚未執行。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && node --test --test-name-pattern="guide draws the arrow" docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-3U-004 | PASS | executable | AC1：speak-card-strings.js 三類別各一句中文 ask 與共同 thanks「不方便也沒關係，謝謝」，en／id／vi 一一對應；friendly-speak-card.test.cjs「planSpeakCard：zh-TW 單面，其他語言雙面且句子一一對應」。AC2：speak-card.js 與 strings 沒有 fetch、XHR、storage API（grep 零命中，另有測試「新檔沒有網路請求或儲存 API」）；grader 以 Playwright 在 ctx.setOffline(true) 下從結果卡開、關開口卡，期間請求數 0，layout single（scratchpad/grader-card-net.mjs）。sw.js 與 tools/package-friendly-prototype.py 都已加入 4 個新檔，offline 測試斷言 26 檔。AC3：en／id／vi 皆 reviewed:false，getAvailableLangs 預設只回 zh-TW；app.js openCard 不帶 includeUnreviewed（巢狀返回測試斷言 includeUnreviewed undefined）；README「開口卡文案校對」表四語言校對人與日期皆「待補」，與句庫 reviewedBy／reviewedOn 全為 null 一致。AC4：關閉走 onClose: goBack，popstate 時 closeSpeakCard silent；測試「closing the speak card returns to its source…」驗回結果卡同一筆（換下一家後）、回地圖同一筆且卡片可見、storageWrites 為 0；開口卡 DOM 只有關閉鈕，無 input／form（grader 實跑 inputs 0）。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && node --test docs/prototypes/tests/friendly-speak-card.test.cjs && node --test --test-name-pattern="closing the speak card" docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-3U-005 | PASS | executable | AC1：app.js LANG_KEY friendly-native-language-v1、STEP_FREE_KEY friendly-step-free-v1；設定頁按鈕寫入 zh-TW 與 1／0（測試斷言 storageWrites 序列）；readPrefs 於啟動讀回，測試「step-free preference…」以 storage 預置 1 驗 prefs.stepFree 為 true。目前只有 zh-TW 上架，所以非中文值的「重開還原」無法實際走到，這是 REQ-3U-004 AC3 的必然結果，不算缺陷。AC2：讀到 vi（未上架）時退回 zh-TW、prefsNotice 提示，並 removeItem 清掉殘值（測試同案例與「review small items…」）。AC3：storageThrows runtime 下設定可切換、輪椅偏好仍影響排序（同一測試後半）。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && node --test --test-name-pattern="preferences are local only" docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-3U-006 | WARN | executable | AC1：history.state 返回堆疊（pushScreen／goBack／popstate→applyScreen）；測試「nested back: home → result → map → speak card…」驗連按返回依序 map、result、home，第四次 history.exited；瀏覽器腳本以 page.goBack 驗 back1→map、back2→result、back3→home 全 PASS。5da7250 起「結束導引」（#guidance-end）依 history entry 的 exitDepth 以 history.go 一次回到進導引前那一筆，導引中換過目標也一樣；畫面返回鍵（#exit-guidance）與系統返回仍走 goBack 一步一步退，所以首頁→結果卡→地圖→開口卡的巢狀返回不受影響。新增測試「review F-8…」「F-9…」「F-10…」與走查項「one press of 結束導引 after switching returns to the result card」皆 PASS。**未驗**：「含 Android 系統返回」需台北通實機，tasks T25 仍未勾，沒有證據顯示 WebView 系統返回會觸發 popstate。AC2：openMap 從 result 進入時 close 雷達、filters 設為該類別、selectResource；測試斷言 filters 只含 toilet、selectedId 為該筆、#selected-card 可見；瀏覽器「result → map after radar」PASS。AC3：selectedCard 有導航、有電話時撥號、speakCategory 非 null 時開口卡（測試「map card offers navigate, phone and speak…」）。規格修訂後 AC3 已註明公眾 Wi-Fi 熱點不顯示開口卡，實作一致（測試「review small items…」），AC3 判通過。本 REQ 維持 WARN 的唯一原因是 AC1 的 Android 系統返回沒有實機證據。AC4：瀏覽器腳本 390px 下 home、result、guide、card（疊在 result）、map 的 scrollWidth-innerWidth 皆 ≤0；grader 另測開口卡疊在地圖時為 0。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && node --test --test-name-pattern="nested back" docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-3U-101 | PASS | executable | WHEN 開啟：initScreen 預設 home，測試斷言 view home、explore-screen hidden、無 #welcome-screen；瀏覽器腳本「first screen is home」PASS。WHEN 看地圖：#home-map pushScreen map，同測試點 #home-map 後 view map，再按 #map-back 回 home。定位規則沿用 requestPosition 與既有失敗訊息（messages 表未變），精度門檻仍為 100 m。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && node --test --test-name-pattern="home is the first screen" docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-3U-102 | PASS | executable | selectedCard（app.js）保留 navigate、有效電話時 phone，加 data-action="speak"；showDetails sheet 沒有加開口卡，也沒有撥號，與 Before 相同；externalAction 的 bridge 呼叫與失敗處理沒有改。測試「map card offers navigate, phone and speak…」與「closing the speak card returns to its source…」驗開卡後回地圖同一筆仍選取。**規格修訂後**：Spec 場景改為「選取一筆非公眾 Wi-Fi 熱點的資源，選取卡片顯示開口卡；熱點不顯示」。實作與測試「review small items…」（hotspot 的 selected-card 沒有 data-action="speak"）一致。沒有三急類別的 212 筆也不出開口卡，這是 plan 第 5 步核准的行為，對熱點以外的資源不會誤擋。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && node --test --test-name-pattern="map card offers navigate" docs/prototypes/tests/friendly-app-state.test.cjs` |
| REQ-3U-201 | PASS | executable | 執行期檔案 grep「出發」「enter-app」「welcome」零命中；測試斷言 #enter-app、#welcome-screen 為 null；grader 瀏覽器首頁 innerText 無「出發」。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108/docs/prototypes/friendly-route && grep -n "出發\\|enter-app\\|welcome" app.js highlights.js index.html app-ui.css highlights.css urgency.js speak-card.js speak-card-strings.js speak-card.css sw.js` |
| REQ-3U-202 | PASS | executable | 執行期檔案 grep TRANSPORT／transport／捷運／單車／開車零命中（不分大小寫）；測試「the transport preference is removed…」與首頁測試斷言 [data-transport]、#transport-status 為 null。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108/docs/prototypes/friendly-route && grep -n -i "transport\\|捷運\\|單車\\|開車" app.js highlights.js index.html app-ui.css highlights.css urgency.js speak-card.js speak-card-strings.js speak-card.css sw.js` |
| REQ-3U-203 | PASS | executable | index.html 已無 #highlight-launch，#highlight-map-launch 只在地圖頁 panel-toolbar；首頁測試斷言 #highlight-launch 為 null、#highlight-map-launch 存在。殘留只有 highlights.js:14 的 querySelector 與 highlights.css:2 的選擇器，元素不存在時 launch 為 null、`if (launch)` 跳過，不會出現在畫面；屬於可清的死碼，不影響 REMOVED 行為。 | `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108/docs/prototypes/friendly-route && grep -n "highlight-launch" index.html app.js highlights.js highlights.css` |

#### Verification Limitations

acceptance baseline was captured or amended after story stage (late-capture)

#### Scenario Deviation Findings

| Scenario ID | Affected REQs | Spec Location | Result | Summary | Evidence |
|---|---|---|---|---|---|
| US-2.2 | REQ-3U-004, REQ-3U-005 | proposal.md:43 | WARN | 四語言只有中文上架，設定頁只能選中文，下半改為母語的情境目前無法在正式流程走到；這是規格允許的「未校對不上架」，不是實作缺陷 | speak-card-strings.js 的 en、id、vi 皆 reviewed:false，getAvailableLangs 只回 zh-TW；README 校對表四列皆待補。雙面版面只在 planSpeakCard 帶 includeUnreviewed 的單元測試與 speak-card-demo.html（不打包）驗過。母語者校對完成前，demo 只會顯示中文單面。 |
| US-2.4 | REQ-3U-004 | proposal.md:45 | WARN | 校對紀錄已寫入 README，但四語言的校對人與日期全為「待補」，連已上架的中文也沒有校對人 | speak-card-strings.js 註解寫明 zh-TW「依 lead 指示標 reviewed: true；校對人與日期尚未登記」。行為符合規格（未校對語言不上架），只記錄現況，需要人補校對人。 |
<!-- prospec:evidence-end -->

<!-- prospec:evidence constitution -->
### constitution — PASS

**Summary:** 10 條規則：9 PASS、1 not-applicable（No any，純 JS），無 MUST 或 SHOULD 違反

**Repro:** `cd /Users/ciyang/Documents/repos/tcf-three-urgencies-20261108 && git log --format=%s e479b2e..5da7250 && git diff --stat e479b2e..5da7250 -- package.json pnpm-lock.yaml`

逐條判斷見 constitution_rules。新增依賴為零、商用地圖與雲端 LLM／翻譯字串零命中、無 secret、commit 7 筆（至 5da7250）全符合格式。
<!-- prospec:evidence-end -->

<!-- prospec:evidence design -->
### design — not-applicable

**Summary:** 本 change 目錄沒有 design-spec.md，UI 沿用 survival 分支現行主題，設計一致性維度不適用

ls .prospec/changes/add-three-urgencies-flow/ 只有 delta-spec、metadata、plan、proposal、review、tasks、verify-context，沒有 design-spec.md；proposal Stated Assumption 13 明定主題沿用現行設計。
<!-- prospec:evidence-end -->
<!-- prospec:evidence-section-end -->

<!-- prospec:escalation-history -->
## Escalation History

Lifetime events: 1. Overrides: 0. Completeness: complete.

| Ordinal | Station | Trigger | Event | State |
|---|---|---|---|---|
| 1 | prospec-review | max_rounds_exceeded | review:3 | pending |

| Event | Station | Reason | Usage |
|---|---|---|---|
<!-- prospec:escalation-history-end -->
