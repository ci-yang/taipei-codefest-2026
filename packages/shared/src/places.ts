import { z } from 'zod';

/** 類別清單：首頁 chips、seed 資料、API 篩選共用同一份。 */
export const PLACE_CATEGORIES = ['toilet', 'water', 'park', 'library', 'shelter'] as const;
export const PlaceCategorySchema = z.enum(PLACE_CATEGORIES);
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;

/** GET /api/v1/places 的 query string。query string 都是字串，所以用 coerce。 */
export const PlacesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().positive().max(50_000).default(1000),
  category: PlaceCategorySchema.optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});
export type PlacesQuery = z.infer<typeof PlacesQuerySchema>;

export const PlacePropertiesSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  category: z.string(),
  /** 資料來源（競賽規則要求標註），例如 "seed:demo" 或 "data.taipei:<rid>" */
  source: z.string(),
  /** 與查詢點的距離（公尺） */
  distanceM: z.number(),
  meta: z.record(z.string(), z.unknown()),
});
export type PlaceProperties = z.infer<typeof PlacePropertiesSchema>;

export const PointGeometrySchema = z.object({
  type: z.literal('Point'),
  /** GeoJSON 順序是 [lng, lat] */
  coordinates: z.tuple([z.number(), z.number()]),
});

export const PlaceFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: PointGeometrySchema,
  properties: PlacePropertiesSchema,
});
export type PlaceFeature = z.infer<typeof PlaceFeatureSchema>;

export const PlaceFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(PlaceFeatureSchema),
});
export type PlaceFeatureCollection = z.infer<typeof PlaceFeatureCollectionSchema>;
