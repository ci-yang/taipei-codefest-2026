# 平台建置證據

## 本輪指示
Ci 負責實際前後端、開源 map、infra deploy 與 App 設定，組員改 prototype/spec；偏好 Cloudflare，可與 Claude 協作。

## 現況核對
- 基線 main 5d94fc508d09ca15aa460b752a20afab6c435c92。
- API app.ts 僅 healthz／places／opendata；2026-11-07 線上首頁與健康皆 200，places 五筆為 seed:demo，不等於友善產品完成。
- 原型 metadata：103 店、9,483 節點／24,314 有向邊；正式導入需重驗來源與雜湊。
- Wrangler 4.158.0 whoami 已登入，Workers/D1 write 可用；未輸出 token。
- TownPass head 1290c052fc7bd8d0f048b95713b1516d4f2d9808，CODEFEST_SERVICE_URL 決定入口，缺 coarse permission；工具鏈可用，adb 無實機。
- Claude Code 2.1.319／claude-opus-5-5 已獨立評估，支持 Worker＋Assets＋D1、裝置路由、GCP 保留；估計建置時間與 DNS 風險未當成量測。

官方文件：
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- https://developers.cloudflare.com/d1/sql-api/sql-statements/
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/
- https://developer.android.com/develop/sensors-and-location/location/permissions/runtime
