# 2026 臺北秋季程式設計節 · 城市通微服務大黑客松 — 說明會投影片萃取

來源：`/Users/ciyang/Downloads/2026 城市通入門指引 2.html`（賽前工作坊 10/25，2026 版，65 頁；單檔 HTML，21 張圖皆為裝飾／App 畫面截圖，文字全在 DOM，無需 OCR）。
頁碼規則：以投影片講稿標示的「Slide N of 65」為準（封面 = 第 1 頁）。標 `[講稿]` 者出自 speaker notes。
主辦：臺北市政府資訊局；承辦：台北市電腦商業同業公會。
**重要缺口**：投影片未載明今天的逐時時程、截止時間、評審配分、題目內容。規則細節出自「競賽須知（115.08.27 版）」，網址見第 64 頁，本檔未取得其原文，需另行閱讀。

---

## 1. 賽程與當天安排

- 今天 11/7 在天母開賽（第 65 頁「11/7 天母見」；第 63 頁清單「賽前準備清單（11/7 前）」）。
- 第二天發表：初選每隊約 2 分鐘；決選約 5 分鐘 + 問答；各隊須上台發表，方可參加評選（第 60 頁，規則來源：競賽須知第六、七條）。
- 發表方式：投影作品實際運作的畫面，不使用簡報（第 60 頁）。[講稿] 發表時投影手機畫面，賽前先用手機投影練習，測試鏡像、線材與網路。
- 題目：[講稿] 第 35 頁「比賽當天拿到題目時，也可依此順序思考」→ 題目疑似當天公布 [不確定]。第 47 頁「第一小時：發想題目方向」。
- 建議 2 分鐘發表節奏（第 60 頁，建議非規則）：0:00 題目與選定需求（一句話）→ 0:15 使用情境（誰、何時用）→ 0:30 實機操作，從城市通進入完成一條流程 → 1:40 資料來源與技術實作（20 秒）。主辦建議內容：說明題目 → 創意來源與應用場景 → 開發項目、資料來源與技術細節 → 實際運作展示。
- 建議時間分配（第 47 頁）：第一小時發想；最後兩小時撰寫文件、整理 repo。
- 工作人員：[講稿] 深夜疲累時有需要隨時聯繫工作人員（第 7 頁）。
- 報到：查驗政府核發身分證件（第 63 頁）。
- 得獎後：2 週內收到 email 整併通知；整併以小幅修改、刪減為主，範圍限比賽期間作品；之後回來黑客松分享經驗（第 62 頁）。

## 2. 評審角度（配分未提供）

- 配分表：投影片未提供 [不確定：可能在競賽須知]。
- 作品評估六個面向（第 38 頁；決選問答常圍繞這些）：
  - 政府端（數位治理）：安全（個資保護、防攻擊、能被監督）、創新（新想法、鼓勵創造、能持續改）、有感（民眾有感、解決需求、可擴充）。
  - 市民端（民眾需求）：參與（方便表達意見、參與社區、民主自決）、便利（數位歸戶、無縫接軌、主動推薦）、透明（用語淺白、即時更新、指引清楚）。
- [講稿] 第 40 頁：清楚標示資料出處，呼應初選「資料來源正確」的項目。
- 決選設有問答，AI 產生的程式碼至少完整閱讀一次以便說明設計考量（第 48 頁）。
- 介面是評審第一印象，善用 Figma UI Kit（第 28 頁）。
- 評審可能在**關閉網路**狀態下現場出題，驗證 LLM 功能（第 49 頁）。
- 資訊局接手維運：思考資料誰更新、問題誰處理（第 39 頁）。好作品五特點：需求明確、資料來自開放資料、主流程單純範圍聚焦、善用 App 原生能力、README 完整（第 45 頁）。

## 3. 交付物（第 61 頁；規則來源競賽須知第五、六、十條，後四項為「建議」）

