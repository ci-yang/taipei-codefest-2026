# Claude Code App 根入口第三輪審查

來源：Claude Code companion，範圍 `509937f..8044891`。結論可合併；以下保留原始回報。Claude 未跑測試，主線工具測試 57 項已通過，GitHub CI run 42367696233 亦已成功。

# Claude Code Review

Target: branch diff against 509937fd20f5efbf31a53ac3fefa0272cadc1550

卍解# 審查：`509937f..8044891`（歷史首頁驗證不再綁定目前的 UI 結構）

我沒有跑測試。`node --test` 在這個唯讀環境被權限擋掉，所以下面的結論都是讀 diff 和 `scripts/app-shell-smoke.mjs`、`scripts/platform-release-state.mjs`、`scripts/smoke-platform.mjs` 的現行內容得出的。

## 整體

上一輪的第 1、2 項都修到了根本原因：
- 歷史模式的首頁不再檢查 `category-filters`、`search-trigger`、`<main class="friendly-app">` 這些 DOM 名稱。改成檢查 SHA stamp，再加上 manifest 裡 `/index.html` 的位元組數和 hash（`app-shell-smoke.mjs:91-97`）。
- `capturePrevious` 也改用同一套檢查（`platform-release-state.mjs:123`）。它對 SHA stamp 的要求和以前等價：stamp 改用 `appManifest.sourceSha` 來比，而 `validateAppManifest(..., config.version)` 已經保證 `sourceSha` 等於 `config.version`。
- current 模式完全沒放寬：仍然走 `assertAppHtml`，裡面有 DOM 檢查、stamp 檢查和非 Vue 檢查。`appManifestMode` 預設是 `'current'`，未知值會被拒絕。
- `smoke-platform.mjs:147` 這次把 `appManifestMode` 傳給 `smokeAppShell` 了。我沒有回頭追 diff 之前的版本，但新的參數是預設 `'current'`，所以沒傳的話 shell 層會被當成 current 驗證，對歷史回退來說會壞。
- 新測試是正反雙向的。歷史模式能接受新的 DOM 和新的版本宣告寫法；同樣的輸入在 current 模式會被拒；首頁竄改一個字元會被 hash 抓到；位元組數多一個字元會被 size 抓到。換一個寬鬆的實作沒辦法同時通過這兩個方向。

## 發現（依嚴重度）

### 1.【低】歷史模式拿掉了「不是 legacy Vue」這道檢查
- 位置：`app-shell-smoke.mjs:91-97` 的 `assertHistoricalAppEntry`。`assertAppHtml` 裡的 `doesNotMatch(/src="\/assets\//)` 在歷史路徑上已經沒有了。上一輪的建議是保留它。
- 實際影響很小：舊 Vue 版從來沒有發布過 `app-manifest.json`，而沒有 manifest 的版本在 `capturePrevious` 裡會走 legacy 分支。要被誤判，得有一份 schema 1、`app: 'friendly-resource'` 的 manifest 去描述一個 Vue 首頁，正常的建置流程產不出這種東西。
- 要注意的是，manifest 和首頁都由同一個線上 Worker 提供，hash 對得上只證明兩者一致，不證明內容是 App。補回這條 regex 不花什麼成本，而且它不綁任何 UI 名稱，不會再造成上一輪那種「改 UI 就驗不過」的問題。可以考慮加回來。

### 2.【低】有兩個 `assert.rejects` 沒給錯誤 matcher，任何錯誤都算通過
- `platform-release-state.test.mjs:204-213`（wrongStamp 那段）完全沒有 matcher。fixture 之後如果因為別的原因壞掉，比如 `/config` 結構改了，這個測試照樣是綠的，卻已經不是在驗 stamp。建議補一個針對 stamp 的 matcher，像 `/app-build-sha/`；如果預設的 assert 訊息不含這個字，就在 `assertAppBuildStamp` 加一條自訂訊息，例如 `'App build stamp differs.'`。
- `smoke-platform.test.mjs` 新測試在 `change === 'dom'` 時，matcher 是 `undefined`。我讀程式推測現在第一個失敗點是 `assertAppHtml` 的 `<main` regex，但測試沒有把這點鎖住。建議給 `assertAppHtml` 的幾條 match 加上訊息，再在這裡比對。

### 3.【資訊】`assertHistoricalAppEntry` 和後面的資產迴圈有重複
- `validateAppManifest` 已經要求必須有 `/index.html`（`requiredAppFiles`），所以 `assert.ok(entry, 'Historical App entry is required.')` 在 smoke 路徑上永遠不會失敗。
- `/index.html` 的位元組數和 hash，迴圈裡會用同一個 `response` 再比一次（`app-shell-smoke.mjs:168-175`）。
- 這段重複對 `capturePrevious` 有用，因為那條路徑不跑資產迴圈；對 smoke 只是讓錯誤訊息比較清楚。不用改，記一下就好。

### 4.【資訊】歷史版的 offline 版本檢查只做子字串比對
- `includes(appManifest.offlineVersion)` 很寬，但 `offlineVersion` 已經用 regex 鎖過格式，加上檔案有 hash 比對，風險可以接受。這和處理紀錄裡「不要求特定引號或變數名稱」的說法一致。

## 文件
- `docs/CLOUDFLARE.md` 新增了一句：「歷史 schema 1 的必要入口、SHA stamp 與 redirect 行為是固定發布契約……應新增 schema 相容處理」。這句把這次修正背後的原則寫清楚了。
- `docs/reviews/2026-11-07-claude-app-entry-round2.md` 把原始審查完整收錄，包括開頭的「卍解卍解」。如果這份要留在 repo 當正式紀錄，可以考慮刪掉那行。處理紀錄寫的「第 3、4 項保留為已知邊界」和程式碼的現況一致。

## 結論

這個 commit 可以合併。上一輪的第 1、2 項都修好了，current 模式沒有被放寬。第 1、2 項建議順手補上：把 `/assets/` 檢查加回歷史模式，再給兩個 `assert.rejects` 補上 matcher，兩件都是幾行的改動。合併前請在本機跑一次 `node --test scripts/*.test.mjs`，因為這輪我和上一輪的 Claude 審查都沒有跑過測試。


## 主線處理紀錄

本輪沒有阻擋項。保留兩個低優先追蹤：歷史 manifest 與首頁來自同源，無法據此驗證主機是否遭竄改；另兩個拒絕案例的錯誤 matcher 可再縮窄。目前新產物仍以本機 manifest 驗證嚴格 App 結構，正常建置不會產生 Vue 冒充 App 的 manifest。未將這兩點宣稱已修。
