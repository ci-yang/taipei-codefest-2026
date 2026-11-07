# Tasks: add-three-urgencies-flow

**Input**: `.prospec/changes/add-three-urgencies-flow/`（plan blob 168e6822、delta-spec blob 1152556f）
**實作位置**：`/Users/ciyang/Documents/repos/tcf-three-urgencies-20261108/docs/prototypes/friendly-route/`（下稱 `fr/`），測試在 `docs/prototypes/tests/`
**Prerequisites**：開口卡模組（`speak-card-strings.js`、`speak-card.js`、`speak-card.css`、demo、`friendly-speak-card.test.cjs`）已完成，本 change 只接線、不改內容

## Format: `[ID] [kind?] Description (plan 步驟 · REQ)`

- **[M] / [V]**：manual／verification；未標記為 code（定義見 tasks-format reference）
- 「S*n*」指 plan.md Implementation Steps 第 *n* 步；「R-xxx」指 delta-spec 的 REQ-3U-xxx

---

## Phase 1: 純函式層

- [x] T1 新增 `fr/urgency.js`：UMD 外殼照 `highlight-math.js`，匯出 `rankNearest(stores, position, { category, stepFree, limit = 3, distance })` 回 `{ items, stepFreeFallback }`；類別比對 `services.includes(category)`，輪椅偏好只取含 `accessible` 者，沒有就回最近者並設 `stepFreeFallback: true`；同距離依輸入順序穩定；無有效 position 回空 items。`distance` 由呼叫端注入，不寫 haversine（S1 · R-002）

## Phase 2: 殼層（app.js／index.html／CSS 五態與返回）

- [x] T2 `fr/app.js:274 setView` 改收 `home／result／guide／card／map`，先 grep `'welcome'|'explore'|'guidance'` 列清單再逐處改：`:19`、`:90`、`:151`、`:160`、`:163`、`:168`、`:172`、`:274-281`、`:292-297`、`:305`、`:426-427`、`:444`、`:446`；`:297 selectResource` 刪除自動 `setView`；`card` 時畫面與 `#app[data-view]` 取 entry 的 `base`（S2 · R-001、R-101）
- [x] T3 `fr/app.js` 返回機制：`pushScreen(entry)`（entry = `{ view, base, urgency, storeId, category, depth }`，先 feature-detect `history.pushState`）、`applyScreen(entry)`、`goBack()`＝`history.back()`、`popstate` 只依 `event.state` 還原、無 state 回 home。**初始化**若已有 `history.state` 就 `applyScreen` 還原（result 依 `entry.urgency` 重跑排序），沒有才 `replaceState` 成 home；「回首頁」只在 `depth > 0` 才 `history.go(-depth)`；不保留 `screenStack` 分支（S2 · R-006、R-004）
- [x] T4 `fr/app.js` 新增 `renderHome`、`openUrgency`、`renderResult`、`nextResult`：結果卡用 `distanceLabel`、`directionName(bearing())`、`sourceHtml`、`phoneFor`，無障礙「有／未標示」與「無障礙資料不足」，網路類別標「免費 Wi-Fi 熱點，不保證訊號」，精度大於 100 m 加「約」。**無定位的「需要定位」畫面也 `pushScreen`**；「換下一家」與定位更新重算一律 `replaceState`，最多前進 2 筆（S2 · R-001、R-002）
- [x] T5 `fr/app.js` 移除 `TRANSPORTS`、`state.transport` 與 `:258-259`、`:403` 的交通偏好邏輯；新增 `openMap({ category, storeId })`：`state.filters = new Set([category])`、`selectResource`、`pushScreen({ view: 'map' })`，`focusPoint` 放進 rAF 排在 `invalidateSize`（`:281`）之後；`#map-back` 走 `goBack()`（S2 · R-006、R-202）
- [x] T6 `fr/index.html`：`#welcome-screen` 換成 `#home-screen`（三顆 `data-urgency` 大按鈕、定位行、重新定位、「看地圖」「設定」），新增 `#result-screen`；刪除 `#enter-app`、`#highlight-launch`、`.transport-section`，保留 `#highlight-map-launch` 與 `#start-guidance`；`:81` 指南針換成 `#guide-arrow`，HUD 加方位感測鈕與 `#guide-walk`；`#guide-timer-status`＋`#guide-timer` 放在 `#guidance-controls`（`:87-90`）；`app.js` 前依序載入 `urgency.js`、`speak-card-strings.js`、`speak-card.js`，`<head>` 加 `speak-card.css`（S3、S5、S6 · R-001、R-201、R-203）
- [x] T7 `fr/app-ui.css`：16 處 `data-view` 選擇器改為 guide／map／home，重寫顯隱規則以涵蓋 home／result，刪 `.welcome-*`；新增 home 大按鈕與結果卡樣式（沿用紫 `#3525cd`／橘 `#ff5e3a`）；guide HUD 拆上下兩段，避免 `:270` 的 `max-height: 42dvh` 在 390px 把倒數捲出畫面（S6 · R-001、R-006）