規定：
1. 所有原始碼（微服務、後端、修改後的 TownPass）
2. LICENSE：AGPL-3.0，附主辦指定授權聲明，repo 維持公開（得獎公布後至少一年；第 6 頁）
3. 建議：README（依其可完成建置）、資料來源清單（名稱、連結、註明模擬資料）、第三方套件清單（名稱 + 授權）、使用 AI 時的模型揭露（名稱、版本、量化格式、推論框架、來源）
- 建議第一天就建立 repo 並設為公開（第 61 頁、第 11 頁 Git）。
- 比賽期間作品放公開 repo，並附主辦指定的授權聲明（第 6 頁）。
- 選套件前確認 LICENSE：MIT、BSD、Apache-2.0 可納入 AGPL 專案；標示「僅供個人使用」「不得再散布」者改用其他套件（第 6 頁）。
- 報名表單／影片／簡報：投影片未提及；且明文「不使用簡報」[不確定是否仍需繳交]。

## 4. 規則重點（今年新增／限制）

- 開源、免費模組：請選用開源、免費的套件（第 5、21 頁）。
- 地圖：必須用開源方案，如 Leaflet、MapLibre 搭配 OpenStreetMap 或國土測繪中心（NLSC）圖資；不可用 Google Maps／Mapbox（第 36、45 頁）。AI 常推薦 google_maps_flutter，提問時先說明要開源免費套件（第 48 頁）。
- 資料：核心資料須為合法開放資料並註明出處；非核心資料可用模擬資料；README 與 Demo 標示資料集名稱與連結（第 40 頁）。
- AI（第 49 頁）：
  - 允許：開發階段使用雲端 AI（企劃、寫程式、除錯、整理資料）；執行時 LLM 推論在裝置端；一般後端（登入、DB、檔案、排行榜、同步）；預先生成的固定文字／圖片／程式碼並如實說明。
  - 禁止：執行時使用雲端 API 或遠端模型做推論；使用者輸入與作品資料的 LLM 推論須在裝置端；不得使用危害國家資通安全清單所列 AI 工具與模型（含大陸廠牌）。
  - README 須揭露模型名稱、版本、量化格式、推論框架、來源。
  - 不做 AI 也可：沒有 AI 功能也能做出好作品（第 52 頁）。
- 部署需「可移轉、可維運、可上架」→ 準備 Dockerfile 即可（第 54 頁）。部署平台不限，請使用免費方案。
- 行為守則（Contributor Covenant 2.1 改編）競賽現場適用（第 7 頁）。
- 個人電腦和設備自行保管（第 63 頁）。

## 5. 「城市通」是什麼（TownPass）

- 台北市政府資訊局的開源市民 App（Flutter）；內建帳號、定位、通知、掃碼。原稱「台北通」，投影片混用（第 9、41 頁）。
- 參賽作品通常 = 一個**微服務網頁**（在 WebView 內執行，語言／框架不限）+ 視需求的後端（語言不限）+ 開放資料。App 本身不一定要修改（第 9 頁）。
- 授權：城市通本身 GPL-3.0；參賽作品用 AGPL-3.0（第 6 頁）。
- 官方範例前端：Vue 3 + Vite + Pinia + Tailwind（[講稿] 第 9 頁）；官方列出 11 項微服務可參考（第 34 頁）：申辦服務、找地點、Q&A、優惠券、臨櫃叫號、市政訊息訂閱、有話要說、災情通報、警政報案、圖書館服務、繳費服務。

## 6. 平台、版本、環境（第 10–16 頁）

- Flutter 3.47.6（去年 3.24.0），`.fvmrc` 指定，用 FVM；Dart SDK 3.13+；iOS 最低 15（UIScene lifecycle、Swift Package Manager）；Android：AGP 9.1.0、Kotlin 2.4.0、Gradle 9.3.1，需 Java 17。
- TownPass main 已於 10/6 升級至 3.47.6，建議直接 clone 最新；去年 fork 過的隊伍建議從最新 main 重新 fork 再搬改動（第 14 頁）。
- 工具：VS Code、Android Studio、Xcode（iOS 需 Mac；Intel Mac 會顯示即將停止支援，建議 Apple Silicon）、FVM、Git、Docker、Postman、Chrome DevTools。建議規格 8 核心／16 GB RAM／60 GB 硬碟。裝置端 AI 需實機。
- 建置指令（第 12 頁）：
  ```
  git clone https://github.com/taipei-doit/TownPass.git
  cd TownPass
  fvm install
  fvm flutter pub get
  fvm dart run build_runner build --delete-conflicting-outputs
  fvm flutter run
  ```
  新增圖示後須重跑 build_runner；首次建置久，iOS 會下載 Swift Package；建置異常先 `flutter clean`。
