<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <RouterView />
  <nav class="tabbar" aria-label="主選單">
    <RouterLink to="/">首頁</RouterLink>
    <RouterLink to="/map">地圖</RouterLink>
    <RouterLink to="/about">關於</RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  inset: auto 0 0 0;
  display: flex;
  justify-content: space-around;
  background: #fff;
  border-top: 1px solid var(--border);
  padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
  z-index: 10;
}
.tabbar a { display: inline-flex; align-items: center; min-height: 40px; text-decoration: none; color: var(--muted); padding: 6px 16px; }
.tabbar a.router-link-exact-active { color: var(--brand); font-weight: 600; }
</style>
