# 決策紀錄

> 「之後還會再問一次」的結論寫在這裡，最新的放最上面。一條三段：決定、理由、影響／何時重議。
> 聊天訊息會被洗掉，這裡不會。值以 `.env`／程式碼為準，這裡記的是「為什麼」。

## 2026-11-08 ｜ D15 ｜ 補助通收台北服務通補助類案件（開放資料集）並加「估算可領金額」

- **決定**：
  1. 台北服務通：從政府資料開放平臺「臺北市政府台北服務通申辦服務及承辦單位資訊」（研考會，<https://data.gov.tw/dataset/157468>，政府資料開放授權條款第 1 版）的 CSV 取補助類個人申請案件 115 項，存成靜態 JSON（`apps/newapp-api/src/data/catalog-subsidies.json`），執行期不連線。新增 `kind: 'catalog'`，序號 301 起（官方網頁整理改為 201～300）。篩選：名稱含補助、津貼、減免、扶助、救助、獎勵金、慰問金；名稱排除規則沿用 `origin/feat/benefits-only` 的 `sync-benefit-catalog.mjs`（另加「請款」）；再排除該分支 37041c0 判為停收的 9 項、申請人是雇主或團體的 20 項、與既有 25 項重複的 18 項。資料集沒有資格與金額欄位，所以不依四題比對：不進可能符合／不符合，結果頁放在最後的摺疊區「台北服務通其他服務 N 項（未依四題比對）」，全部補助頁多一顆「台北服務通」膠囊，詳情標資料來源與下載日。
  2. 估算可領金額：結果頁加一塊，標「估算」並附算法（月額 × 12、每學期 × 2、一次性算一次、「最高」照上限）。只加總可能符合且官方原文有明確金額的項目，每條算法的數字必須逐字出現在原文（測試檢查）；核心資格四題沒問到（新生兒、原住民身分、租屋等）或金額依個案核定的項目不加總，畫面列出未計入項數與逐項原因。
- **理由**：使用者 2026-11-08 指示把 `origin/feat/benefits-only` 先前沒收的 165 項候選與漏領金額「全收」，推翻 D14 的「不收」。查到研考會公告的開放資料集，所以改用開放資料，不收分支的爬蟲版（分支的 165 項是腳本打 service.taipei 未公開 API 取得，比賽規則禁止爬蟲）；同步／抓取腳本不帶進來。停收判斷是分支依案件頁受理狀態做的，這裡只沿用「排除哪幾個案件編號」的結果，不收它的內容。估算只算四題能確認核心資格的項目，免得 65 歲長者的總額算進生育補助。
- **影響／重議**：清單 28 → 143 項；示範情境可能符合數不變（12、14、19），估算分別約 NT$37,392～109,860、48,588～113,820、84,000～99,000。快照不會自動更新，資料集改版時要重跑篩選（腳本不進 repo，篩選結果與排除清單寫在 JSON `meta`）。序號依案件編號排序配給，重新篩選後序號可能位移，收藏要注意。規劃文件 `.plan/.1108/prd-2-adr.md` ADR-036。

## 2026-11-08 ｜ D14 ｜ 補助通加入「官方網頁整理」15 項與「實際補助」原文

- **決定**：補助清單從 13 項擴成 28 項：開放資料 10 項 → 官方網頁整理 15 項（序號 201～215，`kind: 'curated'`）→ 模擬資料 3 項。序號區段 1～100 開放、101～200 模擬、201 起官方網頁整理。每項多 `benefitText`（實際補助原文，查不到可核對金額為 null）、`sourceUrl`（原文所在頁）、`verifiedAt`（查證日）；開放資料用人工核對的原文補上（序號 4 為 null），模擬資料三欄都是 null。兩份整理檔放 `apps/newapp-api/src/data/`，後端靜態載入並用 zod 驗證，驗證失敗當整理失敗、沿用上次結果。回應保留 `source`（開放資料集，前端舊用法不變），另加 `sources` 列三種來源與項數。比對不看資料類型，一律照四題；開放資料與官方網頁整理排同一級，模擬資料在後。畫面：卡片右側有原文時寫「實際補助」並截成兩行內；標籤寫「官方網頁整理 · 可能符合」；詳情加「實際補助」「資料來源」兩列，次鈕改「查看官方來源」；首頁「臺北市 N 項」仍只算開放資料，另一行寫「另含 15 項官方網頁整理的補助」；資料來源頁列三種來源，逐項列官方網頁整理的網址與查證日。
- **理由**：使用者 2026-11-08 給了整理好的補助與來源（「這個branch …裡面寫了更多的補助項目與來源, 請幫我想辦法整合進去」），裁決「收，標『官方網頁整理』」並核可資料模型變動。165 項台北服務通候選是爬蟲、漏領金額加總是估算，都不收（比賽「不准爬蟲」「不編造」）；金額只照官方原文顯示。規劃文件 `.plan/.1108/prd-2-adr.md` ADR-035。
- **影響／重議**：示範情境三組的可能符合數變成 12、14、19（原 2、2、8）。官方網頁整理的年齡、身分條件是人工結構化，部分項目（例如生育、育兒、托育）沒有年齡門檻，所以 65 歲長者也會列「可能符合」，靠「還需確認」說明；開放資料門檻是舊年度、官方網頁整理是 115 年度。官方頁面改版時要重新查證並更新 `verifiedAt`。

## 2026-11-08 ｜ D13 ｜ 補助通 v3：拿掉底部導覽與搜尋、年齡區間改 18–25／26–39／40–64、會員面板只顯示台北通三欄位

