<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import AppToast from '@/components/AppToast.vue';
import BottomNav from '@/components/BottomNav.vue';
import DetailDialog from '@/components/DetailDialog.vue';
import HomeButton from '@/components/HomeButton.vue';
import IllusDefs from '@/components/IllusDefs.vue';
import SearchBar from '@/components/SearchBar.vue';
import { useDetail } from '@/composables/useDetail';
import { useQuery } from '@/composables/useQuery';

const route = useRoute();
const router = useRouter();
const { listState, loadList, loadPrefill, setSearchQuery } = useQuery();
const detail = useDetail();

// [SUBS-R10] 進入服務時取一次補助清單（任何頁面進入都取）
// [SUBS-R24] 同時讀一次台北通帳號（逾時 3 秒），只算出年齡、設籍與區的帶入值；兩者並行，不互相等
onMounted(() => {
  if (listState.value === 'notLoaded') void loadList();
  void loadPrefill();
});

/** [W12] 搜尋鈕只在結果頁與我的珍藏（ADR-027）；關閉或離開頁面清空關鍵字 */
const canSearch = computed(() => route.name === 'result' || route.name === 'favorites');
const searchOpen = ref(false);
function closeSearch(): void {
  searchOpen.value = false;
  setSearchQuery('');
}
function toggleSearch(): void {
  if (searchOpen.value) closeSearch();
  else searchOpen.value = true;
}
// 換頁時收起搜尋；彈窗若還開著（例如連按兩次返回）也一併收起，不再動 history
watch(
  () => route.name,
  () => {
    closeSearch();
    detail.close(true);
  },
);

/** [W13] 頂列頭像：預設人形，按了回首頁表單；不讀不顯示姓名（ADR-027） */
function goHome(): void {
  if (route.name !== 'home') void router.push({ name: 'home' });
}
</script>

<template>
  <!-- 插畫共用漸層，全站一份 -->
  <IllusDefs />
  <div class="app">
    <header class="top">
      <!-- 首頁鍵：首頁以外都有（原型 #btnHome，SUBS-R26） -->
      <HomeButton v-if="route.name !== 'home'" />
      <div class="brand">
        <span class="logo" aria-hidden="true">補</span>
        <h1 data-test="app-title">補助通 · 智能試算</h1>
      </div>
      <button
        v-if="canSearch"
        class="circ"
        aria-label="搜尋補助名稱"
        :aria-expanded="searchOpen ? 'true' : 'false'"
        aria-controls="searchBar"
        data-test="btn-search"
        @click="toggleSearch"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
      </button>
      <button class="circ avatar" aria-label="台北通帳號：回首頁表單" data-test="btn-avatar" @click="goHome">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4" /><path d="M4.5 21c1.2-4 4-6 7.5-6s6.3 2 7.5 6" /></svg>
      </button>
      <SearchBar v-if="canSearch && searchOpen" @close="closeSearch" />
    </header>
    <RouterView />
  </div>
  <BottomNav />
  <DetailDialog />
  <AppToast />
</template>
