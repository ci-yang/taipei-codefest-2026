<script setup lang="ts">
import type { RouteComparison } from '@app/shared/routing';
defineProps<{ comparison: RouteComparison | null; selected: string }>();
defineEmits<{ select: [id: string] }>();
</script>
<template>
  <section aria-label="路線比較結果" aria-live="polite">
    <p v-if="!comparison" class="muted">選好起點與目的地後比較路線。改動條件後請重新比較。</p>
    <p v-else-if="comparison.error" class="error">{{ comparison.error }}</p>
    <template v-else>
      <div class="candidates">
        <button v-for="route in comparison.routes" :key="route.id" type="button" class="candidate" :class="{ active: selected === route.id }"
          :aria-pressed="selected === route.id" @click="$emit('select', route.id)">
          <strong>{{ route.label }}</strong><span>{{ route.distanceM }} 公尺 · 約 {{ route.estimateMinutes }} 分鐘</span>
          <span>{{ route.resourceCount }} 處所選服務 · 接線 {{ route.connectorDistanceM }} 公尺</span>
          <span v-if="route.viaLabel" class="muted">途經 {{ route.viaLabel }} 附近</span>
        </button>
      </div>
      <p class="muted">{{ comparison.warning }}</p>
    </template>
  </section>
</template>
<style scoped>
.candidates { display: grid; gap: 8px; margin-top: 16px; }
.candidate { display: grid; gap: 5px; text-align: left; border: 1px solid var(--border); border-radius: 10px; background: white; padding: 14px; min-height: 40px; cursor: pointer; }
.candidate.active { border: 2px solid var(--brand); background: var(--brand-weak); padding: 13px; }
.error { color: #b00020; }
</style>
