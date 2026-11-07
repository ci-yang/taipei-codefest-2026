<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@/composables/useQuery';
import { previousRouteName } from '@/router';
import { openLink } from '@/lib/townpass';
import { THRESHOLD_NOTICE, displayUrl, formatUpdatedAt } from '@/lib/resultView';

/**
 * 資料來源頁（spec 7.6、sa-3-s2.md W5）：資料集、機關、授權、網址、更新時間讀補助清單的 source 與 updatedAt；
 * 門檻提醒與模擬資料說明是固定文案（照原型）。頁首最左是首頁鍵（App.vue 共用標頭），頁底「返回」保留。
 */
const router = useRouter();
const q = useQuery();
const src = computed(() => q.list.value?.source ?? null);
const updated = computed(() => (q.list.value ? formatUpdatedAt(q.list.value.updatedAt) : null));

function onUrlClick(url: string): void {
  openLink(url);
}
/** 返回：有上一頁就退回，直接開網址時回開始頁 */
function goBack(): void {
  if (previousRouteName(router)) router.back();
  else void router.replace({ name: 'home' });
}
</script>

<template>
  <section class="page" data-test="page-source">
    <h2>資料來源</h2>
    <div v-if="src" class="card">
      <table class="src-table" data-test="src-table">
        <tbody>
          <tr><th>資料集</th><td data-test="src-dataset">{{ src.dataset }}</td></tr>
          <tr><th>提供機關</th><td data-test="src-agency">{{ src.agency }}</td></tr>
          <tr><th>授權</th><td data-test="src-license">{{ src.license }}</td></tr>
          <tr>
            <th>網址</th>
            <td>
              <a :href="src.url" data-test="src-url" @click.prevent="onUrlClick(src.url)">{{ displayUrl(src.url) }}</a>
            </td>
          </tr>
          <tr><th>資料更新時間</th><td data-test="src-updated">{{ updated }}</td></tr>
        </tbody>
      </table>
    </div>
    <div v-else class="banner err" data-test="src-unavailable">暫時無法取得補助資料，請稍後重試。</div>
    <div class="banner warn" data-test="src-threshold">{{ THRESHOLD_NOTICE }}資料集收入門檻為 109 年標準，本服務照原值比對。</div>
    <div class="banner info" data-test="src-mock">標「模擬資料」的育兒、租屋、青年補助是示範用的虛構資料，不是真實補助。</div>
    <button class="btn primary" data-test="btn-source-back" @click="goBack">返回</button>
  </section>
</template>
