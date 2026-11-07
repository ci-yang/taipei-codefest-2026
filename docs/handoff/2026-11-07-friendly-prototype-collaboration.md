# 友善同行：前端 prototype 協作

> 2026-11-07｜Ci 最新決定：規格仍在討論，先做前端，後端暫不實作。見 D8。

## 現在拿到什麼

來源分支：`codex/friendly-route-prototype`；[Draft PR #1](https://github.com/ci-yang/taipei-codefest-2026/pull/1)；原始碼在 `docs/prototypes/friendly-route/`。這是獨立 HTML／CSS／JavaScript 手機原型，尚未遷移為 Vue 正式頁面。既有 `apps/web`、`apps/api`、DB 與部署骨架維持原狀。

- [直接操作](https://ci-share.pages.dev/32d2b105d2eb968a/)
- [討論規格](../../.prospec/changes/enable-friendly-routes/proposal.md)：7 個故事，仍可修訂，不是正式後端契約。
- [資料與限制](../prototypes/friendly-route/README.md)、[驗證紀錄](../prototypes/friendly-route/QA.md)

| 能力 | 目前行為 |
|---|---|
| 四頁 App、GPS、日期、多目的地 | 可操作；真實定位失敗／出界會提示，示範起點另標示 |
| 四類篩選、沿途資源與路線比較 | 真實開放資料的地方快照；本機路網計算，非全市正式導航 |
| 歷史與離線包 | 明確保存才存於此瀏覽器；離線有範圍及資產限制 |
| 品質回報 | 本機試填，沒有公開評論後端 |
| 求助／協助者 | 同一瀏覽器的雙角色示範，沒有通知真人或跨裝置送達 |

## 五步加入協作

1. 從 GitHub 的 `codex/friendly-route-prototype` 開自己的工作分支。若使用共用電腦，先看 [TEAM-PROTOCOL](../TEAM-PROTOCOL.md)，用獨立 worktree，不切換別人的工作樹。
2. 在自己的 repo 根目錄執行 `pnpm prototype`，開啟 `http://localhost:8766`。需 Python 3；不需安裝 workspace 套件、不需 `.env`、API 或 DB。沒有 pnpm 時使用原型 README 的 Python 指令。
3. 先走首頁 → 設定 → 確認 → 行程；GPS 出界時主動使用示範起點。手機用上方 HTTPS 連結，區網 HTTP 的 GPS／離線功能不保證可用。
4. 在 PR 認領一項下表工作，寫清楚要改哪些檔案。同一時間 `app.js` 只交給一位整合者；其他人先提供畫面、需求或測試案例。
5. 修改後執行 `pnpm test:prototype`，附操作步驟與結果開 PR；尚未合併基線前，以原型分支為 base。由 Ci 整合，不直接推 main。

## 待認領工作

以下是分工建議，尚未指定成員，也不表示規格已定。

| 工作 | 檔案範圍 | 可交付成果 |
|---|---|---|
| 視覺與手機排版 | `index.html`、`styles.css` | 390px 四頁、按鈕與錯誤狀態一致；不改流程邏輯 |
| 行程操作整合 | `app.js` | 日期、歷史、起迄及返回修改流程；每次只認領一組行為 |
| 地圖與路線研究 | `routing.js`、`build-friendly-routing.py` | 候選計算與範圍限制的可重現案例；改契約前先對齊整合者 |
| 資料核對 | `build-friendly-data.py`、來源說明 | 官方旗標、來源日期與空白語意；產物由工具生成，避免手改大型 data 檔 |
| 體驗與實機測試 | `docs/prototypes/tests/`、`QA.md` | 真機 GPS／TownPass／斷網重開結果；失敗需附重現步驟 |

`sw.js` 的快取資產清單和 UI 資產一起變更；增加檔案後，需驗證「下載 → 斷網 → 重開」。正式後端工作暫不認領。

## 下次一起定的五件事

1. 優先服務的使用者與外出情境；是否先聚焦步行與網路／電力不足。
2. 「資源最多」允許多繞多遠，以及使用者真正需要的比較資訊。
3. 品質回報要記哪些使用條件、由誰查核；是否需要正式帳號。
4. 求助是否保留、哪些資料可分享、如何撤回及到期。
5. 地圖涵蓋區域與離線保存內容；何時值得投入正式路由與後端。

## 本輪驗證與範圍

原型在前輪已通過 21 項回歸及 Chrome 390×844 四頁檢查，詳見 QA。此次上 GitHub 前，於 `f107ebf` 執行 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全通過（API 14 項、web 24 項）。新增啟動腳本後，`pnpm prototype` 實際回應 HTTP 200，`pnpm test:prototype` 21 項全通過。獨立 reviewer 核對文件連結、資料摘要及交接範圍，未發現待修問題。定位與 TownPass 真機仍待測，不把瀏覽器測試寫成實機結果。

未完成的後端方案草稿不納入此 PR；正式 change 保留 Story 討論基線。不要因 prototype 可操作就把七個故事的正式服務標為完成。
