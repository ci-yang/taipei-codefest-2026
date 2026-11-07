import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { ServiceHealth } from '@app/shared';
import { corsOrigins } from './env';

export const SERVICE_NAME = 'newapp-api';

/** 組裝整個 API。測試直接呼叫 createApp().request(...)，不用開 port。 */
export function createApp(): Hono {
  const app = new Hono();

  if (process.env.NODE_ENV !== 'test') app.use(logger());
  app.use('*', cors({ origin: corsOrigins }));

  app.get('/healthz', (c) => {
    const body: ServiceHealth = { ok: true, service: SERVICE_NAME, time: new Date().toISOString() };
    return c.json(body);
  });
  // 新功能：在這裡加一行 app.route('/api/v1/<feature>', <feature>Routes())

  app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404));
  app.onError((err, c) => {
    console.error(`[${SERVICE_NAME}] 未處理的錯誤：`, err);
    return c.json({ error: 'internal_error', message: err.message }, 500);
  });

  return app;
}
