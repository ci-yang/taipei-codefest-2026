# Claude Code Review

Target: branch diff against c0486bb7a389d8d077a6fce3a7ea0c5b46608b89

卍解卍解

# 審查：`ci/cloudflare-continuous-deploy`（320b160 對 c0486bb）

## 結論

可以合併，沒有阻擋性問題。程式和測試都做到了變更說要做的事：PR 只跑不帶 secret 的 CI；main 收到 push 後，部署 workflow 先跑同一套 reusable CI，再部署；在三個會寫入的階段之前，都會比對 `GITHUB_SHA`、本機 HEAD 和遠端 main 是否一致。下面幾點大多是營運上要注意的地方和文件可以更精確的地方。

我做了什麼：讀了完整的 `deploy-cloudflare.yml`、`release-platform.mjs:40-140`、`platform-tools.mjs` 裡的 `assertCleanHead`／`runCommand`，以及 `.gitignore`。**我沒有執行測試**，因為這次是唯讀審查。

## 確認沒問題的部分

- **檢查順序正確**：三次 `assertSource()` 分別在 build 前、D1 migration 前（`release-platform.mjs:93`）、Worker upload 前（`:113`）。測試 `CI deploy checks the same checkout…` 也用呼叫順序把這件事釘住了。
- **regex 的多行防護成立**：`platform-ci-source.mjs:21` 沒有加 `m` flag，所以 `$` 只會對到整個字串的結尾。遠端回傳多行時會被拒絕，測試也有涵蓋這個情況。
- **`runCommand` 有支援 `timeoutMs`**（`platform-tools.mjs:18`），30 秒上限會生效。
- **`.artifacts/` 已經在 gitignore 裡**（`.gitignore:12`），收據不會讓 `assertCleanHead` 誤判工作樹不乾淨。
- **PR 和 fork 拿不到 secret**：`ci.yml` 沒有用到 `secrets.`，觸發條件裡也沒有 `pull_request_target`／`workflow_run`，測試有斷言這兩點。
- **本機部署不受影響**：只有 `GITHUB_ACTIONS=true` 時才做 stale 檢查。rollback 不經過這個檢查，測試也斷言 rollback 時沒有呼叫 `ls-remote`。

## 發現（嚴重度由高到低）

### 1. 中：過期的 run 若在 D1 匯入之後才被拒絕，遠端 D1 會比線上 Worker 新
- 位置：`release-platform.mjs:95-113`
- 情境：run A 跑完 migration 和 import 之後，main 前進到 B，A 在第三次檢查被拒絕。這時線上 Worker 還是舊版，但 D1 已經套用了 A 的 schema 和資料。測試 `CI main advancing after D1 import keeps the data…` 把這個結果當成預期行為。
- 只要 migration 都是追加式，而且 B 是 A 的後代，就沒有問題。但如果 main 被 revert 或 force push 到不含 A 的 commit，D1 會留下沒有對應 Worker 的 migration。
- 建議：在 `docs/CLOUDFLARE.md` 的 GitHub CI/CD 段寫明「過期 run 可能已套用 D1，下一個 run 會接手」，並說明 migration 必須維持追加式，這條規則是讓這套流程成立的前提。

### 2. 中：每次 push 到 main 都會觸發部署；token 還沒設定時，main 上每個 commit 都會顯示紅燈
- 位置：`deploy-cloudflare.yml:3-5, 48-49`
- 團隊規則是「小改直推 main」。改成這樣之後，連只動文件的 commit 都會完整跑一次 CI，再做一次遠端 migration、import 和 Worker 部署。
- 如果 `CLOUDFLARE_API_TOKEN` 還沒設定，每個 main commit 都會失敗。文件和 DECISIONS 都沒有說 token 已經設定好了，我也無法確認。
- 建議：合併前先確認 secret 已經設定。可以考慮加 `paths-ignore`（例如 `docs/**`、`**.md`），不過這是取捨，不是 bug。

### 3. 低：在密集 push 時，過期的 run 會變成紅燈
- 位置：`platform-ci-source.mjs:23-24`
- 在 concurrency 設定下，GitHub 只保留一個 pending run，所以最新的 commit 最後一定會部署。但是被取代、正在執行的那個 run 會以 error 結束，顯示紅燈。黑客松期間連續合併時，這些紅燈會讓人以為是真的部署失敗。
- 建議：維持目前的做法也行。如果想減少誤報，可以讓「被新 commit 取代」用不同的訊息或結束方式呈現，和真正的失敗分開。

### 4. 低：「手動重跑」的說法有歧義
- 位置：`README.md:33`、`docs/CLOUDFLARE.md:81-82`
- 「也保留 main 手動重跑入口」實際上指的是重新發起一次 `workflow_dispatch`。GitHub UI 上對舊 run 按「Re-run jobs」會沿用舊的 `github.sha`，被設計成一定會被拒絕。
- 建議：改成「重新 dispatch（不要對舊 run 按 Re-run）」。

### 5. 低：main 上不再有獨立的 `CI` 狀態
- 位置：`ci.yml:3-6`
- main 的檢查結果現在出現在「Deploy Cloudflare platform / verify」下。如果有 badge 或 branch protection 參照 main 上的 `CI` workflow，需要跟著改。PR 的 required check 名稱沒有變。

### 6. 細節（不需要改）
- `checkout` 的 `ref: ${{ github.sha }}` 在 push 事件下就是預設值，寫出來只是讓意圖更明確，沒有壞處。
- 第三次檢查和 `wrangler deploy` 之間仍有一個很短的 TOCTOU 空窗（檢查完到真正動手之間 main 可能又前進）。這已經是合理的極限，不必再收緊。

## 測試品質

- 斷言用的是會分出差異的值（`'c'.repeat(40)`），而且是用呼叫順序的索引比對，不是只檢查有沒有呼叫。換一個「只在 build 前檢查一次」的實作，`mainChecks.length === 3` 和順序斷言就會失敗，所以這些測試不是恆真。
- `deploy-workflow.test.mjs` 用文字片段和縮排比對 YAML，會綁死目前的排版，重新排版就會壞。這和既有 `inspectWorkflow` 的做法一致，可以接受。
- 測試沒有涵蓋第 1 點的 revert 情境。那需要在設計層面決定怎麼處理，用單元測試補不了。