- 專案結構（第 13 頁）：`lib/bean`（資料模型）、`lib/page`（各頁，如 city_service、home）、`lib/service`（帳號、定位、通知）、`lib/util`（TP 元件、web_message_handler）、`assets/mock_data`（5 個假資料 JSON）、`assets/svg`（108 個圖示）。
- Mock 資料（第 15 頁）：`assets/mock_data/account.json`（微服務呼叫 userinfo 回傳此內容；改 `citizen`、`birthday` 切換非市民／長者）、`activity.json`、`home_banner.json`、`message.json`、`subscription.json`。修改後重啟 App。
- WebView 注意（第 16 頁）：切頁或背景時釋放 WebView 資源；彈出視窗 iOS 預設阻擋、Android 需自行處理，雙平台都測；完成後在 App 內實測，雙向溝通只在 App 內運作。

## 7. App 與微服務雙向溝通（第 18–21 頁）

- 網頁端用 `window.flutterObject.postMessage(JSON.stringify({ name, data }))`；僅接受字串。
- 接收：`window.flutterObject.addEventListener('message', onReply)`，`event.data` 為 JSON 字串，`JSON.parse` 取 `{name, data}`；用完 `removeEventListener`。一般瀏覽器沒有 `flutterObject`，先判斷是否存在並改用模擬資料。
- 例：送 `{ name: 'location', data: null }`，回 `data.latitude / data.longitude`。
- App 側：`TPWebMessageListener` 依 `name` 找 `TPWebMessageHandler`，用 `replyWebMessage(data: ...)` 回傳；原始碼 `lib/util/web_message_handler/`（去年叫 CPWebMessageHandler，今年改名 TP）。底層 flutter_inappwebview 的 WebMessageListener。
- 官方 Vue 範例已封裝：`src/composables/useConnectionMessage.ts`、`useHandleConnectionData.ts`。
- 自訂 Handler 四步：繼承 `TPWebMessageHandler` → `name` 對應網頁送的 name（勿與內建 location、notify 重複）→ 加入 `TPWebMessageListener` 的 `_cachedMessageHandlers` → 網頁 postMessage 呼叫。
- 內建（9 項）：定位、QR Code 掃描、手機通知、裝置資訊、撥電話／1999、開地圖／開連結（第 21 頁）。
- 可自加：NFC、藍牙、陀螺儀、健康資料、音訊、IoT、Wi-Fi、AR/VR、裝置端 AI。流程：選開源 Flutter 套件（pub.dev，MIT/BSD/Apache）→ 封裝成 MessageHandler → 設定雙平台權限（Info.plist 用途說明、AndroidManifest 權限）。

## 8. 把服務放進城市通（第 23–27、58 頁）

- 服務頁四區：我的服務、更多／新增、服務拼貼、熱門（`lib/page/city_service/`、`lib/page/city_service_edit/`）。
- `lib/page/city_service/model/my_service_model.dart`：在 `enum MyServiceItemId` 加 id（現有 21 個）；在 `MyServiceIdExt` switch 加 case，回傳 `MyServiceItem(title, description, icon, category, destinationUrl, forceWebViewTitle?)`。分類：市政服務、防疫醫療、城市生活、探索臺北、其他服務。
- 圖示：SVG 放 `assets/svg/`（snake_case），跑 build_runner，程式中 `Assets.svg.iconXxx.svg()`。
- 熱門：`model/trending_service_model.dart` 的 `TrendingService(title, icon, url)`。服務拼貼：`widget/official_service_card/`（四個 Widget：top_left、top_right、bottom_left、bottom_right；onTap 目前 TODO，填網址即可導向；去年是 JSON，今年改 Widget）。
- 實機流程：`flutter run` → 服務 › 更多 › 加入我的服務 → 開啟確認雙向溝通 → 完整跑 Demo 流程。Demo 建議用實機（定位、掃碼、通知才完整）。
- 賽前練習（第 32 頁）：clone、fvm install、建置；新增 SVG 跑 build_runner；新增 MyServiceItemId 與 MyServiceItem；destinationUrl 先填 `https://www.gov.taipei/`；在 App 加入我的服務；手機實測；[講稿] 並確認 iOS 簽章。

