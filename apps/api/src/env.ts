import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// 本機開發讀 repo 根目錄的 .env；Docker / CI 直接用環境變數，找不到檔就跳過
for (const candidate of ['.env', '../../.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().default('postgres://app:app@localhost:5433/app'),
  API_PORT: z.coerce.number().int().positive().default(8787),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
  /** 預設：臺北市垃圾車點位路線資訊（2026-11-07 實測 4012 筆）。設成空字串 = 一律回 mock */
  OPENDATA_SAMPLE_RID: z.string().default('a6e90031-7ec4-4089-afb5-361a4efe7202'),
});

export const env = EnvSchema.parse(process.env);

/** PUBLIC_WEB_URL 可用逗號分隔多個來源（例如手機用區網 IP 連） */
export const corsOrigins = env.PUBLIC_WEB_URL.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
