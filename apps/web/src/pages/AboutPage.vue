<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { OpenDataResponseSchema, type OpenDataResponse } from '@app/shared';
import { apiGet } from '@/lib/api';

const sample = ref<OpenDataResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    // API 端已處理 data.taipei 斷線：失敗時回 mock 並標 mocked:true
    sample.value = await apiGet('/api/v1/opendata/sample', OpenDataResponseSchema, { limit: 3 });
  } catch (err) {
    error.value = (err as Error).message;
  }
});
</script>

<template>
  <main class="page">
    <h1>關於與資料來源</h1>

    <h2>資料來源</h2>
    <ul>
      <li>地圖圖磚：&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors（ODbL）</li>
      <li>地圖元件：<a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre GL JS</a>（BSD-3-Clause）</li>
      <li>開放資料：<a href="https://data.taipei/" target="_blank" rel="noopener">臺北市資料大平臺 data.taipei</a>（政府資料開放授權條款）</li>
      <li>地點資料目前為<strong>示範用假資料</strong>（source = seed:demo），正式版會換成開放資料並逐筆標註來源。</li>
    </ul>

    <h2>開放資料範例</h2>
    <p v-if="error" class="muted">讀取失敗：{{ error }}</p>
    <template v-else-if="sample">
      <p class="muted">
        來源：{{ sample.source.name }}<span v-if="sample.mocked">（目前為 mock：{{ sample.reason }}）</span>
      </p>
      <ul>
        <li v-for="item in sample.items" :key="item.id">{{ item.name }}<span v-if="item.address" class="muted"> · {{ item.address }}</span></li>
      </ul>
    </template>
    <p v-else class="muted">載入中…</p>

    <h2>授權</h2>
    <p>
      本專案原始碼以 <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">GNU AGPL-3.0-or-later</a>
      授權釋出。依 AGPL 第 13 條，透過網路使用本服務的使用者有權取得對應原始碼。
    </p>
  </main>
</template>

<style scoped>
h1 { font-size: 22px; }
h2 { font-size: 16px; margin-top: 24px; }
li { margin: 6px 0; line-height: 1.5; }
</style>
