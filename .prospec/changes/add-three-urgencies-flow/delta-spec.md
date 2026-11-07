# Delta Spec: add-three-urgencies-flow

> REQ ID 採 `REQ-3U-{NUMBER}`（3U = three urgencies）。全部路由到尚未存在的 Feature `friendly-route-app`；Story 為該 Feature 的新 story，編號沿用 proposal US-1～US-3。
> `enable-friendly-routes` 的 delta-spec 仍是空骨架、`prospec/specs/features/` 無 Feature Spec，所以 MODIFIED／REMOVED 沒有可指向的既有 REQ id；下列 MODIFIED／REMOVED 以該 change 的 FR 編號與 route-experience 行為為 Before 出處。**archive 前改列 ADDED，或等 enable-friendly-routes 先 archive 後改用其實際 REQ id**；這只擋 archive，不影響實作。

## ADDED

### REQ-3U-001: 三急首頁

**Feature:** friendly-route-app
**Story:** US-1

**Description:**
App 開啟即為首頁：三顆全寬大按鈕「廁所」「充電」「網路」、一行定位狀態（沿用 `enable-friendly-routes` FR-001 的定位規則與失敗語句），以及「看地圖」「設定」小入口。首頁不顯示地圖、歡迎頁、出發鈕、交通偏好或雷達入口。（FR-001）

**Acceptance Criteria:**
1. 冷啟動後 `#app[data-view]` 為 `home`，三顆按鈕可見且各自帶 `data-urgency` 為 `toilet`／`charge`／`wifi`。
2. 首頁顯示定位中、成功（含精度）、精度不足、無法取得定位四種狀態之一，失敗時有重新定位入口。
3. 首頁 DOM 不含地圖容器可見元素、`#enter-app`、`data-transport` 與 `#highlight-launch`。

**Priority:** High

---

### REQ-3U-002: 最近一家結果卡

**Feature:** friendly-route-app
**Story:** US-1

**Description:**
按任一按鈕時，依目前定位挑該類別直線距離最近的一筆並顯示結果卡；輪椅／推車偏好開啟時只在有無障礙標記者中挑，沒有就回最近一筆並標「無障礙資料不足」；無有效定位不出卡。（FR-002）

**Acceptance Criteria:**
1. 固定位置與固定資料下，三類別結果卡那一筆等於程式外重算的直線最近者；「換下一家」依序給第二、第三近，之後不再前進。
2. 卡片含名稱、直線距離、方向文字、無障礙「有／未標示」、來源與更新日，以及「帶我去」「開口卡」「看地圖」三鈕（該筆為公眾 Wi-Fi 熱點、`sourceId` 為 wifi 時不顯示「開口卡」）；精度大於 100 m 時距離前加「約」。
3. 輪椅偏好開啟：存在有標記者的案例只回傳 `services` 含 `accessible` 者；不存在的案例回傳最近者並顯示「無障礙資料不足」。
4. 無有效定位時不出卡，顯示「需要定位才能找最近」、重新定位與「看地圖」，不以地圖中心計算。
5. 「網路」類別卡片標「免費 Wi-Fi 熱點，不保證訊號」，無電話欄位時不出撥號。
6. 同距離多筆以資料順序穩定排序，同輸入重算結果相同。

**Priority:** High

---

### REQ-3U-003: 帶我去導引

**Feature:** friendly-route-app
**Story:** US-1

**Description:**
「帶我去」進入導引畫面，立即顯示方向箭頭與直線距離；本機步行路網算出路線時另畫路線並顯示步行距離與估計分鐘。廁所可接水球倒數，充電在電量低於 20% 或手動試玩時疊生存圈。（FR-003）

**Acceptance Criteria:**
1. 進入導引的同一輪渲染即有依方位旋轉的大箭頭（啟用方位感測時隨裝置轉向）與標「直線」的距離，不等待路線計算。
2. 路線計算成功時另顯示標「步行」的距離與分鐘，「直線」「步行」兩個數字各自標示、不互相否定；失敗、逾時或計算中只有箭頭與直線，無空白與無限載入。
3. 導引期間位置更新不重算已算出的路線，也不取消使用者另設的目的地路線。
4. 廁所導引在導引畫面內顯示水球倒數，沿用導引已算出的路線，不重算第二次；位置更新不重置倒數；路線算出前不出開始鈕，改顯示「步行路線計算中」或「需要步行路線才能倒數」。
5. 充電導引在電量低於 20% 或手動試玩時顯示生存圈，否則不顯示；離開導引後生存圈遮罩清除。

**Priority:** High

---

### REQ-3U-004: 開口卡

**Feature:** friendly-route-app
**Story:** US-2

**Description:**
從結果卡或地圖選取卡片（`selectedCard`）開啟全螢幕雙面卡：上半給店員的中文句、下半使用者母語的同一句，兩面附「不方便也沒關係，謝謝」。文案內建、離線可用、不記錄不送出。（FR-004）

