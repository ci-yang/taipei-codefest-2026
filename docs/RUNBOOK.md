# RUNBOOK：從 clone 到看到地圖

前置：Node 24（`>=22` 可）、pnpm 11、Docker Desktop（含 compose v2）。

## 1. 第一次啟動

```bash
git clone <repo-url> && cd taipei-codefest-2026
cp .env.example .env
pnpm install

docker compose up -d db          # PostGIS 16，對外 port 5433
pnpm db:push                     # drizzle 依 apps/api/src/db/schema.ts 建表
pnpm db:seed                     # 塞 10 筆臺北示範資料（可重複執行）

pnpm dev                         # 同時起 API（:8787）與 Web（:5173）
```

打開：

- 首頁 <http://localhost:5173/>
- 地圖 <http://localhost:5173/map>（沒手機時用 <http://localhost:5173/map?mockBridge=1> 模擬台北通定位）
- API <http://localhost:8787/healthz>、<http://localhost:8787/api/v1/places?lat=25.04&lng=121.56&radius=3000>

確認 API：

```bash
curl http://localhost:8787/healthz
# {"ok":true,"db":"up","postgis":"3.4 ...","time":"..."}
curl 'http://localhost:8787/api/v1/places?lat=25.04&lng=121.56&radius=3000'
# {"type":"FeatureCollection","features":[...]}
```

## 2. 常用指令

| 指令 | 作用 |
|------|------|
| `pnpm dev` | API + Web 一起跑（concurrently，Ctrl+C 全停） |
| `pnpm dev:api` / `pnpm dev:web` | 只跑一邊 |
| `pnpm test` | api（需要 db 已 push+seed）+ web 單元測試 |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | 型別檢查 / ESLint / 產出 dist |
| `pnpm db:push` | schema 改了就跑（開發期直接同步，不產 migration 檔）。**不帶 `--force`**：有會丟資料的變更（drop 欄位、改名）時 drizzle-kit 會停下來問，看清楚再答 |
| `pnpm db:push:force` | 同上但自動接受丟資料的變更。只在確定 DB 資料可以丟（本機、拋棄式 DB）時用；AI session 跑這條會跳確認 |
| `pnpm db:seed` | 重灌示範資料 |
| `docker compose up` | 全部進容器（db + api + web dev，bind mount、HMR） |
| `docker compose --profile prod up --build` | production image：web（nginx）在 <http://localhost:8080>，/api 反代到 api |

## 3. 手機連開發機（TownPass WebView 或手機瀏覽器）

1. 手機與筆電連同一個 Wi-Fi（會場網路若有 client isolation，改用手機熱點讓筆電連上）。
2. 查筆電區網 IP：`ipconfig getifaddr en0`（macOS），例如 `192.168.1.23`。
3. Vite 已設 `host: 0.0.0.0`，`pnpm dev` 輸出的 `Network:` 那行就是手機要開的網址：`http://192.168.1.23:5173/map`。
4. Web 預設走 **Vite proxy**（`VITE_API_BASE` 留空，`/api`、`/healthz` 由 Vite 轉給 `localhost:8787`），所以手機只需要連 5173，不用處理 CORS。
5. 若一定要讓手機直接打 API（例如 `VITE_API_BASE=http://192.168.1.23:8787`），要把手機頁面的來源加到 CORS：
   `.env` 設 `PUBLIC_WEB_URL=http://localhost:5173,http://192.168.1.23:5173`，重啟 API。
6. macOS 第一次會跳「允許 node 接受連入連線」，要按允許；否則到「系統設定 → 網路 → 防火牆」放行。
7. 手機瀏覽器的 `navigator.geolocation` 只在 HTTPS 或 localhost 可用，用 IP 連時瀏覽器定位會失敗（頁面會退回市政府為中心）。測定位請用 `?mockBridge=1` 或在 TownPass App 內開。

## 4. 常見錯誤

| 症狀 | 原因 / 解法 |
|------|-------------|
| `pnpm` 任何指令都報 `Invalid package manager specification` | 根 `package.json` 的 `packageManager` 要寫完整版本（例如 `pnpm@11.13.1`） |
| `ECONNREFUSED 127.0.0.1:5433` | db 沒起來：`docker compose up -d db`，`docker compose ps` 看是否 healthy |
| healthz 回 503 `"db":"down"` | 同上；或 `.env` 的 `DATABASE_URL` port 不是 5433 |
| `relation "places" does not exist` | 還沒 `pnpm db:push`；或 push 其實失敗了（drizzle-kit 失敗時有時仍 exit 0，要看到 `[✓] Changes applied` 才算成功） |
| places 測試報「沒有 seed 資料」 | 先 `pnpm db:seed` |
| `type "geometry" does not exist` | PostGIS extension 沒開：`docker compose exec db psql -U app -d app -c 'CREATE EXTENSION IF NOT EXISTS postgis'` |
| `Port 5173 is in use` / `EADDRINUSE :8787` | `lsof -i :5173` 找出佔用者；或改 `.env` 的 `API_PORT`（Vite proxy 會跟著讀） |
| Apple Silicon 拉 postgis 很慢或警告 platform | 官方 image 只有 amd64，compose 已指定 `platform: linux/amd64` 走模擬，第一次較慢屬正常 |
| 地圖頁只出現清單、顯示「此裝置無法顯示地圖」 | 裝置／瀏覽器沒有 WebGL2（MapLibre 需要），頁面自動降級成清單；headless 測試要加 `--use-angle=swiftshader` |
| console 出現 `Worker failed to load` | MapLibre v6 的 worker 路徑問題：`MapPage.vue` 已用 `setWorkerUrl(...?url)` 處理；自架 nginx 要讓 `.mjs` 回 `application/javascript`（見 `apps/web/nginx.conf`） |
| 地圖灰底沒圖磚 | 網路擋了 `tile.openstreetmap.org`；或 WebView 擋混合內容（頁面需 HTTPS 時圖磚也要 HTTPS，OSM 本身是 HTTPS） |
| `/api/v1/opendata/sample` 回 `"mocked":true` | `.env` 的 `OPENDATA_SAMPLE_RID` 沒設或 data.taipei 打不到；回應的 `reason` 欄位寫了原因，打不到時 API log 另有 `[opendata] 改回 mock：<原因>` |
| 改了 `packages/shared` 前端沒更新 | shared 是直接吃 TS 原始碼，通常會 HMR；不行就重啟 `pnpm dev` |
| 容器版 web 改檔沒 HMR | compose 已設 `VITE_USE_POLLING=true`；確認改的是 bind mount 進去的檔 |

## 5. 停止

```bash
# pnpm dev：Ctrl+C
docker compose stop db           # 保留資料
docker compose down -v           # 連資料一起刪（下次要重新 db:push / db:seed）
```
