# 原型檢查紀錄

日期：2026-11-07。這是 Ci 審閱前的原型檢查，並非正式 prospec-review／prospec-verify 站收據；狀態保留 story。

## 來源與範圍

- 使用 Ci 指定的 Stitch 專案；OpenCLI `hcxs5tb4` 取得四張畫布截圖，另以 Stitch Export 取得六組原始 PNG／HTML。來源檔 SHA-256 由獨立代理核對全部 12 檔一致。
- 個人帳號未製作。新增首頁、交通偏好列與滿版導引已有 proposal／design-spec／interaction-spec；原 enable-friendly-routes proposal blob 仍為 `6da4a77f904db5877d10fe8a54adf90356a178dc`。
- 六張來源與原型對照見 screen-map.md。原型位置 `docs/prototypes/friendly-route/`，沒有在正式 App 插入報告或解說頁。

## 機器檢查

| 檢查 | 結果 |
|---|---|
| proposal、design-spec 結構驗證 | PASS |
| `pnpm typecheck`、`pnpm lint` | PASS；一般 lint 忽略 prototype 目錄，不宣稱覆蓋其 JS |
| `pnpm test` | 113 項通過 |
| `pnpm test:prototype` | 77 項 Node＋9 項 Python 通過 |
| `node --test scripts/build-friendly-app.test.mjs` | 5 項通過 |
| `pnpm build` | API／Vue／App 建置成功；分享版另以 canonical packager 重包最終 UI |
| `node --check`、`git diff --check` | 通過 |
| 內容閘門 | 文件手動執行 content-gate；通過 |

原型測試涵蓋晚到定位、關閉詳情後舊外部動作不重開視窗、目的地與資源獨立、無 GPS 不畫線、真實方位、離線超出底圖提示與快取失敗。測試 fixture 不當成實地 GPS 證據。

## 真瀏覽器檢查

- 390×884：首頁 → 出發 → 本機搜尋「台北101」 → 目的地 → 選資源 → 詳情 → START → 導引 → 結束均可操作；截圖存 `docs/design/stitch-20261107/implementation/`。
- 一般瀏覽器點導航，顯示「需在台北通 App 內使用。可複製地址。」；未宣稱成功開啟原生導航。
- 320×568 導引：無整頁水平溢出，HUD 下緣約 229px、底部操作在 492–544px，兩者沒有重疊。首頁短螢幕可直向捲動至出發按鈕。
- 430×932：無整頁水平溢出，探索地圖保持 360px。
- 停止本機 HTTP server 後，實際重新載入已快取頁面，首頁仍顯示 5,948 筆；本機搜尋「台北101」仍得到 4 筆。此項驗證來源伺服器不可用時的 app shell／資料快取，**不等同手機飛航模式**。
- 真瀏覽器有測到 GPS 成功與逾時；未記錄／提交真實定位座標。提交的導引截圖採無 GPS 狀態，尚缺有定位路線的受控視覺截圖。

## 獨立核對

另一位未產出 UI 的代理核對新規格、來源雜湊、final code 與六張實作截圖，結果：無 critical／major 阻斷。

可接受差異：真實 OSM 與資源取代示意資料；來源及失敗提示增加高度，交通列必要時下捲；S04 為精簡選取卡；S05 比原稿高，但主要動作與關閉仍可見。S04 調整後，390×884 截圖內可看見完整 START。

尚未驗證：TownPass Android 實機、飛航模式、原生導航／撥號、200% 系統字級、iOS／Android WebView 差異。有 GPS 的直線幾何以自動測試覆蓋，未宣稱實機視覺驗收。真正道路路由與交通估時仍不在本版能力內。

## 交接

後續先讓 Ci 審閱本原型，再進 `prospec-plan`。正式實作必讀三份規格、screen-map 與六張來源／實作截圖；變更差異須記錄，不能以結構 PASS 取代視覺核對。

Met 3/3 | Unmet: 無結構缺件；Ci 尚未審閱 | Overall: WARN | Next: 審閱原型後進 prospec-plan。
