# 決策紀錄

> 「之後還會再問一次」的結論寫在這裡，最新的放最上面。一條三段：決定、理由、影響／何時重議。
> 聊天訊息會被洗掉，這裡不會。值以 `.env`／程式碼為準，這裡記的是「為什麼」。

## 2026-11-07 ｜ Prototype v4 ｜ 目的地作參考，路線只到資源

- **決定**：Ci 明確選 A：首頁呈現目前位置與資源，點資源直接畫「目前位置 → 資源」路線與距離；搜尋的目的地只作地圖標記。拿掉現行操作中的安排／確認／開始路線步驟。
- **理由**：這次核心互動是即時找資源，目的地提供位置參考；兩者必須有獨立狀態，選目的地不能誤觸路由，換資源不能消除目的地標記。
- **影響／重議**：取代 v3 的手動起點及多頁主流程。GPS 更新用於資源路線；示範或離線位置明確標示。規格與正式 `apps/` 留待確認 prototype 後調整。見 [v4 交接](handoff/2026-11-07-friendly-prototype-v4.md)。

## 2026-11-07 ｜ Prototype v3 ｜ 先試地圖選點，GPS 與行程起點分開

- **決定**：依 Ci 最新指示，先更新獨立 prototype 的地圖選資源、路線高亮與目的地搜尋；GPS 只顯示目前位置，明確帶入才作為行程起點。正式規格留待確認互動後修改。
- **理由**：使用者需要直接查看資源資訊及輸入目的地；查看沿線店家不應改掉既有路線。搜尋暫用開源 Photon 公開示範端點，不需金鑰；輸入查本地名冊，提交才發出查詢，GPS 與行程不外送。
- **影響／重議**：此為 prototype 的可逆選擇，不改正式服務 Stack 或部署。Photon 沒有 SLA，正式多人服務需再決定容量與自架方案；路由仍受本地快照範圍限制。見 [v3 交接](handoff/2026-11-07-friendly-prototype-v3.md)。

## 2026-11-07 ｜ D8 ｜ 先上前端 prototype，後端暫不實作

- **決定**：Ci 說明規格尚未完全確定，本輪收斂為將目前手機前端 prototype、討論規格與協作說明放進既有 GitHub 專案。以獨立分支和 PR 交接，讓成員操作並認領前端工作。
- **理由**：先確認四頁流程、沿途資源及互動需求，再決定正式 API 與資料模型；目前不需要以後端實作固定尚未收斂的產品決策。
- **影響／重議**：本輪不新增 API、資料表或正式多人服務。原型繼續使用真實開放資料快照、本機歷史、試填評論與雙角色互助；後端計畫僅為未定草稿，不列入本次 PR。團隊確認核心流程及資料需求後，再進 Prospec 計畫與實作站。

## 2026-11-07 ｜ D7 ｜ App 四頁、真定位與有依據的路線比較

- **決定**：依 Ci 新草稿改為手機 App prototype：地圖首頁 → 日期／歷史與起迄設定 → 最短／資源最多比較 → 行程地圖。沿用原五項資源功能，使用深色、亮綠及簡約卡片。起點預設使用裝置實際回傳的位置，定位失敗或超出示範範圍時由使用者選擇替代。
- **理由**：第一版桌面側欄不符合 Ci 的 App 使用順序，直線示意也不足以支撐路線比較。本版從已取得的 OSM 官方匯出建立本地步行候選路網；最短限定這份圖與固定站序，資源最多限定本次候選與一致去重店數，不能以假數字填兩張卡。
- **影響／重議**：GPS 不傳外部路由服務，明確保存行程／離線包才持久保留所選起點；歷史初始空白。當地路網、短接線與步行時間均須揭露限制；現場通行、正式導航與原生 APK 尚未驗證或交付。規格在既有 Story 受控 amendment，正式 Stack 與服務部署不變。

## 2026-11-07 ｜ D6 ｜ 友善同行：先驗證沿途資源與完整離線包

- **決定**：依 Ci 本輪提出的五項功能，產出「友善同行」互動 prototype 與 `enable-friendly-routes` 第一版 Story。五項全部展示；正式服務優先篩選、多站路線、搜尋範圍及離線，公開評論與多人互助列下一階段。原型獨立放在 `docs/prototypes/friendly-route/`。
- **理由**：「拿不到」先對準已有手機、網路或電力受限的市民。官方名冊已有位置及服務標記，缺少消費條件、即時可用狀態與品質回報；不能以標籤推定免費免消費。完整離線包須含底圖，才可驗證斷網後仍可讀資訊。
- **影響／重議**：原型以真實地方名冊與 OSM 向量快照展示，路線為明示直線示意；評論為本機試填、互助為本機雙角色，不通知真人。正式 Stack 維持 D2，本次 Leaflet 僅用於獨立靜態原型，不改 TownPass bridge 或部署。正式路由、WebView 離線、公開評論與互助治理在 `prospec-plan` 再確定；產品成效仍待目標族群實測。

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
