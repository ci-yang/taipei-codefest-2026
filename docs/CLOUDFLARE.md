# Cloudflare 友善平台

正式程式採 Workers + Static Assets + D1；Vue、API 與地方圖資同源。既有 GCP 及 Node/PostGIS 留作基線，不執行舊 `deploy/release.sh`。這份手冊描述本輪 readonly 名冊與裝置端路由，產品 prototype 的評論／互助仍由組員另行定規格。

## 本機

Node 24、pnpm 11。`pnpm install --frozen-lockfile` 會依版本鎖定安裝開源 workerd；安裝允許清單只含 esbuild／workerd。

```bash
pnpm install --frozen-lockfile
pnpm test:platform
```

整合測試自己建立暫存 D1、套 migration、匯入兩次、啟動本機 Worker，再檢查 SPA／API／資料 hash；結束清理它自己的程序及暫存目錄。它不需要 Cloudflare token，不觸碰正式 D1 或既有 PostGIS。

互動開發使用本地持久 D1：

```bash
pnpm exec wrangler d1 migrations apply FRIENDLY_DB --local
pnpm exec tsx scripts/import-friendly.ts --local
pnpm platform:dev
# http://localhost:8791
```

`platform:dev` 先建前端再開 Worker，修改 Vue 後需重新建置；需要 HMR 可用 `pnpm dev` 的既有 Node + Vite 流程。Node 新增同一 friendly 契約，舊 health／places／opendata 仍維持 PostGIS 基線。

## API 契約

| 端點 | 成功內容 | 邊界 |
|---|---|---|
| `GET /api/v1/friendly-stores` | `{version, stores}` | 未帶條件回版本名冊；空結果是 `stores: []` |
| `?services=wifi,charge` | 多選任一符合 | wifi、charge、toilet、accessible；未知值 400 |
| `?bbox=121.546,25.023,121.574,25.044` | bbox 內店家 | 順序 west,south,east,north；不可和 nearby 同用 |
| `?lat=25.033&lng=121.56&radius=500` | 半徑內店家 | 三值須成組；radius 公尺，上限 50,000；不儲存位置 |
| `?limit=100` | 限制筆數 | 正整數，最多 1,000 |
| `GET /api/v1/sources` | `SourceManifest` | 日期、bounds、資料筆數、來源與產物 hash |
| `GET /config` | `PlatformConfig` | 公開 build SHA、dataVersion、API 與資產路徑；無 secret |
| `GET /healthz` | `PlatformHealth` | Worker 讀不到指定資料版本回 503；Node 此端點仍是 PostGIS 健康 |

店家型別為 `{id,name,address,phone,lat,lng,services,url}`。服務空白只表示未標示，實際可用時間、免費或免消費不能由名冊推定。無效查詢 400、未知 API 404、資料不可讀 503，皆為 JSON；不回 SPA 或假店家。

契約單一來源為 `packages/shared/src/friendly.ts`、`platform.ts`。目前前端讀取整份地方名冊，在裝置依服務／路線計算；不自動把 GPS 送至 nearby API。應用 log 只記 pathname，不記 query。

## 資料與地圖

`data/friendly/manifest.json` 記錄來源、日期、範圍及 SHA-256。固定版本為 `friendly-route-2026-11-07-v1`，103 筆店家，OSM 地方步行圖 9,483 節點／24,314 邊。範圍為緯度 25.023–25.044、經度 121.546–121.574，不等於行政區或全市。

`scripts/prepare-friendly-data.ts` 只供有意產生新快照時使用，來源為本輪已核對的原型與原始下載檔。日常 build 只讀已提交的 `data/friendly`，不依賴組員 prototype 或本機 `/tmp`。`platform:assets` 先驗證所有產物 hash，再複製明確四個檔案到 gitignored `apps/web/public/friendly`；不打包整個 repo。

D1 使用單列 immutable snapshot，version 為主鍵。名冊、manifest 與內容 hash 一起寫入；同版本同內容可重跑，異內容拒絕。Worker 的 `DATA_VERSION` 指定讀哪一列；缺版本回錯誤。新增資料請用新版本，先測再改設定；不要覆寫或刪除舊版。

