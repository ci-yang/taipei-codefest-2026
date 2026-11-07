# UI 基線重跑

量測來源：平台原始HEAD `18dffb3`，2026-11-07，Chrome headless＋Playwright。實際結果見 baseline.json；測量時應用程式檔尚未修改。量測不輸入真人GPS。

啟動：`python3 -m http.server 8883 --bind 127.0.0.1 --directory docs/prototypes/friendly-route`

量測：`NODE_PATH=/Users/ciyang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node .prospec/changes/improve-route-experience/measure-layout.mjs`

其他機器請將NODE_PATH改為已有Playwright套件的node_modules；亦可由已安裝playwright的環境直接執行。PROTOTYPE_URL可換指定測試網址。測試讀實際DOM與layout，不是截圖估算。
