# 決策紀錄

> 「之後還會再問一次」的結論寫在這裡，最新的放最上面。一條三段：決定、理由、影響／何時重議。
> 聊天訊息會被洗掉，這裡不會。值以 `.env`／程式碼為準，這裡記的是「為什麼」。

## 2026-11-08 ｜ D13 ｜ 三急首頁視覺採「緊急停止鈕」，全 App 改用城市通官方色票

- **決定**：三急首頁的三顆大按鈕做成真實緊急停止鈕（e-stop）：直排三列，每列一顆蘑菇頭＋底座＋標示環，右側大字標籤（廁所／充電／網路）；按住時頂部沉進底座，放開後卡在按下位置並短震動，停約 180ms 讓人看見再進結果卡，回首頁時彈回。視覺原則沿用主工作樹 D12 的 prototype（`docs/prototypes/rescue-buttons-estop/`，在主工作樹、尚未進本分支）：低飽和、同色系柔和陰影，不做亮球高光與貼紙式裝飾。配色不再用 D12 v3 的自訂綠橘藍，全 App 改用 TownPass `tp_colors.dart` 官方 ramp（primary teal、secondary amber、grayscale、red、orange）；類別色為廁所 primary-500、充電 secondary-500、Wi-Fi primary-800、無障礙 grayscale-700；黃色標示環改為鋼環。字體 Roboto＋PingFang TC，字級只用 36／24／18／16／14／12，字重只用 400／600。同一輪一併定案：dark 主題的選中 chip 一律用深字；首頁「看地圖」一律進空狀態（不帶類別、不帶選取）；地圖上點 pin 只選取、不開詳細資訊；地圖面板刪掉 START 模式卡，城市雷達入口移到 footer。
- **理由**：Ci 要「有儀式感、不要太 AI、有按下去的急救感」，緊急停止鈕是大家都認得的實體物件，「按下卡住」讓人確定自己按到了哪一顆。服務跑在台北通 WebView 裡，用城市通官方色票、字體與字級，畫面才像宿主 App 的一部分，不像外掛頁。dark 主題 primary-600 與 grayscale-500 上的白字對比只有 3.79 與 3.66，不到 4.5，所以改深字。首頁「看地圖」若沿用上一趟結果卡的類別與選取，使用者會以為地圖只有那一類，空狀態才符合「第二層自己選」的規格。
- **影響**：主工作樹 D12「首頁以外頁面配色不跟著改」由本條取代，全 App 都走官方 ramp。官方 ramp 寫成 `docs/prototypes/friendly-route/app-ui.css` 的 `--tp-*` token。地圖圓點描邊改用類別的 text token，淺色底圖上的描邊對比要維持 3:1 以上。`navigator.vibrate` 在 TownPass WebView 的行為仍未實機驗證。

## 2026-11-08 ｜ D12 ｜ 三急版已發布：分享頁、APK、正式站三件套

- **決定**：Ci 2026-11-08 凌晨授權「直接做完」，lead session 代 Codex 完成實作與發布。分支 `feat/three-urgencies-flow`（App 本體 `5da7250`）發布為分享頁 `https://ci-share.pages.dev/d537f3d9f5299fc6/`、TownPass APK Release `three-urgencies-demo-20261108`（內嵌該分享頁），並以本機 wrangler 手動部署到正式站 `https://taipei-friendly-platform.jason21131.workers.dev`（source `d50e0f4`，前版 Worker versionId `c0c9590b-07fe-419d-8427-b24963fd663a` 可 rollback）。舊分享 token `cc521b0047361278` 與舊 APK 不撤。
- **理由**：Ci 醒來要能直接點到成果；正式站走 main 的 Actions 需 merge 與尚未設定的 `CLOUDFLARE_API_TOKEN`，手動部署可回滾且上一輪已用過。
- **影響**：正式站現在與 main 不一致（main 仍是整合版 c0486bb）；PR 收進 main 時會再觸發自動部署。Android 實機、翻譯校對、prospec review 的 round-cap escalation 都待 Ci 處理，見 `docs/handoff/2026-11-08-three-urgencies.md`。

