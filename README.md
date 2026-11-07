# 福利雷達

2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽實驗。這個分支只公開福利資格初篩服務，根路徑 `/` 與 `/benefits` 都直接進入福利雷達，不提供友善地圖或其他功能入口。

## 功能

- 以 10 項臺北市社會救助開放資料，加上 9 項官方常用方案，進行共 19 項深度門檻初篩。
- 收錄台北服務通 165 項補助相關官方服務候選，依使用者情況排序並連回官方申辦頁。
- 透過既有 TownPass `userinfo` bridge 帶入出生日期、臺北市民資訊與原住民族旗標。
- 由使用者補充居住日數、家戶所得、財產及身分情況。
- 所有比對在裝置端完成；不顯示、儲存或使用姓名、身分證字號、電話與 Email 判斷。

福利雷達僅提供初篩，不是政府核定結果。台北服務通目錄沒有一致的結構化資格欄位，因此 165 項候選只排序、不宣稱使用者符合資格。

## 本機執行

```bash
pnpm install
pnpm dev:web
```

- 一般瀏覽器：<http://localhost:5173/?mockBridge=1>
- TownPass WebView：將 `CODEFEST_SERVICE_URL` 指向 `http://localhost:5173/`

開源 TownPass 殼的 `userinfo` 使用固定假帳號，只能驗證串接流程，不能代表已使用真實個資完成個人化。

## 更新福利候選快照

```bash
pnpm benefits:sync
```

同步程式會從台北服務通公開服務目錄重新產生候選快照，並記錄來源統計、抓取時間、關鍵字與篩選版本。它只同步名稱、摘要、標籤、申辦方式與官方連結，不推測法定資格。

## 驗證

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 資料來源

| 資料集 | 提供單位 | 本版用途 | 是否模擬 |
|---|---|---|---|
| [臺北市社會救助補助項目](https://data.gov.tw/dataset/129839) | 臺北市政府社會局 | 10 項深度門檻比對 | 否 |
| [臺北市都市發展局居住服務](https://udd.gov.taipei/collection/oo2cmrc) | 臺北市政府都市發展局 | 中央租補與臺北幸福租規則 | 否 |
| [臺北市租金補貼網](https://rent-allowance.udd.gov.taipei/) | 臺北市政府都市發展局 | 低收入戶等租屋方案 | 否 |
| [育兒及托育相關補助](https://dosw.gov.taipei/Content_List.aspx?n=2C486AA08208CD74) | 臺北市政府社會局 | 育兒與托育規則 | 否 |
| [臺北市生育補助](https://ca.gov.taipei/News_Content.aspx?n=59F2E04A34FDA3E8&s=B48A280E9EB5F920) | 臺北市政府民政局 | 一般生育補助規則 | 否 |
| [失業給付](https://eso.gov.taipei/News_Content.aspx?n=B26586FCE6F04719&s=CDE5D0AFE68F030C&sms=87415A8B9CE81B16) | 臺北市就業服務處 | 失業給付規則 | 否 |
| [台北服務通申辦服務目錄](https://service.taipei/search-item) | 臺北市政府 | 165 項產品候選（由全站 1,647 項篩選） | 否；候選數非官方統計 |

165 項候選是以「補助、津貼、減免、扶助、救助、獎勵金、慰問金」找到 248 筆後，再排除核銷、請款及明顯機構型案件所得；不是臺北市政府公布的補助總數。

## TownPass 整合

本分支沿用 [`apps/web/src/composables/useTownPassBridge.ts`](apps/web/src/composables/useTownPassBridge.ts) 的既有 bridge 協定，不需新增 handler。建置方式見 [`docs/TOWNPASS-BUILD.md`](docs/TOWNPASS-BUILD.md)。

## 第三方套件與 AI 揭露

本版沒有執行期 LLM，也不會呼叫雲端 LLM API。使用 Vue 3、Vite 與既有開源依賴，授權資訊以 lockfile 與各套件 LICENSE 為準。

## License

本專案以 **GNU Affero General Public License v3.0** 授權，全文見 [`LICENSE`](LICENSE)，授權聲明亦見 [`NOTICE`](NOTICE)。