## Phase 3: guide 導引

- [x] T8 `fr/app.js`：把 `:365` 的旋轉算式抽成 `arrowRotation(position, store)`，`renderDirection` 與 `renderGuidance` 共用並設 `#guide-arrow` 的 transform；`orientation()`（`:374-377`）在 guide 時也重繪；`#guidance-distance` 改「直線 X」、`#guidance-bearing` 只寫方位與「正北基準」、拿掉「（非步行路線）」；`#guide-walk` 只在路線成功時出「步行 Y · 約 N 分鐘」（S3 · R-003）
- [x] T9 `fr/app.js`：`startGuide(store)`（`pushScreen({ view: 'guide' })`、rAF 內 `focusGuidance`）與 `scheduleGuideRoute(store)`，用獨立 `guideRouteClient`＋`state.guideGeneration`，只在進入與重試時計算、位置更新不重算；guide 期間移出 `destinationRouteLayer`（`:116-124`），`focusGuidance`（`:286-289`）改以 `[position, store]` 或 guide 路線 fit。**離開 guide 時遞增 `guideGeneration`、`guideRouteClient.cancel()`、通知 highlights 暫停倒數**，晚到的路線不得呼叫 `openToilet`（S3 · R-003）

## Phase 4: 亮點整合（highlights.js）

- [x] T10 `fr/highlights.js`：`:27` 初值改 `'home'`、`:43 active()` 改認 `'map'`、snapshot 加 `urgency`；`onOpenExplore` 改由 app `openMap` 處理；`:260-264 batteryChanged` 只在 view 為 map 時自動 `open('battery')`，跳過時不把 `deviceWasLow` 設為 true（S4 · R-003、R-006）
- [x] T11 `fr/highlights.js`：`create()` 收 `guideHost`，新增 `renderGuide()`（view 為 guide 且 urgency 為 toilet 時寫精簡倒數：水球、剩餘秒數、開始／暫停／重設）；`guideHost` 綁同一個 click handler（照 `:285`），`destroy()` 一併解除；`click()` 結尾改為 `render()` 再 `renderGuide()`；倒數數字用 `data-hl-countdown`，`tick()` 兩處都更新，**歸零分支也呼叫 `renderGuide()`**（S4 · R-003）
- [x] T12 `fr/highlights.js` 新增 `openToilet(store, route)`（設 `selected`、`toiletRoute`、`toiletStatus = 'ready'`、`routeKey`，再 `resetTimer()`），`update()` 遇注入路線時位置改變不 `scheduleToiletRoute`；`fr/app.js` 只在 `scheduleGuideRoute` 成功後呼叫，之前 `#guide-timer-status` 顯示「步行路線計算中，完成後可倒數」、失敗顯示「需要步行路線才能倒數」（S4、S3 · R-003）
- [x] T13 `fr/highlights.js` 新增獨立 `guideLayer`：view 為 guide、urgency 為 charge 且 `budget.active`（含手動試玩）時繪製生存圈，位置或電量鍵改變時重繪；`clearLayers()`（`:119`）不碰它；離開 guide 或換類別時在 `update()` 內清除（S4 · R-003）

## Phase 5: 開口卡接線與設定

- [x] T14 `fr/app.js` 開口卡接線：結果卡與 `selectedCard`（`:237`）加 `data-action="speak"`，click 委派加在 `:400`；`speakCategory(store)` 先用急用類別（店家具備時），否則取 services 中第一個 toilet／charge／wifi，三類都沒有不出按鈕；`openSpeakCard({ category, lang, onClose: goBack })` 不帶 `includeUnreviewed`；開卡前 `closeSheet()`；`popstate` 時卡片開著就 `closeSpeakCard({ silent: true })`（S5 · R-004、R-102）
- [x] T15 `fr/app.js:394 openSettings` 加母語（只列 `getAvailableLangs()`）與輪椅／推車開關，存 `friendly-native-language-v1`（`zh-TW|en|id|vi`）、`friendly-step-free-v1`（`1|0`），照 `:399`／`:441` 的 try/catch；讀到未校對或不合法值退回 `zh-TW` 並提示（S6 · R-005）

