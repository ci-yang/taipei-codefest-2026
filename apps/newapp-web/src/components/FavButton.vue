<script setup lang="ts">
import { computed } from 'vue';
import { useFavorites } from '@/composables/useFavorites';

/** 書籤圓鈕（19.png，SUBS-R28）：切換收藏並 toast，只存序號；不觸發外層卡片的點擊 */
const props = defineProps<{ no: number; name: string }>();
const { isFavorite, toggle } = useFavorites();
const on = computed(() => isFavorite(props.no));
</script>

<template>
  <button
    type="button"
    class="fav-btn"
    :class="{ on }"
    :aria-pressed="on ? 'true' : 'false'"
    :aria-label="`收藏「${props.name}」`"
    :data-test="`fav-${props.no}`"
    @click.stop="toggle(props.no)"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4.5L6 21z" /></svg>
  </button>
</template>

<style scoped>
.fav-btn {
  flex: none;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--tp-primary-50);
  color: var(--tp-primary-700);
  cursor: pointer;
}
.fav-btn svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linejoin: round;
}
.fav-btn.on {
  background: var(--tp-primary-100);
}
.fav-btn.on svg {
  fill: currentColor;
}
.fav-btn:focus-visible {
  outline: 3px solid var(--tp-primary-500);
  outline-offset: 2px;
}
</style>
