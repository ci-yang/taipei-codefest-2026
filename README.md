# 台北通通通懂台北

2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽作品（2026-11-07～08，臺北市立大學天母校區）。

## 專案說明

> **題目待 11/7 公布**，公布後在這裡補：要解的問題、誰在什麼情境用、主流程一句話。

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
| 待補（題目公布後） | | | |

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
