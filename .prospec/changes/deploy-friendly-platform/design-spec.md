# Design Spec：平台整合頁
> 來源：proposal.md（ui_scope: partial）與既有介面。2026-11-07。
> Extract：沿用既有地圖頁的外觀；新控制項只服務平台接線。Ci 已指定產品 prototype/spec 交組員，本輪不另做品牌或產品改版。

## Visual Identity
### Color Palette
| Token | Value | 用途 |
|---|---|---|
| --brand | #0b6e4f | 主要操作、路線 |
| --brand-weak | #e3f2ec | 選取狀態 |
| --text | #1d2321 | 內文 |
| --muted | #5d6763 | 輔助說明 |
| --border | #d9dfdc | 邊界 |
| --surface | #ffffff | 背景 |
| --danger | #b00020 | 錯誤 |
### Typography
沿用系統繁中字體；正文 16px、輔助 14px、標題 22px。表單文字至少 16px，避免手機自動放大。
### Spacing Scale
--space-xs 4px、--space-sm 8px、--space-md 16px、--space-lg 24px；既有卡片圓角 10px、chip 全圓角。互動目標至少 40px。
### Visual Style
白底、綠色單一重點、既有底部導覽；地圖與表單分區，長清單可捲動。狀態以文字搭配顏色，不只依顏色判斷。

## Components
### 服務篩選
四個多選 chip，wifi／充電／廁所／無障礙；選取套 --brand-weak，預設顯示所有名冊。無障礙標籤只代表名冊項目，沒有整條路線通行承諾。
狀態：default 白底；hover/focus 顯示邊框；active 綠色；loading 標示載入；disabled 降低透明度；error 與名冊錯誤共用。
### 地圖與名冊
地圖顯示服務點、選點、候選路線與虛線接線；名冊卡顯示名稱、服務、地址與選點操作。使用 --surface、--text、--brand。
狀態：loading 文字提示；loaded 地圖與清單同步；empty 顯示沒有符合店家；error 保留可讀清單及重試；active 標記選取；hover/focus 呈現明確輪廓；不適用的 disabled 不設虛假按鈕。
### 位置與起迄點
定位狀態、重試、手動起點、目的地選擇與比較按鈕。預設起點等待有效當下位置，展示地圖中心不當作 GPS。
狀態：loading 顯示定位中並防重複提交；default 可手動選；active 顯示選取點；error 顯示拒絕／逾時／精度／時效／範圍原因；disabled 為缺起迄點；hover/focus 沿用品牌輪廓。
### 路線候選
卡片列最短／候選資源較多、估計距離與時間、資源數，點選切換地圖。沒有第二條有效路線時只列一條並說明。
狀態：default 白底；active 品牌邊框；loading 計算中；error 顯示圖資錯誤／不連通並重試；empty 提示先選點；disabled 缺有效輸入；hover/focus 清楚可操作。
### 來源與限制
固定可達的來源頁／連結，呈現資料集日期、範圍與版本；網路需求與地方路網限制用短句。API 失敗顯示錯誤並可重新讀取，不把未知來源填成預設成功。
狀態：loading／loaded／error／retry；連結 hover/focus 有底線，無無意義 disabled 狀態。

## Responsive Strategy
手機 360–430px 為主，單欄、篩選可換行，地圖與控制項不互相遮蔽；平板／桌面保持 max-width 既有頁寬或地圖搭配側欄，避免拉長表單。底部保留導覽及 safe-area，高度不足整頁捲動。鍵盤可用所有選點、篩選及比較功能。

## 設計邊界
無設定 design.platform，依 HTML adapter 的 spec-only 路徑，不新增獨立 HTML prototype。實作以既有視覺與以上狀態核對；組員的四步驟 App prototype 仍是後續 UX 來源，本文件不宣稱產品流程定稿。
