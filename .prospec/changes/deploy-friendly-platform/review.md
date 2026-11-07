<!-- prospec:review-metrics round="3" loop_base="2" provenance="cd02b2ac579e4bea883b993e754a496ea8cf26cb2a9198955c0731d2b605afc1" lenses="correctness,security,spec-architecture,performance,maintainability,docs-claims,parallel-sites,test-quality" request_id="8ab6b633720bd5eab83b7179057953d6936e2f573086ed76739efd6eeeee9c25" attempt_id="prospec-review:2a61c7e7a35a56cf0fc7666d8121d29ee53c454a2fc845e998e6644c39c657f3" base_digest="e3aec2a904232ce910d3b05d528867c7a63899b80af98c6d2fff0423136d9523" artifact_digest="9d4fd1e18cec68e54e4cb501d7422bb346cbc7b3758558dd5067e061f8b3c595" -->
# Review Findings: deploy-friendly-platform

| ID | Location | Severity | Lens | Status | Origin | Summary | Repro |
|---|---|---|---|---|---|---|---|
| F-REMOTE-D1-READBACK | scripts/import-friendly.ts:94 | critical | correctness | fixed | 1 | 遠端讀回 SELECT 使用 Wrangler --file 的匯入路徑，只取得統計列，必定誤判版本衝突並阻止正式部署。 | sed -n '81,98p;149,171p' scripts/import-friendly.ts && sed -n '239815,239885p' node_modules/.pnpm/wrangler*/node_modules/wrangler/wrangler-dist/cli.js |
| F-SOURCE-LINK | apps/web/src/pages/AboutPage.vue:24 | major | docs-claims | fixed | 1 | 公開頁僅連向 AGPL 授權全文，沒有對應版本的專案原始碼入口，與部署手冊要求的來源交付不一致。 |  |
| CLAUDE-REL-2 | scripts/release-platform.mjs:70 | major | correctness | fixed | 1 | deploy 的 --url 只檢查是不是 HTTPS origin，沒有綁定 wrangler.jsonc 的 Worker；網址填錯時，前版基線、smoke 和自動回退都會對著別的服務驗證，可能把正常的新版回退掉，還把結果記成已驗證 | sed -n '70,77p;129,160p' scripts/release-platform.mjs && sed -n '68,84p' scripts/platform-release-state.mjs |
| CLAUDE-REL-3 | .github/workflows/deploy-cloudflare.yml:16 | major | security-data-integrity | fixed | 1 | 正式部署 workflow 沒有 environment 保護，也沒限制 ref；任何能觸發 workflow_dispatch 的協作者都能把未審查的分支部署到正式 workers.dev，並使用 repository 層級的 CLOUDFLARE_API_TOKEN | sed -n '1,33p' .github/workflows/deploy-cloudflare.yml |
| CLAUDE-REL-4 | scripts/test-platform-integration.mjs:96 | major | test-quality | fixed | 1 | 『log 不記座標』只做負向比對，沒有正向對照證明 Worker 的 pathname log 真的有被收集；本機 Worker 又用 --log-level warn 啟動，輸出若是空的，這個斷言也會空洞地通過 | sed -n '94,100p' scripts/test-platform-integration.mjs && sed -n '36,56p' scripts/platform-local-worker.mjs && grep -rn 'pathnameLogger' apps/api/test \|\| true |
| CLAUDE-REL-5 | scripts/build-townpass.mjs:64 | minor | security-data-integrity | fixed | 1 | APK 收據只用 stat 確認固定路徑上的檔案存在，沒有檢查它是不是這次建置產生的；如果外部腳本沒有輸出該 mode 的 APK，舊 APK 的 SHA-256 會被記到這次的 commit 和 URL 名下 | sed -n '36,70p' scripts/build-townpass.mjs |

<!-- prospec:evidence-section -->
## Evidence

<!-- prospec:evidence F-REMOTE-D1-READBACK -->
### F-REMOTE-D1-READBACK

