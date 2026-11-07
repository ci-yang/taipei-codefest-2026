<script setup lang="ts">
import type { SourceManifest } from '@app/shared';
defineProps<{ source: SourceManifest | null; error?: string }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <section class="sources" aria-label="資料來源與限制">
    <h2>資料來源與限制</h2>
    <template v-if="source">
      <p><a :href="source.source.url" target="_blank" rel="noopener noreferrer">{{ source.source.name }}</a></p>
      <p class="muted">資料更新 {{ source.source.updatedAt }} · 本版 {{ source.storeCount }} 筆 · 擷取 {{ source.fetchedAt.slice(0, 10) }}</p>
      <p class="muted">範圍：北緯 {{ source.bounds[0][0] }}–{{ source.bounds[1][0] }}、東經 {{ source.bounds[0][1] }}–{{ source.bounds[1][1] }}。</p>
      <p class="muted">名冊服務不代表店家目前開放；「無障礙」不代表整條路線可通行。</p>
      <details>
        <summary>版本、授權與檔案校驗值</summary>
        <p>名冊：{{ source.version }}<br>路網：{{ source.graph.version }}</p>
        <p>{{ source.source.license }}；路網 {{ source.graph.license }}，{{ source.graph.attribution }}。</p>
        <p>原始資料 SHA-256：<code>{{ source.source.declaredSha256 }}</code></p>
        <p>核對：{{ source.source.verification === 'verified' ? '已重新量測符合來源紀錄' : '僅有來源宣告，尚未重新量測' }}</p>
        <p>路網檔 SHA-256：<code>{{ source.files.routingGraph.sha256 }}</code></p>
        <ul><li v-for="limit in source.limitations" :key="limit">{{ limit }}</li></ul>
      </details>
    </template>
    <p v-else-if="error" role="status">來源讀取失敗：{{ error }} <button type="button" @click="$emit('retry')">重新讀取來源</button></p>
    <p v-else role="status">來源載入中…</p>
    <p class="muted">首次載入需要網路；路線在裝置上計算，這一版尚未提供完整離線下載。定位與行程不會自動傳送至 API。</p>
  </section>
</template>
<style scoped>
h2 { font-size: 18px; }
p, li { line-height: 1.6; }
code { overflow-wrap: anywhere; font-size: 12px; }
summary, button { min-height: 40px; cursor: pointer; }
summary { padding: 10px 0; }
button { padding: 8px; background: white; border: 1px solid var(--brand); border-radius: 8px; }
</style>
