# Claude Code App 根入口第二輪審查

來源：Claude Code companion，範圍 `7018400..509937f`。以下保留原始回報；Claude 本輪未執行測試。

# Claude Code Review

Target: branch diff against 70184003c0251824f84c8a1e578a4d9d23127afd

卍解卍解

# 審查：`7018400..509937f`（回退改用歷史 App manifest 驗證）

我沒有跑測試。以下結論來自讀 diff，以及 `scripts/app-shell-smoke.mjs`、`scripts/platform-release-state.mjs`、`scripts/smoke-platform.mjs` 的現行內容。

## 整體

上一輪的第 1 項（上一版被拿去對照這次的檔案清單）這次大致修好了：
- 當次建置走 `validateCurrentAppManifest`，維持嚴格：版本前綴寫死 `v6`，檔案清單必須完全等於 `APP_FILES`。
- 前版走 `validateAppManifest`，只驗 schema 1 的結構。
- smoke 照前版 manifest 自己記錄的 `files` 逐檔比對位元組數和 sha256。
- `capturePrevious`、`assertRollbackData`、手動回退、自動回退這四條路徑都已接上歷史模式。
- 路徑安全檢查涵蓋完整，測試列了 11 種惡意路徑，加上重複項、缺入口檔、hash 或 size 不合法等情況。
- `appManifestMode` 預設是 `'current'`，未知值會直接拒絕。新部署的 smoke 不會意外落到寬鬆模式，`release-platform.test.mjs` 也有斷言這點。
- 不合法的回退收據會在 `rollback` 動作前就被擋下，Worker version 不會被改到。

## 發現（依嚴重度）

### 1. 【中】HTML 結構檢查仍綁定現行 UI，跟原本第 1 項是同一類問題，只修了一半
- 位置：`scripts/app-shell-smoke.mjs:76-85` 的 `assertAppHtml`。它寫死要求 `id="category-filters"`、`id="search-trigger"`，以及 `<main id="app" class="friendly-app">`。
- 呼叫的地方：
  - `platform-release-state.mjs:123` 的 `capturePrevious`（檢查線上前版）。
  - `smokeAppShell` 內部。歷史模式回退後的 smoke 也會走到這裡。
- 會怎麼壞：假設下一個 commit 把搜尋按鈕改名成 `id="search-open"`，並同步更新 `assertAppHtml`。部署時 `capturePrevious` 會拿新規則去驗線上舊版 HTML，結果驗不過，整次部署中止，也記不到回退目標。這和上一輪第 1 項的失敗方式完全一樣，只是觸發點從「檔案清單」換成「首頁 DOM 標記」。
- 這次的歷史 fixture 只拿掉 `<script src="./search.js">`，`search-trigger` 按鈕還在，所以測試沒有覆蓋這種情況。
- 建議：把 HTML 檢查也拆成兩種。
  - 歷史模式只驗 build SHA 的 meta，以及「不是 legacy Vue」（沒有 `/assets/` bundle）。內容正確性已經有逐檔 hash 保證。
  - DOM 標記檢查只留給 current 模式。
  - 補一個測試：前版 HTML 沒有 `search-trigger`，capture 和歷史 smoke 仍要通過。

### 2. 【低】`sw.js`／`offline.js` 的版本字串格式也綁定現行寫法
- 位置：`smokeAppShell` 對 `/sw.js`、`/offline.js` 要求內容包含 ``const VERSION = '${offlineVersion}'``。
- 這次的修正已經讓版本前綴可以從 v5 到 v7 變動，但宣告的寫法本身仍是寫死的。以後如果改成 `const VERSION = "..."`（雙引號），或改從其他檔匯入版本，舊版本身沒問題，回退後的 smoke 也會失敗。
- 發生機率不高。建議歷史模式只檢查檔案裡有沒有出現 `offlineVersion` 這個字串，或乾脆跳過這項，因為已經有 hash 比對。

### 3. 【低】未知副檔名的 content-type 只檢查「不是 HTML」
- 位置：`assertContentType` 的 fallback 分支。
- 目前沒有實際影響：current 模式下 `APP_FILES` 每個檔都有已知副檔名（LICENSE 也是 `.txt`），內容又有 hash 保證。
- 要注意的是，沒有副檔名的路徑（例如 `/vendor/foo`）取到的 `split('.').at(-1)` 會是整段路徑，也會落進 fallback。如果之後 `APP_FILES` 加了沒有副檔名的檔案，current 模式也會悄悄變寬鬆。可以考慮在 `validateCurrentAppManifest` 加一條：每個路徑都必須是已知副檔名。

### 4. 【資訊】歷史路徑允許隱藏檔名
- 路徑規則允許像 `/.env` 這樣以 `.` 開頭的段落。smoke 會對同源送 GET，不會造成危害，路徑穿越也已經擋掉，不需要改，這裡只是記錄一下。

## 已檢查、沒有問題的部分
- 上一輪第 2 項提到的 D1 已套用邊界，`docs/CLOUDFLARE.md:89` 原本就有寫，處理紀錄說的屬實。
- `loadReleaseApp` 改用 current 驗證，測試用 `/current runtime/` 鎖定錯誤訊息，避免因為其他原因失敗也被算成通過。
- 歷史 smoke 的測試同時驗了三件事：正向能通過、改用 current 模式會被拒、資產被竄改或回 HTML 會被拒。
- 第 1 項的修法在 v5、v7 兩種版本都各跑了一次，替代實作也沒辦法同時通過正向和反向測試。
- `/app-manifest.json` 不能被列為資產，避免 manifest 拿自己驗證自己。

## 結論
這個 commit 可以合併。第 1 項建議在下一次改首頁 DOM 之前修掉：觸發條件跟原本第 1 項一樣常見（改 UI 就會碰到），一旦觸發，部署和回退會一起被擋。第 2 到 4 項可以之後再處理。


## 主線處理紀錄

第 1、2 項已修正：歷史首頁以 SHA stamp 與 manifest 的 bytes／hash 核對，不檢查當前 DOM 名稱；歷史 SW 宣告不要求特定引號或變數名稱，仍核對版本字串與檔案 hash。當次建置保留嚴格驗證。第 3、4 項保留為已知邊界；當次產物仍為明確 allowlist，未加入未知副檔名或隱藏檔。
