<script setup lang="ts">
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre v6 的 worker 是獨立檔案，Vite 的 dep 預打包會讓它找不到 worker，所以明確指定 URL
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { PlaceCategorySchema, type PlaceCategory } from '@app/shared';
import { useTownPassBridge } from '@/composables/useTownPassBridge';
import { PLACE_FEATURES } from '@/lib/features';
import { locateWithRetry } from '@/lib/locate';
import { usePlacesStore } from '@/stores/places';

setWorkerUrl(maplibreWorkerUrl);

/** 預設中心：臺北市政府。定位前與定位失敗時用這裡查 */
const TAIPEI_CITY_HALL = { latitude: 25.0375, longitude: 121.5637 };
const RADIUS_M = 3000;

/** OSM 官方圖磚（免費、無 key）。正式上線量大時請改自架或其他符合 OSM 使用政策的圖磚服務 */
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

type LocateState = 'locating' | 'retrying' | 'bridge' | 'browser' | 'failed';
const LOCATE_NOTES: Record<LocateState, string> = {
  locating: '定位中…',
  retrying: '定位中…（再試一次）',
  bridge: '已用台北通定位',
  browser: '已用瀏覽器定位',
  failed: '無法定位，改以市政府為中心（可按重新定位）',
};

const route = useRoute();
const store = usePlacesStore();
const bridge = useTownPassBridge();
const mapEl = ref<HTMLDivElement | null>(null);
const locateState = ref<LocateState>('locating');
const locating = computed(() => locateState.value === 'locating' || locateState.value === 'retrying');
const mapError = ref<string | null>(null);
let map: MapLibreMap | null = null;
let userMarker: Marker | null = null;
let center = TAIPEI_CITY_HALL;
let unmounted = false;

const category = (): PlaceCategory | undefined => {
  const parsed = PlaceCategorySchema.safeParse(route.query.category);
  return parsed.success ? parsed.data : undefined;
};

async function load(): Promise<void> {
  await store.fetchNearby({ lat: center.latitude, lng: center.longitude, radius: RADIUS_M, category: category() });
  (map?.getSource('places') as GeoJSONSource | undefined)?.setData(store.collection);
}

/** 定位（失敗自動重試一次）；成功就把地圖飛過去並重查，失敗維持市府中心 */
async function locate(): Promise<void> {
  locateState.value = 'locating';
  const { position } = await locateWithRetry(() => bridge.getLocation(), {
    onRetry: () => {
      if (!unmounted) locateState.value = 'retrying';
    },
  });
  if (unmounted) return;
  if (!position) {
    locateState.value = 'failed';
    return;
  }
  center = { latitude: position.latitude, longitude: position.longitude };
  // isAvailable 會在 iOS 晚注入時才翻成 true，所以在拿到結果當下判斷
  locateState.value = bridge.isAvailable.value ? 'bridge' : 'browser';
  const lngLat: [number, number] = [center.longitude, center.latitude];
  if (map) {
    if (userMarker) userMarker.setLngLat(lngLat);
    else userMarker = new Marker({ color: '#d33' }).setLngLat(lngLat).addTo(map);
    map.flyTo({ center: lngLat, zoom: 14 });
  }
  await load();
}

function relocate(): void {
  if (locating.value) return;
  void locate();
}

function initMap(): void {
  try {
    map = new MapLibreMap({
      container: mapEl.value!,
      style: OSM_STYLE,
      center: [center.longitude, center.latitude],
      zoom: 13,
    });
  } catch (err) {
    // 舊手機 WebView 沒有 WebGL2 時 MapLibre 會丟例外：改顯示清單，功能不中斷
    console.warn('[map] 地圖無法初始化，改用清單：', err);
    mapError.value = '此裝置無法顯示地圖，改以清單呈現';
    map = null;
    return;
  }
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

  const ready = (): void => {
    if (!map) return;
    // 樣式載入前就查到的資料直接帶進來；之後的查詢由 load() setData
    map.addSource('places', { type: 'geojson', data: store.collection });
    map.addLayer({
      id: 'places',
      type: 'circle',
      source: 'places',
      paint: { 'circle-radius': 8, 'circle-color': '#0b6e4f', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
    });
    map.on('click', 'places', (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      const p = f.properties as { name: string; distanceM: number; source: string };
      new Popup()
        .setLngLat(f.geometry.coordinates as [number, number])
        .setHTML(`<strong>${escapeHtml(p.name)}</strong><br>${p.distanceM} 公尺<br><small>來源：${escapeHtml(p.source)}</small>`)
        .addTo(map!);
    });
  };
  if (map.isStyleLoaded()) ready();
  else map.once('load', ready);
}

onMounted(() => {
  // 地圖先以市府為中心建好並查一次，不等定位（App 端定位沒有逾時，可能要十幾秒）
  initMap();
  void load();
  void locate();
});

watch(() => route.query.category, () => void load());
onBeforeUnmount(() => {
  unmounted = true;
  map?.remove();
  map = null;
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
</script>

<template>
  <main class="map-page">
    <div class="toolbar">
      <div class="chips">
        <RouterLink :to="{ name: 'map' }" class="chip" :class="{ active: !category() }">全部</RouterLink>
        <RouterLink
          v-for="f in PLACE_FEATURES"
          :key="f.id"
          :to="f.to"
          class="chip"
          :class="{ active: category() === f.id }"
          >{{ f.label }}</RouterLink
        >
      </div>
      <div class="status-row">
        <p class="muted" data-testid="map-status">
          <span data-testid="locate-status">{{ LOCATE_NOTES[locateState] }}</span> ·
          <span v-if="store.loading">載入中…</span>
          <span v-else-if="store.error" class="error">API 錯誤：{{ store.error }}</span>
          <span v-else>半徑 {{ RADIUS_M / 1000 }} 公里內 {{ store.collection.features.length }} 筆</span>
        </p>
        <button type="button" class="relocate" data-testid="relocate" :disabled="locating" @click="relocate">
          {{ locating ? '定位中' : '重新定位' }}
        </button>
      </div>
    </div>
    <div v-show="!mapError" ref="mapEl" class="map" data-testid="map"></div>
    <section v-if="mapError" class="fallback">
      <p class="muted">{{ mapError }}</p>
      <ol>
        <li v-for="f in store.collection.features" :key="f.properties.id">
          {{ f.properties.name }} <span class="muted">· {{ f.properties.distanceM }} 公尺</span>
        </li>
      </ol>
    </section>
  </main>
</template>

<style scoped>
.map-page { position: fixed; inset: 0 0 calc(56px + env(safe-area-inset-bottom)) 0; display: flex; flex-direction: column; }
.toolbar { padding: 8px 12px; background: #fff; border-bottom: 1px solid var(--border); }
.toolbar .chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
.toolbar .chip { text-decoration: none; color: inherit; white-space: nowrap; min-height: 34px; padding: 6px 12px; }
.status-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.status-row p { flex: 1; min-width: 0; margin: 0; }
.relocate { flex: none; min-height: 40px; padding: 0 12px; border: 1px solid var(--brand); border-radius: 10px; background: #fff; color: var(--brand); font-size: 14px; }
.relocate:disabled { opacity: 0.5; }
.map { flex: 1; }
.fallback { flex: 1; overflow-y: auto; padding: 8px 16px; }
.fallback li { margin: 8px 0; }
.error { color: #b00020; }
</style>
