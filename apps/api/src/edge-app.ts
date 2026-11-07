import { Hono } from 'hono';
import { D1FriendlyRepository, type FriendlyD1Database } from './friendly/d1-repository';
import { pathnameLogger } from './friendly/pathname-logger';
import type { FriendlyRepository } from './friendly/repository';
import { friendlyRoutes } from './routes/friendly';
import { platformRoutes } from './routes/platform';

export interface PlatformBindings {
  FRIENDLY_DB: FriendlyD1Database;
  DATA_VERSION: string;
  BUILD_SHA: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}
export function createEdgeApp(
  bindings: PlatformBindings,
  repository: FriendlyRepository = new D1FriendlyRepository(bindings.FRIENDLY_DB),
): Hono {
  const app = new Hono();
  app.use('*', pathnameLogger());
  app.route('/api/v1', friendlyRoutes(repository, bindings.DATA_VERSION));
  app.route(
    '/',
    platformRoutes(repository, {
      dataVersion: bindings.DATA_VERSION,
      buildSha: bindings.BUILD_SHA,
    }),
  );
  app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404));
  app.onError((_error, c) => c.json({ error: 'internal_error' }, 500));
  return app;
}
