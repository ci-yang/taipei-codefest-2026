# 友善同行 prototype v3 交接

2026-11-07。Ci 指定先更新 prototype，稍後才改規格。本次在獨立 worktree `tcf-prototype-map`、分支 `feat/prototype-resource-map` 完成；未改正式 spec、`apps/`、平台部署或 TownPass App。

- [操作分享版](https://ci-share.pages.dev/da352bef2ecaca09/)
- [Draft PR #3](https://github.com/ci-yang/taipei-codefest-2026/pull/3)，實作 commit `6e4227f`，尚未合併。
- 分享版已以 Chrome 點選布納咖啡館，顯示路線與沿線高亮、店家預覽，未擷取到 console error。任何取得連結的人都能查看及轉傳。
- 收回分享：`bash ~/.claude/skills/publish-report/scripts/share.sh --revoke da352bef2ecaca09`。

## 這版可以操作

- 深灰綠地圖、螢光綠路線、四類服務快捷篩選。
- 點地圖資源預覽路徑與沿線高亮；既有路線上點店家只看資訊，明確按「到這裡」才換目的地。
- 搜尋目的地及起點；外部搜尋結果保留座標與來源，不混作官方友善店家。
- GPS 目前位置獨立於行程起點；使用者明確帶入起點後，重新定位不覆寫。
- 保留日期、歷史、多站設定、路線比較及本機評論／互助／離線展示。

## 檔案與啟動

入口 `docs/prototypes/friendly-route/index.html`；整合邏輯 `app.js`；新地圖排版 `map-ui.css`；地點搜尋 `search.js`；新增資產已加入 `sw.js`。`styles.css`、底圖及路網資料沿用前版。

執行 `pnpm prototype`，開啟 `http://localhost:8766`；若該 port 被占用，自行選另一個 port，不停止其他 session。`pnpm test:prototype` 執行 44 項回歸。完整範圍見 [README](../prototypes/friendly-route/README.md)、[QA](../prototypes/friendly-route/QA.md)。

## 搜尋方案與待定事項

這版暫用開源 Photon 公開示範 API，不需申請金鑰或啟動後端。輸入時查本地名冊，明確提交才送出關鍵字與固定臺北範圍；不送 GPS 或行程。公開端點沒有 SLA，正式多人服務的容量／自架方案待規格討論，不能直接當正式服務承諾。

路線由本地 OSM 步行圖計算，僅涵蓋信義／大安東側。API 能找到的地點可能超出路網；此時提示範圍限制，不繪製假路線。GPS 本輪只以狀態測試驗證，尚無實體手機結果。

本輪通過 44 項 prototype 回歸、workspace typecheck／lint／38 項測試／build、390px 與 320px 瀏覽器 viewport 檢查。另有 fresh-context reviewer 唯讀核對及獨立路由／離線測試。正式規格仍為前版討論基線，待 Ci 確認這版互動後再更新。
