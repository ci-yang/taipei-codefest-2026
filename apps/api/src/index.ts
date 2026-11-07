import { serve } from '@hono/node-server';
import { createApp } from './app';
import { pool } from './db/client';
import { corsOrigins, env } from './env';

const app = createApp();

// hostname 0.0.0.0：讓同網段的手機 / Docker 也連得到
const server = serve({ fetch: app.fetch, port: env.API_PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`API listening on http://0.0.0.0:${info.port}  (CORS: ${corsOrigins.join(', ')})`);
});

const shutdown = (): void => {
  server.close();
  void pool.end();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
