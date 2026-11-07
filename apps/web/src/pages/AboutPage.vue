<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, ref } from 'vue';
import type { SourceManifest } from '@app/shared';
import FriendlySources from '@/components/FriendlySources.vue';
import { friendlyData } from '@/lib/friendly-data';
const source = shallowRef<SourceManifest | null>(null); const error = ref('');
const buildSha = import.meta.env.VITE_BUILD_SHA ?? '';
const sourceRef = /^[a-f0-9]{40}$/.test(buildSha) ? buildSha : 'feat/deploy-cloudflare-platform';
const sourceUrl = `https://github.com/ci-yang/taipei-codefest-2026/tree/${sourceRef}`;
let controller: AbortController | null = null;
async function load(): Promise<void> {
  controller?.abort(); const request = new AbortController(); controller = request; error.value = '';
  try {
    const value = await friendlyData.source(request.signal);
    if (!request.signal.aborted) source.value = value;
  } catch (failure) { if (!request.signal.aborted) error.value = failure instanceof Error ? failure.message : '讀取失敗'; }
}
onMounted(() => void load());
onBeforeUnmount(() => controller?.abort());
</script>
<template>
  <main class="page">
    <h1>關於與資料來源</h1>
    <FriendlySources :source="source" :error="error" @retry="load" />
    <h2>開源地圖與授權</h2>
    <p>地圖使用 <a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre GL JS</a>（BSD-3-Clause）與本版 OpenStreetMap 地方快照（ODbL）。</p>
    <p>本專案原始碼以 <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">GNU AGPL-3.0-or-later</a> 授權釋出。</p>
    <p><a :href="sourceUrl" target="_blank" rel="noopener">取得此版本的原始碼</a></p>
    <p><RouterLink to="/map">返回友善地圖</RouterLink></p>
  </main>
</template>
<style scoped>h1 { font-size: 22px; } h2 { font-size: 18px; } p { line-height: 1.6; }</style>
