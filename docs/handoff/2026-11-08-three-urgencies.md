# 交接：三急首頁與開口卡（2026-11-08 凌晨，lead session 代 Codex 完成）

Ci 2026-11-08 01:20 左右授權「直接做完，醒來要看到成果 APK 與部署」。本文是醒來第一份要讀的東西。

## 成果（都可直接點）

| 項目 | 值 |
|---|---|
| 分支 | `feat/three-urgencies-flow`，worktree `~/Documents/repos/tcf-three-urgencies-20261108`，底 `design/survival-highlights` e479b2e |
| 程式最終版 | `5da7250`（App 本體）；`0ff706a` prospec 文件；`d50e0f4` 部署白名單（只改 `scripts/app-shell-smoke.mjs`） |
| 試玩分享頁 | `https://ci-share.pages.dev/d537f3d9f5299fc6/`（token `d537f3d9f5299fc6`，版本 `friendly-resource-v6-b56a156644a3375b`，26,142,445 bytes） |
| APK | `https://github.com/ci-yang/TownPass/releases/tag/three-urgencies-demo-20261108`，檔名 `friendly-taipei-three-urgencies-20261108.apk`，116,052,352 bytes，sha256 `88f26b19…b5af8`，debug 簽章，WebView 載入上面的分享頁（首次需網路） |
| 正式站 | `https://taipei-friendly-platform.jason21131.workers.dev`，`/healthz` version `d50e0f4e…`，前一版 Worker versionId `c0c9590b-07fe-419d-8427-b24963fd663a`（sourceSha 2016b035），rollback 用 `pnpm platform:rollback -- --receipt .artifacts/releases/2026-11-07T18-42-22.922Z-4328a5fc-3a14-4f35-ac63-f0f0a4a98144.json` |
| 舊分享頁 | `cc521b0047361278` 未動，舊 APK 仍可用 |
| prospec | change `add-three-urgencies-flow`：story → plan（verifier 三輪，最後 WARN）→ tasks（WARN）→ implement → review 三輪（0 open critical）→ verify **grade A，status verified** |

## 主流程（demo 講稿順序）

1. 首頁三顆大按鈕「廁所／充電／網路」＋定位狀態。
2. 按「廁所」→ 結果卡：直線最近一筆、方向、無障礙標記、來源更新日；「帶我去／開口卡／看地圖」，「換下一家」最多 2 筆。
3. 「帶我去」→ 旋轉箭頭＋直線距離立刻出現，本機步行路線算完補「步行 X 公尺 · 約 N 分鐘」，廁所接水球倒數（開始／暫停／重設）。
4. 「開口卡」→ 全螢幕大字「您好，我想借用廁所，請問方便嗎？謝謝」＋「不方便也沒關係，謝謝」。目前只有中文單面上架。
5. 「看地圖」→ 原本完整地圖（搜尋、多選、清單、雷達四模式）。
6. 連按返回：地圖 → 結果卡 → 首頁 → 第四次離開微服務。

**demo 避開**：導引中從「附近資源」換目標雖已修好（會推新導引紀錄），但實機未驗，講稿別走這步。房價含金量留在地圖頁雷達面板，不要點。

## 沒做到、沒驗到（照實）

- **Android 實機零驗證**：沒有 adb 與手機。系統返回鍵是否觸發 `popstate`、開口卡全螢幕、`getBattery`、真 GPS、真斷網，全部只有桌機 Chromium 證據。tasks T25 `[M]` 未勾。
- **翻譯未校對**：`speak-card-strings.js` 的 en／id／vi 是 AI 擬的，`reviewed: false` 不上架；中文句子也沒有校對人與日期，README 校對表寫「待補」。要雙語 demo 必須先找母語者。
- **prospec 尾巴**：review 第三輪觸發 CLI 的 round cap（max_rounds_exceeded）escalation event，狀態顯示 HALT；verify 仍以 grade A 進 verified。break-glass 只能由人給（`prospec change log --skill prospec-review --result WARN --warning "Manual override: <reason>"`），要不要處理由 Ci 定。d50e0f4 只動部署腳本，未重跑 record-review／verify，`review-provenance` 可能顯示 stale。
- **worktree 裡 prospec 歷史衝突**：在分支 worktree 跑 prospec 會被 `.prospec/abandoned` 同 identity 衝突擋住，繞法見 memory `prospec-worktree-history-conflict`（暫移 `.prospec/abandoned` 與 `history-operations`，做完 `git checkout --` 還原）。
- **主工作樹**：`~/Documents/repos/taipei-codefest-2026` 的 `docs/DECISIONS.md` 有未 commit 的 D11，`docs/handoff/2026-11-07-highlight-ideas.md` 未追蹤。本分支的 DECISIONS 已含 D11／D12，merge 後以本分支為準。
- **delta-spec 的 MODIFIED／REMOVED** 指向尚不存在的 Feature Spec，archive 時會被拒；archive 前改列 ADDED 或等 `enable-friendly-routes` 先 archive。
- **review 留的 minor 未修**：F-4 重新載入丟失「換下一家」位置、F-5 地圖頁重新載入丟失類別篩選；地圖卡 5 顆鈕在 390px 偏擠。

## 測試與驗證證據

- `pnpm test:prototype`：node 137 pass／python 17 OK；`pnpm test:tooling` 77 pass；`pnpm app:build` 成功（dist 含 `urgency.js`、`speak-card*.js/css`）。
- 走查腳本 `scripts/check-three-urgencies-browser.mjs` 31/31 PASS、0 page error；截圖 `docs/prototypes/screenshots/three-urgencies/`（16 張）。
- 審查員實跑：390×844 與 360×640、拒絕定位、離線重載、連按返回、快速連點，零 pageerror；三輪共 10 條發現，F-1～F-3、F-6～F-10 已修並各有會紅的 pin，F-4、F-5 open minor。
- 分享頁七個檔 hash 與本機包一致；APK 內含新 token、不含舊 token，匿名下載 SHA 一致；正式站 smoke 由部署腳本驗（第一次因 Cloudflare 傳播延遲被 smoke 判失敗自動回滾，第二次成功）。

## 下一步建議

1. Ci 拿 Android 手機裝 APK 走一遍主流程與四次返回，結果補進 T25 與本文。
2. 找人校對印尼文、越南文、英文三句，填 `reviewedBy`／`reviewedOn` 後上架雙語。
3. 決定 PR #9（本分支 → `design/survival-highlights`）與 PR #8 怎麼收進 main；merge 到 main 會觸發 GitHub Actions 自動部署（需 `CLOUDFLARE_API_TOKEN` secret，目前未設）。
4. 房價含金量去留。
