import { Hono } from 'hono';
import { SUBSIDIES_UNAVAILABLE } from '@app/shared';
import { createSubsidyCache, type SubsidyCache } from '../lib/subsidies';

/**
 * GET /api/v1/subsidies：回整理好的補助清單（SubsidyList）。
 * 不讀 query 與 body（[SUBS-R70]）。[SUBS-R09] 經伺服器快取；從未成功過且這次也失敗回 503。
 * 每個 createApp() 一份快取，測試各自獨立。
 */
export function subsidiesRoutes(cache: SubsidyCache = createSubsidyCache()): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    try {
      return c.json(await cache.get());
    } catch (err) {
      console.warn('[subsidies] 無法提供補助清單：', (err as Error).message);
      return c.json({ error: SUBSIDIES_UNAVAILABLE }, 503);
    }
  });

  return app;
}
