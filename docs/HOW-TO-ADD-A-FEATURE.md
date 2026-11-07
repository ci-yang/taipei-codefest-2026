# 新增一個功能切片（5 步）

範例切片是「附近地點」：`packages/shared/src/places.ts` → `apps/api/src/db/schema.ts` → `apps/api/src/routes/places.ts` → `apps/web/src/pages/MapPage.vue` → `apps/web/src/lib/features.ts`。
新功能照著抄，下面用假想的「附近 YouBike 站」（`bikes`）示範。

> 如果新功能只是「另一種地點」（例如加油站），**不需要新表**：在 `PLACE_CATEGORIES` 加一個類別、把資料寫進 `places`（`source` 填來源），再做第 5 步就好。

## 1. shared schema（前後端契約）

檔案：`packages/shared/src/bikes.ts`，並在 `packages/shared/src/index.ts` 加 `export * from './bikes';`

- query 的 schema 用 `z.coerce.number()`（query string 都是字串）。參考 `PlacesQuerySchema`。
- 回應的 schema 也定義在這裡，前端 `apiGet()` 會用它驗證，後端用 `z.infer` 當回傳型別。

## 2. drizzle table

檔案：`apps/api/src/db/schema.ts`

- 照 `places` 抄一張表。座標欄位照抄 `places.geom`，索引照抄 `places_geog_idx`（索引名要換掉，全 DB 不能重複）：

  ```ts
  export const bikes = pgTable(
    'bikes',
    {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
      source: text('source').notNull(),
    },
    (t) => [index('bikes_geog_idx').using('gist', sql`(${t.geom}::geography)`)],
  );
  ```

- 欄位用 drizzle 內建的 `geometry`，**不要**自己宣告 `geography` 的 customType：drizzle-kit 0.31 會把它加上引號，`db:push` 直接失敗（原因寫在 `schema.ts` 檔頭）。量距離時才轉 `::geography`（單位是公尺），寫法見第 3 步。
- `mode: 'xy'`：讀出來是 `{ x: lng, y: lat }`，寫入也用 `{ x, y }`。
- **一定要有 `source` 欄位**（競賽規則要求標註資料來源），例如 `data.taipei:<rid>`。
- 跑 `pnpm db:push` 同步到 DB，看到 `[✓] Changes applied` 才算成功。要假資料就在 `apps/api/src/db/seed.ts` 加一段（或另寫一支 seed，記得 `pool.end()`）。

## 3. API route

檔案：`apps/api/src/routes/bikes.ts`，並在 `apps/api/src/app.ts` 加一行：

```ts
app.route('/api/v1/bikes', bikesRoutes(db));
```

- 用 `zValidator('query', BikesQuerySchema)` 驗證，`c.req.valid('query')` 取值。
- 空間查詢照抄 `routes/places.ts` 的 `ST_DWithin` / `ST_Distance`（geography 單位是公尺）。
- 要即時打開放資料就照抄 `routes/opendata.ts`：server 端 fetch、`AbortSignal.timeout`、失敗回 mock 並標 `mocked: true`。
- 測試照抄 `apps/api/test/places.test.ts`：`createApp().request(...)`，不用開 port。

## 4. Vue page

檔案：`apps/web/src/pages/BikesPage.vue`，並在 `apps/web/src/router.ts` 加一筆 route。

- 打 API：`apiGet('/api/v1/bikes', BikeResponseSchema, { lat, lng })`（`apps/web/src/lib/api.ts`）。需要跨頁共用狀態就照 `stores/places.ts` 開一個 Pinia store。
- 要定位、撥電話、開地圖：`useTownPassBridge()`（`apps/web/src/composables/useTownPassBridge.ts`）。沒手機時網址加 `?mockBridge=1`（`composables/mockTownPassBridge.ts`）。注意：`postMessage` 不回 Promise，回覆走 `message` 事件；`getLocation()` 失敗回 `[]`；`notify()` 成功時 App 不回覆，所以它是同步回傳「已送出」。協定細節見 `docs/townpass-integration.md`。
- 地圖照抄 `pages/MapPage.vue`（MapLibre + OSM 圖磚，禁止 Google Maps / Mapbox）。
- 手機優先：寬度 360–430px，觸控目標至少 40px，底部留 tabbar 空間（`.page` class 已處理）。

## 5. 註冊到首頁 chips

檔案：`apps/web/src/lib/features.ts`

```ts
{ id: 'bikes', label: 'YouBike', kind: 'page', keywords: ['腳踏車', '單車', 'youbike', '騎車'], to: { name: 'bikes' } },
```

- `kind: 'page'` = 獨立頁面，只出現在首頁 chips。`kind: 'place'` 只給「地圖上的一種地點」用（用 `mapFeature(...)` 註冊，會出現在地圖頁工具列）；獨立頁面標成 place，地圖工具列會多一顆點了就跳走的 chip。
- 關鍵字用專有詞（「腳踏車」「youbike」），**不要放單字**（「水」「車」）：一句話常同時含好幾類的字，比對是「命中詞最多的勝出」，單字會搶走別類。加完在 `apps/web/test/features.test.ts` 補一兩句你預期的輸入。

首頁 chip 會自動出現，「輸入一句話找服務」打到關鍵字就會導過去。最後記得把資料來源加進 `apps/web/src/pages/AboutPage.vue`。

## 收尾檢查

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
