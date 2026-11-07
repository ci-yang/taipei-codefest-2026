/**
 * 塞 10 筆臺北市座標的「示範用假資料」。名稱是虛構的，source 標成 seed:demo，
 * 正式 demo 前請換成開放資料（見 docs/HOW-TO-ADD-A-FEATURE.md）。
 * 可重複執行：先刪掉 source=seed:demo 的列再寫入。
 */
import { eq, sql } from 'drizzle-orm';
import { db, pool } from './client';
import { places } from './schema';

const SEED_SOURCE = 'seed:demo';

const rows: Array<{ name: string; category: string; lat: number; lng: number; note: string }> = [
  { name: '示範公廁 A（市政府附近）', category: 'toilet', lat: 25.0375, lng: 121.5637, note: '信義區' },
  { name: '示範公廁 B（台北車站附近）', category: 'toilet', lat: 25.0478, lng: 121.517, note: '中正區' },
  { name: '示範飲水機 A（大安森林公園附近）', category: 'water', lat: 25.0299, lng: 121.5355, note: '大安區' },
  { name: '示範飲水機 B（西門附近）', category: 'water', lat: 25.0422, lng: 121.5078, note: '萬華區' },
  { name: '示範公園 A（國父紀念館附近）', category: 'park', lat: 25.0401, lng: 121.5602, note: '信義區' },
  { name: '示範公園 B（青年公園附近）', category: 'park', lat: 25.0236, lng: 121.5067, note: '萬華區' },
  { name: '示範圖書館 A（總館附近）', category: 'library', lat: 25.0273, lng: 121.5434, note: '大安區' },
  { name: '示範圖書館 B（內湖附近）', category: 'library', lat: 25.0832, lng: 121.5869, note: '內湖區' },
  { name: '示範避難處所 A（松山附近）', category: 'shelter', lat: 25.05, lng: 121.5776, note: '松山區' },
  { name: '示範避難處所 B（士林附近）', category: 'shelter', lat: 25.0932, lng: 121.5246, note: '士林區' },
];

async function main(): Promise<void> {
  await db.delete(places).where(eq(places.source, SEED_SOURCE));
  await db.insert(places).values(
    rows.map((r) => ({
      name: r.name,
      category: r.category,
      geom: { x: r.lng, y: r.lat },
      meta: { district: r.note, demo: true },
      source: SEED_SOURCE,
    })),
  );
  const [{ count }] = (await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM places`)).rows as [
    { count: number },
  ];
  console.log(`seed 完成：places 共 ${count} 筆`);
}

main()
  .catch((err: unknown) => {
    console.error('seed 失敗：', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