execute() 對 INSERT 與讀回 SELECT 一律寫 statement.sql 並傳 --file（scripts/import-friendly.ts:81–98）；importFriendly():158–169 卻把第二次 results[0] 當 SnapshotRow，要求 content_hash 相符。實際鎖定的 Wrangler 4.158.0 executeRemotely() 在 input.file 分支走 D1 import API，回傳 [{results:[{"Total queries executed":num_queries,"Rows read":...,"Rows written":...,"Database size (MB)":...}],success:true,...}]，沒有任何 SELECT 欄位；只有 --command 分支走 query API 並回傳查詢資料。因此即使第一個 INSERT 成功、資料完全正確，第二次讀回的 row.content_hash 仍是 undefined，會拋 Version conflict。release-platform.mjs 在部署前呼叫 import-friendly.ts --remote，因此本機 D1 與 dry-run 全綠也無法通過實際發布。已讀安裝的 Wrangler 一手程式，沒有對雲端做任何寫入。
隔離 snapshot 中建立 Wrangler CLI fixture，回傳上述與安裝實作一致的遠端 --file 統計格式，再用真正 tsx 執行 scripts/import-friendly.ts --remote；實際 exit 1，輸出 Version conflict: existing snapshot has different content; choose a new version。fixture 只在 snapshot/node_modules/.bin/wrangler；未修改 main 依賴或來源。此為確定性邊界重現，不是已執行遠端部署的宣稱。
建議保留 SQL file 作 INSERT，讀回 SELECT 改用 --command 或真正 query API；不要把匯入統計列視為查詢結果。補遠端 CLI 契約 regression pin，分別模擬 --file 的統計與 --command 的完整 SnapshotRow，並保持同內容重跑／異內容衝突的驗證。
本輪另在 snapshot 跑 node --test scripts/*.test.mjs，18/18 通過。測試品質抽驗：刪除 smoke 的 OR 結果斷言後，AND semantics 測試轉紅（Missing expected rejection）；移除 dirty-tree guard 後，dirty tracked 測試轉紅。兩項 mutation 已還原。現有 friendly-import.test.ts 的 CLI 成功測試只使用 --local，test-platform-integration.mjs 亦僅 local，故未覆蓋這個遠端差異。整體已檢閱 correctness/security/spec-architecture/performance/maintainability/docs-claims/parallel-sites/test-quality；尚未執行的部署及 APK 項目沒有當成既有成功或獨立缺陷。

Independent confirmation:
獨立驗證 confirmed。已原樣執行 finding 的 repro：sed -n '81,98p;149,171p' scripts/import-friendly.ts && sed -n '239815,239885p' node_modules/.pnpm/wrangler*/node_modules/wrangler/wrangler-dist/cli.js。檢查目前 package.json 與已安裝 wrangler/package.json，版本均為 4.158.0。
實作依據：scripts/import-friendly.ts:84–110 的 execute() 一律將 SQL 寫檔後傳 --file；149–171 的 importFriendly() 先 INSERT，再用同一 execute() 發 SELECT，要求 results[0].content_hash 等於 snapshotHash。已安裝 Wrangler wrangler-dist/cli.js:239739–239854 的 executeRemotely() 在 input.file 分支呼叫 d1ApiPost(..., 'import', ...)，完成後 results 固定建構為只有 Total queries executed、Rows read、Rows written、Database size (MB) 的單列；該分支沒有回傳 SELECT 欄位的路徑。input.command 分支才呼叫 query 並原樣回傳查詢結果。因此匯入成功與資料正確仍無法讓統計列的 content_hash 相符，回讀必定進入 Version conflict。
隔離驗證：在指定 snapshot 的 .review-d1-check.mjs 直接擷取現用 Wrangler 上述 executeRemotely() 函式原文，以 Node vm 執行；所有認證、DB 查找及 API／poll 函式皆替換為離線 fixture，沒有網路呼叫。對 input.file 實際得到上述四個統計欄位且 content_hash 為 undefined；對 input.command 則確認呼叫 query 並保留 fixture 的 content_hash。再將真實函式產生的 file 回應交給 snapshot 專用 node_modules/.bin/wrangler fixture，使用現用 tsx loader 執行未修改的 scripts/import-friendly.ts --remote。呼叫紀錄依序為 INSERT --file、SELECT --file；實際 exit 1，stderr 精確為 Version conflict: existing snapshot has different content; choose a new version。結果存於 snapshot/.review-d1-result.json。可在該 snapshot 執行 node .review-d1-check.mjs 重現；這是離線邊界重現，不是遠端部署驗證。
scripts/release-platform.mjs:103–116 在 Wrangler deploy 之前呼叫此 importer --remote，故這個確定性錯誤會阻止發布完成。測試只新增 snapshot 檔案與指向現有依賴的 symlink；未修改 main 來源、ref、gitconfig，未 commit，未執行雲端寫入。

