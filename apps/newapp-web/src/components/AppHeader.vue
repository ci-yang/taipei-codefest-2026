<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import HomeButton from '@/components/HomeButton.vue';
import { useFavorites } from '@/composables/useFavorites';

/**
 * 頂列（v3）：首頁是置中標題（左側放等寬透明占位，跟右側書籤平衡）；其他頁左側首頁鍵＋圓標「補」＋標題。
 * 右側只有書籤（到我的珍藏，有收藏時數字徽章）。2026-11-08 使用者裁決拿掉會員頭像與會員面板。
 * 沒有底部導覽列，換頁都靠這裡與各頁按鈕。
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
</script>

<template>
  <header class="top" :class="{ center: isHome }" data-test="app-header">
    <HomeButton v-if="!isHome" />
    <span v-else class="circ spacer" aria-hidden="true" data-test="header-spacer" />
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
  </header>
</template>

<style scoped>
/* 首頁沒有首頁鍵：左側透明占位與右側書籤等寬，標題置中 */
.center .brand h1 {
  flex: 1;
  text-align: center;
}
/* 窄螢幕圓鈕＋標題時允許標題換兩行，不截斷 */
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
.spacer {
  visibility: hidden;
}
</style>
