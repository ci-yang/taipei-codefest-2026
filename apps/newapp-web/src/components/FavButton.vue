<script setup lang="ts">
import { computed } from 'vue';
import { useFavorites } from '@/composables/useFavorites';

/** 書籤（sa-3-s2.md W8、SUBS-R28）：切換收藏並 toast；不觸發外層卡片的開彈窗 */
const props = defineProps<{ no: number; name: string; small?: boolean }>();
const { isFavorite, toggle } = useFavorites();
const on = computed(() => isFavorite(props.no));
</script>

<template>
  <button
    class="bm"
    :class="{ sm: props.small, on }"
    :aria-pressed="on ? 'true' : 'false'"
    :aria-label="`收藏「${props.name}」`"
    :data-test="`fav-${props.no}`"
    @click.stop="toggle(props.no)"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4.5L6 21z" /></svg>
  </button>
</template>
