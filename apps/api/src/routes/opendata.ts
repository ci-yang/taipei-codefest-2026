import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { OpenDataQuerySchema, type OpenDataItem, type OpenDataResponse } from '@app/shared';
import { env } from '../env';
import { MOCK_RECORDS, MOCK_SOURCE_NAME } from '../lib/opendata-mock';

const DATA_TAIPEI_API = 'https://data.taipei/api/v1/dataset';
const FETCH_TIMEOUT_MS = 5000;
/** data.taipei 偶爾 TLS timeout / connection reset，重試一次通常就好 */
const FETCH_ATTEMPTS = 2;

type RawRecord = Record<string, unknown>;

/** 依常見欄位名猜 name/address/lat/lng。換資料集時，通常只需要改這個函式。 */
export function normalizeRecord(raw: RawRecord, index: number): OpenDataItem {
  const pick = (patterns: RegExp[]): unknown => {
    for (const p of patterns) {
      const key = Object.keys(raw).find((k) => p.test(k));
      if (key && raw[key] !== '' && raw[key] != null) return raw[key];
    }
    return null;
  };
  const toNum = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: String(raw._id ?? index),
    // 垃圾車點位沒有「名稱」，退而用「地點」
    name: String(pick([/名稱/, /^name$/i, /title/i, /地點/, /地址/]) ?? `item-${index}`),
    address: (pick([/地址/, /address/i, /地點/, /位置/]) as string | null) ?? null,
    lat: toNum(pick([/緯度/, /^lat/i, /latitude/i, /^y$/i])),
    lng: toNum(pick([/經度/, /^(lng|lon)/i, /longitude/i, /^x$/i])),
    raw,
  };
}

/** data.taipei 回傳格式：{ result: { limit, offset, count, results: [...] } } */
async function fetchDataTaipei(rid: string, limit: number): Promise<RawRecord[]> {
  const url = `${DATA_TAIPEI_API}/${encodeURIComponent(rid)}?scope=resourceAquire&limit=${limit}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`data.taipei HTTP ${res.status}`);
      const json = (await res.json()) as { result?: { results?: RawRecord[] } };
      const results = json.result?.results;
      if (!Array.isArray(results) || results.length === 0) throw new Error('data.taipei 回傳空資料（rid 可能錯誤）');
      return results;
    } catch (err) {
      lastError = err;
      console.warn(`[opendata] 第 ${attempt} 次打 data.taipei 失敗：`, (err as Error).message);
    }
  }
  throw lastError;
}

/**
 * GET /api/v1/opendata/sample?limit=10[&mock=1]
 * server 端打 data.taipei（避免前端 CORS、統一正規化）。每次 5 秒逾時、重試 1 次；
 * 仍失敗就回內建 mock，標 mocked:true 並在 reason 寫原因（demo 不會因為 data.taipei 斷線而開天窗）。
 */
export function opendataRoutes(): Hono {
  const app = new Hono();

  app.get('/sample', zValidator('query', OpenDataQuerySchema), async (c) => {
    const { limit, mock } = c.req.valid('query');
    const rid = env.OPENDATA_SAMPLE_RID;
    const fetchedAt = new Date().toISOString();

    const mockResponse = (reason: string): OpenDataResponse => ({
      source: { name: MOCK_SOURCE_NAME, url: 'https://data.taipei/', rid: 'mock' },
      mocked: true,
      reason,
      fetchedAt,
      items: MOCK_RECORDS.slice(0, limit).map(normalizeRecord),
    });

    if (mock) return c.json(mockResponse('帶了 ?mock=1'));
    if (!rid) return c.json(mockResponse('未設定 OPENDATA_SAMPLE_RID'));

    try {
      const records = await fetchDataTaipei(rid, limit);
      const body: OpenDataResponse = {
        source: {
          name: `臺北市資料大平臺 data.taipei（rid=${rid}）`,
          url: `${DATA_TAIPEI_API}/${rid}?scope=resourceAquire`,
          rid,
        },
        mocked: false,
        reason: null,
        fetchedAt,
        items: records.map(normalizeRecord),
      };
      return c.json(body);
    } catch (err) {
      const reason = `data.taipei 無法取得資料：${(err as Error).message}`;
      console.warn(`[opendata] 改回 mock：${reason}`);
      return c.json(mockResponse(reason));
    }
  });

  return app;
}
