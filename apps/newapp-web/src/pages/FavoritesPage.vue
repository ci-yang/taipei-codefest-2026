<script setup lang="ts">
import { computed } from 'vue';
import SubsidyListCard from '@/components/SubsidyListCard.vue';
import { useFavorites } from '@/composables/useFavorites';
import { useQuery } from '@/composables/useQuery';
import { findRow } from '@/lib/resultView';

/**
 * 我的珍藏（SUBS-R28）：收藏只有序號，顯示時對補助清單；已送出時帶本次判定，沒送出只寫資料類型。
 * 清單裡找不到的序號略過。卡片與結果頁同一種（19.png）。
 */
const q = useQuery();
const fav = useFavorites();

const rows = computed(() => {
  const items = q.list.value?.items ?? [];
  return fav.favorites.value
    .map((no) => items.find((x) => x.no === no))
    .filter((x) => x !== undefined)
    .map((item) => ({ item, result: q.results.value ? (findRow(q.results.value, item.no)?.result ?? null) : null }));
});
</script>

<template>
  <section class="page fav" data-test="page-fav">
    <h2 class="title">我的珍藏</h2>
    <p class="note">收藏只存在這支手機，只記住是哪幾項補助，不記你的答案。</p>
    <div v-if="!rows.length" class="fav-empty" data-test="fav-empty">
      <span class="big-bm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4.5L6 21z" /></svg></span>
      <b>還沒有收藏的補助</b>
      <p class="note">按卡片右上的書籤，就會收在這裡。</p>
      <RouterLink class="go-home" to="/" data-test="fav-go-home">回首頁查詢</RouterLink>
    </div>
    <div v-else class="cards" data-test="fav-list">
      <SubsidyListCard v-for="r in rows" :key="r.item.no" :item="r.item" :result="r.result" />
    </div>
  </section>
</template>

<style scoped>
.fav {
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
.fav-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  text-align: center;
  color: var(--tp-grayscale-900);
}
.big-bm {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--tp-primary-50);
  color: var(--tp-primary-700);
}
.big-bm svg {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linejoin: round;
}
.go-home {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 24px;
  border-radius: 999px;
  background: var(--tp-primary-700);
  color: var(--tp-white);
  font-weight: 700;
  text-decoration: none;
}
</style>
