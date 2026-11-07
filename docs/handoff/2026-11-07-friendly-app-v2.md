# 友善同行 App v2 交接

## 本輪交付

Ci 要求將友善店家 prototype 改為手機 App 四頁：首頁地圖＋開始、GPS 起點與日期／歷史／多目的地、最短／資源最多比較、開始行程。已完成並發布，原有篩選、品質回報、離線及本機互助保留。

- 新分享：https://ci-share.pages.dev/32d2b105d2eb968a/
- 第二版規格：https://ci-share.pages.dev/32d2b105d2eb968a/spec.html
- 提案分析：https://ci-share.pages.dev/32d2b105d2eb968a/analysis.html
- 本機程式：隔離 worktree `/Users/ciyang/Documents/repos/tcf-friendly-prototype`，branch `codex/friendly-route-prototype`。後續已依 Ci 授權推送 GitHub；目前先做前端，最新狀態見 [協作交接](2026-11-07-friendly-prototype-collaboration.md)，不代表已合併 main。
- 分享透過全域 publish-report；私有主台部署 23881b90，Production/main，來源 commit f1f7b6f。
- 收回本篇：`bash ~/.claude/skills/publish-report/scripts/share.sh --revoke 32d2b105d2eb968a`。連結可轉傳，不是觀看者身分驗證。

## 規格與程式邊界

既有 change `enable-friendly-routes` 以 CLI 修訂為 revision 2，7 個 User Stories／26 驗收情境；proposal、input-evidence、metadata 已同步主工作目錄和 worktree。Story 仍在規劃階段；此輪交付獨立靜態討論原型，未宣稱 `apps/` 正式實作完成。

GPS 使用裝置 Geolocation，需要 HTTPS／localhost 和權限；實機 GPS、TownPass WebView 未驗。定位不自動持久保存，除非明確保存歷史或下載含起點的離線包。歷史、示範與目前位置各有不同來源標示。

新路由由同一批官方 OSM 匯出的 9,483 節點／24,314 有向邊計算。固定站序、端點接線上限 120m。最短限本地路網；資源最多限生成候選，不是全市最佳／無障礙導航。起點超範圍不得偷換展示位置。

## 驗證與修復

- 獨立 21 項回歸測試全過：`node --test docs/prototypes/tests/friendly-app-state.test.cjs docs/prototypes/tests/friendly-routing.test.cjs`。
- 固定示範結果：最短 1,861m／25店、資源較多 2,723m／36店。地圖與路網皆有來源，不用假距離。
- Chrome 390×844 四頁、日期／歷史、三站／錯誤輸入、篩選／本機回報／互助驗證通過。
- 下載修正版後停掉本輪 Python HTTP 來源，重新整理可恢復三站底圖與 2.46km／26店。手動離線模式與來源停止合測，未關作業系統 Wi-Fi。
- 已修：歷史方案偏好遺失、舊比較競態、離線還原後編輯錯草稿、SW 註冊失敗阻擋既存離線包。
- 文案 content-gate 通過，公開資產全檔紅線與金鑰掃描通過；規格／文件與程式由非作者 reviewer 核對。

詳見 `docs/prototypes/friendly-route/QA.md`。本機驗證用的 8766 HTTP 服務已停止。後續正式服務應依 Prospec status 進計畫站；Knowledge 仍空且跨故事介面尚需拆定，不能把 prototype 當正式完成。
