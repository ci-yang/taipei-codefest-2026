# 團隊協作協議（5 人 × 多 session × 32 小時）

> 濃縮自 team-brain `playbooks/多 session 共用工作樹.md`（2026-09-12 決賽日半天出四次事）與 `日常協作流程.md`。
> 一句話：**git HEAD、docker、port、git index 都是全域狀態，一個 session 動了，所有人腳下都換了。**

## 1. 成員與分工（草擬，待確認）

| 成員 | 主責 | GitHub |
|---|---|---|
| 楊騏 Ci（隊長） | 全端＋AI、整合、對外動作（push 收尾、PR merge） | ci-yang |
| 卓曄 | 產品需求收斂、Flutter（TownPass fork）＋Web | 待補 |
| 高栩浠 | 視覺設計、Figma、demo 畫面 | 待補 |
| 王建湧 | 後端、DB、資料模型 | 待補 |
| 蘇家成 | DevOps／SRE、docker、CI、部署、demo 環境 | 待補 |

## 2. 地盤表（開工前填，換人時當面交接）

每一列同一時間只有一個主人。**不是你的，動之前先在群組問一句。**

| 資源 | 主人（草擬） | 備註 |
|---|---|---|
| 主工作樹的 git HEAD／分支切換 | Ci | 其他人要切分支 → 開自己的 `git worktree` |
| `docker compose`（db，port 5433） | 家成 | 重啟、`down -v`、改 compose 前先問 |
| `apps/api`（port 8787）、DB schema／migration | 建湧 | 改 schema 要通知前端 |
| `apps/web`（port 5173） | Ci／卓曄 | 同檔同時改先喊 |
| `packages/shared`（前後端契約） | 建湧＋前端共管 | 改型別＝改契約，兩邊都要知道 |
| TownPass fork（`ci-yang/TownPass@codefest-2026`） | 卓曄 | 在另一個 repo，Flutter 建置也在那邊 |
| 設計稿、`apps/web` 的樣式 token | 栩浠 | |
| `CLAUDE.md`、`AGENTS.md`、本檔、`prospec/` | Ci | 規則改動先講 |

port 以 `.env` 為準；本機撞 port 就改自己的 `.env`，不要改 `.env.example` 的預設值去遷就自己。

## 3. 六條規矩

1. **劃地盤、動之前先講。** 上表就是地盤。AI session 也算一個人：一個 session 只動它被派的目錄。
2. **別人在跑時，不 `checkout`／`pull`／`reset`／重啟服務。** 你的 session 也一樣，要它做之前先確認沒人在用。
3. **檢查與動作分兩條指令。** `git status` 看完結果再決定 `checkout`；不要寫成 `git status && git checkout ...`——那等於在看不到檢查結果時就動手了（事故一：害別人的 commit 變孤兒）。
4. **實驗用 `git worktree`**：`git worktree add ../tcf-<你的名字> -b exp/<slug>`。主工作樹 HEAD 只歸地盤主人。
5. **設定以 `.env`／程式碼為準。** 筆記、聊天、其他 session 說的值可能幾分鐘前就變了（事故四：照抄筆記的錯 region）。
6. **下結論前確認沒人在改。** 看到「commit 不見了」「欄位不存在」，先問有沒有人正在 reset／重啟，**先收回結論再重測**，不要拿瞬間狀態指控別人（事故二）。

## 4. Commit、push 與授權

- `git add` 只點名自己的檔；`git add -A` 只在剛看過 `git status`、確認沒有別人的東西時用。
- 小改直推 main；要 demo 的走 PR（模板 `.github/PULL_REQUEST_TEMPLATE.md`）。push 前 `git pull --rebase`，衝突自己解，不要 force push。
- 共用 GitHub 帳號時分不出是誰按的（事故三）。merge、force push、改 repo 設定這類動作，**執行的人（或 session）要說是誰授權的；轉述不算授權**。
- AI session 不自行 push／merge／對外發布，交給該資源的主人。

## 5. Demo 機器與凍結 commit（負責人為草擬，待確認）

- **demo 手機**：至少一支主機＋一支備用（規則建議兩支）。由卓曄＋Ci 在 11/7 晚上前決定是哪兩支、iOS 或 Android，寫進 `docs/DECISIONS.md`。之後 demo 只在這兩支上驗。
- **後端／web 跑在哪**：同上，決定後寫進 DECISIONS（本機 + 區網 IP，或免費雲端方案）。驗證要在 demo 真正會用的環境做——本機綠不等於手機上綠。
- **凍結**：發表前由 Ci 宣告凍結，記下兩個 SHA（本 repo、TownPass fork）寫進 DECISIONS。凍結後只修 demo 主流程的 bug，每修一個重新記 SHA；新功能一律不進。
- **預演**：凍結後在 demo 機上從城市通入口完整跑一次主流程，含關 Wi-Fi 的情境（若有裝置端 AI）。

## 6. 什麼時候開 prospec change

跨人介面（API 契約、bridge message name／payload）或 demo 主流程才開；其他小改直接做、commit message 寫清楚就好。
開法見 `CLAUDE.md`「規格（prospec）」段，範例 `.prospec/changes/000-skeleton-harness/`。