- **決定**：補助通改照 v3 參考圖：首頁、試算頁 `/calc`、結果卡片清單、全部補助 `/all`（依六個分類）、詳情彈窗；任何頁面都沒有底部導覽列，也拿掉搜尋；頂列右邊是書籤鈕（我的珍藏）與頭像鈕（會員面板）。年齡區間改為 18歲以下、18–25、26–39、40–64、65歲以上，只有 65歲以上視同老人。會員面板只顯示台北通串接狀態、由生日推算的年齡區間與戶籍縣市區，不讀不顯示姓名、身分證、email、電話，沒有 bridge 時顯示「未串接台北通，請手動填寫」；台北通資料的讀取範圍與不送出不儲存照 D12。參考圖上的金額、截止日、人數與宣傳字都不放。
- **理由**：使用者 2026-11-08 給新版 UI（「又有做新本的ui了, 請盡量都按照新版處理」「下面的bar 幫我移除」「會員個資串台北通」）並事先「核可」。不放圖上的數字是比賽「不編造」規則。規劃文件 `.plan/.1108/prd-2-adr.md` ADR-031～034，實作分工 `.tmp/v3-impl/BRIEF.md`。
- **影響／重議**：示範情境改 65+、40-64、26-39，可能符合數 2、2、8（程式實算確認）；原型逐頁來源表等原型改完再同步。

## 2026-11-08 ｜ D12 ｜ App 名稱「補助通」；台北通帳號加讀區只顯示；收藏只存序號於手機

- **決定**：newapp（補助初篩查詢）對外名稱定為「補助通」，頂列「補助通 · 智能試算」。台北通 `userinfo` 除了生日與第一筆地址縣市，另讀 `addresses[0].town`（區），只在手機上顯示成「臺北市 · ○○區」，不參與比對、不送出、不儲存；取代 D11 的「只取生日與縣市」，其餘（不讀不顯示 `idNo`、`realName`，不送後端不儲存，比賽版標「示範帳號資料」）照舊。新增收藏：只把補助序號陣列存在手機 localStorage `newapp.favorites`，不存答案、不送伺服器。
- **理由**：使用者 2026-11-08 依三張參考圖重做 UI 並定名（「補助通 是這個app的名稱」），第三輪選「讀 town 顯示區，只在手機顯示、不送出、不儲存」「收藏做，存在手機」，看過原型後「原型可以」。規劃文件 `.plan/.1108/prd-2-adr.md` ADR-023、ADR-026、ADR-028。
- **影響／重議**：localStorage 鍵從一個變兩個（`newapp.subsidyList`、`newapp.favorites`）；換成正式台北通帳號時要驗地址排序與 `town` 欄位，並拿掉「示範帳號資料」標示。

## 2026-11-08 ｜ D11 ｜ 補助初篩查詢讀台北通帳號：只取生日與縣市，demo 標示範帳號

- **決定**：補助初篩查詢只在前端呼叫台北通 bridge `userinfo`，只取 `birthday`（算實歲）與 `addresses[0].city`（臺北市即設籍）帶入年齡與設籍，市民可修改；不讀也不顯示 `idNo`、`realName`，帳號資料不送後端、不寫任何儲存。比賽版開始頁一律標「示範帳號資料」。
- **理由**：少填兩題；個資最小化並維持「答案不離開手機」。開源 TownPass 殼的 userinfo 永遠回固定假帳號（`docs/townpass-integration.md` userinfo 段），不標會被誤認成真實個人化。使用者 2026-11-08 定案原型時拍板（`.plan/.1108/prd-2-adr.md` ADR-019）。
- **影響／重議**：換成正式台北通帳號時，要先驗 `birthday` 格式與地址排序，並拿掉「示範帳號資料」標示。

## 2026-11-08 ｜ D10 ｜ 補助初篩查詢取代線上 demo 服務

- **決定**：newapp（補助初篩查詢：市民回答四題，手機比對臺北市社會救助補助項目開放資料）取代 `https://codefest.ciyang.dev` 現有服務，APK 不重建；斷網只保證「進入時有網路，之後斷網或伺服器失敗仍可比對」，不做 service worker。規劃文件在 `.plan/.1108/`。
- **理由**：發表只能投影台北通實機畫面，沿用 D4 的網址最省；另開子網域要改 DNS、Caddy 並重建 APK。service worker 在台北通 WebView 未驗，賽程內風險高。使用者在 SA 斷點拍板。
- **影響／重議**：`deploy/` 由部署負責人改（newapp 的 Dockerfile、compose 服務、反代 `/api/v1/subsidies` 到 newapp-api），AI session 不動；原本的友善同行不再在線上。

## 2026-11-08 ｜ D9 ｜ 第二組前後端骨架（暫名 newapp）

- **決定**：monorepo 新增 `apps/newapp-api`（`@app/newapp-api`，Hono，port 8788）與 `apps/newapp-web`（`@app/newapp-web`，Vue 3 + Vite + vue-router，port 5174），共用 `packages/shared`（新增 `newapp.ts`）。環境變數一律 `NEWAPP_*`／`VITE_NEWAPP_*` 前綴。名稱是暫名，定案後全域替換 `newapp`。
- **理由**：新專案要跟既有 `@app/api`／`@app/web` 同時在本機跑，port 與 env 錯開才不會互撞；stack 照 D2 精簡版，DB、MapLibre、TownPass bridge、Dockerfile 等需要時再加，避免先複製用不到的東西。
- **影響／重議**：根目錄指令 `pnpm dev:newapp`。不動既有 app、docker compose 與 `deploy/`。要部署或接 DB 時再另議。

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
