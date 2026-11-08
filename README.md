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
| 官方網頁整理 15 項（序號 201～215，明細見下表） | 各主管機關官方網頁、法規或公告，本隊人工整理 | 依各網站「政府網站資料開放宣告」 | 見下表 | 否，非 data.gov.tw 資料集，畫面標「官方網頁整理」 |
| 臺北市政府台北服務通申辦服務及承辦單位資訊（補助類 115 項，序號 301～415） | 臺北市政府研究發展考核委員會 | 政府資料開放授權條款－第1版 | <https://data.gov.tw/dataset/157468>（CSV 2026-11-08 下載的靜態快照，執行期不連線） | 否，畫面標「台北服務通」；資料集沒有資格與金額欄位：其中 20 項另依官方原文補上資格條件後照四題比對（明細見下表），其餘 95 項**未依四題比對** |
| 新生兒育兒津貼、青年租屋補貼、青年職涯探索補助（序號 101～103） | 本隊示範 | — | — | **模擬資料**：名稱、條件、文件、承辦單位都是示範值，畫面上也會標示 |

清單共 143 項，順序是開放資料 10 項、官方網頁整理 15 項、模擬資料 3 項、台北服務通 115 項。卡片與詳情的「實際補助」只照官方原文顯示，查不到可核對的金額就不顯示。

台北服務通 115 項是從資料集 1,681 筆案件中，取名稱含補助、津貼、減免、扶助、救助、獎勵金、慰問金的個人申請案件，排除停收 9 項、雇主或團體申請 20 項、與上面 25 項重複的 18 項（明細在 `apps/newapp-api/src/data/catalog-subsidies.json` 的 `meta.excluded`）。其中 20 項依官方原文補上資格條件（`apps/newapp-api/src/data/catalog-enriched.json`，見下表），照四題進可能符合或不符合；其餘 95 項放在結果頁最後的摺疊區「台北服務通其他服務 95 項（未依四題比對）」，不進可能符合。示範情境的可能符合數依序為 23、28、33 項。

結果頁的「估算可領金額」是估算：只加總可能符合、且官方原文有明確金額的項目，月額 × 12、每學期金額 × 2、一次性金額算一次；核心資格四題沒問到（例如要有新生兒、原住民身分）或金額依個案核定的項目不加總，畫面列出未計入幾項。每條算法的數字都必須逐字出現在原文（`apps/newapp-web/src/lib/estimate.ts`，測試對原文檢查）。開放資料的收入門檻是資料集原值（舊年度），官方網頁整理的門檻年度依各來源頁（多為 115 年度）。整理檔在 `apps/newapp-api/src/data/`，依據見 [`docs/DECISIONS.md`](docs/DECISIONS.md) D14、D15、D16。

**官方網頁整理 15 項**（「實際補助」原文所在頁；查證日都是 2026-11-08）

| 序號 | 補助 | 承辦單位 | 來源網址 | 查證日 |
|---|---|---|---|---|
| 201 | 300 億元中央擴大租金補貼 | 臺北市政府都市發展局住宅企劃科 | <https://udd.gov.taipei/collection/oo2cmrc> | 2026-11-08 |
| 202 | 臺北幸福租—民間租屋租金加碼補貼 | 臺北市政府都市發展局住宅企劃科 | <https://rent-allowance.udd.gov.taipei/documents/grade/臺北幸福租-民間租屋租金加碼補貼計畫及附表.pdf> | 2026-11-08 |
| 203 | 低收入戶承租住宅租金補貼 | 臺北市政府都市發展局（南門辦公室） | <https://rent-allowance.udd.gov.taipei/assets/Downloads/115年低收入戶租金補助申請書表.pdf> | 2026-11-08 |
| 204 | 身心障礙者房屋租金補貼 | 臺北市政府社會局身心障礙者福利科 | <https://dosw.gov.taipei/cp.aspx?n=a119f2d98118e1d5&s=C82846AD24E9F281> | 2026-11-08 |
| 205 | 都市原住民家庭租屋補貼 | 臺北市各區公所原住民服務員 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL078392> | 2026-11-08 |
| 206 | 臺北市生育補助 | 臺北市各區戶政事務所 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL081869> | 2026-11-08 |
| 207 | 育有未滿 2 歲兒童育兒津貼 | 兒童戶籍所在地區公所 | <https://www.mohw.gov.tw/CHT/np-5130-1.html> | 2026-11-08 |
| 208 | 公共化／準公共托育補助與臺北市友善托育補助 | 送托的居家托育服務中心、托嬰中心或社區公共托育家園 | <https://dosw.gov.taipei/News_Content.aspx?n=91F35523B74F69AC&s=9AE6236C0066DD59&sms=87415A8B9CE81B16> | 2026-11-08 |
| 209 | 就業保險失業給付 | 臺北市就業服務處 | <https://www.mol.gov.tw/1607/1632/1633/76483/> | 2026-11-08 |
| 210 | 特殊境遇家庭扶助 | 臺北市政府社會局婦女福利及兒童托育科 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL002598> | 2026-11-08 |
| 211 | 身心障礙者輔具費用補助 | 臺北市政府社會局身心障礙者福利科、各區輔具中心 | <https://dosw.gov.taipei/cp.aspx?n=49304F9B0793FFEF> | 2026-11-08 |
| 212 | 老人全民健康保險保險費自付額補助 | 臺北市政府社會局老人福利科 | <https://dosw.gov.taipei/cp.aspx?n=22B00B4927757FFE> | 2026-11-08 |
| 213 | 臺北市兒童醫療補助 | 臺北市 12 區健康服務中心（第 3 類至戶政事務所） | <https://health.gov.taipei/News_Content.aspx?n=232AD545CBF028A7&s=AD1271100D029C67&sms=D8A8AF6A9CFCB149> | 2026-11-08 |
| 214 | 臺北市好孕 2U 孕婦乘車補助 | 好孕 2U 合作醫療院所、健康服務中心、區公所社會課、社福中心，或台北通線上申請 | <https://dosw.gov.taipei/News_Content.aspx?n=91F35523B74F69AC&s=79FC4665DF0CABCD&sms=87415A8B9CE81B16> | 2026-11-08 |
| 215 | 中低收入老人特別照顧津貼 | 臺北市政府社會局各區老人服務中心 | <https://dosw.gov.taipei/cp.aspx?n=3C3D1F78D6280694> | 2026-11-08 |

