/** Coordinates in the routing snapshot are [latitude, longitude]. */
export type RouteCoordinate = [number, number];
export interface RoutePoint { lat: number; lng: number }
export interface RouteResource extends RoutePoint { id: string; name: string; services: string[] }
export const pointArray = (point: RoutePoint): RouteCoordinate => [point.lat, point.lng];
export const finitePoint = (point: unknown): point is RoutePoint => {
  if (!point || typeof point !== 'object') return false;
  const candidate = point as RoutePoint;
  return Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng);
};
const projectionCos = Math.cos(25.033 * Math.PI / 180);
const toXY = ([lat, lng]: RouteCoordinate): RouteCoordinate => [lng * 111320 * projectionCos, lat * 110540];
export function distance(a: RouteCoordinate, b: RouteCoordinate): number {
  const lat1 = a[0] * Math.PI / 180; const lat2 = b[0] * Math.PI / 180;
  const dlat = lat2 - lat1; const dlng = (b[1] - a[1]) * Math.PI / 180;
  const value = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}
function segmentDistanceXY(point: RouteCoordinate, a: RouteCoordinate, b: RouteCoordinate): number {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}
export function distanceToRoute(point: RoutePoint, coordinates: RouteCoordinate[]): number {
  const xy = toXY(pointArray(point)); let result = Infinity;
  for (let index = 1; index < coordinates.length; index += 1) {
    result = Math.min(result, segmentDistanceXY(xy, toXY(coordinates[index - 1]!), toXY(coordinates[index]!)));
  }
  return result;
}
export function resourceIds(coordinates: RouteCoordinate[], stores: RouteResource[], radius: number): string[] {
  const line = coordinates.map(toXY); const ids = new Set<string>();
  for (const store of stores) {
    const point = toXY(pointArray(store));
    for (let index = 1; index < line.length; index += 1) {
      if (segmentDistanceXY(point, line[index - 1]!, line[index]!) <= radius) { ids.add(String(store.id)); break; }
    }
  }
  return [...ids];
}
