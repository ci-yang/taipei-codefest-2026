import { z } from 'zod';

export const FRIENDLY_SERVICES = ['wifi', 'charge', 'toilet', 'accessible'] as const;
export const FriendlyServiceSchema = z.enum(FRIENDLY_SERVICES);
export type FriendlyService = z.infer<typeof FriendlyServiceSchema>;
export const LatLngSchema = z.tuple([
  z.number().finite().min(-90).max(90),
  z.number().finite().min(-180).max(180),
]);
export const FriendlyBoundsSchema = z
  .tuple([LatLngSchema, LatLngSchema])
  .refine(
    ([southWest, northEast]) => southWest[0] < northEast[0] && southWest[1] < northEast[1],
    'Bounds must be ordered south-west to north-east',
  );
export type FriendlyBounds = z.infer<typeof FriendlyBoundsSchema>;
export const FriendlyStoreSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    address: z.string(),
    phone: z.string(),
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    services: z.array(FriendlyServiceSchema),
    url: z.string().url(),
  })
  .strict();
export type FriendlyStore = z.infer<typeof FriendlyStoreSchema>;
const VersionSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const SourceFileSchema = z
  .object({
    file: z.string(),
    declaredSha256: Sha256Schema,
    measuredSha256: Sha256Schema.nullable(),
    verification: z.enum(['verified', 'source-declared']),
  })
  .strict()
  .refine(
    (v) =>
      v.verification === 'verified'
        ? v.measuredSha256 === v.declaredSha256
        : v.measuredSha256 === null,
    'Source hash verification mismatch',
  );
const AssetSchema = z
  .object({ path: z.string().startsWith('/friendly/'), sha256: Sha256Schema })
  .strict();
export const SourceManifestSchema = z
  .object({
    version: VersionSchema,
    fetchedAt: z.string().datetime({ offset: true }),
    bounds: FriendlyBoundsSchema,
    storeCount: z.number().int().nonnegative(),
    source: z
      .object({
        name: z.string().min(1),
        url: z.string().url(),
        downloadUrl: z.string().url(),
        updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        license: z.string().min(1),
        declaredSha256: Sha256Schema,
        measuredSha256: Sha256Schema.nullable(),
        verification: z.enum(['verified', 'source-declared']),
      })
      .strict()
      .refine(
        (v) =>
          v.verification === 'verified'
            ? v.measuredSha256 === v.declaredSha256
            : v.measuredSha256 === null,
        'Source hash verification mismatch',
      ),
    files: z
      .object({ snapshot: AssetSchema, routingGraph: AssetSchema, mapData: AssetSchema })
      .strict(),
    graph: z
      .object({
        version: VersionSchema,
        nodeCount: z.number().int().positive(),
        edgeCount: z.number().int().positive(),
        license: z.string(),
        attribution: z.string(),
        source: z.string().url(),
        sources: z.array(SourceFileSchema),
      })
      .strict(),
    provenance: z
      .object({ stores: z.string(), routingGraph: z.string(), mapData: z.string() })
      .strict(),
    limitations: z.array(z.string()),
  })
  .strict();
export type SourceManifest = z.infer<typeof SourceManifestSchema>;
export const FriendlyStoresResponseSchema = z
  .object({ version: VersionSchema, stores: z.array(FriendlyStoreSchema) })
  .strict();
export type FriendlyStoresResponse = z.infer<typeof FriendlyStoresResponseSchema>;
export const FriendlySnapshotSchema = FriendlyStoresResponseSchema.extend({
  manifest: SourceManifestSchema,
}).superRefine((s, ctx) => {
  if (s.version !== s.manifest.version || s.stores.length !== s.manifest.storeCount)
    ctx.addIssue({ code: 'custom', message: 'Snapshot metadata mismatch' });
  if (new Set(s.stores.map((store) => store.id)).size !== s.stores.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate store ID' });
  const [[south, west], [north, east]] = s.manifest.bounds;
  if (s.stores.some((s) => s.lat < south || s.lat > north || s.lng < west || s.lng > east))
    ctx.addIssue({ code: 'custom', message: 'Store outside snapshot bounds' });
});
export type FriendlySnapshot = z.infer<typeof FriendlySnapshotSchema>;
const QueryNumber = z.string().trim().min(1).transform(Number).pipe(z.number().finite());
/** bbox uses west,south,east,north (longitude first); radius is metres. */
export const FriendlyQuerySchema = z
  .object({
    services: z
      .string()
      .min(1)
      .transform((s) => s.split(','))
      .pipe(z.array(FriendlyServiceSchema).min(1))
      .optional(),
    bbox: z
      .string()
      .transform((s) => s.split(','))
      .pipe(z.tuple([QueryNumber, QueryNumber, QueryNumber, QueryNumber]))
      .refine(
        ([w, s, e, n]) => w >= -180 && e <= 180 && s >= -90 && n <= 90 && w < e && s < n,
        'Invalid bbox',
      )
      .optional(),
    lat: QueryNumber.pipe(z.number().min(-90).max(90)).optional(),
    lng: QueryNumber.pipe(z.number().min(-180).max(180)).optional(),
    radius: QueryNumber.pipe(z.number().positive().max(50_000)).optional(),
    limit: QueryNumber.pipe(z.number().int().positive().max(1000)).optional().default(1000),
  })
  .strict()
  .superRefine((q, ctx) => {
    const nearby = [q.lat, q.lng, q.radius].filter((v) => v !== undefined).length;
    if ((nearby !== 0 && nearby !== 3) || (q.bbox && nearby > 0))
      ctx.addIssue({ code: 'custom', message: 'Use bbox or lat,lng,radius together' });
  });
export type FriendlyQuery = z.infer<typeof FriendlyQuerySchema>;
