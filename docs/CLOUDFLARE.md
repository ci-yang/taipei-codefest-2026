# App 發布入口

Ci 已指定 Cloudflare 網址直接呈現 App 本體。`platform:build` 從 `docs/prototypes/friendly-route` 的 allowlist 打包乾淨 `dist/app`，`platform:deploy` 發布此目錄，根頁直接顯示地圖、搜尋與四類資源。舊 `/map`、`/about`、分析／規格入口導回 `/`；不發布 Vue 首頁或說明頁。App 功能與離線邊界見 [`prototypes/friendly-route/README.md`](prototypes/friendly-route/README.md)。

產物附 `app-manifest.json`，記錄來源 SHA、離線版本及每個檔案 SHA-256。部署 smoke 會驗根頁是 App、runtime 檔案與 manifest 一致、舊入口 redirect 與缺檔 404。回退至先前 App 依收據核對該版 manifest；舊 Vue 版只作明確標示的歷史回退目標，不可讓新部署因 manifest 缺失降級成 Vue 驗證。歷史 schema 1 的必要入口、SHA stamp 與 redirect 行為是固定發布契約；調整這些協議時應新增 schema 相容處理，不能修改歷史驗證器來套用新版 UI。

# Cloudflare 友善平台

部署採 Workers + Static Assets + D1；App 與保留的 API 同源。入口為 [友善同行 App](https://taipei-friendly-platform.jason21131.workers.dev)。App 使用全市資源靜態快照；下面 API／地方路網契約仍為 103 筆既有後端資料，不冒稱與全市 App 等同。既有 GCP 及 Node/PostGIS 留作基線，不執行舊 `deploy/release.sh`。產品 App 依 D6／D7，沒有評論或互助。

## 本機

Node 24、pnpm 11。`pnpm install --frozen-lockfile` 會依版本鎖定安裝開源 workerd；安裝允許清單只含 esbuild／workerd。

```bash
pnpm install --frozen-lockfile
pnpm test:platform
```

整合測試自己建立暫存 D1、套 migration、匯入兩次、啟動本機 Worker，再檢查 App 根頁／redirect／404／API／資料 hash；結束清理它自己的程序及暫存目錄。它不需要 Cloudflare token，不觸碰正式 D1 或既有 PostGIS。

互動開發使用本地持久 D1：

```bash
pnpm exec wrangler d1 migrations apply FRIENDLY_DB --local
pnpm exec tsx scripts/import-friendly.ts --local
pnpm platform:dev
# http://localhost:8791
```

`platform:dev` 先打包 App 再開 Worker，修改 App 後需重新建置；可用 `pnpm prototype` 直接開原始 App 開發。`pnpm dev` 仍是歷史 Node + Vue/Vite 流程，不是正式 App 入口。Node 新增同一 friendly 契約，舊 health／places／opendata 仍維持 PostGIS 基線。

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

契約單一來源為 `packages/shared/src/friendly.ts`、`platform.ts`。保留的 Vue 前端讀取地方名冊，在裝置依服務／路線計算；目前發布的純 JS App 使用自己的全市資源快照，兩者都不自動把 GPS 送至 nearby API。應用 log 只記 pathname，不記 query。

## 資料與地圖

`data/friendly/manifest.json` 記錄來源、日期、範圍及 SHA-256。固定版本為 `friendly-route-2026-11-07-v1`，103 筆店家，OSM 地方步行圖 9,483 節點／24,314 邊。範圍為緯度 25.023–25.044、經度 121.546–121.574，不等於行政區或全市。

`scripts/prepare-friendly-data.ts` 只供有意產生新快照時使用，來源為本輪已核對的原型與原始下載檔。日常 build 只讀已提交的 `data/friendly`，不依賴組員 prototype 或本機 `/tmp`。`platform:assets` 先驗證所有產物 hash，再複製明確四個檔案到 gitignored `apps/web/public/friendly`；不打包整個 repo。

D1 使用單列 immutable snapshot，version 為主鍵。名冊、manifest 與內容 hash 一起寫入；同版本同內容可重跑，異內容拒絕。Worker 的 `DATA_VERSION` 指定讀哪一列；缺版本回錯誤。新增資料請用新版本，先測再改設定；不要覆寫或刪除舊版。

匯入 SQL 使用 Wrangler `--file`；驗證讀回使用 `--command`。遠端 `--file` 的 stdout 可能混有進度文字與統計，即使指定 JSON 也不能把它當查詢結果。匯入器先確認子程序成功結束，再由 `--command` 的完整資料列、hash 與 schema 判斷匯入結果。本機與遠端的這個差異已有回歸測試。

上述 MapLibre／shared routing 是保留的歷史平台契約。正式 App 使用 Leaflet 與既有 OSM 地方底圖、全市點位；卡片距離是明示的直線距離。App 的全市點位與 shell 快取、缺底圖導引都來自同一份 App 程式。WebView 重開、native GPS 與飛航模式仍須在 TownPass 實機驗證。

## 部署與回退

帳號、Worker、D1 ID 與相容日期在 `wrangler.jsonc`，都不是 secret。目前工具以嚴格 JSON 讀取此檔，請維持無註解、無 trailing comma。首次資源已由 Ci 授權建立；其他成員不需另建資料庫。登入用 `pnpm exec wrangler login`；自動化 token 只放環境或 GitHub Actions secrets。

發布前先完成 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm test:prototype`、`pnpm test:tooling`、`pnpm build`、`pnpm test:platform`，再提交明確 commit。

```bash
pnpm platform:deploy --url https://taipei-friendly-platform.jason21131.workers.dev
```

首次不存在 Worker 時才另加 `--first-deploy`。網址必須與 `wrangler.jsonc` 的 `PUBLIC_ORIGIN` 一致。腳本拒絕 dirty tree，從目前乾淨 HEAD 建置；同機跨 worktree 有 account/worker 互斥鎖，並在每次關鍵動作前核對遠端 Worker version，避免回退他人的新版。腳本強制正式前端使用同源 API，套追加式 migration、匯入名冊、部署後執行有逾時上限的 smoke。結果放 gitignored `.artifacts/releases/`。

```bash
pnpm platform:rollback --receipt .artifacts/releases/<部署收據>.json
```

手動執行 `pnpm platform:smoke --url <入口> --sha <commit>` 前，應在該 commit 的乾淨 worktree 先執行 `pnpm platform:build`，讓本機 manifest 與要驗證的版本一致；不能拿新 build 去驗舊版。此命令只驗現行 App；歷史版本回退交給收據流程，不用遠端 manifest 自驗成功。

回退使用收據的前版 Worker；先確認其資料快照仍可讀，再回退與 smoke。**D1 不隨 Worker 回退**，舊快照及 schema 必須保留。首次部署沒有前版可回退，驗證失敗就不交付新入口，GCP 保持可用。不要自行刪除仍有 owner 的 lock。

## GitHub CI/CD

- PR：`CI` 執行 typecheck、lint、原型測試、PostGIS 測試、工具測試、build、local D1 integration 及 Worker dry-run；不取得部署 secret。
- 合併／push 到 main：`Deploy Cloudflare platform` 先做 main preflight，再呼叫相同的 reusable CI。驗證成功後才執行 `platform:deploy`。main 不另跑重複的 CI workflow。
- 手動重新發布：在 [Actions 部署流程](https://github.com/ci-yang/taipei-codefest-2026/actions/workflows/deploy-cloudflare.yml) 按 Run workflow，選 main 重新 dispatch。其他分支會被拒絕。對舊 run 按 Re-run jobs 仍使用舊 SHA；main 已前進時應重新 dispatch。
- 發布 checkout 固定事件 SHA；GitHub Actions 的 deploy 在開始、建置後 D1 寫入前、Worker upload 前，比對 `GITHUB_SHA`、本機 HEAD 與遠端 main。過期 run 或遠端查詢失敗就停止，不能重跑舊 run 覆蓋新版；真正回退仍使用上方收據指令。
- 同環境序列部署，不取消正在進行的遠端寫入。Smoke 失敗沿用既有 Worker 回退流程，D1 舊快照保留。
- main 若在 D1 匯入後才前進，過期 run 會停止 Worker 發布，但已新增的 D1 schema／快照保留，由後續 run 接續。因此 migration 必須維持追加式，並相容仍在線上的舊 Worker；回退程式或改寫 main 歷史都不能當成 D1 回退。
- 過期 run 會以明確錯誤停止，不能當成部署成功；最新 run 仍須完成 CI 與 smoke 才算上線。main 的 CI 狀態位於部署 workflow 的 verify／ci，PR 的 ci 名稱不變。
- 成功後 Actions summary 列出網址與 SHA；部署收據 artifact 保存 30 天。`/config` 與 `/healthz` 用來核對實際線上版本。

需要專用 `CLOUDFLARE_API_TOKEN` repository secret，設定在 [Actions secrets](https://github.com/ci-yang/taipei-codefest-2026/settings/secrets/actions)。只授權既有 Cloudflare 帳號所需的 Workers Scripts 與 D1 寫入權限，不能使用 Global API Key；token 不寫入程式、收據或 git。本機 Wrangler OAuth 不複製進 GitHub。缺少 token 時 workflow 明確失敗，不會宣稱已發布。帳號與 D1 ID 是公開設定，沿用 `wrangler.jsonc`。

流程依 [Cloudflare GitHub Actions 文件](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) 使用環境 token；發布仍透過本 repo 的版本核對、匯入與 smoke 腳本，實際設定與執行結果見最新 handoff。

## App 與責任

TownPass 在獨立 repo；使用其 `scripts/build-codefest.sh`，本 repo wrapper 不重寫 URL 驗證。正式 APK 需要有效 HTTPS，coarse/fine 一起宣告；既有官方服務不改。建置成功、APK manifest 核對與實機定位是不同驗證項目，建置版本與 SHA-256 記入 handoff。

| 責任 | 位置 |
|---|---|
| Ci：平台／資料／地圖介面／部署 | `apps/api`、`apps/web`、`packages/shared`、`data/friendly`、`scripts`、`wrangler.jsonc` |
| 組員：產品 UX 與規格 | `docs/prototypes/friendly-route`、`.prospec/changes/enable-friendly-routes` |
| App 殼 | 獨立 `ci-yang/TownPass` repo，本輪隔離分支 `feat/codefest-platform` |

App 本體直接沿用組員維護的原型 runtime，發布管線不另寫一套 Vue 畫面；原型來源修正經 PR 驗證後由同一個建置入口打包。APK 內嵌 URL 若不同，仍需在 TownPass repo 明確調整與重建。

## 來源與授權

- [臺北市友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1)、[資料使用規範](https://data.taipei/rule)。
- [OpenStreetMap contributors／ODbL](https://www.openstreetmap.org/copyright)；原始下載與產物 hash 見 manifest。
- MapLibre GL JS：BSD-3-Clause；Hono、Vue、Zod、Vite、tsx：MIT；Wrangler／Workers types：MIT OR Apache-2.0；workerd：Apache-2.0。精確版本以 lockfile 與各套件 LICENSE 為準。
- 本專案 AGPL-3.0-or-later；公開服務的來源連結應指向對應版本。Cloudflare 託管服務另受平台方案限制，沒有因此改變本專案原始碼授權。
