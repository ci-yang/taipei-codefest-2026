# Stitch 設計來源封存

來源：[Ci 指定的 Stitch 專案](https://stitch.withgoogle.com/projects/14902006353412021038)。2026-11-07 使用 OpenCLI 設定檔 `hcxs5tb4` 截取瀏覽器畫布；OpenCLI 1.8.4 的跨域 iframe 元素無法操作，故以 CUA 點擊 Stitch 的 Export → .zip 下載。下載中未改原設計，未 Remix 或重新生成。

`00-overview.png` 及 `01-home-browser.png`、`02-route-detail-browser.png`、`03-guidance-browser.png` 為 OpenCLI 瀏覽器截圖。`source/*.png` 是 Stitch 匯出的原始設計畫面，並非本次改版完成截圖；`*.html.txt` 是原始 HTML 參考，保留字串與樣式以核對，避免誤當可執行的正式 App。`manifest.json` 記錄來源、節點、尺寸與 SHA-256。原 ZIP 保留於本機 Downloads，未保存不相關設計主題與個人帳號的獨立稿／HTML；畫布截圖仍可能包含旁邊的帳號稿作為範圍證據。

| 檔名前綴 | 用途 |
|---|---|
| S01-home | 首頁 |
| S02-nearby | 附近探索 |
| S03-destination | 目的地旗標 |
| S04-resource-route | 資源路徑外觀 |
| S05-detail | 店家詳情彈窗 |
| S06-guidance | 全螢幕導引 |

規格與差異：[screen-map.md](../../../.prospec/changes/adopt-stitch-prototype/screen-map.md)。實作須對照該表：原稿有示意店家、評分與未證實能力，外觀可採用，不能直接當成真實產品資料。個人帳號依 Ci 指示排除。

`implementation/` 是本輪真瀏覽器原型截圖；`implementation/manifest.json` 列出各圖實際像素、CSS viewport 與 SHA-256。六個主畫面以 390×884 CSS viewport 核對；DPR 不同，對照時應按比例縮放。S04／S06 使用定位失敗的真實狀態，不能當成已有 GPS 連線的視覺證據。檢查範圍與尚未驗證事項見 [review.md](../../../.prospec/changes/adopt-stitch-prototype/review.md)。
