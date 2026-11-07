<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import HomeButton from '@/components/HomeButton.vue';
import IllusDefs from '@/components/IllusDefs.vue';
import AppToast from '@/components/AppToast.vue';
import { useQuery } from '@/composables/useQuery';

const route = useRoute();
const router = useRouter();
const { listState, loadList, loadPrefill } = useQuery();

// [SUBS-R10] 進入服務時取一次補助清單（任何頁面進入都取，避免直接開問答頁時沒有清單）
// [SUBS-R24] 同時讀一次台北通帳號（逾時 3 秒），只算出年齡與設籍帶入值；兩者並行，不互相等
onMounted(() => {
  if (listState.value === 'notLoaded') void loadList();
  void loadPrefill();
});

function openSource(): void {
  if (route.name !== 'source') void router.push({ name: 'source' });
}
</script>

<template>
  <!-- 插畫共用漸層，全站一份 -->
  <IllusDefs />
  <RouterView v-if="route.meta.fullPage" />
  <div v-else class="app">
    <header class="top">
      <!-- 首頁鍵：開始頁以外都有（原型 #btnHome） -->
      <HomeButton v-if="route.name !== 'home'" />
      <h1>補助初篩查詢</h1>
      <!-- 資料來源鈕（原型 header .src，spec 7.6） -->
      <button class="src" aria-label="資料來源" data-test="btn-source" @click="openSource">資料來源</button>
    </header>
    <RouterView />
  </div>
  <AppToast />
</template>