## Phase 6: 離線、打包與文件

- [x] T16 `fr/sw.js:9 ASSETS` 與 `tools/package-friendly-prototype.py:11-35` 加 `urgency.js`、`speak-card-strings.js`、`speak-card.js`、`speak-card.css`（sw 22 → 26）；不改 VERSION 字面值、不改 `scripts/build-friendly-app.mjs`；`speak-card-demo.html` 不打包（S7 · R-004、R-001）
- [x] T17 原型 `fr/README.md` 資料來源表旁加開口卡校對表，語言、校對人、日期取自 `speak-card-strings.js` 的 `reviewed`／`reviewedBy`／`reviewedOn`，空值寫「待補」（S7 · R-004）

## Phase 7: Tests

- [x] T18 新增 `tests/friendly-urgency.test.cjs`：以真資料與固定位置驗三類別最近者等於獨立重算、換下一家為第二／三近、輪椅有標記與無標記兩案例、同距離穩定、無定位回空（S7 · R-002）
- [x] T19 `tests/friendly-app-state.test.cjs` harness：runtime 注入 `history` stub（記錄 push／replace／back 並觸發 popstate），在 vm 內執行 `fr/urgency.js` 取真 `FriendlyUrgency`，注入記錄呼叫的 `FriendlySpeakCard` stub，seam（`:147`）加新函式（S7 · R-006）
- [x] T20 `tests/friendly-app-state.test.cjs` 改寫 8 個舊案例（`:350`、`:367`、`:389`、`:403`、`:426`、`:465`、`:575`、`:593`）的入口，`:374` 斷言改「直線」標籤；新增案例：首頁 DOM 無地圖與交通偏好、結果卡內容與無定位、巢狀返回（home → result → map → 開口卡，依序回 map、result、home）、reload 還原、開口卡類別規則與關閉回選取卡、設定保存與退回（S7 · R-001～006、R-101、R-102、R-201～203）
- [x] T21 `tests/friendly-offline.test.cjs:91-96` 的 22 改 26，`:9` VERSION 常數不動（S7 · R-004）
- [x] T22 `scripts/check-friendly-route-browser.mjs:80-82` 入口改為點首頁「看地圖」並等 `data-view === 'map'`，保留 `:108-109`、`:292` 的 `#start-guidance`；新增五畫面 390px 截圖，含「guide＋廁所倒數」、「巢狀返回」、「離開 guide 後無生存圈遮罩」三個狀態（S7 · R-003、R-006）

## Phase 8: 驗證與手動

- [x] T23 [V] 跑 `pnpm test:prototype` 全綠（含既有 `friendly-speak-card.test.cjs`），並全文搜尋 `TRANSPORTS`、`transport-status`、「出發」為零命中（S7 · R-201、R-202）
- [x] T24 [V] 跑 `pnpm app:build`，確認 dist 含 4 個新檔、`sw.js` 與 `offline.js` 共用同一個 v6 雜湊版本；跑 T22 瀏覽器腳本並保存 390px 截圖（S7 · R-001、R-004、R-006）
- [ ] T25 [M] Android 台北通實機：五畫面逐一按系統返回（含巢狀路徑）、飛航模式開開口卡、手動試玩充電生存圈；結果記入交接，未驗項照實標「未驗證」（S7 · R-003、R-004、R-006）

---

## Summary

- **Total Tasks:** 25（code 22、[V] 2、[M] 1）
- **Parallelizable Tasks:** 未標記（實作依序執行）
- **REQ 覆蓋**：R-001（T2、T4、T6、T7、T16、T20、T24）、R-002（T1、T4、T18、T20）、R-003（T8–T13、T22、T25）、R-004（T3、T14、T16、T17、T21、T24、T25）、R-005（T15、T20）、R-006（T3、T5、T7、T10、T19、T20、T22、T24、T25）、R-101（T2、T20）、R-102（T14、T20）、R-201（T6、T20、T23）、R-202（T5、T20、T23）、R-203（T6、T20）
