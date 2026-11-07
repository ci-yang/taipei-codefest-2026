# Claude Code Review

Target: branch diff against 8e05cd2cb786e15abc0f4cbcd5058fe39da73b84

卍解。我審了 `8e05cd2..0ef04f8` 共 4 個檔案的改動，沒發現會出錯的問題，可以合入。有一點要先講：Bash 被權限擋下，兩支測試我都沒有實際跑，以下判斷全部是讀程式碼推出來的。

### 1. `apps/api/src/app.ts:39-46` — 錯誤紀錄不帶請求資料
- **正確性 OK**：紀錄內容只有四個固定字串之一，錯誤訊息、stack 和自訂 `name` 都不會寫進 log。這樣就算有人改了 `err.name`，也只會記成固定分類，不會外洩。回應本體維持 `{ error: 'internal_error' }`，沒有變動。
- **行為沒變**：`zValidator` 是自己回 400（`routes/places.ts:16`、`routes/opendata.ts:66`），不會走到這段錯誤處理。`src/` 裡也沒有用到 `HTTPException`，所以不會有原本該回 4xx、現在被改成 500 的情況。
- **小問題：Edge 端沒跟著改**。`apps/api/src/edge-app.ts:29` 的錯誤處理還是什麼都不記。如果 Cloudflare 那條是正式部署路徑，那邊出錯時看不到任何紀錄。可以考慮把這段分類邏輯抽成共用函式，兩邊都用。不改也不會出錯，只是兩邊不一致。

### 2. `apps/api/test/error-logging.test.ts` — 測試寫得紮實
- 四種錯誤都把 message 和 `name` 換成假的私密字串，再斷言 log 精確等於 `{ type: ErrorClass.name }`，並用正規表達式確認 log 裡沒有座標或 `lat=` 之類的字串。如果有人把 log 改回直接記 `err` 或 `err.message`，這支測試會失敗，不是恆真的測試。
- 它用的斷言 `toHaveBeenCalledExactlyOnceWith` 需要 vitest 3.0 以上，`apps/api/package.json:32` 是 `^5.1.0`，可以用。
- `createApp()` 會走預設的 `db`，這部分我沒查。如果 `db/client` 一載入就去連資料庫，這支測試在沒開 DB 的環境可能跑不起來。不過既有的 API 測試應該也是同樣用法，風險不高。

### 3. `packages/shared/test/routing.test.ts:31` — 拿掉的斷言本來就沒有作用
- 測試把同一個 `graph` 物件直接放進 vm 環境（`:13`），所以 `runtime.window.FRIENDLY_ROUTING_DATA` 跟 `graph` 是同一個物件。原本的斷言等於拿一個物件跟它自己的 JSON 複本比，幾乎一定會通過。
- 輸入資料的完整性另外有 `:25-28` 的 sha256 比對守著，拿掉沒有損失。
- 我也看過，fixture 和 `src/routing.ts` 都不會修改 `graph`，沒有兩個 solver 共用的輸入被改掉的問題。測試標題寫的「original graph inputs」靠 sha 比對還是成立。

### 4. `docs/prototypes/friendly-route/README.md:30` — 文件
- 清楚說明了開發時 Service Worker 快取會讓人看到舊內容，以及該怎麼清除。文件裡的「打包版本依內容雜湊更新」這句，我沒有去對照 `package-friendly-prototype.py` 的實作，算是未驗證的描述。

### 總結
| 項目 | 結果 |
|---|---|
| 會出錯的問題 | 無 |
| 一致性 | Edge 端錯誤處理沒有加紀錄（小問題） |
| 測試品質 | 新測試有效；拿掉的斷言本來就恆真 |
| 沒驗證到的 | 兩支測試沒實際跑過（Bash 被擋）；README 的雜湊描述沒對照打包腳本 |

合入前建議手動跑一次：`pnpm --filter ./apps/api exec vitest run test/error-logging.test.ts` 和 `pnpm --filter ./packages/shared exec vitest run test/routing.test.ts`。

