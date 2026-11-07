<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFavorites } from '@/composables/useFavorites';

/** 底部膠囊導覽（sa-3-s2.md W8）：首頁與我的珍藏（數量徽章）；我的珍藏以外的頁都亮首頁（原型 show()） */
const route = useRoute();
const router = useRouter();
const { count } = useFavorites();
const onFav = computed(() => route.name === 'favorites');

function go(name: 'home' | 'favorites'): void {
  if (route.name !== name) void router.push({ name });
}
</script>

<template>
  <nav class="bnav" aria-label="主要導覽" data-test="bottom-nav">
    <button :class="{ on: !onFav }" :aria-current="!onFav ? 'page' : undefined" data-test="nav-home" @click="go('home')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5L12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /><path d="M10 19v-5h4v5" /></svg>首頁
    </button>
    <button :class="{ on: onFav }" :aria-current="onFav ? 'page' : undefined" data-test="nav-fav" @click="go('favorites')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4.5L6 21z" /></svg>我的珍藏<span v-if="count" class="nbadge" data-test="fav-count">{{ count }}</span>
    </button>
  </nav>
</template>
