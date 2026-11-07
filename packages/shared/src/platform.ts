import { z } from 'zod';
import { FriendlyBoundsSchema } from './friendly';

export const PlatformConfigSchema = z
  .object({
    version: z.string().min(1),
    dataVersion: z.string().min(1),
    apiBase: z.literal('/api/v1'),
    bounds: FriendlyBoundsSchema,
    assets: z
      .object({
        routingGraph: z.literal('/friendly/routing-graph.json'),
        mapData: z.literal('/friendly/map-data.geojson'),
        manifest: z.literal('/friendly/manifest.json'),
      })
      .strict(),
  })
  .strict();
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;
export const PlatformHealthSchema = z
  .object({
    ok: z.boolean(),
    version: z.string(),
    dataVersion: z.string(),
    data: z.enum(['ready', 'unavailable']),
  })
  .strict();
export type PlatformHealth = z.infer<typeof PlatformHealthSchema>;
