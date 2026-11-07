# Design Spec: 友善同行淺色 App 原型

> Generated from: proposal.md (ui_scope: full)
> Platform: html
> Last updated: 2026-11-07
> 模式：Extract。Ci 已指定從提供的設計稿擷取並先做原型；本版為待 Ci 審閱的設計基準。來源識別、截圖與實作映射另見 screen-map.md，不在本文件耦合工具節點。

## Visual Identity

### Color Palette

| Token | 值 | 用途與依據 |
|---|---|---|
| --color-primary | #3525cd | 選取類別、定位、圖示；來源探索稿主色 |
| --color-action | #ff5e3a | 出發、START、目標旗標與資源連線；來源明確覆寫的橘色 |
| --color-background | #f6f8fc | 探索頁背景；以實際畫面背景覆寫設計集的泛用底色 |
| --color-surface | #ffffff | 搜尋膠囊、卡片、交通列 |
| --color-text | #0f172a | 標題與主要文字 |
| --color-muted | #64748b | 輔助資訊；不可用淺灰取代必要狀態 |
| --color-map | #edf1f8 | 地圖底色 |
| --color-building | #e0e7f3 | 建物與街廓 |
| --color-road | #ffffff | 道路背景 |
| --color-scrim | rgba(15,23,42,.50) | 店家詳情遮罩 |

畫面主色以實際來源畫面為準；不把來源設計集其他主題色套進本套。定位／成功狀態須同時有文字，不能只用綠點表示。

### Typography

| Token | 字型 | 尺寸／行高 | 字重 | 用途 |
|---|---|---|---|---|
| --font-family | 系統 sans-serif、PingFang TC、Noto Sans TC 後備 | 依角色 | 400–800 | 離線不依賴字型下載；來源為 Plus Jakarta Sans，列入差異表 |
| --font-hero | 同上 | 32／38px | 800 | 首頁雙行主標 |
| --font-heading | 同上 | 16／22px | 700 | 區塊標題 |
| --font-body | 同上 | 14／20px | 400–600 | 店家名稱、說明與表單 |
| --font-label | 同上 | 12／16px | 600 | 距離、來源與狀態 |
| --font-metric | 同上 | 26／32px | 700 | 首頁資料量與導引距離 |

來源部分輔助字為 10–11px；原型必要狀態至少 12px，避免低視力使用者難以閱讀。保留系統文字縮放與頁面縮放。

### Spacing Scale

| Token | 值 | 用途 |
|---|---|---|
| --space-xs | 4px | 圖示及小標籤 |
| --space-sm | 8px | 卡片內小間距 |
| --space-md | 16px | 模組內距 |
| --space-page | 20px | 手機兩側留白，取自來源 |
| --space-lg | 24px | 模組間留白 |
| --map-height | 360px | 探索、目的地、資源連線共用地圖高度 |
| --radius-card | 16px | 標準白卡 |
| --radius-pill | 999px | 搜尋、類別與主按鈕 |

### Visual Style

淺色街廓上疊白色浮動控制；地圖直接延伸至最上緣，沒有橫式 App Bar、頭像與返回列。類別／資源卡採水平滑動；主要卡片柔和陰影，色彩主要集中於紫色狀態與橘色動作。首頁採抽象曲線與節點營造出發氛圍，不能被讀成實際導航路徑。探索與導引的地圖使用真實可追溯開放圖資，不複製示意街道作為可通行路網。

## Components

### 通用互動狀態

下表適用於以下全部可互動元件；個別例外另列。不適用的非同步狀態明示不產生，不能因版面沒有畫出而省略錯誤退路。

| 狀態 | 視覺與行為 |
|---|---|
| Default | 白底、深色文字，主動作橘底，選取狀態紫色 |
| Hover | 滑鼠輕微加深底色；不靠 hover 才能發現必要資訊 |
| Focus | 可見紫色外框，焦點不被裁切 |
| Active | 按壓輕微縮小或加深；選取同時有文字／aria 狀態 |
| Disabled | 降低強度、不可送出；保留可讀原因 |
| Loading | 顯示實際載入文字，會重複送出的動作暫停 |
| Error | 就近文字說明與重試，保留既有可用內容 |

