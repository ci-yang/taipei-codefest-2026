# 情境入口「我遇到了……」（BRA-592，行動卡版）

選一張最接近你狀況的卡，卡上寫好：現在打給誰（大字電話＋撥號鍵）、接通後照著說、要準備的東西（可勾選）、先知道。對象是有手機但不知道找誰的人，或幫忙查的親友、里長、社工；整張卡可以截圖或直接拿給社工看。

主版採設計方向 B「行動卡」（2026-11-08 曄選定）。A、C 兩個方向和 B 的原型留在 `variants/`，當設計紀錄。

- 純靜態網頁：固定內容，不用 AI、不用後端、不用登入，不讀 userinfo。
- 不記錄、不上傳使用者選了什麼：不用 localStorage／cookie／fetch，路由只用網址 hash。選的行政區、勾的項目只在頁面記憶體，重新整理就清空。
- 每條資訊都有來源網址與查核日期；官方頁面沒寫清楚的標「待確認」。

## 畫面規則

- 時段：平日 8:30–17:30 算白天（希望好食堂常見問答寫的社福中心上班時間），其他算晚上或假日。國定假日判斷不出來，右上角可以手動切換。晚上整頁換成深色桌面、卡頭變藍綠，一眼看得出時段。
- 白天：食援、急難救助先問「你住哪一區？」，點一下就給那一區社福中心的電話，範本裡的「臺北市＿＿區」自動填入。勞權沒有分區窗口，直接給勞動局律師電話諮詢。
- 晚上或假日：情境有 1999 就先給 1999。
- 首頁依 `categories` 分組；情境標 `"urgent": true` 會排在最上面「有危險，先打這些」並用紅色卡頭（樣式已預留，目前沒有情境使用）。新增情境或分類只改 `data/situation/situations.json`。
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

## 三個情境

| 情境 | 主要窗口 | 官方來源 |
|---|---|---|
| 今天沒飯吃 | 住處的社福中心（上班時間）；夜間假日 1999 留資料、上班時間轉介 | 社會局希望好食堂常見問答、社福中心名冊（社會局網站、開放資料） |
| 薪水被拖欠、突然被解僱 | 免費勞工法令律師諮詢；勞資爭議調解（免費） | 免費勞工律師諮詢時段（開放資料）、勞動局調解頁與調解申請書 |
| 突然沒錢，繳不出房租或水電 | 戶籍區公所社會課或社福中心：急難救助、急難紓困 | 社會局急難救助頁、急難紓困方案頁、臺北市急難救助金核發作業要點 |

## 撥電話

- 在城市通 App 內：其他號碼走 `phone_call`。App 回 `true` 代表已開啟撥號畫面（不代表已撥出或接通），畫面不再顯示提示；回 `false` 或 5 秒逾時，畫面提示手動撥打。
- 1999 走 `1999agree`（App 的同意條款與撥號對話框）。這個 handler 成功時不回訊息，失敗時回 `false`，而且可能等使用者讀完條款才回。所以 1999 永遠不宣稱已撥出：1.5 秒內沒回就顯示「若沒有跳出撥號畫面，請直接撥 1999。」，並繼續聽晚到的 `false`，收到就改成「請手動撥打」（之後又按了別的號碼就不改畫面）。
- App 回的訊息不帶請求 id，分不出是哪一通 1999 的。所以前一次 1999 還沒回 `false` 時，再按 1999 不會送新的 `1999agree`，改用 App 的 `phone_call` handler 撥 `1999`（`1999agree` 撥號成功後不回覆，會一直停在這個狀態；App 內的 WebView 不會攔 `tel:` 連結，所以不能退回 `tel:1999`）。`phone_call` 的回覆名稱不同，上一通晚到的 `false` 不會被算到這一通；畫面也不宣稱已撥出。
- 一般瀏覽器：沒有 `flutterObject`，按鈕就是 `tel:` 連結。
- 分機號碼不自動撥，按鈕下方寫「接通後轉分機」。

## 在城市通裡開

TownPass 分支 `feat/situation-entry` 有獨立服務「我遇到了」，網址用 `--dart-define=SITUATION_SERVICE_URL=...`（預設 `http://10.0.2.2:8767`，給 Android 模擬器）。

## 截圖

`docs/screenshots/situation-entry/main-*.png`，2026-11-08 以 headless Chrome（DevTools 協定模擬 390px 寬、2 倍像素的行動裝置）截取，**不是** iOS／Android 模擬器截圖。網址用 `?t=day|night` 固定時段；選區、勾選是腳本實際點擊畫面。

| 檔案 | 內容 |
|---|---|
| `main-home-day.png`、`main-home-night.png` | 首頁，白天／晚上 |
| `main-food-day-pick-district.png` | 食援白天，先選區 |
| `main-food-day.png`、`main-food-night.png` | 食援，白天（選萬華區）／晚上（1999） |
| `main-labor-day.png`、`main-labor-night.png` | 勞權，白天（律師電話諮詢）／晚上（1999） |
| `main-emergency-day.png`、`main-emergency-night.png` | 急難救助，白天（選北投區）／晚上（1999） |
| `main-checklist.png` | 急難救助「要準備的東西」勾了 3 項 |

三個設計方向的比較截圖在 `variants/` 子資料夾，保留不動。