## 2026-11-08 ｜ D11 ｜ 主流程改為「三急首頁 → 最近一家結果卡 → 開口卡」，地圖降為第二層，以 survival-highlights 為底

- **決定**：副局長評 v6「很基本、沒必要做成 app、要有亮點」後，Ci 以分鏡「人有三急」（claude.ai artifact `PRJUafqt1tcodcbgtk4yCh`）定調：首頁只有三顆大按鈕（廁所、充電、網路），按下直接出直線最近一家的結果卡（帶我去／開口卡／看地圖）；開口卡為全螢幕雙語大字，給店員看中文、給自己看母語。現有地圖、目的地搜尋、多選、清單全部保留但降為第二層「看地圖」，不刪。實作底採 `design/survival-highlights`（e479b2e，PR #8；含 stitch 骨架、cicd 管線、本機步行路線與城市生存雷達四亮點），三顆按鈕分別接廁所倒數、電量生存圈、Wi-Fi 密度；房價含金量不進主流程（去留待 Ci）。規格在 `.prospec/changes/add-three-urgencies-flow/`，`enable-friendly-routes` 仍是基礎規格不重述。公眾 Wi-Fi 熱點不顯示開口卡（審查後補進規格）。
- **理由**：技術完整度與穩定合計 50 分都在現有那層，刪掉等於丟分；改順序不改邏輯最安全。開口卡是面對面、零上傳、零配對，與撥號鍵同層級，不屬 D6 禁止的經平台互動（lead 判斷，待 Ci 或主辦確認）。
- **影響**：D7 的「原型分支＝v4」更新為本分支；20 MB 路網不得阻擋首頁與結果卡；印尼文、越南文、英文句子須母語者校對後才上架；demo 一律 Android。

## 2026-11-07 ｜ 目的地道路、地圖展開與 TownPass 首頁

- **決定**：依 Ci 本輪實機回饋，選目的地後顯示步行道路與沿線資源；保留既有 Stitch 介面，修正初始搜尋焦點、縮小 START，加入地圖展開／浮動面板收合。原生根頁恢復 TownPass 首頁，友善同行經入口進入，明確返回台北通與網頁上一頁分開。
- **理由**：只有目的地旗標無法判讀沿途資源；固定小地圖與大按鈕壓縮手機操作空間；服務須保留宿主 App 導覽。
- **影響／重議**：新 change 為 `.prospec/changes/improve-route-experience/`，覆蓋 D6「目的地僅方向」部分；原凍結 proposal 不回寫。GPS 不外送的限制持續有效，重用本機 OSM 圖與背景 Worker，只算最短步行道路。Ci於回覆明確確認本機方案，建置期擴充固定臺北市開放道路資料，範圍外或不連通仍明確提示，全市資源名冊不縮減；沿線採幾何兩側250m，並非可達性或無障礙保證。公開路由服務不採用；本輪不宣稱修復 iOS 離線快取限制。

## 2026-11-07 ｜ Cloudflare 根網址直接呈現 App 本體

- **決定**：Ci 明確要求「我要直接是 app 本身，不要有其他畫面」。Cloudflare 根頁直接發布 D7 指定的純 JS App，`dist/app` 只含 runtime 與必要資料、授權及版本資訊；Vue 首頁與分析／規格頁不列入產物，舊入口導回 `/`。
- **理由**：使用者拿到的網址必須直接進入產品，發布產物應與既定作品本體一致。
- **影響／重議**：沿用既有 Worker／D1／HTTPS 與回退機制，改發布來源及 smoke 驗收；CI/CD 同步發布 App。App 內部主流程、凍結 proposal、API 契約與 APK 本輪不變。離線套件版本納入來源 SHA，讓快取的首頁 stamp 與發布版本一致；代價是文件 commit 若部署也會重新下載套件。更新失敗保留前版完整套件，日後若需減少下載量再將發布識別與內容版本拆分。這是修正 D7 既定本體的部署接線，不另改產品規格。自動部署的專用 token 確認仍獨立處理；既有本機 Wrangler 登入可執行本輪已授權部署。

