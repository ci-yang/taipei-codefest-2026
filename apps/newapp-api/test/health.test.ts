import { describe, expect, it } from 'vitest';
import { ServiceHealthSchema } from '@app/shared';
import { createApp } from '../src/app';

// 不需要 DB，直接打 createApp()
describe('GET /healthz', () => {
  it('回 ok:true 與服務名稱', async () => {
    const res = await createApp().request('/healthz');
    expect(res.status).toBe(200);
    const body = ServiceHealthSchema.parse(await res.json());
    expect(body.ok).toBe(true);
    expect(body.service).toBe('newapp-api');
  });

  it('未知路徑回 404 JSON', async () => {
    const res = await createApp().request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'not_found' });
  });
});
