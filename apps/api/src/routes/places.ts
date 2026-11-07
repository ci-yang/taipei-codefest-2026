import { zValidator } from '@hono/zod-validator';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { PlacesQuerySchema, type PlaceFeatureCollection } from '@app/shared';
import type { DB } from '../db/client';
import { places } from '../db/schema';

/**
 * GET /api/v1/places?lat=25.04&lng=121.56&radius=3000[&category=toilet][&limit=100]
 * 用 PostGIS ST_DWithin 找半徑內的點（geom 轉 ::geography，單位是公尺），依距離排序，回 GeoJSON。
 * 新功能照抄這支：shared schema 驗 query → drizzle 查詢 → 回 shared 定義的型別。
 */
export function placesRoutes(db: DB): Hono {
  const app = new Hono();

  app.get('/', zValidator('query', PlacesQuerySchema), async (c) => {
    const { lat, lng, radius, category, limit } = c.req.valid('query');
    const origin = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
    // 跟 schema 裡的 GiST 索引用同一個運算式 (geom::geography)，才會走索引
    const geog = sql`(${places.geom}::geography)`;

    const rows = await db
      .select({
        id: places.id,
        name: places.name,
        category: places.category,
        source: places.source,
        meta: places.meta,
        geom: places.geom,
        distanceM: sql<number>`ST_Distance(${geog}, ${origin})`,
      })
      .from(places)
      .where(and(sql`ST_DWithin(${geog}, ${origin}, ${radius})`, category ? eq(places.category, category) : undefined))
      .orderBy(sql`ST_Distance(${geog}, ${origin})`)
      .limit(limit);

    const body: PlaceFeatureCollection = {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.geom.x, r.geom.y] },
        properties: {
          id: r.id,
          name: r.name,
          category: r.category,
          source: r.source,
          distanceM: Math.round(Number(r.distanceM)),
          meta: r.meta,
        },
      })),
    };
    return c.json(body);
  });

  return app;
}
