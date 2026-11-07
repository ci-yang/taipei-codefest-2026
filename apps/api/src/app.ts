import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { db as defaultDb, type DB } from './db/client';
import { corsOrigins } from './env';
import { healthRoutes } from './routes/health';
import { opendataRoutes } from './routes/opendata';
import { placesRoutes } from './routes/places';

/** 組裝整個 API。測試直接呼叫 createApp().request(...)，不用開 port。 */
export function createApp(db: DB = defaultDb): Hono {
  const app = new Hono();

  if (process.env.NODE_ENV !== 'test') app.use(logger());
  app.use('*', cors({ origin: corsOrigins }));

  app.route('/healthz', healthRoutes(db));
  app.route('/api/v1/places', placesRoutes(db));
  app.route('/api/v1/opendata', opendataRoutes());
  // 新功能：在這裡加一行 app.route('/api/v1/<feature>', <feature>Routes(db))

  app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404));
  app.onError((err, c) => {
    console.error('[api] 未處理的錯誤：', err);
    return c.json({ error: 'internal_error', message: err.message }, 500);
  });

  return app;
}
