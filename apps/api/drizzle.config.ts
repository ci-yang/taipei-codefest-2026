import { defineConfig } from 'drizzle-kit';
import { env } from './src/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  dbCredentials: { url: env.DATABASE_URL },
  // PostGIS 自帶的 spatial_ref_sys 等表不要被 drizzle 管（否則 push 會想刪掉它們）
  extensionsFilters: ['postgis'],
});