**Acceptance Criteria:**
1. 三類別各有固定中文句，所選母語（英、印尼、越南）句子與之一一對應；母語為中文時只顯示單面。
2. 開啟、切換、關閉開口卡期間網路請求為零，飛航模式下可開啟。
3. 句庫中 `reviewed: false` 的語言不出現在語言清單；README 資料來源表旁的校對人與日期與句庫的 `reviewedBy`／`reviewedOn` 一致，未填者寫「待補」。
4. 關閉後回到來源：結果卡回結果畫面，選取卡片回地圖且同一筆仍選取；畫面無輸入框、無送出或回覆機制、無 storage 寫入。

**Priority:** High

---

### REQ-3U-005: 本機偏好設定

**Feature:** friendly-route-app
**Story:** US-1

**Description:**
設定提供「母語」（只列已校對語言）與「輪椅／推車」偏好，只存在本機 `localStorage`，不送出；母語同時決定 US-2 開口卡下半語言。（FR-005）

**Acceptance Criteria:**
1. 偏好寫入 `friendly-native-language-v1`（`zh-TW|en|id|vi`）與 `friendly-step-free-v1`（`1|0`），重開 App 後還原。
2. 讀到未校對或不合法的語言值時退回中文單面並提示。
3. `localStorage` 不可用時功能照常，只是不保存。

**Priority:** Medium

---

### REQ-3U-006: 地圖第二層與開口卡入口

**Feature:** friendly-route-app
**Story:** US-3

**Description:**
「看地圖」進入既有地圖頁：目的地搜尋、多選類別、清單、快取狀態列、雷達工具列全部保留；從結果卡進入時該類別已 highlight、該筆置中並開卡；地圖選取卡片多一顆開口卡。（FR-006）

**Acceptance Criteria:**
1. 從首頁與結果卡各進入一次地圖，返回鍵（含 Android 系統返回）回到來源畫面；巢狀路徑 首頁 → 結果卡 → 地圖 → 開口卡 連按返回依序回地圖、結果卡、首頁，第四次才離開微服務。
2. 從結果卡進入時 `state.filters` 只含該類別、`selectedId` 為該筆、卡片已開。
3. 地圖選取卡片（`selectedCard`）同時有「導航」、「撥號」（有電話時）與「開口卡」；公眾 Wi-Fi 熱點不顯示「開口卡」。
4. 390px 寬度下首頁、結果卡、導引、開口卡、地圖五畫面無水平溢出。

**Priority:** Medium

---

## MODIFIED

### REQ-3U-101: 開啟後的第一個畫面

**Feature:** friendly-route-app
**Story:** US-1

**Before:**
`enable-friendly-routes` FR-001／route-experience：開啟即顯示歡迎頁，按「出發」進入地圖探索頁，定位與距離在地圖上呈現。

**After:**
開啟即為三急首頁（REQ-3U-001），地圖改由「看地圖」進入；定位規則、精度門檻與失敗語句不變。

**Reason:**
急用者不需先看地圖；副局長評語指出三步才到一家。

**Spec:**
App 開啟時顯示三急首頁，地圖頁為第二層入口；定位規則沿用 `enable-friendly-routes` FR-001。
- WHEN App 開啟，THEN 顯示三急首頁而非地圖或歡迎頁
- WHEN 使用者按「看地圖」，THEN 進入地圖頁，返回回到首頁

**Priority:** High

---

### REQ-3U-102: 地圖選取卡片的動作

**Feature:** friendly-route-app
**Story:** US-3

**Before:**
`enable-friendly-routes` FR-003：地圖選取卡片（`selectedCard`）有「導航」（`launch_map`）、有電話才出現的「撥號」（`phone_call`）、資訊與方向；資訊 sheet（`showDetails`）有複製地址與電話、導航、方向，沒有撥號。

**After:**
選取卡片另加「開口卡」（REQ-3U-004）；資訊 sheet 不變；導航與撥號的 bridge 呼叫、退路與失敗處理不變。

**Reason:**
到門口的最後一步需要面對面表達工具，與撥號同層級，不經平台。

**Spec:**
地圖選取卡片提供導航、有電話時的撥號，以及開口卡；導航與撥號行為沿用 `enable-friendly-routes` FR-003。
- WHEN 使用者在地圖選取一筆非公眾 Wi-Fi 熱點的資源，THEN 選取卡片顯示「開口卡」動作；熱點不顯示
- WHEN 使用者按「開口卡」，THEN 開啟開口卡，關閉後回到地圖且同一筆仍選取

**Priority:** Medium

---

## REMOVED

### REQ-3U-201: 歡迎頁與「出發」鈕

**Reason:**
首頁直接是三顆按鈕（REQ-3U-001），歡迎頁多一步且只有統計數字，與急用流程衝突。

---

### REQ-3U-202: 交通方式偏好（步行／捷運／單車／開車）

**Reason:**
偏好從未改變路線計算（導引固定直線＋本機步行路網），留著會暗示有多模式路線；proposal US-3.3 要求不出現在任何畫面。

---

### REQ-3U-203: 首頁的城市生存雷達入口

**Reason:**
雷達四模式降到地圖頁工具列（`#highlight-map-launch` 保留）；首頁只留三急。

---
