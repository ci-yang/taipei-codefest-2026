# 變更規格：目的地沿途資源與 TownPass 返回

既有 trust-zone 未有 Feature Specs，因此建立 friendly-route-experience 的 US-1～US-3；以下均為 ADDED，不虛構舊 REQ。proposal 同號故事對應此新 feature。

## ADDED

### REQ-ROUTE-001: 本機目的地道路路線
**Feature:** friendly-route-experience
**Story:** US-1
**Description:** 取得真實定位並選目的地後，以本機 OSM 步行圖算路；GPS 不送外部路由。對應 FR-001、FR-003、FR-007。
**Acceptance Criteria:**
1. 有定位＋目的地且在可連通圖內，顯示道路折線、估計接線與距離，實線／虛線可區分，接線不是已驗證入口。
2. 無定位、無圖、離線缺圖、超範圍、無路或逾時顯示具體限制與可行重試；不得把地圖中心當本人或直線當道路。
3. 更換／清除目的地或定位失敗取消過時任務，晚到結果不可覆蓋；晚到有效GPS可觸發當前目的地算路。
4. 清除目的地清除道路／沿線集合，回附近探索；保留其他類別選擇。
**Priority:** High

### REQ-ROUTE-002: 沿線資源單一集合
**Feature:** friendly-route-experience
**Story:** US-1
**Description:** 以道路及明確估計接線的幾何兩側250m選資源，類別多選取聯集；不是步行可達保證。對應FR-002、FR-007。
**Acceptance Criteria:**
1. 地圖highlight、數量、清單均取同一route.storeIds與類別集合；空集合有空狀態。
2. 點店家保留目的地線，可開資訊、來源、更新日與原有導航／撥號。
3. 類別切換只過濾資源，不重算道路；路由過程與結果不持久儲存真實GPS。
**Priority:** High

### REQ-UI-001: 焦點與探索比例
**Feature:** friendly-route-experience
**Story:** US-2
**Description:** 修正未操作的搜尋框與START比例，保留鍵盤焦點。對應FR-004。
**Acceptance Criteria:**
1. pointer進入探索頁未按搜尋時無程式造成的焦點藍框；鍵盤Tab仍有可見焦點，搜尋輸入仍可正常輸入。
2. 320／390／430／768px寬及844×390橫向無整頁水平溢出；標準字級模式文案與START單行，按鈕可觸及；高字級優先完整可讀及可捲動。
**Priority:** High

### REQ-UI-002: 地圖展開與浮動面板
**Feature:** friendly-route-experience
**Story:** US-2
**Description:** 地圖可在App可用區域展開，浮動面板可收合，保留現有Stitch視覺。對應FR-005。
**Acceptance Criteria:**
1. 展開、收合、還原均保留GPS、目的地線、類別及所選資源，不重建地圖，尺寸改變後底圖對齊。
2. 始終保留可達復原操作，收合內容不進Tab序列，aria-expanded／aria-controls與實際狀態一致。
3. 路線fitBounds避開浮動面板；短視窗與減少動態偏好正常操作。
**Priority:** High

### REQ-NATIVE-001: TownPass 首頁與服務返回
**Feature:** friendly-route-experience
**Story:** US-3
**Description:** 未自訂起始頁時啟動回TownPass首頁，友善同行嵌入專用服務容器。對應FR-006、FR-007。
**Acceptance Criteria:**
1. 根頁為MainView＋必要bindings，未自訂起始頁時顯示首頁且有友善同行入口；保留已儲存的起始頁偏好。
2. 首頁與服務清單入口使用同一CodefestView，保留bridge就緒順序、受信任定位來源、載入失敗重試；其他服務不改導向。
3. 可見的返回台北通直接native pop，不受WebView歷史影響；系統返回先上一個文件，無歷史才回原生頁。
**Priority:** High

## MODIFIED
無已註冊REQ可修改；原型與原生行為的替換由以上驗收及plan描述。

## REMOVED
無。
