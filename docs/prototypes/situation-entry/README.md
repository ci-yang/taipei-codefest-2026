# 情境入口「我遇到了……」（BRA-592，行動卡版）

選一張最接近你狀況的卡，卡上寫好：現在打給誰（大字電話＋撥號鍵）、接通後照著說、要準備的東西（可勾選）、先知道。對象是有手機但不知道找誰的人，或幫忙查的親友、里長、社工；整張卡可以截圖或直接拿給社工看。

主版採設計方向 B「行動卡」（2026-11-08 曄選定）。A、C 兩個方向和 B 的原型留在 `variants/`，當設計紀錄。

- 純靜態網頁：固定內容，不用 AI、不用後端、不用登入，不讀 userinfo。
- 不記錄、不上傳使用者選了什麼：不用 localStorage／cookie／fetch，路由只用網址 hash。選的行政區、勾的項目只在頁面記憶體，重新整理就清空。
- 每條資訊都有來源網址與查核日期；官方頁面沒寫清楚的標「待確認」。

## 畫面規則

- 時段：平日 8:30–17:30 算白天（希望好食堂常見問答寫的社福中心上班時間），其他算晚上或假日。國定假日判斷不出來，右上角可以手動切換。介面照城市通服務頁的語言：白天白底、卡頭淺藍綠底配深藍綠標題、撥號鍵藍綠、1px 淺灰細框加 8–12px 圓角，不用黑粗框與硬陰影；黃色只當點綴（待確認、範本填空、勾選完成、晚上提示列）。**晚上也維持白底**：城市通 App 只設了淺色 `ThemeData`、沒有 darkTheme，整頁換深色會跟 App 的白色外框對不上，所以晚上跟白天用同一組顏色 token，只換內容（晚上打得通的電話、晚上的說法、閉線提示）。看得出時段的地方有三個：右上角切換鈕（☾ 晚上／假日）、首頁搜尋框上方和情境卡「現在打給」上方的淺黃提示列（secondary-50 底、secondary-200 細框、secondary-700 月亮、grayscale-900 字），以及首頁說明區標題「現在是晚上或假日」。卡上提示列的字跟著那張卡顯示的號碼走：號碼現在打得通，寫「先給晚上打得通的電話」；打不通（租屋 412-8518、出院 1966、健保 0800-030-598），寫「這支電話明天 9:00 起才有人接」這類開線時間，不說打得通。卡片排序是先放現在打得通的那支，所以顯示的號碼打不通就代表這張卡沒有晚上能改打的電話，提示列不另外推薦號碼。首頁提示列寫「卡片會標出哪些電話現在打得通」，不宣稱每張都打得通。`tests/situation-night.test.mjs` 驗證所有 token 只宣告在 `:root`、沒有依時段或系統深色模式切換的規則、晚上不多出提示列以外的 class、提示列在首頁與每張卡都有且對比過 AA。
- **每支電話照自己的服務時段挑**：`call` 每一筆有 `hours`（`"24h"`、`{ "days": "weekdays", "spans": [["09:00","12:30"], …] }`，官方沒寫就 `null`＝時段待確認）。`core.js` 的 `plan` 依資料順序，挑第一支「現在在服務時段內」的電話；全部沒開就顯示第一支，標「不在服務時間，X 起」，X 照閉線原因只給一個：午休或還沒開→「今天」、平日下班後→「明天」、週五晚上和週末→「週一」、手動切成假日→「下個上班日」；卡上的「現在打給」改成「上班時間打給」。沒手動切換時，每次重繪、換頁、回到頁面（`visibilitychange`）都重讀現在時間；手動切的白天／晚上會一直保留。例：勞動局律師電話只在 14:00–17:00，平日 09:15、13:15 不會推薦；1966 中午 12:00–13:30 休息。
- 切換鈕的意思：上班時間內切到「晚上／假日」＝當作國定假日（平日時段的電話都不算開）；下班後切到「白天」＝看白天的卡，用 14:30 計算。
- 白天：食援、急難救助先問「你住哪一區？」，點一下就給那一區社福中心的電話，範本裡的「臺北市＿＿區」自動填入。
- 晚上或假日：1999 話務人員 24 小時接聽，但承辦單位上班時間才處理；卡片寫「請他登錄並轉辦」，不寫當晚會處理。急難救助的分機 6962 只出現在白天。
- 範本、時段說明用 `for` 指定跟哪一支電話走（`"@closed"`＝全部沒開時顯示）。
- **搜尋與分類篩選**（首頁標題下面）：搜尋框比對每個情境的標題＋副標＋`keywords`（同義詞、口語說法，例如「餓」「押金」「走丟」），中文直接用包含比對、不斷詞；空白分開的幾個詞要全部符合，臺／台視為同字。打字即時篩選，右側清除鈕 44×44，Esc 清除、Enter 收鍵盤。分類籤是「全部」＋各分類，一次選一個，籤上數字跟著搜尋字變；全部分類都換行顯示，不橫向捲動。分類和搜尋取交集；選「全部」照分類分組，選了某類只顯示那一類。搜不到時不只說查無結果，給下一步：「不確定找誰，先打 1999 市民熱線」（附撥號鍵與研考會出處），提醒底部緊急電話一直都在；在某分類裡搜不到但其他分類有，給「改在全部分類找」。搜尋字只在頁面記憶體：不存 storage、不進網址（沒有 form、input 沒有 name）、不送網路請求。
- 首頁依 `categories` 分組；每張卡的「現在打」和卡片內第一支電話是同一個計算，並顯示這支電話的簡短說明（`brief`，例如「接通後轉分機 7019」）和服務時段。新增情境或分類只改 `data/situation/situations.json`。
- **緊急電話列**：每一頁底部固定 110（有立即危險）、119（受傷、急病）、113（家暴、兒少、性侵）、1925（心情撐不住），資料在 `emergencyLines`。紅色外框、不填滿，不壓過主要行動卡；只給號碼，不追問細節、不寫保證安全或保密。家暴、自傷不做完整情境流程。
- 來源鈕：每一段一顆，44×44 點擊範圍，列出這段引用的所有來源編號。
- 首頁卡片上「現在打」的電話和卡片內第一支電話是同一個計算（`core.js` 的 `plan`），測試會逐支對回 `data/situation/` 的資料與來源。

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html`、`app.js`、`styles.css` | 主版（行動卡） |
| `core.js` | 時段判斷、「現在先打哪支」、來源編號、撥號串接；主版和 `variants/` 共用 |
| `bridge.js` | TownPass 撥號 bridge（邏輯見下方「撥電話」） |
| `situations-data.js` | 由 `build-data.mjs` 從 `data/situation/` 產生，不要手改 |
| `variants/` | 三個設計方向的原型（設計紀錄） |

## 啟動與測試

```sh
pnpm prototype:situation   # http://127.0.0.1:8767
pnpm test:situation        # 檢查 situations-data.js 與 data/situation/ 同步，再跑 node --test
```

改內容：只改 `data/situation/`，再跑 `node docs/prototypes/situation-entry/build-data.mjs` 重新產生 `situations-data.js`（不要手改）。

## 八個情境（第一批）

| 分類 | 情境 | 電話與時段 | 官方來源 |
|---|---|---|---|
| 錢和吃住 | 今天沒飯吃 | 住處社福中心（平日 8:30–17:30）；其他時間 1999 留資料、上班時間轉介 | 社會局希望好食堂常見問答、社福中心名冊、研考會 1999 問答 |
| 錢和吃住 | 突然沒錢，繳不出房租或水電 | 住處社福中心；1999 轉 6962（平日 9:00–12:30、13:30–17:00）；其他時間 1999 登錄轉辦 | 社會局急難救助頁與洽辦資訊、急難紓困方案頁、急難救助金核發作業要點 |
| 錢和吃住 | 房東突然要我搬走、押金不退 | 法扶租屋糾紛律師電話 02-412-8518 轉 2 再轉 6（平日 9:00–12:30、13:30–17:00） | 法務局轉載法扶租屋專線公告 |
| 工作出狀況 | 薪水被拖欠、突然被解僱 | 勞動局律師電話 02-2720-8889 轉 7019（平日 14:00–17:00）；勞動權益中心（時段待確認）；1999 | 免費勞工律師諮詢時段（開放資料）、勞動局調解頁與調解申請書 |
| 家人和照顧 | 家人快出院了，回家沒人會照顧 | 1966（平日 8:30–12:00、13:30–17:30）；醫院出院準備小組 | 衛生局出院準備銜接長照、衛福部諮詢服務專線 |
| 人身安全 | 家人走失了 | 110（24 小時）；也可到最近的派出所，不用等 24 小時 | 警政署答客問、警政署「不用等 24 小時」、我的E政府緊急專線表 |
| 人身安全 | 剛轉帳，發現可能被詐騙 | 165（24 小時）、110；打完要到派出所完成報案 | 警政署港務警察總隊問答、刑事局 165 公告、警政署 165 問答、北市警局防詐專區 |
| 健康 | 欠了健保費，怕不能看病 | 健保諮詢 0800-030-598，手機改撥 02-4128-678（平日 8:30–17:30） | 衛福部諮詢服務專線、健保署臺北業務組業務分機、健保署闢謠公告（欠費不鎖卡）、健保署無力繳費協助、健保署分期繳納 |

## 撥電話

- 只撥白名單號碼（`bridge.js` 的 `dialable`）：110、113、119、165、1925、1957、1966、1999，0800 免付費號碼，以及一般市話（區碼後不接 0，所以手機、0204／0809 付費號碼和帶分機的字串都不送）。短號碼顯示原樣（`110`），0800 顯示 `0800-030-598`，七碼市話顯示 `02-412-8518`。
- 在城市通 App 內：1999 以外的號碼走 `phone_call`。App 回 `true` 代表已開啟撥號畫面（不代表已撥出或接通），畫面不再顯示提示；回 `false` 或 5 秒逾時，畫面提示手動撥打。
- 1999 走 `1999agree`（App 的同意條款與撥號對話框）。這個 handler 成功時不回訊息，失敗時回 `false`，而且可能等使用者讀完條款才回。所以 1999 永遠不宣稱已撥出：1.5 秒內沒回就顯示「若沒有跳出撥號畫面，請直接撥 1999。」，並繼續聽晚到的 `false`，收到就改成「請手動撥打」（之後又按了別的號碼就不改畫面）。
- App 回的訊息不帶請求 id，分不出是哪一通 1999 的。所以前一次 1999 還沒回 `false` 時，再按 1999 不會送新的 `1999agree`，改用 App 的 `phone_call` handler 撥 `1999`（`1999agree` 撥號成功後不回覆，會一直停在這個狀態；App 內的 WebView 不會攔 `tel:` 連結，所以不能退回 `tel:1999`）。`phone_call` 的回覆名稱不同，上一通晚到的 `false` 不會被算到這一通；畫面也不宣稱已撥出。
- 一般瀏覽器：沒有 `flutterObject`，按鈕就是 `tel:` 連結。
- 分機號碼不自動撥，按鈕下方寫「接通後轉分機」。

## 內容安全政策（CSP）

`index.html` 的 `<head>` 第一行是 CSP meta，只允許頁面自己的檔案：

```
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; worker-src 'none'
```

- 這是主要防線：style 屬性、內嵌 `<style>`、外部 `<link>`、`@import`、外部圖片和字型，瀏覽器直接拒絕，寫法再怎麼繞都一樣。`frame-ancestors` 在 meta 裡無效，所以沒寫。
- `tests/situation-csp.test.mjs` 用 headless Chrome（`tests/chrome.mjs`，走 DevTools protocol，不加套件）實際開頁面：首頁、搜尋、分類、八張卡、選區、勾選、日夜切換，`securitypolicyviolation` 必須是 0、沒有 console 錯誤、沒有連到別的來源。再把審查列的四種攻擊（body style、app.js 渲染的外部 `<link>`、反斜線換行拼出的 `url()`、同源 Worker 對外 `fetch`）放進實際檔案，確認 Chrome 擋下、各自觸發違規、外部伺服器沒收到請求。「外部」是本機另一個 port 的測試伺服器（不同 origin），不連外網，它記錄收到哪些請求。對照組拿掉 CSP 後，四種攻擊都要實際生效：body 文字變色、外部 CSS 被抓且 `letter-spacing` 生效、外部圖片被抓、worker 執行並連到外部伺服器；變異測試逐一拿掉其中一種攻擊，對照組的斷言必須失敗。找不到 Chrome 就失敗（可用 `CHROME_PATH` 指定），不會 skip。Chrome 啟動逾時、提早結束或 DevTools 連不上時，`chrome.mjs` 會先 kill Chrome、刪掉暫存的 user-data-dir 再丟錯；`tests/situation-chrome.test.mjs` 故意連到錯的 port，確認程序與 profile 都沒留下。測試用的本機伺服器關閉時會一併切斷 keep-alive 連線，免得卡住。
- `worker-src 'none'` 一定要明寫：沒寫時 worker 退回 `child-src`、再退回 `script-src 'self'`，同源的 `new Worker('/x.js')` 就能啟動，而 worker 不吃頁面這組 CSP，可以自己 `fetch` 出去，繞過 `connect-src 'none'`，頁面的 `securitypolicyviolation` 也不會回報（第 17 輪審查實測）。測試裡拿掉 `worker-src` 這一項，worker 確實跑起來並連到外部伺服器。
- `child-src`、`frame-src`、`media-src`、`manifest-src` 沒另外寫：它們都會退回 `default-src 'none'`（`frame-src` 先退回 `child-src`，`child-src` 再退回 `default-src`），沒有像 worker 那樣中途接到 `'self'` 的來源。測試在 Chrome 實際插入外部 `<iframe>`、`<audio>`、`<video>`、`<link rel="manifest">`，確認分別觸發 `frame-src`、`media-src`、`manifest-src` 違規，外部伺服器一個請求都沒收到。
- `<link rel="icon" href="data:,">` 是空圖示，讓瀏覽器不去要 `/favicon.ico`（原本每次都 404）。
- 原有的 `css-audit.mjs` 與 `situation-inline-style.test.mjs` 保留，當第二道防線。
- **TownPass bridge 不受這組 CSP 影響（判斷，待真機確認）**：
  - Android：殼用 `controller.addWebMessageListener(...)`（TownPass `lib/util/tp_web_view.dart:257`），flutter_inappwebview 6.1.5 轉給 AndroidX `WebViewCompat.addWebMessageListener`（`flutter_inappwebview_android-1.1.3` 的 `InAppWebView.java:1890`）。`flutterObject` 由 WebView 原生注入，不是頁面載入的 script；`postMessage` 不是網路請求，不歸 `connect-src` 管。
  - iOS：`flutterObject` 由 plugin 以 `WKUserScript`（`atDocumentStart`）注入，送訊息走 `window.webkit.messageHandlers`（`flutter_inappwebview_ios-1.1.2` 的 `WebMessageListener.swift:109`、`WebMessageListenerJS.swift:21`）。原生注入的 script 與 App 端執行的 JavaScript 一般不受頁面 CSP 限制，但這點沒有在 iOS 實機驗證。
  - 本頁自己的 `bridge.js` 只呼叫 `flutterObject.postMessage` 與監聽 `message` 事件，不用 `eval`、不發網路請求。`tel:` 連結是導覽，不受 CSP 限制。
  - 上面是讀原始碼的判斷，**兩個平台都待真機確認**（模擬器或手機開頁面，按一支電話看撥號畫面是否跳出）。

## 在城市通裡開

TownPass 分支 `feat/situation-entry` 有獨立服務「我遇到了」，網址用 `--dart-define=SITUATION_SERVICE_URL=...`（預設 `http://10.0.2.2:8767`，給 Android 模擬器）。

