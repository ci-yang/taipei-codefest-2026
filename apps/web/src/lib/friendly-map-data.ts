import { z } from 'zod';
import type { FriendlyStore } from '@app/shared';
import type { RouteCandidate, RoutePoint, RouteCoordinate } from '@app/shared/routing';
import { fetchValidated } from './api';
const Coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const LocalMapSchema = z.object({ type: z.literal('FeatureCollection'), features: z.array(z.object({
  type: z.literal('Feature'), properties: z.record(z.string(), z.unknown()),
  geometry: z.discriminatedUnion('type', [
    z.object({ type: z.literal('LineString'), coordinates: z.array(Coordinate).min(2) }),
    z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(Coordinate).min(4)).min(1) }),
  ]),
})) });
export type LocalMapData = z.infer<typeof LocalMapSchema>;
export const loadLocalMap = (url: string, signal: AbortSignal): Promise<LocalMapData> => fetchValidated(url, LocalMapSchema, { signal });
export interface MapViewData { stores: FriendlyStore[]; points: RoutePoint[]; route: RouteCandidate | null }
const lngLat = ([lat, lng]: RouteCoordinate): [number, number] => [lng, lat];
export function mapCollections(view: MapViewData) {
  const connectorKeys = new Set(view.route?.connectors.map((pair) => JSON.stringify(pair)) ?? []);
  const coordinates = view.route?.coordinates ?? [];
  return {
    stores: { type: 'FeatureCollection' as const, features: view.stores.map((store) => ({
      type: 'Feature' as const, properties: { id: store.id, name: store.name },
      geometry: { type: 'Point' as const, coordinates: [store.lng, store.lat] },
    })) },
    points: { type: 'FeatureCollection' as const, features: view.points.map((point, index) => ({
      type: 'Feature' as const, properties: { index }, geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] },
    })) },
    route: { type: 'FeatureCollection' as const, features: coordinates.slice(1).map((end, index) => {
      const segment: [RouteCoordinate, RouteCoordinate] = [coordinates[index]!, end];
      return { type: 'Feature' as const, properties: { connector: connectorKeys.has(JSON.stringify(segment)) },
        geometry: { type: 'LineString' as const, coordinates: segment.map(lngLat) } };
    }) },
  };
}
