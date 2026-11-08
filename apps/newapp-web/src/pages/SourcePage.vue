<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { SubsidyKind } from '@app/shared';
import { useQuery } from '@/composables/useQuery';
import { previousRouteName } from '@/router';
import { openLink } from '@/lib/townpass';
import { THRESHOLD_NOTICE, displayUrl, formatUpdatedAt } from '@/lib/resultView';

/**
 * 資料來源頁（spec 7.6、sa-3-s2.md W5）：資料集、機關、授權、網址、更新時間讀補助清單的 source 與 updatedAt；
 * ADR-035：依 sources 列出三種來源類型；官方網頁整理逐項列名稱、來源網址（sourceUrl）、查證日。
 * 門檻提醒與模擬資料說明是固定文案（照原型）。頂列最左是首頁鍵（App.vue 共用頂列，SUBS-R26），頁底「返回」保留。
 */
const router = useRouter();
const q = useQuery();
const src = computed(() => q.list.value?.source ?? null);
const sourceOf = (kind: SubsidyKind) => q.list.value?.sources.find((s) => s.kind === kind) ?? null;
const curatedSource = computed(() => sourceOf('curated'));
const mockSource = computed(() => sourceOf('mock'));
const openSource = computed(() => sourceOf('open'));
const curatedItems = computed(() =>
  (q.list.value?.items ?? []).filter((i) => i.kind === 'curated').sort((a, b) => a.no - b.no),
);
const mockNames = computed(() =>
  (q.list.value?.items ?? []).filter((i) => i.kind === 'mock').map((i) => i.name).join('、'),
);
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
    <template v-if="src">
      <h3 class="src-h" data-test="src-type-open">開放資料<small v-if="openSource"> · {{ openSource.count }} 項</small></h3>
      <div class="card">
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

      <template v-if="curatedSource && curatedItems.length">
        <h3 class="src-h" data-test="src-type-curated">{{ curatedSource.label }}<small> · {{ curatedSource.count }} 項</small></h3>
        <div class="card">
          <p class="src-desc" data-test="src-curated-desc">{{ curatedSource.description }}</p>
          <ol class="src-list" data-test="src-curated-list">
            <li v-for="it in curatedItems" :key="it.no" :data-no="it.no" data-test="src-curated-item">
              <b>{{ it.name }}</b>
              <a v-if="it.sourceUrl" :href="it.sourceUrl" @click.prevent="onUrlClick(it.sourceUrl)">{{ displayUrl(it.sourceUrl) }}</a>
              <small v-if="it.verifiedAt">查證日 {{ it.verifiedAt }}</small>
            </li>
          </ol>
        </div>
      </template>

      <h3 v-if="mockSource && mockSource.count" class="src-h" data-test="src-type-mock">
        模擬資料<small> · {{ mockSource.count }} 項</small>
      </h3>
    </template>
    <div v-else class="banner err" data-test="src-unavailable">暫時無法取得補助資料，請稍後重試。</div>
    <div class="banner info" data-test="src-mock">
      標「模擬資料」的{{ mockNames || '育兒、租屋、青年補助' }}是示範用的虛構資料，不是真實補助。
    </div>
    <div class="banner warn" data-test="src-threshold">
      {{ THRESHOLD_NOTICE }}資料集收入門檻為 109 年標準，本服務照原值比對；官方網頁整理的門檻年度依各來源頁。
    </div>
    <button class="btn primary" data-test="btn-source-back" @click="goBack">返回</button>
  </section>
</template>

<style scoped>
.src-h {
  margin: 18px 0 8px;
  font-size: 18px;
}
.src-h small {
  font-size: 14px;
  font-weight: 400;
  color: var(--muted);
}
.src-desc {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
}
.src-list {
  margin: 0;
  padding-left: 22px;
}
.src-list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
}
.src-list li:last-child {
  border-bottom: 0;
}
.src-list li b {
  font-size: var(--fs-body);
  color: var(--heading);
}
.src-list a {
  color: var(--primary-strong);
  word-break: break-all;
}
.src-list small {
  color: var(--muted);
}
</style>