## 截圖

`docs/screenshots/situation-entry/main-*.png`，2026-11-08 以 headless Chrome（DevTools 協定模擬 390px 寬、2 倍像素的行動裝置）截取，**不是** iOS／Android 模擬器截圖。網址用 `?t=day`（固定週三 14:30）、`?t=night`（週三 21:00）、`?at=0915` 指定時間（只給 `?at` 時白天／晚上照那個時間自動判斷）；勾選是腳本實際點擊畫面。整頁截圖時底部緊急列畫在頁尾。所有 `*-night.png` 是 2026-11-08 改成「晚上維持白底＋提示列」後重拍的。首頁、人身安全分類、搜尋「被騙」、搜不到、租屋、出院、健保這 7 張晚上截圖，在第 15 輪審查把提示列改成跟號碼開線狀態一致後再重拍一次。

| 檔案 | 內容 |
|---|---|
| `main-home-day.png`、`main-home-night.png` | 首頁，白天／晚上（白底，搜尋框上方多一條☾提示列） |
| `main-sos-bar.png` | 首頁第一屏（390×844）：搜尋框、分類籤兩列全部顯示，底部固定緊急電話列 |
| `main-search-fraud.png`、`main-search-fraud-night.png` | 搜尋「被騙」（第一屏），白天／晚上：只剩詐騙卡；畫面上不寫「有幾張卡」，數字只在分類籤上，張數另外給螢幕閱讀器 |
| `main-search-nomatch.png`、`main-search-nomatch-night.png` | 搜不到（「外星人」），白天／晚上：改給 1999 下一步和緊急電話提醒 |
| `main-category-safety.png`、`main-category-safety-night.png` | 選「人身安全」分類，白天／晚上：只顯示走失、詐騙兩張 |
| `main-food-day-pick-district.png` | 食援白天，先選區 |
| `main-food-day.png`、`main-food-night.png` | 食援，白天（選萬華區）／晚上（1999；「現在打給」上方有☾提示列） |
| `main-emergency-day.png`、`main-emergency-night.png` | 急難救助，白天（選北投區）／晚上（1999 登錄轉辦） |
| `main-rental-day.png`、`main-rental-night.png` | 租屋糾紛，白天（法扶律師電話）／晚上 |
| `main-labor-day.png`、`main-labor-day-0915.png`、`main-labor-night.png` | 勞權，14:30（律師電話）／09:15（律師電話未開，改 1999）／晚上 |
| `main-discharge-day.png`、`main-discharge-night.png` | 出院長照，白天（1966）／晚上 |
| `main-discharge-lunch-1245.png`、`main-rental-lunch-1245.png` | 平日 12:45 午休：只寫「今天 13:30 起」 |
| `main-missing-day.png`、`main-missing-night.png` | 家人走失，白天／晚上（110） |
| `main-fraud-day.png`、`main-fraud-night.png` | 詐騙，白天／晚上（165） |
| `main-nhi-day.png`、`main-nhi-night.png` | 健保欠費，白天／晚上（市話 0800-030-598、手機 02-4128-678；有健保只是欠費不影響就醫） |
| `main-checklist.png` | 急難救助「要準備的東西」勾了 3 項（勾選後只變色、不加刪除線） |

