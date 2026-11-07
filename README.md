# 台北通通通懂台北

2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽作品（2026-11-07～08，臺北市立大學天母校區）。

## 目前作品：友善同行 App

協助網路或電力受限的市民尋找附近廁所、充電、Wi-Fi 與無障礙資源。依 Ci 的 D6／D7 與凍結規格，作品本體是 `docs/prototypes/friendly-route/` 的純 JavaScript／Leaflet App。

- [操作手機 App v6](https://ci-share.pages.dev/57c6867d600ab5e6/)
- [原型程式、資料來源與離線邊界](docs/prototypes/friendly-route/README.md)
- [凍結規格](.prospec/changes/enable-friendly-routes/proposal.md)

```bash
pnpm prototype
# http://localhost:8766
pnpm test:prototype
```

需要 Python 3；原型不依賴 API、資料庫或 `.env`。主流程是定位與地圖 → 搜尋目的地 → 四類多選 highlight → 查看來源、更新日與直線距離。首次連線快取全市點位與 app shell；離線底圖限信義／大安東側，範圍外使用點位、方向與距離。導航與撥號需 TownPass bridge；一般瀏覽器會說明限制。

評論、回報、互助及協助者已移除。日期、歷史、多站與路線比較是歷史原型／P1 資產，沒有放入現行主流程。分享頁是 v6 發布快照，後續 main 的變更須另行打包發布。

## 獨立平台與部署基礎

`apps/web` 的 Vue／MapLibre、`apps/api` 的 Hono 與 Cloudflare Workers + Static Assets + D1 一併保留，供 API、資料版本、部署與回退工作使用。這個平台仍使用 103 筆地方名冊及舊路線頁，**不是上方 App 原型的發布產物**。`platform:deploy` 與既有 APK 指向平台網址，不會因本次合併自動變成 v6。

```bash
pnpm install --frozen-lockfile
pnpm platform:assets
pnpm test:platform
```

平台入口：[Cloudflare 友善平台](https://taipei-friendly-platform.jason21131.workers.dev)。PR 執行 CI；合併／push 到 main 後，部署 workflow 先跑同一套 CI，通過才自動發布到既有 Worker。也保留 main 手動重跑入口。GitHub 必須設定專用 `CLOUDFLARE_API_TOKEN` secret；未設定會停止發布。

`test:platform` 使用獨立本機 D1。部署成功會檢查線上 API、資料與資產，保存收據；實際線上 commit 可由 [`/config`](https://taipei-friendly-platform.jason21131.workers.dev/config) 查看。操作方式與限制見 [Cloudflare 手冊](docs/CLOUDFLARE.md)。原型打包使用 `python3 tools/package-friendly-prototype.py /tmp/friendly-app-package`，分享依 `publish-report` 流程。

## 既有 Node／GCP 基線

本作品是一個在台北通（TownPass）App 內以 WebView 開啟的城市通微服務：Vue 3 網頁 ＋ Hono API ＋ PostGIS，地圖用 MapLibre ＋ OpenStreetMap，核心資料來自政府開放資料。

## 快速開始

```bash
cp .env.example .env
pnpm install
```

接下來怎麼起 DB、API、Web，怎麼在手機上連開發機，見 [`docs/RUNBOOK.md`](docs/RUNBOOK.md)。要加一個功能，見 [`docs/HOW-TO-ADD-A-FEATURE.md`](docs/HOW-TO-ADD-A-FEATURE.md)。

- **線上 demo**：<https://codefest.ciyang.dev>（地圖 <https://codefest.ciyang.dev/map>），部署方式見 [`deploy/README.md`](deploy/README.md)。
- **APK 怎麼拿**：用 TownPass fork 建，`--dart-define=CODEFEST_SERVICE_URL=https://codefest.ciyang.dev`，步驟見 [`docs/TOWNPASS-BUILD.md`](docs/TOWNPASS-BUILD.md)。

## Repo 關係

```
┌──────────────────────────────────────┐        WebView 開啟 destinationUrl
│ ci-yang/TownPass @ codefest-2026     │ ─────────────────────────────┐
│ （fork 自 taipei-doit/TownPass）     │                              ▼
│ Flutter App 殼：服務入口、自訂        │ ◀── JS bridge ──▶ ┌────────────────────────┐
│ MessageHandler                       │  postMessage      │ 本 repo                │
└──────────────────────────────────────┘                   │ apps/web  Vue 3 + Vite │
                                                           │ apps/api  Hono         │──▶ PostGIS
                                                           │ packages/shared 型別   │
                                                           └────────────────────────┘
                                                                      │
                                                                      ▼
                                                    開放資料（data.taipei 等）
```

- App 殼：<https://github.com/ci-yang/TownPass>（分支 `codefest-2026`）
- 官方上游：<https://github.com/taipei-doit/TownPass>、<https://github.com/taipei-doit/TownPass-Services>

## 資料來源

現行 App 使用 `resources-data.js` 的 5,948 筆官方來源紀錄，5,938 筆有座標；缺座標保持空白。不同來源不當成同一場所去重，亦不表示目前可用或免消費。

| 資料集 | 提供單位 | 現行 App 紀錄 | 是否模擬 |
|---|---|---:|---|
| [友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1) | 臺北市政府 | 993 | 否 |
| [公廁點位](https://data.taipei/dataset/detail?id=ca205b54-a06f-4d84-894c-d6ab5079ce79) | 臺北市政府 | 1,531 | 否 |
| [公眾免費 Wi-Fi](https://data.taipei/dataset/detail?id=6aa6532d-652f-4c1b-814a-4646b75407af) | 臺北市政府 | 3,305 | 否 |
| [捷運無障礙設施](https://data.taipei/dataset/detail?id=3c799405-4e44-40dd-b747-daed09e88cdb) | 臺北捷運公司 | 119 | 否 |
| [捷運車站資料](https://data.taipei/dataset/detail?id=1eefa68d-7c8d-491b-8e75-66a161947426) | 臺北市政府 | 座標對應來源 | 否 |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | OpenStreetMap contributors | 地方底圖與歷史路網 | 否；現場通行未驗 |

成員於 `21bc1f3` 完成三類官方資源全市匯入、來源註記與 Wi-Fi 同址彙整（3,305 AP → 2,036 組）。原始 commit 與 `docs/prototypes/build-friendly-data.py` 保留作歷史建置紀錄；其品牌服務推定不列入現行 App 的正式四類篩選。`data.js` 在 App 僅提供地方底圖。平台固定快照另見 [manifest](data/friendly/manifest.json)。

## 第三方套件與 AI 揭露

- 第三方套件清單（名稱＋授權）：待補，交件前整理。
- 本輪平台沒有執行期 LLM；路線是裝置端圖演算法。開發過程使用 Claude Code（Opus 5.5）與 Codex 協作。

## 團隊

| 成員 | 角色（草擬，待確認） | GitHub |
|---|---|---|
| 楊騏 Ci（隊長） | 全端＋AI | [ci-yang](https://github.com/ci-yang) |
| 卓曄 | 產品需求收斂、Flutter＋Web | 待補 |
| 高栩浠 | 視覺設計 | 待補 |
| 王建湧 | 企業架構、後端、DB | 待補 |
| 蘇家成 | DevOps、SRE | 待補 |

協作規則：[`CLAUDE.md`](CLAUDE.md)、[`docs/TEAM-PROTOCOL.md`](docs/TEAM-PROTOCOL.md)、[`docs/DECISIONS.md`](docs/DECISIONS.md)。

## License

本專案以 **GNU Affero General Public License v3.0** 授權，全文見 [`LICENSE`](LICENSE)。依競賽須知第捌條，授權聲明如下（亦見 [`NOTICE`](NOTICE)）：

```
台北通通通懂台北 microservice — 2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽作品，以台北通（TownPass）為基礎的城市通微服務。
Copyright (C) 2026 台北通通通懂台北
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.
You should have received a copy of the GNU Affero General Public License along with this program. If not, see https://www.gnu.org/licenses/.
```