## 9. 設計規範與無障礙（第 28–31 頁）

- Figma Town Pass UI Kit：45+ 畫面、100+ 元件；連結在開發文件首頁，搜「Town Pass Design Tokens」。
- 色票：Primary 500 `#5AB4C5`、Secondary 500 `#F5BA4B`、Grayscale 500 `#738995`，各 50→950；字體中文 PingFang TC、英數 Roboto；字級 h1 36、h2 24、title 18、h3 16、body 14、caption 12。對應 `lib/util/tp_colors.dart`、`tp_text_styles.dart`；官方 Vue 範例設定於 `tailwind.config.js`，其他框架可用 CSS 變數。
- 無障礙 12 類（替代文字、時序媒體、通知、觸控 ≥48dp×48dp、焦點、表單、連結、動態內容無閃爍、結構、可調適、文字放大 200% 可讀、可預期）。
- 使用者進入情境三種：目標明確（引導置頂）、需求不明（主動推薦）、隨意瀏覽（放熱門）；建議先選主要對象，Demo 依該情境（第 31 頁）。
- 使用者類型含營運層（資訊局、其他機關、商家）（第 39 頁）。

## 10. 開放資料與 API

投影片沒有「城市通專屬 API／key／sandbox」；資料皆為開放資料平台（第 40 頁）：
- 臺北市資料大平臺 data.taipei（建議優先）
- 政府資料開放平臺 data.gov.tw
- TDX 運輸資料流通服務 tdx.transportdata.tw（公車、捷運、YouBike；**免費註冊取得金鑰，建議提早申請**）
- 臺北城市儀表板 dashboard.gov.taipei（開源：Taipei-City-Dashboard；城市通 App 已內建「市政資訊儀表板」）
- 往屆資料來源例：北市好停車即時車位、data.taipei 紅黃線、YouBike 2.0 即時、今日施工、中央氣象署（雷達回波、1 小時雨量預測）、環境部 AQI（第 41–45 頁）。
- 認證／OAuth/SSO：未提及；測試帳號用 mock `account.json`。
- 往屆作品（原始碼公開於 taipei-doit，已整併進台北通；第 41–45 頁）：
  - 2024 ParkFlow 找車位：`townpass2024-parking`（Vue 3 + FastAPI；自訂 `timer_set` Handler 用 flutter_local_notifications 排程推播）
  - 2025 RideFlow 騎妙：`townpass2025-RideFlow`（Vue 3 + FastAPI + XGBoost；README 有架構圖、環境變數、AI 聲明）
  - 2024 即時雨晴：`townpass2024-weather`（Flask + 純 HTML/JS + Leaflet + OSM；用內建 location）
  - 建議賽前 clone 一項實際執行。

## 11. 裝置端 AI（第 49–52 頁）

- 架構：網頁 `postMessage({name:'llm_ask', data:'...'})` → App 自訂 `LlmMessageHandler` → 裝置端推論引擎 → 回傳；離線可運作。`llm_ask` 為示意名稱。模型由 App 載入一次可共用；把開放資料放進提示詞（RAG）提升小模型品質。
- Flutter 套件：`flutter_edge_ai`（原 flutter_gemma；Gemma 4 E2B/E4B、Gemma 3n、Phi-4 Mini；.litertlm/.task/.onnx；MIT；2.3.2）、`llamadart`（GGUF／llama.cpp、.litertlm；Dart 3.10+、Flutter 3.38+；MIT；0.8.19）。
- 建議模型 Gemma 4 E2B（2026/4 Apache 2.0；8 GB RAM 手機較穩）；繁中表現需實測；模型檔數 GB，首次啟動下載或 Demo 前預放實機；首次載入數十秒，Demo 前預熱；用飛航模式完整測試一次。
- 開發階段 AI 建議：repo 根目錄放 CLAUDE.md／AGENTS.md 載明規則；給 AI 最新版本資訊（pubspec.yaml、官方文件）；逐一確認 AI 給的 API 網址／資料集名稱；隊內先統一工具與 code review 分工（第 47–48 頁）。

