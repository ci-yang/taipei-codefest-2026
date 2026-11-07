# Lessons Ledger

| key | description | frequency | impact_modules | kind | source_changes | status |
|---|---|---|---|---|---|---|
| prototype/runtime-boundary | 原型已被指定為交付本體時，先確認實際 runtime 與檔案依賴，再移植 bridge 或介面；純 JS 原型不得直接 import 僅存在正式 Vue App 的 composable，也不應另外重建一套框架。依 Ci 的 D7 交接修正。module-map 目前空白，影響模組尚未命名。 | 1 | 0 | convention | enable-friendly-routes | personal |
