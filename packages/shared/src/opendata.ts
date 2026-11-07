import { z } from 'zod';

/** 正規化後的開放資料項目：不管原始欄位叫什麼，前端只看這個形狀。 */
export const OpenDataItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  raw: z.record(z.string(), z.unknown()),
});
export type OpenDataItem = z.infer<typeof OpenDataItemSchema>;

export const OpenDataResponseSchema = z.object({
  /** 資料來源說明，顯示在畫面上（規則要求標註來源） */
  source: z.object({
    name: z.string(),
    url: z.string(),
    rid: z.string(),
  }),
  /** true 表示回的是內建 mock（data.taipei 打不到、沒設 rid、或帶 ?mock=1） */
  mocked: z.boolean(),
  /** mocked=true 時說明原因；拿到真資料時為 null */
  reason: z.string().nullable(),
  fetchedAt: z.string(),
  items: z.array(OpenDataItemSchema),
});
export type OpenDataResponse = z.infer<typeof OpenDataResponseSchema>;

export const OpenDataQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(10),
  /** ?mock=1 強制回內建 mock（data.taipei 斷線時的 demo 備援） */
  mock: z
    .enum(['0', '1'])
    .optional()
    .transform((v) => v === '1'),
});