**台北服務通補上資格條件的 20 項**（資格條件與「實際補助」原文所在頁；申請連結仍是各案件頁 `https://service.taipei/case-detail/<案件編號>`）

| 序號 | 補助 | 承辦機關 | 條件原文 | 查證日 |
|---|---|---|---|---|
| 304 | 中低收入老人假牙補助 | 社會局 | <https://dosw.gov.taipei/cp.aspx?n=504CCD746B074DAE> | 2026-11-08 |
| 305 | 臺北市弱勢兒童及少年醫療補助 | 社會局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL067608> | 2026-11-08 |
| 307 | 協助中低收入老人修繕住屋補助 | 社會局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL059221> | 2026-11-08 |
| 308 | 身心障礙者承租停車位租金補助 | 社會局 | <https://dosw.gov.taipei/cp.aspx?n=4B447000B62AC93C> | 2026-11-08 |
| 309 | 發展遲緩兒童早期療育補助 | 社會局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL077603> | 2026-11-08 |
| 311 | 老人收容安置補助 | 社會局 | <https://service.taipei/case-detail/AI025> | 2026-11-08 |
| 313 | 危機家庭兒童及少年緊急生活扶助 | 社會局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL037389> | 2026-11-08 |
| 314 | 臨時看護補助 | 社會局 | <https://dosw.gov.taipei/cp.aspx?n=0EADA59EE328427A> | 2026-11-08 |
| 315 | 弱勢家庭兒童及少年緊急生活扶助 | 社會局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL039642> | 2026-11-08 |
| 318 | 協力照顧補助 | 社會局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL089237> | 2026-11-08 |
| 320 | 低收入戶及受保護安置市民喪葬補助 | 社會局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL002888> | 2026-11-08 |
| 323 | 04、臺北市失業勞工子女就學費用補助 | 勞動局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL048225> | 2026-11-08 |
| 330 | 臺北市身心障礙者醫療輔具及醫療費用補助申請 | 衛生局 | <https://service.taipei/case-detail/AL073> | 2026-11-08 |
| 331 | 臺北市氣切個案進住照護機構費用補助申請 | 衛生局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL025202> | 2026-11-08 |
| 332 | 助孕生殖「醫療性凍卵」補助 | 衛生局 | <https://service.taipei/case-detail/AL087> | 2026-11-08 |
| 333 | 助孕生殖「人工生殖(試管嬰兒)加碼」補助 | 衛生局 | <https://service.taipei/case-detail/AL088> | 2026-11-08 |
| 379 | 申請低收入戶(無親屬)喪葬補助 | 殯葬處 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL002888> | 2026-11-08 |
| 384 | 臺北市家庭暴力被害人補助 | 家防中心 | <https://service.taipei/case-detail/CV003> | 2026-11-08 |
| 410 | 臺北市青年留學生就學貸款補助 | 青年局 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL060186> | 2026-11-08 |
| 412 | 臺北市青年實習津貼 | 青年局 | <https://service.taipei/case-detail/PO004> | 2026-11-08 |

**開放資料 10 項的「實際補助」原文出處**（資料集本身沒有金額欄位）

| 序號 | 補助 | 原文出處 |
|---|---|---|
| 1 | 低收入戶生活扶助 | <https://dosw.gov.taipei/cp.aspx?n=E6D700BD37E78592&s=AC5701100C4A434B> |
| 2 | 低收入戶18歲以上就學生活補助 | <https://dosw.gov.taipei/cp.aspx?n=F9708F71674DF16E&s=D8656FCB81034B8F> |
| 3 | 低收入戶國中以上就學子女交通補助 | <https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL078859> |
| 4 | 中低收入戶 | 查不到可核對的金額，不顯示 |
| 5 | 身心障礙者生活補助 | <https://dosw.gov.taipei/cp.aspx?n=C764A5808F9A3B08> |
| 6 | 中低收入老人生活津貼 | <https://dosw.gov.taipei/cp.aspx?n=FCF3DAE98DDA289F&s=64180EEDD02DEE2A> |
| 7 | 營養品補助 | <https://dosw.gov.taipei/cp.aspx?n=372850F2A8369C81> |
| 8 | 生育補助 | <https://dosw.gov.taipei/cp.aspx?n=372850F2A8369C81&s=3D545516AA427905> |
| 9 | 市民醫療補助 | <https://dosw.gov.taipei/cp.aspx?n=D8645B7D5413343D>、<https://dosw.gov.taipei/cp.aspx?n=BF13AF1D3FA84C62>、<https://dosw.gov.taipei/cp.aspx?n=4F6E5F7925A8C7CE> |
| 10 | 急難救助 | <https://dosw.gov.taipei/cp.aspx?n=0BF751F1B9F07AA1> |

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
