# Claude Code Review

Target: branch diff against 5d94fc508d09ca15aa460b752a20afab6c435c92

卍解。先跟你說一下進度：API、Worker、shared schema 和最新一筆整合 commit 都看完了，接下來看現行 App 本體的 Service Worker 和 bridge，看完就寫結論。卍解。

# Review：`integration/20261107-review` 對 `5d94fc5` 的差異

**結論：沒有找到會擋合併的 correctness bug，合併前有 3 件事要處理。** 這是靜態 review。這個 session 沒有 Bash 權限，所以 `pnpm test`、`test:prototype` 和 `test:platform` 我都沒跑，結果不知道。

這次看了 API／Worker／D1、shared schema、Vue 的 explorer 和 location、原型的 `sw.js`、`offline.js`、`bridge.js`、打包腳本和 CI workflow，還有最新一筆整合 commit `8e05cd2`。沒有逐行看的有 `scripts/*` 的部署和回退腳本、`app.js`、`search.js`、Python 建置腳本和資料檔。

## 合併前要處理

**1. 路由對照測試有一條斷言永遠會過**（`packages/shared/test/routing.test.ts`）
- `8e05cd2` 把 `graph` 直接放進 `vm.createContext({ window: { FRIENDLY_ROUTING_DATA: graph } })`。
- 下面那行 `expect(graph).toEqual(...runtime.window.FRIENDLY_ROUTING_DATA)` 因此等於拿 `graph` 比對它自己，永遠會過。
- 以前這行的用處是確認原型的 `routing-data.js` 跟平台的 graph 一致，現在這層保護沒了。
- 新加的 sha256 對 manifest 檢查有效。但兩邊 solver 現在吃同一份輸入，「frozen prototype differential」測的只剩演算法一不一致，測不到資料有沒有分歧。
- 建議：刪掉這條斷言，或改成真的跟原型資產比對。

**2. Node API 的錯誤處理不再寫 log**（`apps/api/src/app.ts` 的 `onError`）
- 舊版會 `console.error(err)`，新版直接回 500 不留紀錄。
- 本機和 GCP 基線出錯時看不到原因，32 小時的比賽裡排錯成本會變高。
- `pathnameLogger` 不記 query 是對的（定位座標可能在 query 裡），但 error 至少可以記 `err.name`，或只在開發環境記 stack。

**3. 原型在開發模式下改了檔案，畫面不會更新**（`docs/prototypes/friendly-route/sw.js` 的 fetch handler）
- fetch 是 cache-first：只要有 active 快取，連線時也回快取的版本。
- `VERSION` 在原始碼裡寫死 `friendly-resource-v6-20261107`，只有 `tools/package-friendly-prototype.py` 打包時才換成內容 hash。
- 所以用 `pnpm prototype` 開發的人，第一次離線下載完成後，改 `app.js` 或 `resources-data.js` 畫面都不會變。組員很容易以為改壞了。
- 正式打包沒有這個問題。建議在 README 寫一句「開發時改完要清掉離線資料或換 VERSION」，或在 localhost 跳過 cache-first。

## 次要（可以之後再做）

- **每個請求都重讀並重驗整份資料**：`D1FriendlyRepository.read` 和 `SnapshotFriendlyRepository.read` 每次請求都會讀、`JSON.parse`、跑一次 zod，D1 版還多算一次 SHA-256。`/config`、`/healthz`、`/friendly-stores` 都走這條路。103 筆沒問題，資料換成全市 5,948 筆就有超過 Worker CPU 時間上限的風險。之後可以依 `version` 快取在 module scope，因為快照不可變（有 trigger 保證），快取不會有一致性問題。
- **`limit` 預設和上限都是 1000**（`packages/shared/src/friendly.ts`）：前端 `friendlyData.stores` 不帶參數，所以超過 1000 筆會被悄悄截斷，選起點和終點時會找不到店家。現在只有 103 筆，暫時不會發生。
- **`PUBLIC_ORIGIN` 沒有被用到**：`wrangler.jsonc` 宣告了，但 `PlatformBindings` 和任何程式都沒讀它。
- **CI 時間變長**：`ci.yml` 加了 `test:prototype`、`test:tooling`、`test:platform` 和 wrangler dry-run，每次 PR 都會跑。

## 查過、沒問題的部分

- **D1 快照**：migration 用 trigger 禁止 UPDATE 和 DELETE。讀取時驗 `version` 和內容 hash，失敗一律回 503，不洩漏錯誤內容。
- **查詢參數**：重複的 query key 會回 400，bbox 和 lat/lng/radius 不能混用，`.strict()` 擋掉多餘欄位。
- **Log 隱私**：`pathnameLogger` 只記 method、path 和 status，不記 query，座標不會進 log。
- **部署 workflow**：只能手動觸發，限 main，有 concurrency 鎖，部署前先跑完整 CI。token 走 secrets，account_id 不算機密。
- **Service Worker**：訊息驗證了 channel、id、來源 client 和 scope。下載完整才切換到新快取，失敗時保留舊的完整包，不會讓離線資料變半套。
- **Bridge**：訊息驗證了 `name`、`data` 和來源物件。導航有 geo → OSM 的備援和逾時；撥號會先檢查號碼格式。
- **定位**：會拒絕模擬位置、精度超過 100 公尺、超過 60 秒或超出範圍的定位。重新定位失敗時，不會留著舊的 GPS 起點。
- **文件**：README、`docs/CLOUDFLARE.md` 和 DECISIONS 都講清楚了「App 本體是原型，平台是獨立部署入口，合併不等於重新部署或更新 APK」。這跟 D6／D7 一致。

