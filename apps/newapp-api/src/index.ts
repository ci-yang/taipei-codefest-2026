import { serve } from '@hono/node-server';
import { createApp, SERVICE_NAME } from './app';
import { corsOrigins, env } from './env';

const app = createApp();

// hostname 0.0.0.0：讓同網段的手機 / Docker 也連得到
const server = serve({ fetch: app.fetch, port: env.NEWAPP_API_PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`${SERVICE_NAME} listening on http://0.0.0.0:${info.port}  (CORS: ${corsOrigins.join(', ')})`);
});

const shutdown = (): void => {
  server.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