### 首頁與出發
**Layout:** 單欄滿高、雙行主標、中央抽象曲線、底部兩張白色資訊卡與滿寬橘色出發鈕。側邊留白採 --space-page；桌面仍為手機容器。首頁不加提案文案或教學輪播。
**Children:** 網路標籤、主標、副標、裝飾圖、全市資源卡、離線狀態卡、出發鈕。
**Tokens:** --font-hero、--color-action、--color-surface、--space-page。
**States:** 預設真資料筆數；載入／離線／失敗顯示實際快取狀態；任何狀態都可出發。出發套用通用 hover／focus／active，無 disabled 或另設非同步請求。

### 地圖與資源標記
**Layout:** 探索地圖高 --map-height；搜尋、目的地與選資源不改變高度。導引時地圖填滿可用畫面，保留圖資署名。以紫色標示目前位置與符合資源，橘色標示目的地／資源連線；非符合點降低強度但不移除。
**Children:** 真實圖資、位置精度、四類標記、目的地旗標、選資源連線、來源署名。
**States:** 一般／highlight／選取具有形狀及文字差異；定位載入顯示文字；失敗明示目前非本人位置；無底圖不假造道路，仍有點位與方位退路。無座標資源不能產生 marker。連線用虛線並標「直線距離（非步行路線）」。
**Tokens:** --color-map、--color-building、--color-primary、--color-action。

### 浮動搜尋與定位鈕
**Layout:** 地圖左上白色搜尋膠囊，標準上距 32px 並納入安全區；右上單一圓形定位鈕，兩者不相撞。目的地名稱截斷後仍可進搜尋看完整名稱。
**States:** 搜尋 Default 為提示；有目的地為名稱及清除入口。搜尋 Loading／空結果／離線僅本機／Error 各有就近文字。定位 Loading 不偽裝成功；拒絕／逾時可重試。Hover、Focus、Active、Disabled 依通用狀態；定位失敗不阻擋搜尋。
**Tokens:** --radius-pill、--color-surface、--color-primary、--space-page。

### 類別膠囊
**Layout:** 單行水平滑動，Wi-Fi／廁所／充電／無障礙四類均可觸及，圖示配文字，最小觸控高度 44px。
**States:** 未選白底、選取紫底白字；可多選並明示任一符合，再按取消；零筆仍顯示零，不偷偷變更類別。無獨立 Loading／Error／Disabled，資料錯誤由附近區塊承接；Hover、Focus、Active 依通用狀態。
**Tokens:** --color-primary、--color-surface、--radius-pill。

### 附近資源橫滑卡片
**Layout:** 標題／結果數／距離排序提示，下方固定寬白卡橫滑，首卡完整、下一卡局部露出。卡片基準高度約 160px，可隨內容增加；名稱最多兩行，預覽省略地址，詳情保留完整地址。來源名稱可單行省略，但更新日期保持完整；內容含名稱、實際直線距離、服務標籤與來源，不放評分、假營業狀態或假步行分鐘。
**States:** 選取有紫色強調；空結果提供移動地圖／搜尋入口；資料缺漏標未提供。無額外載入請求；錯誤不清空可讀資料。Hover、Focus、Active 依通用狀態，無座標仍可開詳情但不能畫線。
**Tokens:** --radius-card、--space-md、--color-muted、--color-surface。

### 模式與 START
**Layout:** 白卡左側方向圖示、兩行模式文字，右側橘色 START；必要時副標換行，不能推擠按鈕超出畫面。
**States:** 自由探索／前往已選資源兩種。未選資源切到資源模式時提示先選店，不假造終點；START 自由探索可直接進滿版地圖。無 Loading；錯誤保持原狀態。Hover、Focus、Active 依通用狀態。
**Tokens:** --color-primary、--color-action、--radius-card。

