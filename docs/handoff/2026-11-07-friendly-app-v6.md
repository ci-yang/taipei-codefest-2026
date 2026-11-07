# 友善同行 App 原型 v6 交接

本輪沿用 `feat/prototype-resource-map` 的純 JS／Leaflet 原型，依 Ci 的 D6／D7 更新完整手機介面。正式 `apps/web`、`apps/api`、平台部署與 TownPass fork 沒有在本輪改動。

## 程式與規格

- PR：[原型 PR #3](https://github.com/ci-yang/taipei-codefest-2026/pull/3)，保留 draft。
- 入口：`docs/prototypes/friendly-route/index.html`。
- 行為：`app.js`；樣式：`app-ui.css`；官方圖示：`icons.js`。
- 原生能力：`bridge.js`；離線：`offline.js` 與 `sw.js`。
- 全市資料：`resources-data.js`；原始官方快照：`docs/prototypes/data/friendly-resources/`。
- 規格：`.prospec/changes/enable-friendly-routes/proposal.md`，142 行，blob `6da4a77f904db5877d10fe8a54adf90356a178dc`，原樣同步。
- D6／D7 自主樹 `bb2149e` cherry-pick 至 `192c88a`；沒有替主樹 push 或改動其他 session 的工作。
- CLI amendment 已建立 acceptance revision 3，digest `7cb7b56b7e85ecadf1f8bc773f57627f3d45d2e050d740bf1f6476b08b62481d`。

## 本輪完成

開啟即定位與地圖、目的地搜尋、四類 OR highlight、視窗數量與清單、來源／官方更新日／直線距離卡片、TownPass 導航與撥號失敗處理、全市點位與 shell 自動快取、方向與距離導引、深淺色與 320px 排版。

評論、品質回報、互助、協助者與求助功能全部移除。多站、日期與歷史依凍結規格降 P1，不放回主流程。

資料為四類官方資源聯集，加官方捷運站資料對應座標：5,948 筆來源紀錄，5,938 筆有座標，10 筆保留無座標，不編造位置。不同來源沒有去重成單一場所。

## 邊界與待辦

- 離線底圖仍限信義及大安東側；其他區域可用全市點位、直線距離與方向。外部 OSM 圖磚只供當下線上視窗，不批次下載或收入離線包。
- TownPass 實機定位、外部導航／撥號、WebView 飛航模式重開與真實方向感測待驗。瀏覽器沒有 bridge 時顯示 App 限制並保留可複製資料。
- `prospec validate proposal enable-friendly-routes` 被既有 abandoned history 同 identity 衝突阻擋；正式計畫／驗證站未宣稱完成。主樹未追蹤的 placeholder `plan.md`／`delta-spec.md` 沒有被當作已定計畫匯入。
- 後續整合者先處理 Prospec history 衝突，依凍結 proposal 走正式計畫，再安排 TownPass 實機驗收。

## 操作與驗證

```sh
pnpm prototype
pnpm test:prototype
pnpm typecheck && pnpm lint && pnpm test && pnpm build
python3 tools/package-friendly-prototype.py /tmp/friendly-app-package
```

打包腳本只帶 14 個 runtime 檔案，並依內容雜湊產生 Service Worker 版本；發布必須用打包產物，避免同版本保留舊快取。測試與實際瀏覽器證據見 [QA-v6.md](../prototypes/friendly-route/QA-v6.md)。手機截圖為本機定位失敗情境，沒有保存個人 GPS。

本輪打包版本：`friendly-resource-v6-aeff561959dd2814`，5,787,826 bytes。原型測試 66 項、資料清洗 9 項通過；既有 API 14 項與 web 24 項、型別與建置通過。公開站特有的 `index.html` 308 已修正，仍保留拒絕轉址與 scope 驗證。

## 分享

[開啟 App prototype v6](https://ci-share.pages.dev/57c6867d600ab5e6/)。已由 `publish-report` 的私有主台 → 隔離分享台流程發布。公開站實際顯示完整快取與時間，重新載入後仍 ready；未宣稱真機飛航模式通過。這是持連結即可查看的分享頁。

撤回指令：

```sh
bash ~/.claude/skills/publish-report/scripts/share.sh --revoke 57c6867d600ab5e6
```

發現轉址問題時的暫時 token `ef5e0b9332b0cc10` 已撤回；先前 v4 歷史連結保留，不是本輪入口。
