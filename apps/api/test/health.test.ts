import { afterAll, describe, expect, it } from 'vitest';
import { HealthSchema } from '@app/shared';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';

// 需要 DB：先 `docker compose up -d db`（CI 用 services: postgis）
describe('GET /healthz', () => {
  afterAll(() => pool.end());

  it('回 ok:true 且帶 PostGIS 版本', async () => {
    const res = await createApp().request('/healthz');
    expect(res.status).toBe(200);
    const body = HealthSchema.parse(await res.json());
    expect(body.ok).toBe(true);
    expect(body.db).toBe('up');
    expect(body.postgis).toMatch(/^\d+\.\d+/);
  });

  it('未知路徑回 404 JSON', async () => {
    const res = await createApp().request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'not_found' });
  });
});
