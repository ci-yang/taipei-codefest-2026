# Claude Code App 根入口審查

來源：Claude Code companion，範圍 `c0486bb..7018400`。以下保留原始回報；其中行號為 reviewer 回報，實際位置以檔案為準。

# Claude Code Review

Target: branch diff against c0486bb7a389d8d077a6fce3a7ea0c5b46608b89

卍解卍解

# 審查：`ci/cloudflare-continuous-deploy`（c0486bb..7018400）

我沒辦法跑測試（Bash 在 don't-ask 模式下被拒）。以下全部是讀 diff、`wrangler.jsonc`、`deploy-cloudflare.yml`、`sw.js` 和 `apps/api/src` 得出的結論，沒有實際執行過。

## 整體

部署流程的防呆做得紮實：
- 在 main 上 push 才觸發部署，而且必須先過 `verify`（重用 `ci.yml`）。
- 部署前用 `assertCiDeploySource` 檢查三次：開始時、套 D1 migration 前、`wrangler deploy` 前。檢查內容是 `GITHUB_REF`、`GITHUB_SHA`、HEAD，以及用 `ls-remote` 比對遠端 main，可以擋掉過期的部署。
- `concurrency` 不取消進行中的部署，同一時間只會有一個在跑。
- 建置先寫到暫存目錄，驗完再整個換成 `dist/app`，不會只換一半。
- smoke 會比對每個資產的位元組數和 sha256，並確認 `not_found_handling: none` 之後找不到的路徑回 404，不再回 SPA 首頁。
- 如果上一版還是舊的 Vue 版本，rollback 有專門處理（`allowLegacy`、`assertLegacyHtml`，以及 SPA 對 `/app-manifest.json` 回傳 HTML 的情況）。

`index.html` 被 canonical 成 `/` 這件事，`sw.js:86-88` 已經處理了。不在 `run_worker_first` 清單裡的路徑會落到 Hono 的 `notFound`，回 JSON 404，跟 smoke 的預期一致。

## 發現（依嚴重度）

### 1. 【高】檢查「上一版」時用的是這次程式碼的檔案清單，之後只要增減 App 檔案，部署和 rollback 都會被擋
- 位置：`scripts/app-shell-smoke.mjs:128-132` 的 `validateAppManifest`，用 `deepEqual` 要求檔案清單完全等於這次程式碼裡的 `APP_FILES`。
- 呼叫它的地方：
  - `scripts/platform-release-state.mjs:479` 的 `capturePrevious`，用來驗證「線上那一版」。
  - `rollbackRelease`，以及 `release-platform.mjs` 失敗時自動回退那條路徑上的 `smokePlatform`，檢查的是 `previous.appManifest`。
- 會怎麼壞：假設下一個 commit 在 `package-friendly-prototype.py` 的 `ASSETS` 和 `APP_FILES` 各加一個檔（例如 `vendor/xxx.js`）。部署時 `capturePrevious` 拿新清單去比線上舊版的 manifest，結果不相等，丟出錯誤，整次部署中止，而且沒辦法記下 rollback 目標。就算繞過這一步，部署失敗要自動回退時，回退後的 smoke 也會因為同一個原因失敗。結果是 receipt 會被標成 rollback 失敗，但舊版其實是好的。
- `offlineVersion` 的 regex 寫死 `v6`，有同樣的問題：哪天升到 v7，舊版就驗不過。
- 建議：驗證上一版時，只驗結構（必要的入口檔有沒有在、每筆是不是合法的 sha256 和 bytes），smoke 就照那一版自己記錄的 `files` 去逐檔比對。要求清單完全一致的檢查，只留給「這次的建置產物」。另外補一個測試：上一版的 manifest 比這次少一個檔，部署仍要能通過。

### 2. 【中】過期的 push 會讓 main 留下紅燈，而且可能在 migration 已經套上之後才中止
- 位置：`deploy-cloudflare.yml` 的 `concurrency: cancel-in-progress: false`，加上 `release-platform.mjs:553,561` 的 `assertSource()`。
- 情境：連續推 A 和 B 兩個 commit。A 的部署正在跑 D1 migration 時 B 進來，A 在 `wrangler deploy` 前的檢查發現遠端 main 已經變了，於是中止。但 A 的 migration 已經套到 remote D1 上了。A 的 run 在 main 上顯示紅燈，看起來像部署壞掉，其實是正常拒絕。
- migration 只會往前加，A 的 migration 是 B 的子集，所以資料沒有正確性問題。主要是兩個麻煩：一是誤導人去查 bug；二是如果 B 後來被 revert，D1 裡會留著那次 migration。
- 建議：遇到「遠端 main 已變」的情況，用 `::notice` 標記並以成功狀態結束，跟真正的失敗分開。並在 `docs/CLOUDFLARE.md` 寫清楚：中止之前 migration 可能已經套上。

