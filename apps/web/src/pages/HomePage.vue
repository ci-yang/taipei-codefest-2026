<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { FEATURES, matchFeature } from '@/lib/features';

const router = useRouter();
const query = ref('');
const notFound = ref(false);

function onSearch(): void {
  const hit = matchFeature(query.value);
  notFound.value = !hit;
  if (hit) void router.push(hit.to);
}
</script>

<template>
  <main class="page">
    <h1>想找什麼服務？</h1>
    <form class="search" role="search" @submit.prevent="onSearch">
      <input
        v-model="query"
        type="search"
        enterkeyhint="search"
        placeholder="輸入一句話，例如「附近哪裡有廁所」"
        aria-label="輸入一句話找服務"
      />
      <button type="submit">找</button>
    </form>
    <p v-if="notFound" class="muted">找不到對應的服務，試試下面的分類。</p>

    <h2 class="muted">分類</h2>
    <div class="chips">
      <RouterLink v-for="f in FEATURES" :key="f.id" :to="f.to" class="chip">{{ f.label }}</RouterLink>
    </div>
  </main>
</template>

<style scoped>
h1 { font-size: 22px; margin: 8px 0 16px; }
h2 { font-size: 14px; font-weight: 500; margin: 24px 0 8px; }
.search { display: flex; gap: 8px; }
.search input { flex: 1; min-width: 0; font-size: 16px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; }
.search button { padding: 0 18px; border: 0; border-radius: 10px; background: var(--brand); color: #fff; }
.chip { text-decoration: none; color: inherit; display: inline-flex; align-items: center; }
</style>
