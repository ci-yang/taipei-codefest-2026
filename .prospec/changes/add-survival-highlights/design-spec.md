# Design Spec: 城市生存雷達
> Generated from: proposal.md (ui_scope: partial)
> Platform: html
> Last updated: 2026-11-07

## Visual Identity
延伸目前App，使用者已指定「用現在版本」：擷取既有Stitch視覺，生成四項新元件；不覆寫舊設計。原型是完整App而非解說頁。

### Color Palette
| Token | Value | Usage |
|---|---|---|
| --color-primary | #3525cd | 既有主要品牌／模式 |
| --color-action | #ff5e3a | 既有主行動 |
| --hl-wifi | #16a7a0 | Wi-Fi 圓圈與密度 |
| --hl-water | #2e8bd8 | 水球與倒數 |
| --hl-gold | #c28a18 | 金幣與試算 |
| --hl-energy | #6ca928 | 可用電量與充電 |
| --hl-shadow | #17202a | 低電量圈外深灰 |

### Typography
既有本機無襯線字型，內文14px；大數字28～36px、tabular-nums；補充12px，重要假設可展開閱讀。主標與短模式名避免320px下互擠。

### Spacing Scale
既有4／8／16／24px；卡片16px圓角、模式與按鈕pill；44px最小觸控高度。

### Visual Style
保留紫橘App外殼與地圖，以四種功能色作語義區分。模式按壓160ms、狀態切換180ms；同心圓／水波／金幣僅在該模式使用且可停。減少動態時保留靜態指標、禁脈動與旋轉。無新框架或動畫依賴。

## Components
### 城市雷達入口與模式列
Layout：首頁一個緊湊城市雷達入口；進入後在原地圖面板上緣4等分模式列，圖示與兩至四字標題；可關閉回一般探索。所有狀態使用既有surface/text/line。
States：default薄邊；hover僅滑鼠；active功能色底；focus可見；disabled低對比並說明；loading文字；error保留退出。

### 地圖圖層
Layout：圖層在資源marker下方且不攔截地圖手勢。Wi-Fi 50m／100m同心圓，50m為估算半徑、外圈是動態示意，統計不得把外圈當覆蓋。低電量圈外深灰，可點選圈內充電。
States：default無額外圖層；active隨模式畫；empty顯示無點位；loading保留地圖；error移除過期圖；reduced-motion靜態；縮圈只於<20%生效。

### 雷達摘要與試玩工具
Layout：面板上方精簡摘要；明示試玩位置／實際GPS，提供展示地點與回GPS；細部假設用details。Wi-Fi統計以目前畫面中心為準並標示。
States：default折疊說明；active展開；無位置提供定位或展示；error重試；disabled不假稱已定位。試玩控制不得藏在開發說明頁。

### 廁所水球計時卡
Layout：80px水球＋大倒數＋步數／路程；開始／暫停／重置與20倍展示切換。選取廁所後marker可有靜態水球提示，水波只動畫單一選取點，面板倒數文字不每秒live announce。
States：empty請選廁所；loading本機算路；ready時間與步數；running水球同步退水；paused波紋停止；finished顯示估計時間到與手動抵達；error無路線不可開始。更換目標取消舊計算。

### 房價金幣卡
Layout：立體金幣視覺＋每秒金額＋行政區和樣本日期；主動按我已抵達才開始累加。公式與資料來源在details，保留官方連結。
States：empty選廁所；no-data待補；ready價格；running金幣轉動／金額增加；paused停止；reset歸零；error仍保留來源。任何數值不表述真實消費或收入。

### 生存縮圈卡
Layout：大電量百分比、滑桿、估算分鐘／距離、圈內充電清單與查看資源；標示電量來源。預設無原生支援用試玩18%，需點試玩才覆蓋實際來源。
States：unsupported說明並可試玩；normal >=20%無遮罩；low <20%深灰圈外；reserve <=5%可走0m；no-position請定位；charging裝置回報充電時顯示充電狀態並停止低電量警戒；error回到手動。

## Responsive Strategy
| Breakpoint | Behavior |
|---|---|
| 320～767px | 單欄App、4模式固定列、短標不擠出螢幕；面板可收合／捲動，地圖仍可展開 |
| >=768px | 沿用現有手機寬度置中，模式卡不無限拉寬 |
| 短橫向 | 地圖工具保留，浮層限高且內部捲動 |
放大200%允許文字換行，數字不得截斷；輸入16px避免iOS自動放大。面板收合後其內控制不可Tab進入。
