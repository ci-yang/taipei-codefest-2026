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
  NEWAPP_API_PORT: z.coerce.number().int().positive().default(8788),
  NEWAPP_PUBLIC_WEB_URL: z.string().default('http://localhost:5174'),
});

export const env = EnvSchema.parse(process.env);

/** NEWAPP_PUBLIC_WEB_URL 可用逗號分隔多個來源（例如手機用區網 IP 連） */
export const corsOrigins = env.NEWAPP_PUBLIC_WEB_URL.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