### 3. 【低】`pnpm platform:smoke` 手動跑的時候一定要有跟 `--sha` 同一個 commit 的本機建置
- 位置：`scripts/smoke-platform.mjs:712`，一律讀本機的 `dist/app/app-manifest.json`，再拿去跟 `args.sha` 比對。
- 情境：在本機 smoke 線上某個舊版本，或線上還是舊 Vue 版本時，`dist/` 不存在就會丟 ENOENT；`dist/` 是別的 commit 建的就報「source SHA differs」。手動排查時不好用。
- 建議：加一個選項，改從遠端的 `/app-manifest.json` 取得 manifest，或允許用 `--legacy`。

### 4. 【低】`JSON.parse` 讀的是 `.jsonc` 檔
- 位置：`scripts/build-friendly-app.mjs:300` 和 `platform-tools.mjs:11` 的 `readJson`。
- 目前 `wrangler.jsonc` 裡沒有註解，所以能跑。但副檔名本身就暗示可以寫註解，以後有人加一行 `//`，build 和 release 會一起壞。這是原本就有的寫法，這次又多了一個地方用它。

### 5. 【低／設計確認】每個 commit 都會讓離線快取整包重新下載
- 位置：`tools/package-friendly-prototype.py:817-818`，把 `build_sha` 也算進 digest。
- 影響：就算 App 內容完全沒變，只改了文件，`offlineVersion` 也會變，使用者的 Service Worker 會把約 6k 筆資料整包重抓一次。黑客松期間會一直推 main，demo 時用手機網路可能卡在「新版本尚未完整下載」。
- 如果用意是讓每次部署都換版本，現在這樣沒問題，但要寫進 DECISIONS。否則建議 digest 只算內容。index.html 裡那個 sha 的 meta 也是內容的一部分，可以改成從 digest 裡排除。

## 已檢查、沒有問題的部分
- `ci.yml` 拿掉 push 觸發之後，main 的 CI 改由部署流程裡的 `verify` 跑。`permissions: contents: read` 經 `workflow_call` 呼叫時權限不會擴大。
- `checkout` 固定 `ref: github.sha`，Actions 裡 `ls-remote origin` 會用 checkout 保留的憑證。
- `/config` 回報的版本來自 `--var BUILD_SHA:${sourceSha}`（`release-platform.mjs:129-130`），跟 `appManifest.sourceSha` 是同一個值。
- `requireGeneratedDirectory` 擋得住符號連結；暫存目錄在 `finally` 會被清掉。
- Python 打包時如果版本字串替換失敗，`build-friendly-app.mjs:333-335` 會抓到，因為原本的 `20261107` 不符合 16 位 hex 的格式。
- 用 Node 的 fetch 帶 `redirect: 'manual'` 可以讀到 302 的 `location`，`new URL(..., origin)` 也處理了相對路徑。

## 結論
第 1 點要在合併前修，或至少開 issue 並補測試。這個問題現在不會發作，但下一次改動 App 檔案清單時，CD 一定會卡住，而且失敗時的自動回退也會一起壞。第 2 點建議補文件，順便區分「拒絕過期部署」和「部署失敗」。其他幾點可以之後再處理。


## 主線處理紀錄

- 第 1 項：採用分離契約；當次建置保留嚴格清單，前版依 schema 1 自帶 manifest 驗證，補 capture、manual／auto rollback、路徑安全及逐檔 hash 回歸測試。
- 第 2 項：維持拒絕過期發布為失敗狀態，避免 Actions 顯示成功但實際未部署；D1 已套用的邊界已寫入部署文件。
- 第 3 項：部署文件補上在相同 commit 先建置再 smoke 的前置條件；保留本機產物作獨立比對基準。
- 第 4 項：文件明示目前 wrangler.jsonc 必須維持嚴格 JSON。
- 第 5 項：DECISIONS 記錄每次發布換離線版本與整包下載的取捨；未擅改 App 更新協議。

第二輪審查與實際發布結果另記於交接。
