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

## 2026-11-07 ｜ D7 ｜ 程式本體＝原型分支（v4），由 Codex session 實作；規格由 lead session 維護

- **決定**：作品本體以原型分支（worktree `tcf-prototype-map`，分支 `feat/prototype-resource-map`，目前 v4）為準，實作交 Codex session；lead（Claude）session 只維護 `docs/DECISIONS.md` 與 `.prospec/changes/enable-friendly-routes/` 規格，不動原型程式。Cloudflare 平台分支與 main 骨架不是本體，用途待定。（Ci 2026-11-07 約 17:20）
- **理由**：原型已可操作且持續迭代，重做 Vue 版今晚來不及；規格與實作分 session 避免兩邊同時改同一份檔。
- **影響**：部署目標、APK 內建網址（`https://codefest.ciyang.dev`）要跟原型的部署方式對齊，尚未決定，列待決。

## 2026-11-07 ｜ D6 ｜ 題目方向「拿不到」：友善資源地圖，主流程單一、離線為主功能、不做任何互動功能

- **決定**：作品「友善同行」主流程固定為：開啟即定位並顯示地圖 → 可搜尋目的地 → 底部幾個類別鈕（廁所、充電、Wi-Fi、無障礙等），按下直接在地圖上 highlight 該類店家。**離線可用是主功能**，規格缺的要補。**互助、品質回報、協助者模式、任何使用者之間或使用者對店家的互動一律不做**（Ci 2026-11-07 約 17:10 拍板）。
- **理由**：決選配分落地 30、應用 25，創意只佔 10；主辦方明講主流程要單純、評審可能現場關網路。政府端對使用者產生內容與互助功能有安全疑慮（個資、濫用、維運責任），做了會變成問答箭靶。
- **影響**：prospec change `enable-friendly-routes` 要改：US-3（回報）、US-5（互助）移除；US-4（離線）升為主功能並補全市點位快取與無網路導引；多站行程、日期與歷史降為次要。資料面可併入公廁、捷運無障礙等公家資料集以達全市覆蓋。原型與平台分支要收斂到一條（待 D7）。

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

- 題目官方原文尚未入檔（方向見 D6，只有 Ci 轉述）
- demo 主機＋備用機各是哪一支（平台已定 Android，見 D4）
- 原型（v4）的部署目標與 APK 內建網址如何對齊（見 D7）
- 多站行程、日期與歷史是完全移除還是留第二層（見 D6）
- 分工確認（`docs/TEAM-PROTOCOL.md` §1）；GitHub 帳號已確認：bboyyan／shimo23333／hohshen／imthe71，邀請待接受
