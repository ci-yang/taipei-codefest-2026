<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import SubsidyRow from '@/components/SubsidyRow.vue';
import { useDetail } from '@/composables/useDetail';
import { useFavorites } from '@/composables/useFavorites';
import { useQuery } from '@/composables/useQuery';
import { findRow, matchesSearch, searchNoteText } from '@/lib/resultView';

/**
 * 我的珍藏（sa-3-s2.md W8、SUBS-R28，原型 #page-fav）：收藏只有序號，顯示時對補助清單；
 * 已送出時帶本次判定，沒送出寫「尚未比對」。清單裡找不到的序號略過（4.9）。搜尋只改顯示（SUBS-R25）。
 */
const router = useRouter();
const q = useQuery();
const fav = useFavorites();
const detail = useDetail();

const all = computed(() => {
  const items = q.list.value?.items ?? [];
  return fav.favorites.value.map((no) => items.find((x) => x.no === no)).filter((x) => x !== undefined);
});
const query = computed(() => q.searchQuery.value.trim());
const shown = computed(() => all.value.filter((it) => matchesSearch(it.name, query.value)));
const rows = computed(() =>
  shown.value.map((item) => {
    const r = q.results.value ? findRow(q.results.value, item.no) : null;
    return {
      item,
      ok: r ? r.result.ok : null,
      why: r ? `${r.result.ok ? '可能符合：' : '不符合：'}${r.result.reason}` : '尚未比對，回首頁填完四題就會看到判定。',
    };
  }),
);

function goHome(): void {
  void router.push({ name: 'home' });
}
</script>

<template>
  <section class="page" data-test="page-fav">
    <h2 class="page-title">我的珍藏</h2>
    <p class="muted">收藏只存在這支手機，只記住是哪幾項補助，不記你的答案。</p>
    <p v-if="query" class="search-note" data-test="fav-search-note">{{ searchNoteText(query, shown.length) }}</p>
    <div data-test="fav-list">
      <div v-if="all.length && !shown.length" class="empty" data-test="fav-search-empty">沒有名稱符合搜尋的收藏</div>
      <div v-else-if="!shown.length" class="fav-empty" data-test="fav-empty">
        <span class="big-bm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4.5L6 21z" /></svg></span>
        <b>還沒有收藏的補助</b>
        <p class="muted">在比對結果按卡片右上的書籤，就會收在這裡。</p>
        <button class="btn primary" data-test="fav-go-home" @click="goHome">回首頁查詢</button>
      </div>
      <SubsidyRow v-for="r in rows" v-else :key="r.item.no" :item="r.item" :ok="r.ok" :why="r.why" @open="detail.open" />
    </div>
  </section>
</template>
