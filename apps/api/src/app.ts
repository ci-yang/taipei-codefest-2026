import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { pathnameLogger } from './friendly/pathname-logger';
import { SnapshotFriendlyRepository } from './friendly/snapshot-repository';
import type { FriendlyRepository } from './friendly/repository';
import { friendlyRoutes } from './routes/friendly';
import { platformRoutes } from './routes/platform';
import { db as defaultDb, type DB } from './db/client';
import { corsOrigins } from './env';
import { healthRoutes } from './routes/health';
import { opendataRoutes } from './routes/opendata';
import { placesRoutes } from './routes/places';

/** 組裝整個 API。測試直接呼叫 createApp().request(...)，不用開 port。 */
export function createApp(
  db: DB = defaultDb,
  friendlyRepository: FriendlyRepository = new SnapshotFriendlyRepository(),
): Hono {
  const app = new Hono();

  if (process.env.NODE_ENV !== 'test') app.use(pathnameLogger());
  app.use('*', cors({ origin: corsOrigins }));

  app.route('/healthz', healthRoutes(db));
  app.route('/api/v1/places', placesRoutes(db));
  app.route('/api/v1/opendata', opendataRoutes());
  const dataVersion = process.env.DATA_VERSION ?? 'friendly-route-2026-11-07-v1';
  app.route('/api/v1', friendlyRoutes(friendlyRepository, dataVersion));
  app.route(
    '/',
    platformRoutes(
      friendlyRepository,
      { dataVersion, buildSha: process.env.BUILD_SHA ?? 'local' },
      false,
    ),
  );

  app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404));
  app.onError((err, c) => {
    // Do not log the raw error: its message, stack, or custom name can contain request data.
    const type = err instanceof TypeError ? 'TypeError'
      : err instanceof RangeError ? 'RangeError'
      : err instanceof SyntaxError ? 'SyntaxError' : 'Error';
    console.error('api_unhandled_error', { type });
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
