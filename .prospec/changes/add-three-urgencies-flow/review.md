<!-- prospec:review-metrics round="3" lenses="correctness,spec-architecture,security,test-quality" signatures="F-1:FF,F-2:FF,F-3:FF,F-4:F,F-5:F,F-6:FF,F-7:FF,F-8:_FF,F-9:_FF,F-10:_FF" request_id="ddc56968ac6696c6925121f943ff966eac012ec5edb439fdd7e5dbc3008149e8" attempt_id="prospec-review:659f0a94b28005f3670ec1bb0f8570b352b2e4eccc839e7fd167c741a89071d2" base_digest="4dfd160bb9a1753809d4018f8ece1473b5ac2ba53946127020094c3ae999c600" artifact_digest="1251aaaf63c9f125f326b0583077e5cfd1564cd27cdaadbd0ae6918c3abd2627" -->
# Review Findings: add-three-urgencies-flow

| ID | Location | Severity | Lens | Status | Origin | Summary | Repro |
|---|---|---|---|---|---|---|---|
| F-1 | docs/prototypes/friendly-route/app.js:189 | critical | correctness | resolved | 1 | 已修：導引中換目標改推新導引紀錄，標題、直線、步行、返回紀錄 storeId 一致，返回回前一目標並重算；pin review #1 撤修法會紅 | (python3 -m http.server 8768 --bind 127.0.0.1 --directory /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev3/docs/prototypes/friendly-route &) ; sleep 1; node /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/repro-guide-switch.mjs |
| F-2 | docs/prototypes/friendly-route/app.js:426 | critical | spec-architecture | resolved | 1 | 已修：結果卡進地圖先關雷達，篩選與資源卡片可見；首頁直接進地圖時雷達保留；pin review #2 撤修法會紅 | (python3 -m http.server 8768 --bind 127.0.0.1 --directory /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev3/docs/prototypes/friendly-route &) ; sleep 1; node /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/qa7.mjs |
| F-3 | docs/prototypes/friendly-route/app.js:267 | major | correctness | resolved | 1 | 已修：從地圖選非結果卡的資源按 START，標題為「前往選取的資源」；結果卡那筆仍為「最近的廁所」；pin review #3 撤修法會紅（reload 例外見 F-9） | (python3 -m http.server 8768 --bind 127.0.0.1 --directory /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev3/docs/prototypes/friendly-route &) ; sleep 1; node /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/qa8.mjs |
| F-4 | docs/prototypes/friendly-route/app.js:419 | minor | correctness | open | 1 | 停在「換下一家」第 3 筆時重新載入，會回到第 1 筆，返回紀錄的 index 被改回 0 | sed -n 419,422p /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev2/docs/prototypes/friendly-route/app.js |
| F-5 | docs/prototypes/friendly-route/app.js:424 | minor | correctness | open | 1 | 在從結果卡進入的地圖頁重新載入，類別篩選沒有還原（filters 不在 history entry 內） | sed -n 424,431p /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev2/docs/prototypes/friendly-route/app.js |
| F-6 | docs/prototypes/friendly-route/app.js:434 | minor | spec-architecture | resolved | 1 | 已修：公眾熱點（sourceId wifi）結果卡與地圖卡都不出開口卡 | sed -n 432,438p /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev3/docs/prototypes/friendly-route/app.js |
| F-7 | docs/prototypes/friendly-route/app.js:456 | minor | correctness | resolved | 1 | 已修：未上架母語讀到後 removeItem，提示只出一次 | sed -n 452,460p /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev3/docs/prototypes/friendly-route/app.js |
| F-8 | docs/prototypes/friendly-route/app.js:315 | major | correctness | resolved | 2 | 已修：換兩次目標後按「結束導引」一次回結果卡（從地圖 START 則回地圖），左上返回逐步退；pin review F-8 撤修法會紅 | (python3 -m http.server 8768 --bind 127.0.0.1 --directory /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev4/docs/prototypes/friendly-route &) ; sleep 1; node /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/r5.mjs |
| F-9 | docs/prototypes/friendly-route/app.js:375 | minor | correctness | resolved | 2 | 已修：在結果卡那筆的導引頁重新載入，定位回來後標題仍為「最近的廁所」；pin review F-9 撤修法會紅 | (python3 -m http.server 8768 --bind 127.0.0.1 --directory /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev4/docs/prototypes/friendly-route &) ; sleep 1; node /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/r5.mjs |
| F-10 | docs/prototypes/friendly-route/app.js:362 | minor | test-quality | resolved | 2 | 已補 pin：把 guide→guide 先 leaveGuide 改回只在離開 guide 時清理，review F-10 轉紅 | sed -n 362p /private/tmp/claude-501/-Users-ciyang-Documents-repos-taipei-codefest-2026/505ea571-3734-4953-9902-8380b3867ecb/scratchpad/rev4/docs/prototypes/friendly-route/app.js |

