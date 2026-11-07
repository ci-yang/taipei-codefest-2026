import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Health } from '@app/shared';
import type { DB } from '../db/client';

export function healthRoutes(db: DB): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    let postgis: string | null = null;
    let dbUp = false;
    try {
      const result = await db.execute<{ v: string }>(sql`SELECT postgis_version() AS v`);
      postgis = result.rows[0]?.v ?? null;
      dbUp = true;
    } catch (err) {
      console.warn('[healthz] db 檢查失敗：', (err as Error).message);
    }
    const body: Health = { ok: dbUp, db: dbUp ? 'up' : 'down', postgis, time: new Date().toISOString() };
    return c.json(body, dbUp ? 200 : 503);
  });

  return app;
}
