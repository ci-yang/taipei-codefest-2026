import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { FRIENDLY_SERVICES, type FriendlyService, type FriendlyStore, type PlatformConfig, type SourceManifest } from '@app/shared';
import type { createRouter, RouteCandidate, RouteComparison, RoutePoint } from '@app/shared/routing';
import { friendlyData, type FriendlyDataAdapter } from '@/lib/friendly-data';
import type { LocationAdapter, LocationReading } from '@/lib/friendly-location';

export interface SelectedPoint extends RoutePoint { id: string; name: string; source: 'manual' | 'native' | 'browser' }
const errorText = (error: unknown): string => error instanceof Error ? error.message : '讀取失敗，請重試。';
export function useFriendlyExplorer(location: LocationAdapter, data: FriendlyDataAdapter = friendlyData) {
  const stores = shallowRef<FriendlyStore[]>([]);
  const config = shallowRef<PlatformConfig | null>(null);
  const source = shallowRef<SourceManifest | null>(null);
  const router = shallowRef<ReturnType<typeof createRouter> | null>(null);
  const loading = ref(false); const graphLoading = ref(false);
  const error = ref(''); const graphError = ref(''); const sourceError = ref('');
  const services = ref<FriendlyService[]>([]); const radius = ref(250);
  const start = shallowRef<SelectedPoint | null>(null); const destination = shallowRef<SelectedPoint | null>(null);
  const reading = shallowRef<LocationReading | null>(null); const locating = ref(false);
  const comparison = shallowRef<RouteComparison | null>(null); const selectedRouteId = ref('shortest');
  let loadController: AbortController | null = null;
  let graphController: AbortController | null = null;
  let locationController: AbortController | null = null;
  let generation = 0; let disposed = false;
  const visibleStores = computed(() => stores.value.filter((store) => !services.value.length || store.services.some((key) => services.value.includes(key))));
  const selectedRoute = computed<RouteCandidate | null>(() => comparison.value?.routes.find((route) => route.id === selectedRouteId.value) ?? null);
  const canCompare = computed(() => !!start.value && !!destination.value && !!router.value);
  const clearRoute = (): void => { comparison.value = null; selectedRouteId.value = 'shortest'; };
  watch([start, destination, services, radius], clearRoute, { deep: true, flush: 'sync' });
  function cancelLocation(): void {
    generation += 1; locationController?.abort(); locationController = null; locating.value = false;
  }
  function selectStart(id: string): void {
    cancelLocation(); reading.value = null;
    const store = stores.value.find((item) => item.id === id);
    start.value = store ? { ...store, source: 'manual' } : null;
  }
  function selectDestination(id: string): void {
    const store = stores.value.find((item) => item.id === id);
    destination.value = store ? { ...store, source: 'manual' } : null;
  }
  function toggleService(service: FriendlyService): void {
    services.value = services.value.includes(service) ? services.value.filter((item) => item !== service) : [...services.value, service];
  }
  async function locate(): Promise<void> {
    if (!config.value) return;
    cancelLocation();
    const request = ++generation; const controller = new AbortController(); locationController = controller;
    locating.value = true; reading.value = null;
    // A previous GPS fix must not silently remain usable during a failed retry.
    if (start.value?.source !== 'manual') start.value = null;
    try {
      const value = await location(config.value.bounds, controller.signal);
      if (disposed || request !== generation || controller.signal.aborted) return;
      reading.value = value;
      if (!value.reason && value.position) start.value = {
        id: 'current-location', name: '目前位置', lat: value.position.latitude, lng: value.position.longitude, source: value.source,
      };
    } catch (failure) {
      if (!disposed && request === generation && !controller.signal.aborted) reading.value = { source: 'browser', position: null, reason: 'unknown', message: errorText(failure) };
    } finally {
      if (request === generation) locating.value = false;
    }
  }
  async function loadGraph(): Promise<void> {
    graphController?.abort(); graphController = new AbortController();
    const controller = graphController; const currentConfig = config.value;
    if (!currentConfig) return;
    graphLoading.value = true; graphError.value = ''; router.value = null; clearRoute();
    try {
      const loaded = await data.router(currentConfig.assets.routingGraph, controller.signal);
      if (!controller.signal.aborted && !disposed) router.value = loaded;
    } catch (failure) {
      if (!controller.signal.aborted && !disposed) graphError.value = errorText(failure);
    } finally { if (!controller.signal.aborted && !disposed) graphLoading.value = false; }
  }
  async function load(): Promise<void> {
    loadController?.abort(); graphController?.abort(); cancelLocation();
    const controller = new AbortController(); loadController = controller;
    loading.value = true; graphLoading.value = false; error.value = ''; sourceError.value = ''; graphError.value = '';
    router.value = null; config.value = null; source.value = null; clearRoute();
    const results = await Promise.allSettled([data.stores(controller.signal), data.config(controller.signal), data.source(controller.signal)]);
    if (controller.signal.aborted || disposed) return;
    const [directory, settings, manifest] = results;
    if (directory.status === 'fulfilled') stores.value = directory.value.stores;
    else { stores.value = []; error.value = errorText(directory.reason); }
    if (manifest.status === 'fulfilled') source.value = manifest.value;
    else sourceError.value = errorText(manifest.reason);
    if (settings.status === 'fulfilled') config.value = settings.value;
    else graphError.value = `路網設定讀取失敗：${errorText(settings.reason)}`;
    if (directory.status === 'fulfilled' && settings.status === 'fulfilled' && directory.value.version !== settings.value.dataVersion) {
      error.value = '名冊與設定版本不一致，請重新載入。'; stores.value = []; config.value = null;
    }
    if (start.value?.source === 'manual' && !stores.value.some((store) => store.id === start.value?.id)) start.value = null;
    if (destination.value && !stores.value.some((store) => store.id === destination.value?.id)) destination.value = null;
    loading.value = false;
    if (config.value) await loadGraph();
  }
  function compare(): void {
    if (!router.value || !start.value || !destination.value) return;
    comparison.value = router.value.compare({ points: [start.value, destination.value], stores: stores.value,
      services: services.value.length ? services.value : [...FRIENDLY_SERVICES], radius: radius.value });
    selectedRouteId.value = 'shortest';
  }
  onScopeDispose(() => { disposed = true; loadController?.abort(); graphController?.abort(); cancelLocation(); });
  return { stores, config, source, router, loading, graphLoading, error, graphError, sourceError,
    services, radius, start, destination, reading, locating, comparison, selectedRouteId, visibleStores, selectedRoute, canCompare,
    load, loadGraph, locate, selectStart, selectDestination, toggleService, compare };
}
