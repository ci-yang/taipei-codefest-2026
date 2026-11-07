# 決策紀錄

> 「之後還會再問一次」的結論寫在這裡，最新的放最上面。一條三段：決定、理由、影響／何時重議。
> 聊天訊息會被洗掉，這裡不會。值以 `.env`／程式碼為準，這裡記的是「為什麼」。

## 2026-11-07 ｜ D5 ｜ Commit message：type/scope 英文、描述繁中

- **決定**：Conventional Commits `<type>(<scope>): <描述>`，type 與 scope 用英文，描述用繁體中文（例 `fix(web): 定位逾時後自動重試`）。
- **理由**：prospec 產生的 Constitution 預設「commit 一律英文」，和 CLAUDE.md 的「一律繁中」互相矛盾，不同隊員的 AI 會各選一邊（審查發現 6）。隊員都讀中文，commit log 是 32 小時內同步進度的主要管道；type/scope 留英文讓工具可用。Ci 拍板。
- **影響**：`prospec/CONSTITUTION.md` 新增「Commit message 格式」MUST 覆蓋 Language Policy 的 commit 部分（Language Policy 的 Description 是產生的，不手改，以免 `prospec check` 報 drift）；`CLAUDE.md`、`AGENTS.md` user 段同步。

## 2026-11-07 ｜ D4 ｜ Demo 基礎設施：Android 實機 + GCP VM + Caddy HTTPS + Cloudflare 灰雲

- **決定**：demo 用 Android 實機。web＋api 部署在 GCP 專案 `tpe-codefest-2026-ci` 的 VM（`asia-east1-b`、`e2-medium`），Caddy 自動簽 HTTPS，網址 `https://codefest.ciyang.dev`（Cloudflare DNS only，灰雲）。APK 用 `--dart-define=CODEFEST_SERVICE_URL=https://codefest.ciyang.dev` 建置（變數在 TownPass fork `lib/config/codefest.dart`）。
- **理由**：發表只能投影實機畫面，不能賭會場 Wi-Fi 的 client isolation 和筆電區網 IP；固定 HTTPS 網址讓手機用行動網路也能開，瀏覽器定位也只在 HTTPS 可用。灰雲是因為 Caddy 要直接向 Let's Encrypt 驗證網域（細節見 `deploy/README.md`）。Android 不需開發者帳號（iOS 實機要改簽章，見 `docs/TOWNPASS-BUILD.md`）。
- **影響**：部署與 VM 由專人負責，`deploy/` 改動先問；APK 怎麼建見 `docs/TOWNPASS-BUILD.md`。demo 結束要停 VM 省錢（`deploy/README.md` 檢查清單）。凍結時 SHA 照 `docs/TEAM-PROTOCOL.md` §5 記。

## 2026-11-07 ｜ D3 ｜ 開發 harness 用 prospec，模式 sprint

- **決定**：規格層用 prospec v2.6（`prospec/`、`.prospec/changes/`），團隊規則採 team-harness 的 sprint 模式＋四條核心規則（secret 隔離、不編造、不可逆先問、決策留痕）。只有跨人介面與 demo 主流程才開 change。
- **理由**：5 人＋多個 AI session 並行，需要共同的規則入口（`CLAUDE.md`／`AGENTS.md`）；但 32 小時不適合每個改動都走完整規格。
- **影響**：`.prospec/changes/` 要進 git（不 gitignore），隊員才看得到彼此的規格。team-harness 的 `.mcp.json`（Linear）與 team-brain submodule 本次不掛。

## 2026-11-07 ｜ D2 ｜ Stack：Hono + Vue 3 + PostGIS + MapLibre/OSM，pnpm workspace

- **決定**：`apps/api` Hono（TypeScript）＋ Drizzle ＋ PostgreSQL/PostGIS；`apps/web` Vue 3 ＋ Vite ＋ Pinia ＋ MapLibre GL ＋ OSM 圖資；`packages/shared` 放前後端共用型別；docker compose 起 DB。
- **理由**：前端與官方 TownPass-Services 範例同為 Vue 3 + Vite + pnpm，好整併；全 TypeScript 讓前後端共用型別；地圖規則禁商用，MapLibre + OSM 是開源方案；PostGIS 處理開放資料的地理查詢。
- **影響**：新增依賴須為開源相容授權（見 `prospec/CONSTITUTION.md`）。

## 2026-11-07 ｜ D1 ｜ 兩個 repo：本 repo（微服務）＋ TownPass fork（App 殼）

- **決定**：微服務（web＋api）放本 repo；App 殼用 fork `https://github.com/ci-yang/TownPass`，分支 `codefest-2026`，只放加入服務入口、自訂 MessageHandler 等 Flutter 改動。
- **理由**：官方要求作品能從城市通開啟（WebView＋JS bridge）；Flutter 殼與 web 的建置、工具鏈完全不同，分 repo 互不干擾。說明會建議從最新 main 重新 fork。
- **影響**：交付時兩個 repo 都要公開、都附 AGPL 授權聲明；demo 凍結時兩邊各記一個 SHA（見 `docs/TEAM-PROTOCOL.md` §5）。

## 待決（決定後移到上面）

- 題目與要解的需求（11/7 公布）
- demo 主機＋備用機各是哪一支（平台已定 Android，見 D4）
- 成員 GitHub 帳號與分工確認（`docs/TEAM-PROTOCOL.md` §1）
