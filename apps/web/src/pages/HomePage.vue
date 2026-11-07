<script setup lang="ts">
import { FRIENDLY_SERVICES } from '@app/shared';
import { FRIENDLY_LABELS } from '@/lib/friendly-data';
</script>
<template>
  <main class="page">
    <h1>找到沿路需要的友善服務</h1>
    <p>用真實友善店家名冊，在臺北地方路網比較距離與沿線資源。</p>
    <RouterLink class="primary" to="/map">開啟友善地圖</RouterLink>
    <h2>想找什麼？</h2>
    <div class="chips"><RouterLink v-for="service in FRIENDLY_SERVICES" :key="service" class="chip"
      :to="{ name: 'map', query: { service } }">{{ FRIENDLY_LABELS[service] }}</RouterLink></div>
    <p class="muted">首次載入需要網路。路線在裝置計算；未驗證現場入口、施工與整條路線的無障礙通行。</p>
    <RouterLink to="/about">查看資料來源與本版範圍</RouterLink>
  </main>
</template>
<style scoped>
h1 { font-size: 22px; margin: 16px 0; } h2 { font-size: 18px; margin-top: 28px; }
p { line-height: 1.65; } .primary { display: inline-flex; align-items: center; background: var(--brand); color: white; text-decoration: none; border-radius: 10px; min-height: 44px; padding: 10px 18px; margin: 12px 0; }
.chip { text-decoration: none; } a:focus-visible { outline: 3px solid var(--brand); outline-offset: 3px; }
</style>