## 2026-11-07 ｜ Cloudflare CI/CD 自動部署

- **決定**：Ci 要求提供 Cloudflare 入口並完成 CI/CD。沿用既有 `taipei-friendly-platform` Worker 與 D1；PR 只測試，main push／手動 main dispatch 先跑相同 CI，成功才發布。憑證只放 GitHub Actions secret。
- **理由**：讓成員合併後能更新平台，不依賴某台電腦的 Wrangler OAuth；重用已驗證的部署、smoke 與回退腳本。
- **影響／重議**：checkout 與發布固定同一 SHA，遠端 main 前進就拒絕過期 run，發布序列化且不取消遠端寫入。依上方後續決定，發布範圍為純 JS App／Hono／D1；APK 另行發布，D6／D7 產品方向不變。此設定改動不新增產品 API 或 demo 主流程，未另開 Prospec change。

## 2026-11-07 ｜ 分支整合狀態

Ci 本輪授權整理分支、取得最新 main、經 Claude Code review 後合入 main。整合保留成員 `21bc1f3` 的全市資料管線、平台分支的部署基礎，以及原型分支的完整 App；現行主流程依下列 D6／D7 與凍結 proposal `6da4a77f904db5877d10fe8a54adf90356a178dc`。品牌推定保留在歷史資料實驗，不進現行正式分類；平台仍為獨立部署入口，合併不等於重新部署或 APK 更新。

下方保留不同 session 的歷史決策原文；D6／D7／D9 曾重號，應連同標題與版本閱讀，不能只靠編號判定現行規格。

## 2026-11-07 ｜ D7 ｜ 程式本體＝原型分支（v4），由 Codex session 實作；規格由 lead session 維護

- **決定**：作品本體以原型分支（worktree `tcf-prototype-map`，分支 `feat/prototype-resource-map`，目前 v4）為準，實作交 Codex session；lead（Claude）session 只維護 `docs/DECISIONS.md` 與 `.prospec/changes/enable-friendly-routes/` 規格，不動原型程式。Cloudflare 平台分支與 main 骨架不是本體，用途待定。（Ci 2026-11-07 約 17:20）
- **理由**：原型已可操作且持續迭代，重做 Vue 版今晚來不及；規格與實作分 session 避免兩邊同時改同一份檔。
- **影響**：部署目標、APK 內建網址（`https://codefest.ciyang.dev`）要跟原型的部署方式對齊，尚未決定，列待決。

## 2026-11-07 ｜ D6 ｜ 題目方向「拿不到」：友善資源地圖，主流程單一、離線為主功能、不做任何互動功能

- **決定**：作品「友善同行」主流程固定為：開啟即定位並顯示地圖 → 可搜尋目的地 → 底部幾個類別鈕（廁所、充電、Wi-Fi、無障礙等），按下直接在地圖上 highlight 該類店家。**離線可用是主功能**，規格缺的要補。**互助、品質回報、協助者模式、任何使用者之間或使用者對店家的互動一律不做**（Ci 2026-11-07 約 17:10 拍板）。
- **理由**：決選配分落地 30、應用 25，創意只佔 10；主辦方明講主流程要單純、評審可能現場關網路。政府端對使用者產生內容與互助功能有安全疑慮（個資、濫用、維運責任），做了會變成問答箭靶。
- **影響**：prospec change `enable-friendly-routes` 要改：US-3（回報）、US-5（互助）移除；US-4（離線）升為主功能並補全市點位快取與無網路導引；多站行程、日期與歷史降為次要。資料面可併入公廁、捷運無障礙等公家資料集以達全市覆蓋。原型與平台分支要收斂到一條（待 D7）。

## 歷史決策（保留來源脈絡）

