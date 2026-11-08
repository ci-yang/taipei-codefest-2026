<script setup lang="ts">
import { computed, ref } from 'vue';
import SubsidyListCard from '@/components/SubsidyListCard.vue';
import { useQuery } from '@/composables/useQuery';
import { CATEGORIES, categoryOf, type CategoryId } from '@/lib/categories';
import { kindRank } from '@/lib/match';
import { findRow } from '@/lib/resultView';

/**
 * 全部補助（v3）：不用作答就能看。分類膠囊篩選（只改顯示）；卡片與結果頁同一種。
 * 有作答結果時帶判定，沒有時狀態標籤只寫資料類型。真實資料（開放、官方網頁整理）在前、模擬在後，台北服務通最後，同級依序號。
 * ADR-036：最後一顆膠囊「台北服務通」只看 catalog 項目（不比對，SUBS-R75）。
 */
const q = useQuery();
const cat = ref<CategoryId | 'all' | 'catalog'>('all');

const all = computed(() =>
  [...(q.list.value?.items ?? [])].sort((x, y) => kindRank(x) - kindRank(y) || x.no - y.no),
);
const rows = computed(() =>
  all.value
    .filter((it) =>
      cat.value === 'all' ? true : cat.value === 'catalog' ? it.kind === 'catalog' : categoryOf(it.no)?.id === cat.value,
    )
    .map((item) => ({ item, result: q.results.value ? (findRow(q.results.value, item.no)?.result ?? null) : null })),
);
const hasCatalog = computed(() => all.value.some((it) => it.kind === 'catalog'));
const chips = computed(() => [
  { id: 'all' as const, label: '全部' },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ...(hasCatalog.value ? [{ id: 'catalog' as const, label: '台北服務通' }] : []),
]);
</script>

<template>
  <section class="page all" data-test="page-all">
    <h2 class="title" data-test="all-title">全部 {{ all.length }} 項補助</h2>
    <div class="chips" role="group" aria-label="補助分類">
      <button
        v-for="c in chips"
        :key="c.id"
        type="button"
        class="chip"
        :class="{ on: cat === c.id }"
        :aria-pressed="cat === c.id ? 'true' : 'false'"
        :data-test="`cat-${c.id}`"
        @click="cat = c.id"
      >
        {{ c.label }}
      </button>
    </div>
    <p v-if="q.listState.value === 'notLoaded'" class="note" data-test="all-loading">載入中…</p>
    <p v-else-if="!all.length" class="note" data-test="all-unavailable">目前無法取得補助清單，請稍後再試。</p>
    <div v-else class="cards" data-test="all-list">
      <SubsidyListCard v-for="r in rows" :key="r.item.no" :item="r.item" :result="r.result" />
    </div>
  </section>
</template>

<style scoped>
.all {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.title {
  margin: 0;
  font-size: var(--tp-fs-h2, 24px);
  font-weight: 800;
  color: var(--tp-grayscale-900);
}
.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.chip {
  flex: none;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--tp-primary-200);
  border-radius: 999px;
  background: var(--tp-white);
  color: var(--tp-primary-700);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.chip.on {
  border-color: var(--tp-primary-700);
  background: var(--tp-primary-700);
  color: var(--tp-white);
}
.chip:focus-visible {
  outline: 3px solid var(--tp-primary-500);
  outline-offset: 2px;
}
.note {
  margin: 0;
  font-size: 14px;
  color: var(--tp-grayscale-600);
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
