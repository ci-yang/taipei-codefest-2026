<script setup lang="ts">
import { useRouter } from 'vue-router';

/** 首頁鍵：結果頁、我的珍藏、資料來源頁回首頁，答案保留在記憶體（SUBS-R26、ADR-021，原型 goHome）；彈窗不放 */
const router = useRouter();
function goHome(): void {
  void router.push({ name: 'home' });
}
</script>

<template>
  <button class="circ" aria-label="回首頁" data-test="btn-home" @click="goHome">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11.5L12 5l8 6.5" />
      <path d="M6.5 10v9h11v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  </button>
</template>
