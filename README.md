# 補助通

在台北通裡回答四題，馬上知道自己可能符合哪些臺北市社會救助補助。2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽作品（2026-11-07～08，臺北市立大學天母校區），隊伍「台北通通通懂台北」。

## 專案說明

補助通是在台北通（TownPass）App 內以 WebView 開啟的城市通微服務。市民填年齡區間、戶籍、身分、每人月收入，服務在手機上比對「臺北市社會救助補助項目」開放資料，列出可能符合的補助，以及還需要自己確認的條件。結果只是初篩，實際資格以主管機關審核為準。

依 [`docs/DECISIONS.md`](docs/DECISIONS.md) D10，補助通取代原本的線上 demo 服務。

## 功能

- **四題初篩**：年齡區間（18 歲以下、18-29、30-44、45-64、65 歲以上）、是否設籍臺北市、身分（低收入戶、中低收入戶、身心障礙者、懷孕或 60 天內分娩等）、每人月收入。
- **台北通帶入**：年齡與戶籍可從台北通會員資料帶入，市民可再修改。
- **比對結果**：列出可能符合的補助與還需確認的條件；看得到所需文件、承辦單位、聯絡方式，可開申請連結或撥號。
- **收藏**：把感興趣的補助收藏起來，下次進來還在。
- **斷網後仍可比對**：進入時有網路即可；之後斷網或伺服器失敗，用上次取得的補助清單繼續比對。

## 快速開始

需要 Node.js 22 以上、pnpm。在 repo 根目錄執行：

```bash
cp .env.example .env   # 補助通的 NEWAPP_* 變數不填就用預設值
pnpm install
pnpm dev:newapp        # 同時起 newapp-api 與 newapp-web
```

- Web：<http://localhost:5174>（Vite dev server 把 `/api`、`/healthz` 轉到 API）
- API：<http://localhost:8788>，健康檢查 `GET /healthz`，補助清單 `GET /api/v1/subsidies`
- 只起一邊：`pnpm dev:newapp-api`、`pnpm dev:newapp-web`
- 改 port：`.env` 設 `NEWAPP_API_PORT`；手機用區網 IP 連時，把 `http://<開發機IP>:5174` 加進 `NEWAPP_PUBLIC_WEB_URL`（逗號分隔）

測試、型別檢查：`pnpm --filter @app/newapp-api test`、`pnpm --filter @app/newapp-web test`、`pnpm typecheck`。補助通不需要資料庫。

- **線上 demo**：依 D10 改由補助通取代 <https://codefest.ciyang.dev> 現有服務，部署由部署負責人處理（[`deploy/README.md`](deploy/README.md)），上線狀態待補。
- **APK 怎麼拿**：用 TownPass fork 建，`--dart-define=CODEFEST_SERVICE_URL=https://codefest.ciyang.dev`，步驟見 [`docs/TOWNPASS-BUILD.md`](docs/TOWNPASS-BUILD.md)。

其他指令與排錯見 [`docs/RUNBOOK.md`](docs/RUNBOOK.md)。

## 架構

```
apps/
  newapp-api/     補助通 API（Hono）：GET /api/v1/subsidies 抓開放資料、整理後快取 24 小時
  newapp-web/     補助通網頁（Vue 3 + Vite + vue-router）：作答、比對、收藏都在手機上
  api/、web/      舊版骨架（友善同行時期），補助通不使用
packages/
  shared/         前後端共用契約（zod schema 與型別，補助通在 newapp.ts）
docs/             決策、協作規則、台北通整合說明
```

API 打不到 data.taipei 時重試一次，失敗就沿用上次整理好的結果。比對邏輯在前端執行，市民的答案不會送到後端。

## Repo 關係

```
┌──────────────────────────────────────┐        WebView 開啟 destinationUrl
│ ci-yang/TownPass @ codefest-2026     │ ─────────────────────────────┐
│ （fork 自 taipei-doit/TownPass）     │                              ▼
│ Flutter App 殼：服務入口、自訂        │ ◀── JS bridge ──▶ ┌────────────────────────┐
│ MessageHandler                       │  postMessage      │ 本 repo                │
└──────────────────────────────────────┘                   │ apps/newapp-web  Vue 3 │
                                                           │ apps/newapp-api  Hono  │
                                                           │ packages/shared 契約   │
                                                           └────────────────────────┘
                                                                      │
                                                                      ▼
                                                    開放資料（data.taipei）
```

- App 殼：<https://github.com/ci-yang/TownPass>（分支 `codefest-2026`）
- 官方上游：<https://github.com/taipei-doit/TownPass>、<https://github.com/taipei-doit/TownPass-Services>

## 資料來源

| 資料集 | 提供單位 | 授權 | 連結 | 是否模擬 |
|---|---|---|---|---|
| 臺北市社會救助補助項目 | 臺北市政府社會局 | 政府資料開放授權條款－第1版 | <https://data.gov.tw/dataset/129839>（API 取自 data.taipei，resource id `549a3347-df6e-4bed-b818-368210d01544`） | 否 |
| 新生兒育兒津貼、青年租屋補貼、青年職涯探索補助（序號 101～103） | 本隊示範 | — | — | **模擬資料**：名稱、條件、文件、承辦單位都是示範值，畫面上也會標示 |

## 台北通整合

- 只透過 bridge 讀 `userinfo` 的 `birthday`（換算年齡）與 `addresses[0].city`、`addresses[0].town`（顯示「臺北市 · ○○區」並帶入戶籍）。
- 不讀也不顯示姓名（`realName`）與身分證字號（`idNo`）。
- 帳號資料只在手機上使用，不送後端、不儲存。開源 TownPass 殼回的是固定假帳號，所以比賽版標「示範帳號資料」。
- 另外用 bridge 的 `open_link` 開申請網頁、`phone_call` 撥打聯絡電話。
- 依據：[`docs/DECISIONS.md`](docs/DECISIONS.md) D11、D12；bridge 協定見 [`docs/townpass-integration.md`](docs/townpass-integration.md)。

## 隱私

- 市民的答案只存在手機記憶體，不寫 localStorage、sessionStorage、cookie，也不放進任何請求；關掉頁面就消失。
- 手機 localStorage 只存兩樣東西：上次取得的補助清單（`newapp.subsidyList`，不含答案）、收藏的補助序號（`newapp.favorites`）。
- 伺服器端只抓開放資料，不收、不存任何個人資料。

## 舊版 prototype（友善同行）

補助通之前的主題「友善同行」（沿途 WiFi、充電、友善廁所與無障礙店家）已由補助通取代，檔案保留在 repo：[線上原型](https://ci-share.pages.dev/32d2b105d2eb968a/)、[原始碼與資料說明](docs/prototypes/friendly-route/README.md)、[協作紀錄](docs/handoff/2026-11-07-friendly-prototype-collaboration.md)。本機執行 `pnpm prototype` 後開 <http://localhost:8766>。

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
