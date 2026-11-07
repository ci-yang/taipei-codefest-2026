import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PlaceFeatureCollectionSchema } from '@app/shared';
import { createApp } from '../src/app';
import { db, pool } from '../src/db/client';

// 打真 DB。前置：pnpm db:push && pnpm db:seed（seed 的 10 筆示範資料）
const app = createApp();
const get = async (qs: string) => {
  const res = await app.request(`/api/v1/places?${qs}`);
  return { status: res.status, json: (await res.json()) as unknown };
};

describe('GET /api/v1/places', () => {
  beforeAll(async () => {
    const r = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM places WHERE source = 'seed:demo'`);
    if ((r.rows[0]?.n ?? 0) === 0) throw new Error('places 沒有 seed 資料，請先跑 pnpm db:push && pnpm db:seed');
  });
  afterAll(() => pool.end());

  it('市政府附近 3km 內有資料，回合法 GeoJSON 且依距離排序', async () => {
    const { status, json } = await get('lat=25.04&lng=121.56&radius=3000');
    expect(status).toBe(200);
    const fc = PlaceFeatureCollectionSchema.parse(json);
    expect(fc.features.length).toBeGreaterThan(0);
    const d = fc.features.map((f) => f.properties.distanceM);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(d.every((x) => x <= 3000)).toBe(true);
    // GeoJSON 是 [lng, lat]
    const [lng, lat] = fc.features[0]!.geometry.coordinates;
    expect(lng).toBeGreaterThan(121);
    expect(lat).toBeGreaterThan(24);
  });

  it('半徑縮小會排除較遠的點', async () => {
    const wide = PlaceFeatureCollectionSchema.parse((await get('lat=25.04&lng=121.56&radius=3000')).json);
    const narrow = PlaceFeatureCollectionSchema.parse((await get('lat=25.04&lng=121.56&radius=500')).json);
    expect(narrow.features.length).toBeLessThan(wide.features.length);
  });

  it('category 篩選只回該類別', async () => {
    const fc = PlaceFeatureCollectionSchema.parse((await get('lat=25.04&lng=121.54&radius=20000&category=toilet')).json);
    expect(fc.features.length).toBeGreaterThan(0);
    expect(fc.features.every((f) => f.properties.category === 'toilet')).toBe(true);
  });

  it('參數不合法回 400', async () => {
    expect((await get('lat=999&lng=121.56')).status).toBe(400);
    expect((await get('lng=121.56')).status).toBe(400);
  });
});
