<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useQuery } from '@/composables/useQuery';

/** 搜尋列（sa-3-s2.md W12、SUBS-R25）：只在結果頁與我的珍藏出現；輸入只改 searchQuery，關閉時由 App 清空 */
const emit = defineEmits<{ (e: 'close'): void }>();
const q = useQuery();
const input = ref<HTMLInputElement | null>(null);

onMounted(() => {
  void nextTick(() => input.value?.focus({ preventScroll: true }));
});
function onInput(e: Event): void {
  q.setSearchQuery((e.target as HTMLInputElement).value);
}
</script>

<template>
  <div id="searchBar" class="searchbar" data-test="search-bar">
    <svg class="ico-line" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
    <input
      ref="input"
      type="search"
      placeholder="搜尋補助名稱，例如：醫療"
      aria-label="搜尋補助名稱"
      data-test="search-input"
      :value="q.searchQuery.value"
      @input="onInput"
    />
    <button type="button" class="circ" aria-label="關閉搜尋" data-test="search-close" @click="emit('close')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
</template>