Claude independent finding (CLAUDE-REL-1):
閱讀證據：scripts/import-friendly.ts:84-99 的 execute() 一律把 SQL 寫成暫存檔再用 `--file` 執行；importFriendly() 在 :157 用它插入，:158-164 也用它做讀回 SELECT，接著 :165-170 要求 rows.length===1 且 row.content_hash===hash。我在主 repo 安裝的 wrangler 4.158.0 讀了 node_modules/wrangler/wrangler-dist/cli.js:239739-239840：executeRemotely() 遇到 input.file 就走 D1 import API（init/upload/poll），回傳固定的 `[{results:[{"Total queries executed","Rows read","Rows written","Database size (MB)"}],success:true}]`，不包含 SELECT 的列。只有 executeLocally（:239704-239737）才會回真正的查詢結果。

影響：用 --remote 時（release-platform.mjs:92-103 正式部署就是這樣呼叫），resultRows 會得到一列統計資料。rows.length===1 會通過，但 row.content_hash 是 undefined，跟 hash 不相等，於是丟出 'Version conflict: existing snapshot has different content'。結果是正式部署一定在 wrangler deploy 之前失敗（前版 Worker 不受影響），而且錯誤訊息會誤導操作者以為資料版本衝突、去換新版本。另外同一段 Wrangler 程式在 :239747 警告 file import 期間『D1 database will be unavailable to serve queries』，所以每次部署的 INSERT 也可能讓線上前版 Worker 的 /healthz 和 API 短暫回 503。

測試為何沒抓到：scripts/test-platform-integration.mjs 只跑 --local，apps/api/test/friendly-import.test.ts 是 mock 掉 execFileSync，所以兩者都碰不到遠端回應格式。建議：讀回改用 `--command`（release-platform-state.mjs:86-101 的 assertRollbackData 已經是這樣做），INSERT 也可以考慮改走 --command 或 D1 API，避開 import 期間 DB 不可用的問題。

未執行事項：這是唯讀審查，我沒有跑任何遠端或本機命令，也沒有重現；結論只來自閱讀已安裝的 Wrangler 原始碼與這份 snapshot 的程式碼。

修復核對：# F-REMOTE-D1-READBACK 隔離回歸證據

修補準備日期：2026-11-07。所有修改與實際 local D1 狀態均在 `/private/tmp/platform-d1-readback-kdpg1rwn`。凍結期間未套用至 MAIN；root 明確解除凍結並授權後才套用兩檔。未變更 git refs、未 commit、未操作遠端 D1。

## 已確認根因

安裝版本為 Wrangler 4.158.0。`node_modules/.pnpm/wrangler@4.158.0_@cloudflare+workers-types@5.20261106.1/node_modules/wrangler/wrangler-dist/cli.js`（實際 pnpm 路徑後綴依安裝結果，以 `node_modules/.pnpm/wrangler*/node_modules/wrangler/wrangler-dist/cli.js` 找到）約 239815–239885 行顯示：

- remote `--file` 走 `import`，回傳 `results` 的唯一內容為查詢數、讀寫筆數與資料庫大小等統計。
- remote `--command` 走 `query`，直接回傳 SQL 結果列。
- 現有 importer 對 INSERT 與 SELECT 都傳 `--file`，因此遠端 SELECT 的統計列沒有 `content_hash`，卻被當成 SnapshotRow，正常匯入後誤報 `Version conflict`。

