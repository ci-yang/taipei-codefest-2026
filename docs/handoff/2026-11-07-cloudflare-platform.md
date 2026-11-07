# Cloudflare 平台與 App 交接

日期：2026-11-07。平台分支 `feat/deploy-cloudflare-platform`，基底 `5d94fc508d09ca15aa460b752a20afab6c435c92`。這份紀錄隨部署補入實際收據，不將待執行項目寫成已通過。

## 本輪交付邊界

Workers + Static Assets + D1 承接正式 Vue／Hono 平台；MapLibre 呈現本地 OSM GeoJSON，裝置端比較最短與有限候選中的資源路線。保留 GCP／Node／PostGIS。完整操作及端點契約見 [CLOUDFLARE.md](../CLOUDFLARE.md)。

組員繼續負責 `docs/prototypes/**` 與 `.prospec/changes/enable-friendly-routes/**`，本輪未修改。現有整合頁提供服務篩選、GPS／手動起點、單一目的地與兩種路線；shared 引擎支援固定順序的多站點。產品 App 畫面、日期／歷史／多目的地 UI、跨裝置評論／求助、完整離線保存由後續規格接續。

## 程式與資料

- 正式來源：`data/friendly/manifest.json`；版本 `friendly-route-2026-11-07-v1`，103 筆店家、9,483 路網節點、24,314 有向邊。
- 同版本同內容匯入可重跑；不同內容拒絕，D1 不覆寫舊快照。
- 地圖與服務點來自固定地方快照，不能推定全市通行、即時開放、免費或無障礙路線。
- GPS 在裝置使用，不自動傳到 API；定位失敗、過期、低精度、模擬位置、出界皆保留手動入口。
- TownPass commit：`9701688709fa0faf5fd1c2257c968c5440ee6421`；[獨立 App PR](https://github.com/ci-yang/TownPass/pull/1)，base `codefest-2026`。

## 已執行驗證

- 首輪 workspace：103 tests 通過（shared 7、API 49、web 47）；typecheck、build、Worker dry-run 通過。review 後新增 D1 遠端回讀回歸測試；工具腳本擴充至 29 tests 並通過，最終 workspace 結果見 Prospec 測試紀錄。
- ESLint 曾誤掃 `.wrangler/tmp` 生成檔，已加入生成目錄忽略；最終重跑通過。
- 真實 local D1 integration：migration、兩次匯入、異內容拒絕、缺版本 503、API JSON 404 與 SPA deep link 通過；只使用獨立暫存本機資料，無遠端寫入。
- 2026-11-07 Chrome／390×844：選「新東陽忠孝店 → 新東陽101專櫃」，出現最短 1,565 公尺與資源候選 1,975 公尺；可切換候選並繪圖。選 Wi-Fi 後名冊 103 → 75，舊路線清空提示重算；document scrollWidth 與 viewport 同為 390。
- TownPass 獨立複核：Python URL 驗證 7 tests、Flutter 專用 2 tests、相關 analyze 通過。既有 counter 範本測試失敗與既有分析警告未冒稱修復。
- Claude Code `claude-opus-5-5` 已參與架構及程式 review，無工具權限拒絕。兩位 reviewer 獨立指出同一 D1 遠端回讀問題；已經獨立確認，舊測試重現失敗、修正後通過。另補網址綁定、main 分支發布限制、日誌正向對照、舊 APK 拒絕與對應版本原始碼連結。
- review 後 local D1 integration 於 `2026-11-07T08:02:19.162Z` 通過，確實擷取 `GET /api/v1/friendly-stores 200` 日誌並確認沒有座標 query；未進行遠端寫入。

## 部署與 APK 執行紀錄

- Cloudflare D1 已建立：`taipei-friendly-platform`，ID `1e0f3668-ef50-4a8b-9a11-0dedb5ab54e5`。
- 已發布入口：[友善平台](https://taipei-friendly-platform.jason21131.workers.dev)。部署來源為 `412dd870ea9ebb3fb903794e61a289a462b44e5a`，最終 Worker version 為 `9f239e0b-0667-45b8-a26e-92911f476159`。
- 先發布兩個 Worker version，實際回退到第一個，再重新發布；四次線上 smoke 均成功。這次演練各版本使用相同程式與資料，驗證版本切換及資料保留，未宣稱跨資料 schema 升級回退。詳見下表原始收據。
- 原入口 `https://codefest.ciyang.dev` 與 GCP VM 保留，不改 DNS。
- GitHub 部署 workflow 已具備 concurrency 及先驗後發流程；repository 尚未設定專用 `CLOUDFLARE_API_TOKEN` secret，本機 OAuth 不上傳至 GitHub。
- APK 已以驗證後的 HTTPS 入口建置；外 repo 路徑 `/Users/ciyang/Documents/repos/TownPass-platform`，wrapper 為 `scripts/build-townpass.sh`。平台與 App 建置前後均為乾淨 commit。APK 為 `com.example.townpass`／`0.0.12`（code 1），115,790,112 bytes；SHA-256：`fb815e2f9d03f0402d5db3105c2a93fd4fda506391e6ebf2c9716d7db1cb7a68`。
- [APK 與 SHA-256 下載](https://github.com/ci-yang/TownPass/releases/tag/untagged-f991213db1395b66fcdb)位於 GitHub release 草稿（tag `platform-demo-20261107`），需有 repository 的草稿存取權限。fresh-context reviewer 已獨立核對 APK hash、manifest、簽章及三種 ABI 內嵌的服務網址。
- 尚無 Android 實機／模擬器連線，不能宣稱 native GPS／實機 WebView 通過。release 配置沿用 debug signing，產物供展示測試，不作商店正式簽署。

| 實際操作 | 收據 |
|---|---|
| 第一次發布：Worker `49b107b7-6dd0-4cf3-a56d-a93f8dde4678` | [first-deploy.json](evidence/2026-11-07-cloudflare/first-deploy.json) |
| 第二次發布：Worker `e3ce7236-905a-4b5b-988a-514b896e5926` | [second-deploy.json](evidence/2026-11-07-cloudflare/second-deploy.json) |
| 回退第二版至第一版，D1 保留 | [rollback.json](evidence/2026-11-07-cloudflare/rollback.json) |
| 重新發布最終版，103 筆資料與檔案 hash 通過 smoke | [final-deploy.json](evidence/2026-11-07-cloudflare/final-deploy.json) |
| APK 建置與兩個 repository 的來源 commit | [apk-build.json](evidence/2026-11-07-cloudflare/apk-build.json) |
| APK manifest、簽章與內嵌 URL 檢查 | [apk-verification.json](evidence/2026-11-07-cloudflare/apk-verification.json) |
| 原 GCP／PostGIS 仍健康 | [gcp-health.json](evidence/2026-11-07-cloudflare/gcp-health.json) |

最終 workspace 109 tests、工具腳本 29 tests 通過；平台 commit `412dd87` 的 [GitHub CI](https://github.com/ci-yang/taipei-codefest-2026/actions/runs/42354923870) 成功。線上 Chrome 亦完成選點、路線比較與資源路線繪製。獨立 review 與 Prospec 驗證紀錄位於 `.prospec/changes/deploy-friendly-platform/`；部署前等級 A，包含兩項設計細節 WARN，產品 UI 仍由組員接續。

首次遠端匯入曾因 Wrangler `--file --json` 的 stdout 混有進度文字而停止發布。修正為 INSERT 子程序成功後，以獨立 SELECT 回讀完整資料並核對 hash；修正版已通過獨立 review、回歸測試與實際雲端匯入。失敗發生在 Worker 發布之前。

## 接手位置

| 工作 | 入口 |
|---|---|
| 頁面接資料 | `apps/web/src/lib/friendly-data.ts`、`packages/shared/src/friendly.ts` |
| 地圖、定位、路線 | `apps/web/src/lib/friendly-map.ts`、`friendly-location.ts`、`packages/shared/src/routing.ts` |
| Worker API／D1 | `apps/api/src/worker.ts`、`apps/api/src/friendly` |
| 本機整合 | `pnpm test:platform`、`pnpm platform:dev` |
| 發布／回退 | `pnpm platform:deploy`、`pnpm platform:rollback` |
| App 重新建置 | `CODEFEST_SERVICE_URL=<已驗HTTPS> TOWNPASS_DIR=<TownPass路徑> bash scripts/build-townpass.sh` |

發布需要乾淨已提交 HEAD；先更新與驗證程式，再執行發布。不要用舊 GCP release 腳本發布 Cloudflare。