三個設計方向的比較截圖在 `variants/` 子資料夾，保留不動。

表裡所有截圖都是 2026-11-08 城市通化（白底藍綠、細框）後的配色。白天的照舊；晚上的 12 張（首頁、人身安全分類、搜尋「被騙」、搜不到、食援、急難、租屋、勞權、出院、走失、詐騙、健保）在晚上改回白底後全部重拍，畫面上看得到提示列。`main-home-day-vs-townpass.png` 左邊是城市通服務頁（`docs/screenshots/e2e-ios-02-service-tab.png`），右邊是本頁首頁第一屏，方便比對。

## 色票與字級

- 顏色全部來自 TownPass `lib/util/tp_colors.dart`（TPColors），在 `styles.css` 開頭照抄成 `--tp-primary-500` 這類變數；其他規則只引用變數。色票快照固定在 `tests/fixtures/tp_colors.json`（記來源檔、commit、抓取日期），`styles.css` 必須跟它一致；有 TownPass checkout 時另外比對 Dart 檔，找不到就明示跳過（可用 `TP_COLORS_DART` 指定路徑）。
- `tests/css-audit.mjs` 把 CSS 拆成宣告逐條檢查，屬性名和值先轉小寫、去掉 `!important`。只有白名單裡確定不帶顏色的屬性（margin、display、font-size…，vendor prefix 去掉後比對）可以略過顏色檢查；其他屬性（含 `-webkit-text-fill-color`、`caret-color`、`scrollbar-color` 和自訂變數）值裡每個字都只能是 `var(--…)`（且變數有定義）、底色在色票裡的 `rgba()`、長度或線型關鍵字，白名單屬性出現色值也擋。`currentColor` 只准用在 border、outline、fill、stroke、text-decoration，不能用在 `color`、背景或 token。檢查前先還原 CSS 跳脫字元（`\62 old` 就是 `bold`，屬性名也一樣）。`font`、`font-size` 只能是 TPTextStyles 字級；字重 `normal`／`bold`／`bolder`／`lighter` 換算成數字後只能 400／600。`font`、`font-size`、`font-weight` 遇到 `var()` 會代入變數的每一個定義逐一檢查；變數沒定義、帶 fallback 或代不出值就判失敗，不略過。`font-weight` 的 `inherit`／`unset`／`initial`／`revert` 一律擋（看不出實際字重）；`font` 簡寫只放行 `inherit`／`initial`／`unset`（繼承已檢查過的父層或回到 16px 400），尺寸前只准字重、`italic`、`small-caps` 這類已知字。測試另外把具名色、`color()`、`font: 900 23px`、`-webkit-text-fill-color: rebeccapurple !important`、`font: BOLD 16px`、`color: currentColor` 等寫法注入，確認會失敗；第 14 輪審查的 `:root { --heavy: 900; } .dial { font: var(--heavy) 16px sans-serif; }` 和跳脫字元寫的 `bold` 也在注入清單裡。也驗證 border 用 currentColor、`font-weight: normal`、`var(--strong)`＝600 這類合法寫法不會被誤擋。
- 不准 inline style：`tests/situation-inline-style.test.mjs` 檢查 index.html 和 app.js 實際渲染的首頁（全部、搜尋、搜不到、分類）與每張情境卡（白天／晚上、有無選區），不能有 `style=` 屬性或 `<style>`；也掃 app.js、core.js、bridge.js 原始碼，擋 `.style`、`setProperty`、`cssText`、`setAttribute('style')`、`insertRule`。審查提出的 `style="color: rebeccapurple !important; font-weight: 900"` 注入 body 或 mini-band 都會讓測試失敗。
- 主要 token：白天 `--desk`/`--paper` white、`--band` primary-50 配 `--band-ink` primary-800、`--go` primary-700 配 white、`--line` grayscale-200；晚上用同一組。晚上提示列 `--note-bg` secondary-50、`--note-edge` secondary-200、`--note-ink` grayscale-900、`--note-mark` secondary-700。
- 字級只用 TPTextStyles：36／24／18／16／14／12，字重 400／600。主要閱讀字用 h3 16 而不是 body 14（390px 上給長輩讀，14 太小），次要說明 14，註解 12。大號電話 36、緊急列號碼 24、「接通後照著說」24。
- 字體：系統字 `system-ui, -apple-system, "PingFang TC", "Noto Sans TC", Roboto, …`，不載網路字型，頁面零外部請求（測試會擋 index.html 的外部資源與 CSS 的外部 `url()`）。城市通 App 本身用蘋方（TPTextStyles 指定 PingFangTC），iOS 系統字就是蘋方；Android 系統字是 Roboto＋Noto Sans TC，跟 App 的拉丁字 Roboto 一致。自帶 Roboto woff2 只影響數字和英文，還要多帶授權檔和約 70 KB，換不到差別。