## 12. 部署（第 53–57 頁）

- 前端：Firebase Hosting（亦可 GitHub Pages、Cloudflare Pages、Vercel，須 HTTPS）
  ```
  npm install -g firebase-tools
  firebase login
  firebase init hosting     # public 填 build 輸出（Vite 為 dist）；SPA 選 Yes；覆蓋 index.html 選 No
  npm run build
  firebase deploy --only hosting     # → https://你的專案.web.app
  ```
- 後端：Cloud Run（亦可 Render、Fly.io、比賽期間 ngrok）
  ```
  gcloud auth login
  gcloud config set project [PROJECT-ID]
  gcloud run deploy my-service --source . --region asia-east1
  ```
  首次詢問啟用 API → y；允許未驗證存取 → y。有 Dockerfile 用之，否則 buildpacks。Container Registry 已於 2025/3 關閉，改 Artifact Registry。區域選 asia-east1（彰化）。
- 後端範例：Spring Boot 4.x / Java 21 / Maven；`server.port=${PORT:8080}`（Cloud Run 提供 PORT）；web.app 與 run.app 不同網域須設 CORS。
- 免費額度足夠，部署平台不限但請用免費方案；建議先部署 Hello World 並填入 destinationUrl 測試（第 54 頁）。

## 13. 賽前／當天攜帶清單（第 63 頁）

- 環境：每位成員完成 TownPass 最新版建置；至少一台實機安裝自建 App；Hello World 部署完成可從 App 開啟；完成 Firebase、GCP、TDX 帳號註冊。
- 隊伍：建立 repo、約定分支與 review 分工；統一 AI 工具與說明檔；預先瀏覽 data.taipei、TDX 資料集；預先試用地圖／圖表開源套件。
- 攜帶：身分證件（報到查驗）、延長線、手機線、投影轉接頭、Demo 用手機兩支（含備用）。

## 14. 資源連結與聯絡（第 64 頁）

- TownPass 原始碼：github.com/taipei-doit/TownPass（clone URL `https://github.com/taipei-doit/TownPass.git`）
- 開發文件（中英）：tpe-guideline.web.app（無障礙：tpe-guideline.web.app/docs/accessibility/；另有 Two-Way Connection on Website、Microservices - User Interface 章節）
- 活動官網、競賽須知：codefest.taipei/2026-fall
- Figma UI Kit：開發文件首頁連結，搜 Town Pass Design Tokens
- 開放資料：data.taipei、data.gov.tw、tdx.transportdata.tw
- 城市儀表板：github.com/tpe-doit/Taipei-City-Dashboard
- Flutter 3.47：flutter.dev/blog/whats-new-in-flutter-3-47
- 往屆原始碼：github.com/taipei-doit/（repo 名見第 10 節）
- 預設測試網址：`https://www.gov.taipei/`
- 聯絡：技術問題開 GitHub issue（TownPass）；規則問題洽承辦單位（台北市電腦商業同業公會）。Discord／Line 群、電話：投影片未提供。QR code：投影片 DOM 中未發現 QR 圖片 [不確定：21 張圖未逐張檢視，皆判定為場景照／App 截圖]。

---

## 未涵蓋／需另查

1. 逐時時程（開賽、程式碼截止、報告繳交截止）、評審配分、獎項 → 競賽須知（codefest.taipei/2026-fall）。
2. 題目是否當天公布、是否限定主題 → 同上。
3. 報名／提交方式（表單、repo 連結怎麼交）→ 同上。
