# Interaction Spec：目的地路線與探索控制

> DSL draft-1；2026-11-07；對應 US-1～US-3。

## Screens
- TownPass首頁：預設顯示；點友善同行進專用服務容器。
- 友善探索：現有歡迎與探索流不變；新增route idle／waiting-location／loading／ready／error。
- 店家詳情：保留來源、更新日、導航／撥號，關閉回原地圖狀態。
- 地圖layout：normal／expanded；panel independently expanded／collapsed。

## Flows
### 目的地道路與沿線資源（US-1）
1. 使用者點搜尋、選目的地 → 保留目的地；有GPS即本機計算，無GPS提示重新定位。
2. 結果屬於目前請求且成功 → 畫道路與虛線接線、距離、沿線資源。
3. 類別切換 → 同集合更新highlight／數量／清單；點資源 → 保留道路＋開詳情。
4. 更換目的地 → 取消舊路由並重算；清除目的地 → 取消並清路線、回附近資源。
5. 過時結果 → 忽略；無圖／斷線缺圖／超範圍／逾時 → 提示原因、可重試，不畫假路線。

### 地圖操作（US-2）
1. pointer點出發 → 探索頁不自動聚焦搜尋；鍵盤啟動 → 合理轉焦點並保留提示。
2. 點展開 → 地圖填滿可用區域，面板浮動，保留搜尋及復原。
3. 點面板收合 → 內容hidden、aria-expanded=false；再次點 → 原內容恢復。
4. 點復原 → 原尺寸，定位／目的地／類別／選店家均保留；ResizeObserver更新底圖。
5. 搜尋／詳情dialog關閉 → 鍵盤返回原觸發鈕；pointer不強制新增藍框。

### 原生返回（US-3）
1. 未自訂起始頁時啟動 → TownPass首頁；點首頁或服務清單入口 → 同一友善服務。
2. WebView橋接ready後載入指定服務URL；載入失敗可重試，始終能返回。
3. 點返回台北通 → 直接回原生首頁；系統返回 → 有文件歷史先上一頁，無則native pop。

## Gestures
地圖保留單指移動／雙指縮放；控制按鈕以點擊為主，不依賴拖曳才能展開。面板可縱向捲動，避免攔截整張地圖。

## Micro-interactions
沿用既有短按壓回饋。不得為地圖尺寸做逐格動畫；尺寸變更後invalidateSize。prefers-reduced-motion停用非必要動態。

## Responsive Interaction Differences
手機與桌面操作相同。精細指標才提供hover；鍵盤以Tab走搜尋、定位、展開、面板控制及資源。收合內容不留隱形可focus節點。
