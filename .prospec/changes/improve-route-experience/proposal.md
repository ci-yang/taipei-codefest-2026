# 目的地沿途資源與 TownPass 返回流程

## Background
Ci 在實機試用後要求目的地顯示路徑與沿途資源，並回報搜尋鈕未操作即有藍框、探索 START 比例過大與文字換行。Ci 另要求恢復 TownPass 首頁，友善同行由首頁進入且可返回，地圖可展開或控制面板可收合。

## Premise
```yaml
problem: "目的地僅有旗標，缺少沿途資源路線；原生殼直開 WebView，探索控制比例與焦點管理也需調整。"
source: user-observation
source_ref: "Ci 2026-11-07 本輪功能與 bug 清單"
evidence:
  kind: observation
  ref: "平台18dffb3的app.js、app-ui.css、index.html；TownPass7180078的tp_route.dart、codefest_view.dart"
  result: "獨立程式檢查確認setDestination只放旗標、探索主動聚焦搜尋鈕、START固定尺寸、原生根路由直接為CodefestView。"
withdrawal: "若Ci撤回目的地路線或原生首頁要求，保留原流程並另記決策，不用舊原型假設覆蓋新指示。"
verification:
  status: verified
  by: "Codex與route_explore、ui_explore、native_home_explore唯讀核對"
  conclusion: "已確認流程缺口與程式設定；藍框的視覺成因仍需瀏覽器操作核對，不宣稱全部UI問題已重現。"
```

## User Stories
### US-1: 依目的地道路路線尋找沿途資源 [P0]
作為外出需要廁所、充電或網路的市民，我想選目的地後看見步行道路路線與沿途資源，以便選擇途中停靠點。
**Acceptance Scenarios:**
- WHEN 目前位置與目的地齊全，THEN 顯示步行道路路線與距離，起終點估計接線和道路段可區分。
- WHEN 切換類別或點沿線資源，THEN highlight、數量與清單使用同一沿線集合，詳情保留來源及更新日，目的地路線不消失。
- WHEN 快速更換或清除目的地，THEN 舊回應不覆蓋新狀態，清除後回到附近資源探索。
- WHEN 無定位、斷網或無可用路線，THEN 明確提示限制，不將直線或地圖中心偽裝成道路路線與本人位置。
**Independent Test:** 固定公開地標座標驗證路線、沿線集合與非同步取消，不使用真實測試者GPS。

### US-2: 緊湊且可展開的探索地圖 [P0]
作為手機使用者，我想保持控制緊湊並能收合面板看完整地圖，以便辨認路線與資源。
**Acceptance Scenarios:**
- WHEN 以觸控或滑鼠進探索頁且未按搜尋，THEN 沒有非操作產生的搜尋藍框；鍵盤Tab仍保留可見焦點。
- WHEN 使用320、390、430、768像素寬度及手機橫向，THEN START與模式主文案不互擠或非必要換行，無整頁水平溢出且操作可觸及。
- WHEN 收合面板或展開地圖再復原，THEN 地圖使用App可用區域且保留復原鈕，目的地、路線、類別與已選資源不遺失。
**Independent Test:** 同尺寸截圖、鍵盤與觸控操作、縮放字體及反覆展開復原，檢查地圖重新計算尺寸。

### US-3: TownPass首頁進入與返回 [P0]
作為TownPass市民，我想由原生首頁進友善同行並能返回首頁，以便繼續使用其他服務。
**Acceptance Scenarios:**
- WHEN 未自訂起始頁而啟動原生App，THEN 顯示TownPass首頁與友善同行入口，不以友善WebView取代原生根頁。
- WHEN 點首頁或服務清單入口，THEN 進入同一友善服務容器，保留橋接、定位及載入失敗重試。
- WHEN 點返回台北通，THEN 即使WebView有文件歷史也直接回TownPass；系統返回先處理文件歷史，無歷史才回原生頁面。
**Independent Test:** Flutter測試首頁、入口、橋接載入與返回；實機確認首頁到服務再返回。

## Stated Assumptions
1. improve-route-experience採standard，限定純JS原型與Flutter兩個既有實作面；不換框架、不新增登入或互助。
2. 第一版為步行路線；其他交通方式不宣稱已支援，無障礙資源不代表道路通行性已驗證。
3. 沿途預設為路線幾何兩側250公尺，類別多選採聯集；此範圍不保證步行可達。
4. 無定位時請求定位，失敗保留目的地與重試，不用假位置畫道路。
5. 地圖採App內展開與可收合浮動面板，不依賴瀏覽器Fullscreen API。
6. 保留Stitch淺色、橘色主操作與紫色資源點；針對既有設計修整。
7. 原生未自訂起始頁時以TownPass首頁開始，保留既有起始頁偏好；返回台北通與網頁上一頁分開。
8. Ci已確認維持本機算路、GPS不外送；以固定公共臺北市範圍擴充本機道路資料。已知iOS離線快取限制不宣稱已修正。

## Edge Cases
- 無路線、回應無效、逾時或取消：清除過期線條並提供明確狀態。
- 沿線或所選類別零筆：顯示空狀態，目的地路線保留。
- 高字級或短視窗：內容可捲動，完整文字優先於強迫全部單行。
- 返回後重進、錯誤遮罩或外部網址：保留既有橋接限制與其他服務行為。

## Functional Requirements
- FR-001：目的地步行道路、距離、接線差異與失敗狀態（US-1）。
- FR-002：沿線集合共用於地圖、數量及清單，選店家保留目的地（US-1）。
- FR-003：定位與目的地競爭保護、清除與重試（US-1）。
- FR-004：焦點管理、緊湊START與手機RWD（US-2）。
- FR-005：地圖展開復原及浮動面板收合且保留狀態（US-2）。
- FR-006：TownPass首頁、共用友善入口與返回（US-3）。
- FR-007：保留真實來源、開源地圖、橋接與離線失敗提示（US-1～US-3）。

## Success Criteria
- SC-001：公開地標起終點產生道路路線而非兩點直線，沿線集合測試可重跑。
- SC-002：成功、失敗、取消、晚到回應與清除測試通過。
- SC-003：指定四種寬度及橫向無整頁水平溢出，標準字級主文案與START單行。
- SC-004：觸控無初始藍框、Tab焦點保留，地圖展開復原通過。
- SC-005：Flutter首頁→友善同行→返回測試通過，既有bridge及重試不退步。

## Related Modules
已讀prospec/index.md；module-map空且Feature Specs不存在。以docs/prototypes/friendly-route、打包與測試及外部TownPass為範圍，Knowledge記WARN，不宣稱已註冊模組。

## Open Questions
路由供應者與可用性於計畫階段驗證；藍框視覺成因及高字級版面於實作驗證補齊。

## Constitution Check
開源免費地圖與真實開放資料，無雲端LLM、secret、帳號或互助；各故事具可觀察驗收，真實GPS不進測試資料與repo。Knowledge缺漏為WARN。

## UI Scope
**Scope:** partial
既有探索頁、目的地路線、浮動控制；原生恢復既有首頁與明確返回。