## 2026-11-07 ｜ D10 ｜全市官方資源加上明示的常識推定

- **決定**：取消 D9 的地方框選與「完全不做品牌推定」限制。原型載入全市 993 筆友善店家、1,531 筆列管公廁與 3,305 個 Taipei Free AP（同類型同址合併為 2,036 點）。對其中麥當勞、摩斯、星巴克、路易莎、肯德基與漢堡王等 139 個既有點位，加上 Wi-Fi、充電、廁所的橘色「推定」標籤。
- **理由**：使用者希望 DEMO 不只顯示小範圍點位，也能提供日常生活中可用的線索。純移除這些常識會降低實用性；直接當成官方保證又會誤導，因此以服務層級分開呈現。
- **影響／重議**：全市共 4,560 個官方資源點；推定不新增店家、不改寫官方證據，畫面與文件皆提醒「可能需消費、分店有差異」。加油站廁所仍只採列管公廁資料，不推定手機充電或 Wi-Fi。若得到單店官方服務資料，將對應推定升級為官方證據。路網快照仍保留信義安和至台北 101 示範廊帶，路網外只查資源、不計算行程。

## 2026-11-07 ｜ D9 ｜ 以官方公廁與 Taipei Free 補足資源，不用品牌推定

- **決定**：原型除友善店家清冊外，加入臺北市公廁點位及 Taipei Free 新版熱點的同範圍快照。每筆資源保留自己的來源、更新日與證據；Taipei Free 排除行政機關並合併同類型同址 AP。充電插座只採友善店家清冊的明示標記。
- **理由**：友善店家清冊沒有涵蓋示範區內的麥當勞、摩斯與中油加油站，但官方公廁資料能直接證明其中部分地點有列管公廁；Taipei Free 則能直接證明免費網路熱點。品牌常識、連鎖店政策或地圖評論不足以證明單店現況，也不能用來推定免費插座。
- **影響／重議**：原型目前有 324 個官方資源點位（103 友善店家、104 列管公廁、117 Taipei Free 地址點位），畫面與文件均分開標示資料源。營業、免消費條件與現場可用性仍不保證；若要納入插座、營業狀態或評論驗證，必須另有可立即利用且可合法再用的單店資料源，再重議合併規則。

## 2026-11-07 ｜ D9 ｜ Ci 建正式平台，組員調整 prototype 與產品規格

- **決定**：依 Ci 本輪指示，恢復實際前後端與部署工作，採 Cloudflare Workers + Static Assets + D1；MapLibre 顯示開放 OSM 快照，路線在裝置計算。另以既有 TownPass fork 建 Android APK。正式平台 change 為 `deploy-friendly-platform`，組員持續持有 prototype 與 `enable-friendly-routes`。
- **理由**：本輪 readonly 名冊與裝置路由可用 Cloudflare 同源部署，不需要維護新的 VM 或公開現有 PostgreSQL。D1 沒有 PostGIS，使用版本化地方名冊與窄 repository，保留既有 Node/PostGIS API。Claude Code Opus 5.5 已參與架構比較；獨立架構與任務複核列出的逾時、log 與回退邊界納入計畫。
- **影響／重議**：先發獨立 workers.dev；正式 hostname 未決前，既有 GCP／DNS／資料保持不變。D8 的「後端暫不實作」由本輪指示更新；評論、真人互助、身分與治理仍待組員定規格，不擅自設公開寫入政策。地方路網不等於全市導航；正式 Vue 尚未完成整包離線與 Android 實機驗收時如實標示。之後若需要全市路由、長任務或 PostGIS，再評估 GCP 容器服務。

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
- APK 內建網址是否均指向 Cloudflare App 根頁，與 TownPass 實機離線重開驗證
- 多站行程、日期與歷史是完全移除還是留第二層（見 D6）
- 分工確認（`docs/TEAM-PROTOCOL.md` §1）；GitHub 帳號已確認：bboyyan／shimo23333／hohshen／imthe71，邀請待接受