這是由實際安裝的 Wrangler 程式與模擬其兩種回應的回歸測試共同確認，不是對 Cloudflare 遠端實際寫入測試的宣稱。

## 最小修補

`scripts/import-friendly.ts` 的 execute 加入明確 `file | command` 模式；預設仍為 file。INSERT 完整快照保持 `--file`；回讀 SELECT 明確選 `--command`。子程序仍直接呼叫已安裝的 Wrangler，保留安全錯誤分類。

`apps/api/test/friendly-import.test.ts` 新增依 Wrangler 路徑行為回應的 mock：remote file 回統計；command 回真正 SQLite 查詢列。使用記憶體 SQLite 執行既有 migration 與 INSERT，驗證兩次匯入只有一列，以及同版本不同 hash 保留原資料並拒絕。

## Red → Green

在隔離副本執行：

```sh
./apps/api/node_modules/.bin/vitest run --root apps/api test/friendly-import.test.ts
```

1. 只加入回歸測試、尚未修 importer：exit 1，11 tests 中 9 PASS、2 FAIL。remote 正常匯入案例誤報 `Version conflict`；remote conflict 案例也證實 readback 沒有使用 `--command`。local 重跑案例通過。
2. 套用最小修補：exit 0，11 tests 全 PASS。
3. 三個 API suites：`friendly.test.ts`、`platform.test.ts`、`friendly-import.test.ts`，共 38 tests PASS。
4. `tsc --noEmit --project apps/api/tsconfig.json` PASS；相關兩檔 eslint PASS。

完整 log：`/tmp/platform-d1-red.log`、`/tmp/platform-d1-green.log`、`/tmp/platform-d1-all-tests.log`。

## 真實 local D1

僅使用隔離副本的 `./d1-state`：

```sh
./node_modules/.bin/wrangler d1 migrations apply FRIENDLY_DB --local --config wrangler.jsonc --persist-to ./d1-state
./node_modules/.bin/tsx scripts/import-friendly.ts --local --persist-to ./d1-state
./node_modules/.bin/tsx scripts/import-friendly.ts --local --persist-to ./d1-state
```

migration 成功；兩次匯入均 exit 0、103 stores；contentHash 均為 `49094577adde6acbc2bdb6355766b3766f8eed2ca030dfe67c230dcadc31fdcd`。完整 log 在 `/tmp/platform-d1-local.log`。

## 同類呼叫掃描

已用 `rg` 掃描 scripts、apps/api/src、apps/api/test 的 SELECT 與 D1 execute：

- `scripts/import-friendly.ts`：唯一同類缺陷，本 patch 修復。
- `scripts/platform-release-state.mjs:90`：SELECT manifest，已明確 `--command`（98 行）。
- `scripts/test-platform-integration.mjs:57`：SELECT COUNT，已明確 `--command`。
- `apps/api/src/friendly/d1-repository.ts:15`：使用 Worker D1 binding 的 prepare/bind/first，不走 Wrangler CLI。
- health/places/seed 的 SELECT 是既有 PostgreSQL；測試中的 SQLite SELECT 不屬 Wrangler CLI。

## MAIN 凍結核對

套用前已確認以下兩份 MAIN 檔案與讀取時 baseline 完全相同；下列 hash 是套用前的凍結核對值：

- `scripts/import-friendly.ts`：MAIN 與修補前副本 SHA-256 相同，`30adbfdbe7604b62762b39d18524b80ef187b37c02353e23b383b4047898782d`。
- `apps/api/test/friendly-import.test.ts`：MAIN 與修補前副本 SHA-256 相同，`8015c8b0fbdea6923dec7fb4035608af1e37a1a3fe6b2d4cf48ed4ace9d99dae`。

修補檔：`/tmp/platform-d1-readback.patch`。root 明確放行後已用 `git apply --check` 檢查，並僅套用 importer/test 兩檔；原始 red/green 與 local D1 log 保留。
<!-- prospec:evidence-end -->