匯入 SQL 使用 Wrangler `--file`；驗證讀回使用 `--command`。遠端 `--file` 走檔案匯入流程，只回統計資訊，不能用它取得 SELECT 的資料列。本機與遠端的這個差異已有回歸測試。

MapLibre 使用本地 OSM GeoJSON；不使用 Google Maps、Mapbox 或雲端路由。shared routing 對固定站序求最短路徑，資源較多是有限候選比較；虛線接線、現場通行及無障礙未驗證。正式 Vue 尚無完整離線保存包，需要網路載入；不能引用 prototype 的離線結果當作正式 Vue 的驗證。

## 部署與回退

帳號、Worker、D1 ID 與相容日期在 `wrangler.jsonc`，都不是 secret。首次資源已由 Ci 授權建立；其他成員不需另建資料庫。登入用 `pnpm exec wrangler login`；自動化 token 只放環境或 GitHub Actions secrets。

發布前先完成 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm test:tooling`、`pnpm build`、`pnpm test:platform`，再提交明確 commit。

```bash
pnpm platform:deploy --url https://taipei-friendly-platform.jason21131.workers.dev
```

首次不存在 Worker 時才另加 `--first-deploy`。網址必須與 `wrangler.jsonc` 的 `PUBLIC_ORIGIN` 一致。腳本拒絕 dirty tree，從目前乾淨 HEAD 建置；同機跨 worktree 有 account/worker 互斥鎖，並在每次關鍵動作前核對遠端 Worker version，避免回退他人的新版。腳本強制正式前端使用同源 API，套追加式 migration、匯入名冊、部署後執行有逾時上限的 smoke。結果放 gitignored `.artifacts/releases/`。

```bash
pnpm platform:rollback --receipt .artifacts/releases/<部署收據>.json
```

回退使用收據的前版 Worker；先確認其資料快照仍可讀，再回退與 smoke。**D1 不隨 Worker 回退**，舊快照及 schema 必須保留。首次部署沒有前版可回退，驗證失敗就不交付新入口，GCP 保持可用。不要自行刪除仍有 owner 的 lock。

CI 對 PR 執行既有 PostGIS 測試、新 D1 整合及 Worker dry-run，保存明確 SHA 的前端／Worker artifact。另有 `Deploy Cloudflare platform` 手動 Actions workflow：限 main 分支，先跑同一 CI，再序列部署。它需要專用 `CLOUDFLARE_API_TOKEN` repository secret；本機 Wrangler OAuth 不會被複製進 GitHub。部署憑證是否已設定及實際發布結果見本輪 handoff。

## App 與責任

TownPass 在獨立 repo；使用其 `scripts/build-codefest.sh`，本 repo wrapper 不重寫 URL 驗證。正式 APK 需要有效 HTTPS，coarse/fine 一起宣告；既有官方服務不改。建置成功、APK manifest 核對與實機定位是不同驗證項目，建置版本與 SHA-256 記入 handoff。

| 責任 | 位置 |
|---|---|
| Ci：平台／資料／地圖介面／部署 | `apps/api`、`apps/web`、`packages/shared`、`data/friendly`、`scripts`、`wrangler.jsonc` |
| 組員：產品 UX 與規格 | `docs/prototypes/friendly-route`、`.prospec/changes/enable-friendly-routes` |
| App 殼 | 獨立 `ci-yang/TownPass` repo，本輪隔離分支 `feat/codefest-platform` |

不直接改組員原型來接後端；正式 Vue 透過 shared 契約與 adapter，產品畫面確定後再整合。

## 來源與授權

- [臺北市友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1)、[資料使用規範](https://data.taipei/rule)。
- [OpenStreetMap contributors／ODbL](https://www.openstreetmap.org/copyright)；原始下載與產物 hash 見 manifest。
- MapLibre GL JS：BSD-3-Clause；Hono、Vue、Zod、Vite、tsx：MIT；Wrangler／Workers types：MIT OR Apache-2.0；workerd：Apache-2.0。精確版本以 lockfile 與各套件 LICENSE 為準。
- 本專案 AGPL-3.0-or-later；公開服務的來源連結應指向對應版本。Cloudflare 託管服務另受平台方案限制，沒有因此改變本專案原始碼授權。
