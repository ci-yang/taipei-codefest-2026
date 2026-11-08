<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import HomeButton from '@/components/HomeButton.vue';
import MemberPanel from '@/components/MemberPanel.vue';
import { useFavorites } from '@/composables/useFavorites';

/**
 * 頂列（v3）：首頁只有置中標題；其他頁左側首頁鍵＋圓標「補」＋標題。右側都有書籤（到我的珍藏，有收藏時數字徽章）、
 * 頭像（開台北通會員面板）。沒有底部導覽列，換頁都靠這裡與各頁按鈕。不讀不顯示姓名。
 */
const route = useRoute();
const { count } = useFavorites();
const isHome = computed(() => route.name === 'home');

/** 頂列標題依頁面切換（v4 原型 HEAD 表） */
const TITLES: Record<string, string> = {
  home: '補助通 · 全民智能試算',
  calc: '補助通 · 智能試算',
  result: '補助通 · 智能補助試算',
  all: '補助通 · 全部補助',
  favorites: '補助通 · 我的珍藏',
  source: '補助通 · 資料來源',
};
const title = computed(() => TITLES[String(route.name)] ?? '補助通');
const panelOpen = ref(false);

// 換頁時收起會員面板（面板裡的連結會換頁）
watch(
  () => route.fullPath,
  () => {
    panelOpen.value = false;
  },
);
</script>

<template>
  <header class="top" :class="{ center: isHome }" data-test="app-header">
    <HomeButton v-if="!isHome" />
    <div class="brand">
      <span v-if="!isHome" class="logo" aria-hidden="true">補</span>
      <h1 data-test="app-title">{{ title }}</h1>
    </div>
    <RouterLink
      :to="{ name: 'favorites' }"
      class="circ bm"
      :aria-label="count ? `我的珍藏，已收藏 ${count} 項` : '我的珍藏'"
      data-test="btn-favorites"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4.5L6 21z" /></svg>
      <span v-if="count" class="nbadge badge" aria-hidden="true" data-test="fav-count">{{ count }}</span>
    </RouterLink>
    <button
      class="circ avatar"
      aria-label="台北通會員"
      aria-haspopup="dialog"
      :aria-expanded="panelOpen ? 'true' : 'false'"
      data-test="btn-avatar"
      @click="panelOpen = !panelOpen"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4" /><path d="M4.5 21c1.2-4 4-6 7.5-6s6.3 2 7.5 6" /></svg>
    </button>
  </header>
  <MemberPanel :open="panelOpen" @close="panelOpen = false" />
</template>

<style scoped>
/* 首頁沒有左側圓鈕，標題置中 */
.center .brand h1 {
  flex: 1;
  text-align: center;
}
/* 窄螢幕四顆圓鈕＋標題時允許標題換兩行，不截斷 */
.brand h1 {
  white-space: normal;
  line-height: 1.3;
}
.bm {
  position: relative;
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  box-shadow: 0 0 0 2px var(--bg);
}
.avatar {
  background: var(--primary-faint);
  color: var(--primary-strong);
  border-color: var(--tp-primary-200);
}
</style>