<!-- prospec:evidence F-SOURCE-LINK -->
### F-SOURCE-LINK

AboutPage.vue:24 宣告原始碼以 AGPL-3.0-or-later 釋出，但唯一連結是 GNU 授權文字；HomePage、App、FriendlyMapPage、FriendlySources 也沒有專案 repository／對應 commit 的來源下載連結。rg 搜尋 apps/web/src 的 github、VITE_BUILD_SHA 與原始碼，未找到其他 UI 來源入口。/config 雖公開 BUILD_SHA，卻沒有 source URL，前端也沒有將此版本連到原始碼。
docs/CLOUDFLARE.md:91 明寫「公開服務的來源連結應指向對應版本」。目前部署／smoke 可成功而不提供該入口，接手者會把有授權文字誤認為已完成來源交付。建議 About 提供已確認公開 repo 的對應 build commit 連結，或明確列成發布前必辦項；用實際 build SHA，不把 local／測試值包裝成已發布來源。本 finding 為交付文件與 UI 的可核對缺口，不將未執行的雲端／APK 任務升成 critical，也不在此作法律責任判定。

修復核對：AboutPage 加入以 VITE_BUILD_SHA 選對應 commit 的原始碼連結，未有 SHA 的本機版連到本次分支。
<!-- prospec:evidence-end -->

<!-- prospec:evidence CLAUDE-REL-2 -->
### CLAUDE-REL-2

閱讀證據：release-platform.mjs:70 用 validateOrigin(options.url) 只確認格式（platform-tools.mjs:143-160），沒有比對 config.name 或帳號的 workers.dev 子網域。:76 capturePrevious 從這個網址的 /config、/healthz、/api/v1/sources 取得 previous.sourceSha 和 manifest（platform-release-state.mjs:68-84），但 previous.versionId 卻是 wrangler deployments list 查到的 config.name 的版本。兩者沒有交叉核對。

後果：如果網址指向另一個資料健全的部署（例如打錯子網域、或貼到 GCP/其他 Worker），新版部署完成後 :131 的 smoke 會因為 expectedSha 不符而失敗，進入 :148-160 的自動回退。這時正確部署的新版會被 rollbackWorker 換掉；接著 rollbackSmoke 又對同一個錯誤網址用 previous.sourceSha 驗證，所以會通過，receipt 被寫成 'failed-and-rolled-back'，錯誤訊息還寫『previous Worker restored and verified』，這是假的驗證。

CI 的 deploy-cloudflare.yml:33 寫死網址，影響主要落在本機手動部署。建議：從 config.name 加上已知的 workers.dev 子網域推導網址，或至少要求 hostname 以 `${config.name}.` 開頭並以 `.workers.dev` 結尾；也可以在部署後讓 Worker 回報版本相關識別（例如 /config 帶 CF version metadata），再跟 versionId 比對。

未執行事項：我沒有實際部署或重現，這是從程式流程推得的結論。

修復核對：部署工具作者修正後 tooling 29 tests、lint、typecheck、真實 local integration 通過；證據 /tmp/platform-release-fixes-tooling.log、/tmp/platform-release-fixes-integration.log。最終獨立 re-review 另作第二輪。
<!-- prospec:evidence-end -->

<!-- prospec:evidence CLAUDE-REL-3 -->
### CLAUDE-REL-3

閱讀證據：deploy-cloudflare.yml:3-4 只有 workflow_dispatch。:16-21 的 deploy job 沒有 `environment:`，也沒有 `if: github.ref == 'refs/heads/<main>'` 之類的條件，就直接把 secrets.CLOUDFLARE_API_TOKEN 注入 env，:33 對正式 URL 執行 platform:deploy。docs/CLOUDFLARE.md:72 也明確寫 token 是 repository secret。

