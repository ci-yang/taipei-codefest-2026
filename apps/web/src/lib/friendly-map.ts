import { Map as MapLibreMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { FriendlyBounds } from '@app/shared';
import { mapCollections, type LocalMapData, type MapViewData } from './friendly-map-data';
setWorkerUrl(maplibreWorkerUrl);

export interface FriendlyMapHandle { update: (view: MapViewData) => void; destroy: () => void }
export function createFriendlyMap(container: HTMLElement, data: LocalMapData, bounds: FriendlyBounds,
  onError: () => void, onReady: () => void, onSelect: (id: string) => void): FriendlyMapHandle {
  const empty = { type: 'FeatureCollection' as const, features: [] };
  const style: StyleSpecification = {
    version: 8, sources: {
      local: { type: 'geojson', data, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ODbL' },
      stores: { type: 'geojson', data: empty }, points: { type: 'geojson', data: empty }, route: { type: 'geojson', data: empty },
    }, layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f7f8f5' } },
      { id: 'areas', type: 'fill', source: 'local', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#dce7dc', 'fill-opacity': 0.65 } },
      { id: 'roads', type: 'line', source: 'local', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#b7c6bf', 'line-width': 2 } },
      { id: 'route', type: 'line', source: 'route', filter: ['==', 'connector', false], paint: { 'line-color': '#0b6e4f', 'line-width': 5 } },
      { id: 'connectors', type: 'line', source: 'route', filter: ['==', 'connector', true], paint: { 'line-color': '#a35012', 'line-width': 4, 'line-dasharray': [2, 2] } },
      { id: 'stores', type: 'circle', source: 'stores', paint: { 'circle-radius': 6, 'circle-color': '#0b6e4f', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } },
      { id: 'points', type: 'circle', source: 'points', paint: { 'circle-radius': 10, 'circle-color': '#fff', 'circle-stroke-width': 4, 'circle-stroke-color': '#a35012' } },
    ],
  };
  const map = new MapLibreMap({ container, style, bounds: [[bounds[0][1], bounds[0][0]], [bounds[1][1], bounds[1][0]]],
    fitBoundsOptions: { padding: 20 }, attributionControl: { compact: true } });
  let current: MapViewData = { stores: [], points: [], route: null }; let ready = false; let destroyed = false;
  const update = (view: MapViewData): void => {
    current = view;
    if (!ready || destroyed) return;
    const collections = mapCollections(view);
    for (const id of ['stores', 'points', 'route'] as const) (map.getSource(id) as GeoJSONSource | undefined)?.setData(collections[id]);
  };
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  map.on('error', () => { if (!destroyed) onError(); });
  map.on('load', () => { ready = true; update(current); onReady(); });
  map.on('click', 'stores', (event) => {
    const id: unknown = event.features?.[0]?.properties?.id;
    if (typeof id === 'string') onSelect(id);
  });
  return { update, destroy: () => { if (!destroyed) { destroyed = true; map.remove(); } } };
}
