import { sql } from 'drizzle-orm';
import { geometry, index, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * 座標欄位用 PostGIS geometry(Point,4326)，查距離時轉成 ::geography（單位才是公尺）。
 * 為什麼不直接宣告 geography：drizzle-kit 0.31 會把非內建型別加上引號，
 * 產生 "geography(Point,4326)" 這種不存在的型別，push 會失敗。
 * geometry 是 drizzle 內建型別；另建一個 (geom::geography) 的 GiST 索引，讓 ST_DWithin 走索引。
 *
 * mode 'xy'：讀出來是 { x: lng, y: lat }，寫入也用 { x, y }。
 */
export const places = pgTable(
  'places',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    /** 資料來源（競賽規則要求標註），例如 "seed:demo"、"data.taipei:<rid>" */
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('places_geog_idx').using('gist', sql`(${t.geom}::geography)`),
    index('places_category_idx').on(t.category),
  ],
);
