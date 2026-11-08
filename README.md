# 台北通通通懂台北

2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽作品（2026-11-07～08，臺北市立大學天母校區）。

## 目前作品：友善同行 App

協助網路或電力受限的市民尋找附近廁所、充電、Wi-Fi 與無障礙資源。依 Ci 的 D6／D7 與凍結規格，作品本體是 `docs/prototypes/friendly-route/` 的純 JavaScript／Leaflet App。

- [開啟友善同行 App](https://taipei-friendly-platform.jason21131.workers.dev)
- [原型程式、資料來源與離線邊界](docs/prototypes/friendly-route/README.md)
- [凍結規格](.prospec/changes/enable-friendly-routes/proposal.md)

```bash
pnpm prototype
# http://localhost:8766
pnpm test:prototype
```

需要 Python 3；原型不依賴 API、資料庫或 `.env`。主流程是定位與地圖 → 搜尋目的地 → 四類多選 highlight → 查看來源、更新日與直線距離。首次連線快取全市點位與 app shell；離線底圖限信義／大安東側，範圍外使用點位、方向與距離。導航與撥號需 TownPass bridge；一般瀏覽器會說明限制。

評論、回報、互助及協助者已移除。日期、歷史、多站與路線比較是歷史原型／P1 資產，沒有放入現行主流程。Cloudflare 根頁直接開啟 App；舊 `/map`、`/about` 與說明頁入口導回根頁。[先前分享快照](https://ci-share.pages.dev/57c6867d600ab5e6/) 保留作歷史版本。

## App 部署與後端基礎

`platform:build` 只將 App runtime 打包到乾淨的 `dist/app`，由既有 Cloudflare Worker 發布。產物不包含 Vue 首頁、規格或分析頁；每版包含來源 SHA、內容 hash 與對應離線版本。

`apps/api` 的 Hono／D1 API 繼續保留 103 筆地方版本快照；App 自己使用 5,948 筆全市資源，兩者不混用。`apps/web` Vue／MapLibre 保留為歷史開發基礎，已不作 Cloudflare 頁面入口。既有 APK 若指向相同 Cloudflare 根網址，連線時會取得新 App；本輪未重建 APK，也不宣稱 TownPass 實機驗證完成。

```bash
pnpm install --frozen-lockfile
pnpm app:build
pnpm test:platform
```

App 入口：[Cloudflare 友善同行](https://taipei-friendly-platform.jason21131.workers.dev)。PR 執行 CI；合併／push 到 main 後，部署 workflow 先跑同一套 CI，通過才自動發布同一份 App 到既有 Worker。也可在 Actions 重新 dispatch main；舊 run 的 Re-run 沿用舊 SHA，若 main 已前進會被拒絕。GitHub 必須設定專用 `CLOUDFLARE_API_TOKEN` secret；未設定會停止發布。

`test:platform` 使用獨立本機 D1。部署成功會檢查線上 API、資料與資產，保存收據；實際線上 commit 可由 [`/config`](https://taipei-friendly-platform.jason21131.workers.dev/config) 查看。操作方式與限制見 [Cloudflare 手冊](docs/CLOUDFLARE.md)。原型打包使用 `python3 tools/package-friendly-prototype.py /tmp/friendly-app-package`，分享依 `publish-report` 流程。

## 福利雷達（apps/web）

`apps/web` 另有新北市福利補助資格初篩頁（`/benefits`），與上方友善同行 App 分開。它完整收錄新北市政府「福利補助資訊」152 筆開放資料，每筆連回官方福利明細；其中 28 項常用方案整理為結構化深度初篩，涵蓋低收／中低收、租屋、生育育兒、托育、身障、高齡、醫療、急難及青年就業。依使用者已填身分排除明確不相關項目，未知條件不假裝已符合；對可量化且初篩為「可能符合」的方案，估算一個申請週期可能錯過的金額。比對全在裝置端完成，不要求姓名、身分證字號、電話或 Email。

福利雷達僅提供初篩，不是政府核定結果。所得認列、家戶人口、財產、受理狀態及實際給付仍以主管機關最新審查為準。開放資料沒有一致的即時受理欄位，只有官方文字明確標示全年受理、免申請或停辦時才自動標記，其他一律要求回官方明細確認。本頁不連接個人帳號，也不取得戶籍、所得或財產資料。

```bash
pnpm benefits:sync        # 經新北市資料開放平臺 API 重建 152 筆快照，不使用爬蟲
pnpm --filter @app/web dev
pnpm --filter @app/web test
```

`platform:build` 只打包友善同行 App 到 `dist/app`，福利雷達目前不隨 Cloudflare 部署上線。

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
| [不動產買賣實價登錄批次資料](https://data.gov.tw/dataset/25119) | 內政部 | 亮點原型：476筆原始交易篩成44筆住宅、12區最高樣本（[重建與範圍](docs/prototypes/taipei-price-sample.md)） | 交易非模擬；房貸條件為示範 |
| [新北市政府福利補助資訊](https://data.ntpc.gov.tw/datasets/73c24d1c-e1f0-44ce-8a31-cf835ef37e74) | 新北市政府 | 福利雷達：152 筆完整候選與 28 項深度規則主來源 | 否 |
| [新北市政府福利補助自己查](https://welfare.ntpc.gov.tw/) | 新北市政府 | 福利雷達：官方方案明細與申請入口 | 否 |
| [2026 新北市社會福利手冊](https://www.sw.ntpc.gov.tw/uploaddowndoc?dis=anounce&file=anounce%2F202605251059560.pdf&filedisplay=2026%E6%96%B0%E5%8C%97%E5%B8%82%E7%A4%BE%E6%9C%83%E7%A6%8F%E5%88%A9%E6%89%8B%E5%86%8A.pdf&flag=doc) | 新北市政府社會局 | 福利雷達：115 年福利門檻與給付交叉核對 | 否 |
| [116 年度新北市青年租金補貼](https://www.planning.ntpc.gov.tw/home.jsp?act=be4f48068b2b0031&dataserno=fe742ca76643d3d08232f452a681532a&id=22) | 新北市政府城鄉發展局 | 福利雷達：青年租補金額、年齡、家庭類別、所得門檻與受理期間 | 否 |
| [新北市生育獎勵金](https://www.ca.ntpc.gov.tw/home.jsp?id=3af0fb3ede4a9056) | 新北市政府民政局 | 福利雷達：115 年出生序金額與設籍規則 | 否 |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | OpenStreetMap contributors | 地方底圖與臺北市本機步行路網（[重建方式](docs/prototypes/taipei-routing.md)） | 否；現場通行未驗 |

成員於 `21bc1f3` 完成三類官方資源全市匯入、來源註記與 Wi-Fi 同址彙整（3,305 AP → 2,036 組）。原始 commit 與 `docs/prototypes/build-friendly-data.py` 保留作歷史建置紀錄；其品牌服務推定不列入現行 App。現行資料管線另對官方來源已存在的 332 個點位加入常識推定（`inferredServices`），畫面以橘色「推定」標示並提醒向現場確認；推定不新增門市位置、不覆蓋官方服務，規則見 [資料說明](docs/prototypes/data/friendly-resources/README.md)。`data.js` 在 App 僅提供地方底圖。平台固定快照另見 [manifest](data/friendly/manifest.json)。

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
