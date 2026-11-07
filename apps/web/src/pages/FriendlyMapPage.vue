<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { FRIENDLY_SERVICES, FriendlyServiceSchema } from '@app/shared';
import FriendlyMap from '@/components/FriendlyMap.vue';
import FriendlyRouteResults from '@/components/FriendlyRouteResults.vue';
import FriendlySources from '@/components/FriendlySources.vue';
import { useTownPassBridge, isTownPassBridgeAvailable } from '@/composables/useTownPassBridge';
import { useFriendlyExplorer } from '@/composables/useFriendlyExplorer';
import { createLocationAdapter } from '@/lib/friendly-location';
import { FRIENDLY_LABELS } from '@/lib/friendly-data';
const route = useRoute();
const bridge = useTownPassBridge();
const explorer = useFriendlyExplorer(createLocationAdapter({ nativeAvailable: isTownPassBridgeAvailable,
  getNative: bridge.getLocation, geolocation: navigator.geolocation }));
const { stores, config, source, loading, graphLoading, error, graphError, sourceError, services, radius,
  start, destination, reading, locating, comparison, selectedRouteId, visibleStores, selectedRoute, canCompare } = explorer;
const view = computed(() => ({ stores: visibleStores.value, points: [start.value, destination.value].filter((point) => point !== null), route: selectedRoute.value }));
const selectedService = FriendlyServiceSchema.safeParse(route.query.service ?? route.query.category);
if (selectedService.success) services.value = [selectedService.data];
onMounted(() => void explorer.load());
</script>
<template>
  <main class="page friendly-page">
    <h1>友善店家與地方路線</h1>
    <p class="muted">使用臺北地方快照選點，依路網比較距離與沿線服務。</p>
    <fieldset class="filters">
      <legend>需要什麼服務？（任一符合）</legend>
      <div class="chips"><button v-for="service in FRIENDLY_SERVICES" :key="service" type="button" class="chip"
        :class="{ active: services.includes(service) }" :aria-pressed="services.includes(service)" @click="explorer.toggleService(service)">{{ FRIENDLY_LABELS[service] }}</button></div>
      <p class="muted">未選服務時顯示全部名冊。</p>
    </fieldset>
    <p v-if="loading" role="status">名冊與設定載入中…</p>
    <div v-if="error" class="error" role="status"><p>{{ error }}</p><button type="button" @click="explorer.load">重試名冊</button></div>
    <section class="controls" aria-label="起點與目的地">
      <h2>選擇起點與目的地</h2>
      <button type="button" class="location-button" :disabled="!config || locating" @click="explorer.locate">{{ locating ? '定位中…' : '使用目前位置／重試定位' }}</button>
      <p role="status" class="muted">{{ reading?.message ?? (locating ? '等候真實位置，最多 12 秒；也可直接手動選點。' : '尚未定位，可使用目前位置或手動選起點。') }}</p>
      <p v-if="reading?.position" class="muted">來源：{{ reading.reason === 'simulated' ? '模擬位置' : reading.source === 'native' ? '台北通' : '瀏覽器' }} · 精度 {{ reading.position.accuracy ?? '未知' }} 公尺 · 時間 {{ new Date(reading.position.timestamp).toLocaleTimeString('zh-TW') }}</p>
      <label for="friendly-start">起點</label>
      <select id="friendly-start" :value="start?.id ?? ''" @change="explorer.selectStart(($event.target as HTMLSelectElement).value)">
        <option value="">手動選擇起點</option><option v-if="start && start.source !== 'manual'" value="current-location">目前位置（{{ start.source === 'native' ? '台北通' : '瀏覽器' }}）</option>
        <option v-for="store in stores" :key="store.id" :value="store.id">{{ store.name }}</option>
      </select>
      <label for="friendly-destination">目的地</label>
      <select id="friendly-destination" :value="destination?.id ?? ''" @change="explorer.selectDestination(($event.target as HTMLSelectElement).value)">
        <option value="">選擇目的地</option><option v-for="store in stores" :key="store.id" :value="store.id">{{ store.name }}</option>
      </select>
      <label for="friendly-radius">沿線資源距離</label>
      <select id="friendly-radius" v-model.number="radius"><option :value="100">100 公尺</option><option :value="250">250 公尺</option><option :value="500">500 公尺</option></select>
      <p v-if="graphLoading" role="status" class="muted">地方路網載入中…</p>
      <p v-if="graphError" class="error" role="status">路網無法使用：{{ graphError }} <button type="button" @click="config ? explorer.loadGraph() : explorer.load()">重試路網</button></p>
      <button type="button" class="primary" :disabled="!canCompare" @click="explorer.compare">比較路線</button>
    </section>
    <FriendlyRouteResults :comparison="comparison" :selected="selectedRouteId" @select="selectedRouteId = $event" />
    <FriendlyMap v-if="config" :url="config.assets.mapData" :bounds="config.bounds" :view="view" @select="explorer.selectDestination" />
    <section aria-label="友善店家名冊">
      <h2>友善名冊 <span class="muted">{{ visibleStores.length }} 筆</span></h2>
      <p v-if="!loading && !error && !visibleStores.length" role="status">沒有符合服務的店家，請調整篩選條件。</p>
      <ul class="store-list"><li v-for="store in visibleStores" :key="store.id" :class="{ selected: start?.id === store.id || destination?.id === store.id }">
        <h3>{{ store.name }}</h3><p>{{ store.address }}</p>
        <p class="muted">{{ store.services.length ? store.services.map((service) => FRIENDLY_LABELS[service]).join('、') : '名冊未記載這四類服務' }}</p>
        <div class="store-actions"><button type="button" @click="explorer.selectStart(store.id)">設為起點</button><button type="button" @click="explorer.selectDestination(store.id)">設為目的地</button></div>
      </li></ul>
    </section>
    <FriendlySources :source="source" :error="sourceError" @retry="explorer.load" />
  </main>
</template>
<style scoped>
h1 { font-size: 22px; margin: 8px 0 12px; } h2 { font-size: 18px; } h3 { font-size: 16px; margin: 0; }
p { line-height: 1.55; } fieldset { border: 0; margin: 16px 0; padding: 0; } legend { margin-bottom: 10px; }
.controls { display: grid; gap: 8px; border: 1px solid var(--border); padding: 16px; border-radius: 10px; }
.controls h2, .controls p { margin: 4px 0; }
select { width: 100%; min-width: 0; min-height: 44px; font: inherit; font-size: 16px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: white; }
button { min-height: 40px; padding: 8px 12px; background: white; border: 1px solid var(--brand); border-radius: 10px; cursor: pointer; color: var(--brand); }
button:disabled { opacity: .5; cursor: default; } .primary { background: var(--brand); color: white; margin-top: 8px; }
.store-list { list-style: none; padding: 0; max-height: 600px; overflow: auto; }
.store-list li { padding: 16px; border: 1px solid var(--border); border-radius: 10px; margin: 10px 0; }
.store-list li.selected { border-color: var(--brand); background: var(--brand-weak); }
.store-list p { margin: 8px 0; } .store-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.error { color: #b00020; } :focus-visible { outline: 3px solid #0b6e4f; outline-offset: 3px; }
</style>
