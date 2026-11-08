<script setup lang="ts">
import { computed } from 'vue';
import { INCOME_BRACKETS } from '@app/shared';

/**
 * 每人月收入級距長條圖（只顯示，不能點）：五條，高度依各級距上限的比例；
 * 最後一級沒有上限，畫成滿高。選中的那條亮起來。
 */
const props = defineProps<{ selected: number | null }>();

const TOP_CAP = INCOME_BRACKETS[3].max; // 有上限的最高一級
const bars = computed(() =>
  INCOME_BRACKETS.map((b) => ({
    value: b.value,
    label: b.label,
    pct: b.max === null ? 100 : Math.round((b.max / TOP_CAP) * 85),
    on: props.selected === b.value,
  })),
);
</script>

<template>
  <div class="bars" aria-hidden="true" data-test="income-bars">
    <div class="plot">
      <span v-for="b in bars" :key="b.value" class="bar" :class="{ on: b.on }" :style="{ height: `${b.pct}%` }" :data-test="`bar-${b.value}`" />
    </div>
    <div class="axis"><span>{{ INCOME_BRACKETS[0].label }}</span><span>{{ INCOME_BRACKETS[4].label }}</span></div>
  </div>
</template>

<style scoped>
.bars { margin-top: 14px; padding: 12px 12px 8px; border-radius: 14px; background: var(--tp-grayscale-50); }
.plot { display: flex; align-items: flex-end; gap: 8px; height: 72px; }
.bar { flex: 1; border-radius: 6px 6px 2px 2px; background: var(--tp-primary-200); transition: background-color .2s; }
.bar.on { background: var(--tp-primary-700); }
.axis { display: flex; justify-content: space-between; margin-top: 6px; font-size: var(--tp-fs-caption); color: var(--tp-grayscale-600); }
</style>
