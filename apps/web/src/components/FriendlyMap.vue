<script setup lang="ts">
import 'maplibre-gl/dist/maplibre-gl.css';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { FriendlyBounds } from '@app/shared';
import { loadLocalMap, type MapViewData } from '@/lib/friendly-map-data';
import type { FriendlyMapHandle } from '@/lib/friendly-map';
const props = defineProps<{ url: string; bounds: FriendlyBounds; view: MapViewData }>();
const emit = defineEmits<{ select: [id: string] }>();
const element = ref<HTMLElement | null>(null); const error = ref(''); const loading = ref(true);
let controller: AbortController | null = null; let map: FriendlyMapHandle | null = null;
let generation = 0; let readyTimer: ReturnType<typeof setTimeout> | undefined;
function mapFailure(): void { loading.value = false; error.value = '地圖無法顯示，可繼續使用下方名冊選點。'; clearTimeout(readyTimer); }
async function initialize(): Promise<void> {
  const request = ++generation; controller?.abort(); controller = new AbortController();
  const signal = controller.signal; map?.destroy(); map = null; clearTimeout(readyTimer);
  loading.value = true; error.value = '';
  try {
    const [data, adapter] = await Promise.all([loadLocalMap(props.url, signal), import('@/lib/friendly-map')]);
    if (signal.aborted || request !== generation || !element.value) return;
    readyTimer = setTimeout(mapFailure, 15_000);
    map = adapter.createFriendlyMap(element.value, data, props.bounds, mapFailure,
      () => { loading.value = false; clearTimeout(readyTimer); }, (id) => emit('select', id));
    map.update(props.view);
  } catch {
    if (!signal.aborted && request === generation) mapFailure();
  }
}
onMounted(() => void initialize());
watch(() => props.view, (view) => map?.update(view), { deep: true });
watch(() => props.url, () => void initialize());
onBeforeUnmount(() => { generation += 1; controller?.abort(); clearTimeout(readyTimer); map?.destroy(); });
</script>
<template>
  <section class="map-section" aria-label="地方路網地圖">
    <p v-if="loading" role="status">地圖載入中…</p>
    <div v-show="!error" ref="element" class="map-canvas" aria-label="服務點與候選路線地圖"></div>
    <div v-if="error" role="status"><p>{{ error }}</p><button type="button" @click="initialize">重試地圖</button></div>
    <p class="muted">綠線：地方路網候選；棕色虛線：未驗證的起終點接線。點地圖服務點可設為目的地。</p>
  </section>
</template>
<style scoped>
.map-section { margin: 16px 0; }
.map-canvas { width: 100%; height: 320px; border: 1px solid var(--border); border-radius: 10px; }
button { min-height: 40px; padding: 8px 14px; background: white; border: 1px solid var(--brand); color: var(--brand); border-radius: 10px; }
</style>