release 腳本只要求 HEAD 乾淨並記錄 sourceSha，沒有要求這個 commit 已經進入受保護的主線，所以 REQ-FRIENDLY-PLATFORM-005 的『明確版本』在 CI 上可以是任意分支的 commit。更進一步，repository secret 對任何分支上的 workflow 都可用：有寫入權的人可以在分支上改 workflow，直接拿到 token。所以光在 workflow 加 ref 條件不算真正的安全邊界。

建議：改用 GitHub Environment（例如 cloudflare-production），把 token 改成 environment secret，並設定 deployment branch 規則和 required reviewers；deploy job 加上 `environment:`。

未執行事項：我沒有檢視 GitHub repo 的實際 secret 或 environment 設定（不在 snapshot 內）；如果線上已另外設了限制，程式碼裡沒有反映出來。

修復核對：部署工具作者修正後 tooling 29 tests、lint、typecheck、真實 local integration 通過；證據 /tmp/platform-release-fixes-tooling.log、/tmp/platform-release-fixes-integration.log。最終獨立 re-review 另作第二輪。
<!-- prospec:evidence-end -->

<!-- prospec:evidence CLAUDE-REL-4 -->
### CLAUDE-REL-4

閱讀證據：test-platform-integration.mjs:94-100 打 nearby 查詢之後，只斷言 worker.output() 不含 25.044321、121.529876、radius=123。platform-local-worker.mjs:40-41 用 `--log-level warn` 啟動 wrangler dev，而 apps/api/src/friendly/pathname-logger.ts:7 是用 console.log 輸出。如果 Wrangler 過濾掉 log 層級的 Worker 輸出，output 就會是空字串；這時就算把 pathnameLogger 改成輸出完整 URL（含 query），測試仍然是綠的。

我用 Grep 確認過，apps/api/test 底下沒有任何 pathnameLogger 的單元測試，所以 REQ-FRIENDLY-PLATFORM-002 AC2『應用 log 不記座標 query』沒有一個對失敗敏感的測試守著。

建議：加入正向對照，例如斷言 output 含 `GET /api/v1/friendly-stores 200`，或調整 log level 確保 Worker 輸出會被收集；另外為 pathnameLogger 補單元測試，注入 write 並斷言寫出的行不含 query。

未執行事項：我沒有跑整合測試，不確定 --log-level warn 實際會不會過濾 Worker 的 console.log；這個缺陷的核心是缺少正向對照，不依賴那個行為。

修復核對：部署工具作者修正後 tooling 29 tests、lint、typecheck、真實 local integration 通過；證據 /tmp/platform-release-fixes-tooling.log、/tmp/platform-release-fixes-integration.log。最終獨立 re-review 另作第二輪。
<!-- prospec:evidence-end -->

<!-- prospec:evidence CLAUDE-REL-5 -->
### CLAUDE-REL-5

閱讀證據：build-townpass.mjs:42-47 執行外部 scripts/build-codefest.sh，並轉發任意參數。:57 的 mode 只看有沒有 `--debug`。:64-68 對 build/app/outputs/flutter-apk/app-${mode}.apk 只做 stat（確認是檔案、大小合理）和計算雜湊，沒有比對 mtime 是否晚於 startedAt，也沒有在建置前先刪掉舊產物。Flutter 不會清掉其他 mode 或前一次的 APK。所以如果轉發的參數讓外部腳本產生不同 mode 或格式的產物，或者成功退出卻沒有輸出這個檔案，收據就會把舊 APK 標成 'apk-built'，並跟這次的 serviceUrl、sourceSha 綁在一起，違背 REQ-FRIENDLY-PLATFORM-004 AC1『產物記 URL、來源 commit 與 SHA-256』的可追溯性。

建議：建置前記錄或移除目標 APK，並在建置後要求 mtime >= startedAt。

未執行事項：我沒有讀外部 TownPass repo，也沒有實際建置 APK。

修復核對：部署工具作者修正後 tooling 29 tests、lint、typecheck、真實 local integration 通過；證據 /tmp/platform-release-fixes-tooling.log、/tmp/platform-release-fixes-integration.log。最終獨立 re-review 另作第二輪。
<!-- prospec:evidence-end -->
<!-- prospec:evidence-section-end -->