### 已選資源摘要
**Layout:** 選取後以單張精簡白卡替代附近橫滑卡；名稱最多兩行 16px，距離 20px，來源與完整更新日 12px，必要操作在同一列。卡片不固定高度，正常內容約 200px；完整資訊在中央詳情卡。保留 44px 關閉與動作觸控區，START 緊接下方。
**States:** 有電話才顯示撥號；無電話保留詳細資訊。無 GPS 必須標地圖中心估算，不冒充本人距離；來源長名稱可省略但詳情完整顯示。Hover、Focus、Active 依通用狀態。
**Tokens:** --color-primary、--color-surface、--color-muted、--radius-card。

### 交通偏好列
**Layout:** 依序步行、捷運、單車、開車四等寬格，圖示加名稱，不顯示時間。選取項紫色並有淺底形狀；區塊旁不得顯示「即時路況最佳化」。
**States:** 單選，四種偏好可切換；顯示「直線距離，非所選交通方式路線」。尚無路由時不能呈現路徑成功／時間。無網路請求、Loading 或 Disabled；Hover、Focus、Active 依通用狀態。
**Tokens:** --color-primary、--color-surface、--color-muted、--radius-card。

### 店家詳情彈窗
**Layout:** 中央亮白卡、半透明灰色背景，手機左右保留 20px，長內容卡內直向捲動。標題、關閉、距離、服務列表、條件、來源與更新日、主要動作；不被底部交通列遮住。
**States:** 開啟聚焦卡片、關閉回到觸發點；未知欄位明示，無電話不放撥號；外部動作送出顯示 Loading，失敗就近說明與可複製欄位；無 bridge 顯示需在台北通 App 使用。來源連結不被長字串撐寬。Hover、Focus、Active／Disabled 依通用狀態。
**Tokens:** --color-scrim、--color-surface、--radius-card、--color-primary。

### 全螢幕導引
**Layout:** 上方簡潔關閉／標題，白色距離與方位 HUD，中央真實地圖與選取資源，底部資源入口及結束按鈕；延續橘紫色彩。沒有個人、語音或未實作的 3D 街景控制。
**States:** 有 GPS＋資源時顯示正北基準方位及直線距離；無 GPS 提供重新定位，不顯示假箭頭；自由探索顯示附近資源狀態而不偽造目標。離線保留相同計算；無底圖可開方向與距離。退出保留地圖工作狀態。Hover、Focus、Active 依通用狀態，錯誤／載入與定位元件共用。
**Tokens:** --color-primary、--color-action、--font-metric、--color-surface。

### 次層搜尋、方向與離線設定
**Layout:** 沿用可關閉的同系統白色面板；搜尋框、結果列表、方位箭頭或快取資訊各自依目的組織。離線設定從探索底部可到達，無需帳號。
**States:** 搜尋有空／載入／完成／無結果／錯誤／離線；方位有未授權／不可用／正北基準／感測成功；快取有未開始／進行中／完成／部分失敗。按鈕 hover／focus／active 依通用；不重複發送時 disabled，有可恢復錯誤則重試。部分完成不可稱已全部快取。
**Tokens:** --color-surface、--color-text、--color-muted、--space-page。

## Responsive Strategy

### Breakpoints
| 範圍 | 佈局 | 留白 |
|---|---|---|
| 320–379px | 單欄；縮短次要標籤，卡片橫滑，必要時垂直捲動 | 16–20px |
| 380–480px | 390×884 為標準；地圖 360px，內容依序堆疊 | 20px |
| >480px | 置中手機容器，最大 480px；不新增桌面儀表板 | 容器內 20px |

### Layout Adaptations
一般探索以直向捲動承載內容，地圖與卡片高度不因搜尋狀態跳動；導引專用滿高圖面與固定控制。安全區計入頂部搜尋與底部操作，短螢幕與 200% 文字放大時允許捲動，不裁掉出發、關閉或導航。詳情最大高不超過可用視窗並可捲動。

### Navigation
首頁出發進探索；搜尋與詳情為次層面板；START 進導引，結束返回探索；探索底部提供首頁與離線資料入口。沒有帳號分頁、說明入口或確認路線頁。手機點擊與桌面鍵盤都走相同狀態轉換。
