# 台北通通通懂台北

2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽作品（2026-11-07～08，臺北市立大學天母校區）。

## 專案說明

目前主題是「友善同行」：協助網路或電力受限的市民，查詢沿途的 WiFi、充電、友善廁所與無障礙友善店家。Ci 負責正式平台、開源地圖與部署；組員持續調整 App prototype 與產品規格。

## 正式平台

Cloudflare Workers + Static Assets + D1 提供同源 Vue 前端與真實友善名冊 API；MapLibre 顯示 OSM 地方快照，路線在裝置計算。原有 Node/PostGIS 與 GCP 保留。平台交接與部署方式見 [Cloudflare 操作手冊](docs/CLOUDFLARE.md)。

```bash
pnpm install --frozen-lockfile
pnpm platform:assets
pnpm test:platform
```

`test:platform` 在獨立本機 D1 驗證匯入、API 與 SPA，不寫正式資料庫。這是可接線的平台版本；公開評論、真人互助、完整離線包與全市導航仍待後續產品實作。

## 先看 App Prototype

- [直接操作手機版原型](https://ci-share.pages.dev/32d2b105d2eb968a/)
- [原始碼與資料說明](docs/prototypes/friendly-route/README.md)
- [協作方式、待認領工作與待定規格](docs/handoff/2026-11-07-friendly-prototype-collaboration.md)

在 repo 根目錄執行（需 Python 3，不需要 API、資料庫或 `.env`）：

```bash
pnpm prototype
# 開啟 http://localhost:8766
```

無 pnpm 時也可直接執行：

```bash
python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/prototypes/friendly-route
```

流程：地圖首頁 → 日期／歷史與起迄設定 → 路線比較 → 開始行程。店家與路網來自開放資料；評論與互助是明示的本機示範。定位、離線需要 localhost 或 HTTPS，手機可直接使用上方 HTTPS 原型連結。

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

| 資料集 | 提供單位 | 連結 | 是否模擬 |
|---|---|---|---|
| [臺北市友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1) | 臺北市政府 | 正式平台採地方 103 筆；[來源、日期與 hash](data/friendly/manifest.json) | 否 |
| OpenStreetMap 地方路網與向量底圖 | OpenStreetMap contributors | [ODbL 與來源](https://www.openstreetmap.org/copyright)、[快照 manifest](data/friendly/manifest.json) | 否；未驗證現場通行 |

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
