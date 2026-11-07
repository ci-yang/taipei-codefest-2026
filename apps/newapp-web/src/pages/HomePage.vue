<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ServiceHealthSchema, type ServiceHealth } from '@app/shared';
import { apiGet } from '@/lib/api';

const health = ref<ServiceHealth | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    health.value = await apiGet('/healthz', ServiceHealthSchema);
  } catch (err) {
    error.value = (err as Error).message;
  }
});
</script>

<template>
  <main class="home">
    <h1>newapp</h1>
    <p v-if="health" data-test="api-up">API 正常：{{ health.service }}（{{ health.time }}）</p>
    <p v-else-if="error" data-test="api-down">API 連不上：{{ error }}</p>
    <p v-else>檢查 API 中…</p>
  </main>
</template>

<style scoped>
.home {
  padding: 24px 16px;
}
</style>
