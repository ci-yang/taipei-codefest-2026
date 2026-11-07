# Lessons Ledger

| key | description | frequency | impact_modules | kind | source_changes | status |
|---|---|---|---|---|---|---|
| prototype/runtime-boundary | 原型已被指定為交付本體時，先確認實際 runtime 與檔案依賴，再移植 bridge 或介面；純 JS 原型不得直接 import 僅存在正式 Vue App 的 composable，也不應另外重建一套框架。依 Ci 的 D7 交接修正。module-map 目前空白，影響模組尚未命名。 | 1 | 0 | convention | enable-friendly-routes | personal |
| privacy/local-routing | Ci 確認目的地路線必須維持本機計算，GPS 不送外部路由服務；路網不足時應擴充可重建的開放道路資料，不能暗中改用遠端路由。跨 Worker 的座標只在記憶體傳遞，查詢、儲存與日誌邊界都須核對。module-map 目前空白，尚無可引用的註冊模組。 | 1 | 0 | convention | improve-route-experience | personal |
