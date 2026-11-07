# 目的地道路與 TownPass 返回交接

## 範圍與分支

- 平台：`feat/destination-route-experience`，由 `18dffb3` 分出；實際入口仍是 `docs/prototypes/friendly-route` 的純 JS App。
- 原生：TownPass `feat/townpass-friendly-entry`，由 `7180078` 分出。
- 規格：`.prospec/changes/improve-route-experience/`，保留原 `enable-friendly-routes` 凍結文件。
- Ci 明確選擇本機算路，GPS 不外送；不接公開路由 API。

## 行為

選目的地且取得 GPS 後，背景 Worker 算步行候選道路與距離。地圖實線為道路，虛線為起終點估計接線；地圖、數量及清單共用路線兩側250m的資源集合。切類別不重算，點店家保留目的地線。

修正進探索頁自動焦點與捲動殘留，START改44px高；可展開地圖、收合浮動面板，再復原原有狀態。TownPass恢復原生首頁及服務入口；未設定起始頁時預設首頁，仍尊重既有設定。明確返回台北通直接回原生頁，系統返回先走網頁歷史。

## 道路資料

官方 Overpass 固定臺北市行政區道路及完整引用節點；271,533節點、621,530有向邊、904分量，runtime 20,758,759 bytes。來源、hash、完整重建命令見 [taipei-routing.md](../prototypes/taipei-routing.md)。`data/friendly/` 相容API快照未修改。

全市圖保留分量後，曾發現車站最近節點落在孤立2點路段。shortest-only改成120m內多候選接線的最短樹，選道路及兩端估計接線總距離；未擴大接線上限。反向鄰接表只在舊替代路線比較需要時建立。不能將候選接線當成已驗證入口、無障礙道路或即時導航。

## 可重跑驗證

- `pnpm test:prototype`：91項Node及17項Python測試通過。
- `pnpm test:tooling`：77項通過，含App大型資產的current／historical讀取界線。
- 原生 `flutter test test/codefest_launch_test.dart test/codefest_service_test.dart`：13項通過。
- 原生 Claude Code Opus review 找出起始頁偏好被覆蓋；新增回歸測試先失敗，恢復原設定讀取後通過。Podfile.lock僅有本機CocoaPods雜訊，已排除。
- 真實瀏覽器腳本 `scripts/check-friendly-route-browser.mjs`：82項通過；完整量測見 `evidence/2026-11-07-route-experience/browser.json`。5種尺寸、Tab/pointer/touch、200%文字、展開復原及資源集合皆覆蓋。
- 指定公開測試座標臺北車站→市府，真Worker算出5,195m、156道路點、473沿線資源；接線合計152m。載圖＋計算303ms是localhost桌面Chrome結果，不能當手機效能。
- 上述瀏覽器receipt後僅更新兩段過時路網提示；最終獨立重跑82項及七檔hash核對存於 `.prospec/changes/improve-route-experience/evidence/browser-final.json`。發布smoke另核對打包產物。

重跑瀏覽器：先啟動repo prototype HTTP server（8883），再以已安裝Playwright的node_modules作NODE_PATH執行腳本；不將真人GPS加入測試。腳本攔截外部底圖並停用Service Worker，因此不能據此宣稱實機與離線快取通過。

## 發布與原生建置

沿用既有Cloudflare Worker與回退腳本。服務入口：`https://taipei-friendly-platform.jason21131.workers.dev`；實際部署SHA以`/app-manifest.json`為準，本文件不把工作樹建置當已部署。完整發布、回退、APK hash與安裝紀錄見 [.prospec release.md](../../.prospec/changes/improve-route-experience/release.md)。

原生 `CODEFEST_SERVICE_URL` 必須明確指定上方HTTPS網址。iOS沿用既有開發簽章與`CODEFEST_IOS_BUNDLE_ID`，不得用全域PRODUCT_BUNDLE_IDENTIFIER覆蓋框架；細節見前次iOS交接。APK仍是測試簽章，不能宣稱商店版。

## 限制

- 開放道路資料可能缺人行穿越、入口或臨時施工；範圍外、無路、缺定位皆明確提示，不補假位置或假線。
- 全市資源／道路與離線底圖是不同覆蓋：內建底圖仍是信義與大安東側，無底圖時資源仍可顯示。
- iOS WKWebView目前不支援本App的Service Worker離線快取，這輪未修復。網路失敗且未載入道路時會提示，不承諾離線算路成功。
- 還原地圖、篩選與畫面測試為桌面模擬；實機操作結果另以安裝後實際檢查為準。
