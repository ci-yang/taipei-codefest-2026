import type { FriendlyQuery, FriendlySnapshot, FriendlyStore } from '@app/shared';

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function queryFriendly(snapshot: FriendlySnapshot, query: FriendlyQuery): FriendlyStore[] {
  return snapshot.stores
    .filter((store) => {
      if (query.services && !query.services.some((service) => store.services.includes(service)))
        return false;
      if (query.bbox) {
        const [west, south, east, north] = query.bbox;
        if (store.lng < west || store.lng > east || store.lat < south || store.lat > north)
          return false;
      }
      if (
        query.lat !== undefined &&
        query.lng !== undefined &&
        query.radius !== undefined &&
        distanceM(query.lat, query.lng, store.lat, store.lng) > query.radius
      )
        return false;
      return true;
    })
    .slice(0, query.limit);
}
