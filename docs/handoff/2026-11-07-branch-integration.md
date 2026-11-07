# 分支整合與 Claude Code 審查交接

Ci 本輪明確授權：取得最新 main、整理成員分支、經 Claude Code review 後合入 main。整合在獨立工作樹 `tcf-integration-20261107` 執行；保留原分支歷史，不 force push，也不代替部署或更新 APK。

## 分支盤點

| 來源 | 盤點時 SHA | 處理 |
|---|---|---|
| 遠端 main／成員全市資料 | `21bc1f3` | 作為整合起點；保留匯入與 Wi-Fi 彙整工具 |
| `feat/deploy-cloudflare-platform`／PR #2 | `5aabb36` | 整合 Hono、D1、Vue、CI、部署與回退基礎 |
| `feat/prototype-resource-map`／PR #3 | `7a559e2` | 整合完整純 JS App、全市資料、離線與 bridge |
| 本機 main 決策 | `bb2149e` | 保留 D6／D7 原 commit 的 ancestry，方便安全 fast-forward |
| `codex/friendly-route-prototype` | `3626e5c` | PR #1 的歷史原型分支，沒有額外重套舊 UI |

整合 PR：[#4](https://github.com/ci-yang/taipei-codefest-2026/pull/4)。本文件記錄合併前的候選與證據；最終 merge SHA 以 PR 為準。各成員分支保留，避免刪掉仍被工作樹使用的分支。

## 衝突與相容性處理

- App／index／SW／狀態測試採凍結 v6 主流程；沒有回復評論、回報、互助或行程確認。
- main 的 `data.js` 地方底圖與 v6 相同，可以保留；現行點位／搜尋／分類用 `resources-data.js`。品牌推定只留在歷史建置實驗，沒有混入正式四類服務。
- 成員三源資料與 v6 官方資料重疊；v6 另有捷運無障礙資料，合計 5,948 筆來源紀錄、5,938 筆有座標。保留缺值，不補造位置。
- 平台路由差異測試原本綁活動中的原型 `data.js`，103 與 4,560 筆會衝突。改用平台自己的版本化快照、固定站序及 manifest hash，保留雙 solver 比較。
- 原型搜尋測試改驗現行全市 catalogue；CI 加入 `test:prototype`，涵蓋 JS 與 Python。
- README 主入口指向 App，另列 Vue／Cloudflare 平台；`platform:deploy` 仍發布 `apps/web/dist`，合併不等於原型已接到該部署／APK。
- proposal 保持 142 行，blob `6da4a77f904db5877d10fe8a54adf90356a178dc`，沒有把本機 placeholder plan／delta 當成已完成規格。

## Claude Code review

使用 `cc:review` companion，model 參數為 `opus`。兩輪都是隔離、只讀的 Claude Code 靜態審查；Claude 沒有執行測試，實際測試由整合任務另行執行。

| 輪次 | 差異 | Job | 結果 |
|---|---|---|---|
| 第一輪 | `5d94fc5...8e05cd2` | `review-mw69csqj-svomq5` | 無阻擋 correctness bug；列出三項合併前修正 |
| 複核 | `8e05cd2..0ef04f8` | `review-mw69g1kk-d2dhpi` | 沒發現會出錯的問題，可以合入 |

原文：[第一輪](../reviews/2026-11-07-claude-integration-initial.md)、[複核](../reviews/2026-11-07-claude-integration-followup.md)。第一輪對定位門檻的描述屬 Vue 平台；現行 App 依凍結規格保留精度超過 100m 的位置並警示，不能混為同一行為。

三項修正：移除同一 graph 自比的無效斷言；Node API 補固定種類的錯誤紀錄、不記 message／stack／自訂 name／query；原型 README 補本機固定 SW 版本的更新方式。新增四種錯誤的回歸測試，確認回應仍為一般 500 且紀錄不含測試座標。

## 實際驗證

- `pnpm install --frozen-lockfile`、typecheck、lint、build 通過。
- workspace 113 項：shared 7、API 59、web 47。
- tooling 29 項；原型 Node 66 項；Python 資料清洗 9 項。
- 真實 local D1／Worker integration：重複匯入、異內容拒絕、版本缺失、SPA fallback、pathname log 通過；`remoteWrites: false`。
- Wrangler `deploy --dry-run` 通過，未執行正式發布。
- 候選 `8e05cd2` 的 GitHub CI 已通過；最終合併前另確認最新 head 的 CI。

## 本機檔案保全與保留限制

原主工作樹 10 個未追蹤檔案已逐一保存並計 SHA-256：`/Users/ciyang/Documents/repos/tcf-integration-backups/20261107-182911-main-untracked/manifest.json`。其中 5 個路徑將被遠端追蹤檔取代；其原文都在備份，另外 5 個未定計畫草稿留在主工作樹。

Claude 的非阻擋提醒保留：Edge 端尚無同樣的錯誤種類紀錄；平台若擴至全市，須處理每請求重驗快照及 1,000 筆查詢上限。目前平台固定 103 筆，App 直接載全市資料，沒有將兩者誤接。TownPass 實機、飛航模式、主部署入口與 APK 對齊仍依既有交接待驗。
