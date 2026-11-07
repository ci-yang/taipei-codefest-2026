# 任務：目的地沿途資源與 TownPass 返回

## 本機路由 domain 與 adapter
- [x] T21 官方Overpass固定臺北市query、串流builder／全連通分量compact runtime圖、來源hash重建文件（步驟1；REQ-ROUTE-001）。
- [x] T1 routing.js 新增 shortest-only，沿用幾何與接線，錯誤不回假路線（步驟1；REQ-ROUTE-001／002）。
- [x] T2 routing-worker.js 適配 window/self，載入固定公開圖與router，驗證訊息後只回本機結果（步驟2；REQ-ROUTE-001）。
- [x] T3 route-client.js 實作 cancel／generation／terminate／逾時／缺Worker錯誤，無遠端fallback（步驟2；REQ-ROUTE-001）。

## 原生導向基礎（獨立 repo）
- [x] T4 恢復 MainView bindings／預設首頁索引；TPRoute新增專用路由與精確服務URL導向（步驟5；REQ-NATIVE-001）。
- [x] T5 首頁新增友善入口；CodefestView返回台北通可越過文件歷史，保留系統返回、bridge與重試（步驟5；REQ-NATIVE-001）。

## 網頁 controller 與介面
- [x] T6 app.js 接目的地＋GPS路由、loading/error/ready、晚到與清除；獨立道路與接線layer（步驟3；REQ-ROUTE-001）。
- [x] T7 app.js 統一沿線集合的highlight、列表、計數與類別；選店保線與來源（步驟3；REQ-ROUTE-002）。
- [x] T8 app.js／app-ui.css修pointer焦點、短文案、緊湊START與RWD，保留Tab焦點（步驟4；REQ-UI-001）。
- [x] T9 index.html／app.js新增獨立展開及面板收合狀態、aria、地圖ResizeObserver（步驟4；REQ-UI-002）。
- [x] T10 app-ui.css配置浮動面板、手機／桌面／橫向、縮放字級與reduce-motion（步驟4；REQ-UI-002）。

## 打包與離線介面
- [x] T11 index.html接route-client；sw.js／package-friendly-prototype.py／app-shell-smoke.mjs同步公開路由資產，禁止快取使用者路線（步驟6；REQ-ROUTE-001／002）。

## Tests
- [x] T22 Python builder測節點限制、foot方向、分量保留及compact幾何；舊比較器fixture與新版跨區最短路徑測試分離（步驟1／6；REQ-ROUTE-001／002）。
- [x] T12 Node test新增shortest-only幾何250m邊界、無路／超界與Worker adapter取消／逾時測試（步驟1／2／6；REQ-ROUTE-001／002）。
- [x] T13 Node app-state測目的地路線、GPS競爭、類別集合、清除、保線；焦點／展開還原狀態（步驟3／4／6；REQ-ROUTE-001／002、REQ-UI-001／002）。
- [x] T14 Node／Python測離線公開資產清單及打包hash，禁止個人路由cache（步驟6；REQ-ROUTE-001／002）。
- [x] T15 Flutter測首頁、雙入口、bridge載入、錯誤返回／重試、有文件歷史仍可直接返回（步驟5／6；REQ-NATIVE-001）。
- [x] T16 [V] 真實瀏覽器五種viewport、Tab與pointer、字級、展開還原及真實Worker載圖，保存量測與截圖（步驟6；REQ-ROUTE-001／002、REQ-UI-001／002）。
- [x] T17 [V] 執行prototype／tooling、typecheck、lint、test、build與Flutter targeted tests（步驟6；全部REQ）。

## 交接與發布
- [x] T18 更新DECISIONS、設計對照與跨repo交接，標明路網範圍／實測結果／已知限制（步驟6；全部REQ）。
- [x] T19 [M] 獨立review及verify後部署既有Worker並產新版原生App（步驟6；全部REQ）。
- [x] T20 [V] 可用實機驗證TownPass首頁→友善→返回，保留可回復artifact（步驟6；REQ-NATIVE-001）。

## Summary
**Total Tasks:** 22

## 執行備註
T4／T5 為獨立原生呼叫鏈，可與本機router平行；T6依賴T1～T3的介面契約。UI視覺微調以design-spec與interaction-spec為準。Knowledge空缺不以虛構module補齊；變更路徑及兩個repo皆明示於plan。

發布後T11/T14補正：首次真實smoke因新全市路網超過舊8 MB讀取上限而自動回退；App資產改按manifest與硬上限受控讀取，current及historical、root及其他檔案均測先紅後綠。此為既有發布驗證任務的修正，驗收情境與App行為不變。