<!-- prospec:evidence-section -->
## Evidence

<!-- prospec:evidence F-1 -->
### F-1

b224061 實跑 repro 輸出 not reproduced：選清單第 3 筆後 title 瀚寓酒店、直線 261 m、步行 265 m、history.storeId friendly-0701。r3.mjs：G1→G2 後 reload 仍在 G2，back 回 G1（市政大樓、步行 33 m 重算），再 back 到 result、home、離開；快速連切三個目標後 back×2 順序正確，零 pageerror。突變：移除 app.js:189 的 guide 分支，review #1 轉紅。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-2 -->
### F-2

b224061 qa7.mjs 輸出 selected card visible true、filters visible true、host visible false。r3.mjs：首頁→地圖開雷達→返回→首頁→看地圖，雷達仍可見（未誤關）。突變：移除 openMap 內 highlights.close()，review #2 轉紅。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-3 -->
### F-3

b224061 qa8.mjs 輸出 START guide heading 前往選取的資源。突變：heading 改回只看 URGENCIES，review #3 轉紅。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-4 -->
### F-4

實跑：充電→換下一家兩次（friendly-0867）→reload，結果顯示 friendly-0007、history.state.index 0。reload 時定位尚未取得，applyScreen 把 index clamp 成 0，GPS 回來 refreshUrgencyScreens 再 replaceScreen({index:0})。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-5 -->
### F-5

實跑：充電結果→看地圖→reload，selected card 有、filter chips 全部未選。openMap 只在當下設 state.filters，applyScreen 的 map 分支不依 entry.urgency 重設。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-6 -->
### F-6

r3.mjs：網路結果卡 speak 按鈕 0；qa8 地圖選熱點 speak btn 0。突變撤掉 sourceId 條件，review small items 轉紅。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-7 -->
### F-7

r3.mjs：設 vi 後 reload，key 被清空，第一次開卡有 toast，再 reload 開卡 toast 隱藏。突變撤掉 removeItem，review small items 轉紅。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-8 -->
### F-8

5da7250 r5.mjs：結果卡第 2 筆→帶我去→換兩次目標（depth 4, exitDepth 1）→結束導引→result toilets-1227 index 1；再返回 home、再返回離開。reload 在 depth 4 後左上返回退到 depth 3，結束導引回 result。r6.mjs：地圖 START→換目標→結束導引回 map→返回 home→離開。零 pageerror。突變：endGuidance 改回 goBack，review F-8 轉紅。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-9 -->
### F-9

r5.mjs reload G1 (nearest)：最近的廁所/市政大樓。突變：拿掉定位後重建（refreshUrgencyScreens 內 guide 分支）review F-9 轉紅；只拿掉 applyScreen 內的重建分支則 63 全綠，該分支在 reload 時因無定位本就產生空清單，屬多餘未 pin 程式，不影響行為。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-10 -->
### F-10

突變 M10：if (state.screen === "guide" && next.view !== "guide") leaveGuide(); → friendly-app-state 62 pass 1 fail（review F-10）。
<!-- prospec:evidence-end -->
<!-- prospec:evidence-section-end -->
