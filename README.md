# 台北通通通懂台北

2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽作品（2026-11-07～08，臺北市立大學天母校區）。

## 專案說明

目前主題是「友善同行」：協助網路或電力受限的市民，查詢沿途的 WiFi、充電、友善廁所與無障礙友善店家。**目前先做前端 prototype，規格仍在討論，尚未串接後端。**

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

## 既有正式服務骨架

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
| [臺北市友善店家清冊](https://data.taipei/dataset/detail?id=d807396c-e41f-4005-be42-0160280783a1) | 臺北市政府 | 原型載入全市 993 筆快照，詳見原型 README | 否 |
| [臺北市公廁點位資訊](https://data.taipei/dataset/detail?id=ca205b54-a06f-4d84-894c-d6ab5079ce79) | 臺北市政府 | 原型載入全市 1,531 筆列管公廁快照，詳見原型 README | 否 |
| [臺北市公眾區免費無線上網熱點資料（新版）](https://data.taipei/dataset/detail?id=6aa6532d-652f-4c1b-814a-4646b75407af) | 臺北市政府 | 原型載全市 3,305 個 AP，合併同類型同址後為 2,036 點，詳見原型 README | 否 |
| 連鎖餐飲服務推定 | 原型內建規則 | 對既有官方點位補上常見 Wi-Fi、充電與廁所線索，畫面明確標示「推定」 | 是；非單店官方保證 |
| OpenStreetMap 地方路網與向量底圖 | OpenStreetMap contributors | [來源與授權](docs/prototypes/friendly-route/README.md) | 否；未驗證現場通行 |

## 第三方套件與 AI 揭露

- 第三方套件清單（名稱＋授權）：待補，交件前整理。
- 執行期 AI：若有，僅在裝置端推論；模型名稱／版本／量化格式／推論框架／來源：待補。開發過程使用 Claude Code、Codex 協助撰寫程式。

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
