<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import SubsidyListCard from '@/components/SubsidyListCard.vue';
import { sortEligible } from '@/components/result/cardText';
import { useQuery } from '@/composables/useQuery';
import { openLink } from '@/lib/townpass';
import { answerSummary, formatUpdatedAt } from '@/lib/resultView';

/**
 * 結果頁（19.png）：米黃膠囊「一共找到了 N 項合適計畫」、大標、你的答案＋修改答案、
 * 可能符合卡片直排（開放資料在前、還需確認少的在前）、不符合摺疊在最後、無符合時最接近 3 項與社福中心、頁尾門檻與更新時間。
 * 頂列由 App 外框負責。未完成狀態進來導回試算頁。
 */
const router = useRouter();
const q = useQuery();

const groups = computed(() => q.results.value ?? { eligible: [], ineligible: [] });
const eligible = computed(() => sortEligible(groups.value.eligible));
const ineligible = computed(() => groups.value.ineligible);
const summary = computed(() => answerSummary(q.answers.value).replace(/^你的答案：/, ''));
const updatedText = computed(() => (q.list.value ? formatUpdatedAt(q.list.value.updatedAt) : ''));

onMounted(() => {
  if (q.answersState.value !== 'completed') void router.replace('/calc');
});

function onCenterClick(url: string): void {
  openLink(url);
}
</script>

<template>
  <section class="page result" data-test="page-result">
    <span class="found" data-test="found-pill">一共找到了 {{ eligible.length }} 項合適計畫</span>
    <h2 class="title">為你量身試算的<br />專屬補助方案</h2>
    <p class="answers" data-test="answer-summary">
      <span class="answers-label">你的答案</span>
      <span class="answers-text">{{ summary }}</span>
      <RouterLink class="edit" to="/calc" data-test="btn-edit">修改答案</RouterLink>
    </p>

    <div v-if="q.listState.value === 'cached'" class="banner warn" data-test="result-cached">
      目前顯示的是上次載入的資料（{{ updatedText }}）。
    </div>

    <!-- [SUBS-R19] 可能符合（含模擬）為 0 項：最接近 3 項與各差在哪一條、社會福利服務中心 -->
    <div v-if="q.noMatch.value" class="no-match" data-test="no-match">
      <b>目前沒有可能符合的補助</b>
      <p>最接近的 3 項：</p>
      <ul data-test="no-match-closest">
        <li v-for="c in q.noMatch.value.closest" :key="c.item.no">{{ c.item.name }}：差在「{{ c.firstFailure }}」</li>
      </ul>
      <p>
        可以洽
        <a :href="q.noMatch.value.center.url" data-test="no-match-center" @click.prevent="onCenterClick(q.noMatch.value.center.url)">{{
          q.noMatch.value.center.name
        }}</a>
        問問其他資源。
      </p>
    </div>

    <div class="cards" data-test="list-yes">
      <SubsidyListCard v-for="r in eligible" :key="r.item.no" :item="r.item" :result="r.result" />
    </div>

    <details v-if="ineligible.length" class="fold" data-test="fold-no">
      <summary data-test="fold-no-summary">不符合的 {{ ineligible.length }} 項</summary>
      <div class="cards" data-test="list-no">
        <SubsidyListCard v-for="r in ineligible" :key="r.item.no" :item="r.item" :result="r.result" />
      </div>
    </details>

    <footer class="foot">
      <p data-test="result-notice">這是初步篩選，門檻以社會局最新公告為準</p>
      <p data-test="result-updated">資料每 24 小時自政府資料開放平臺更新・最後更新 {{ updatedText }}</p>
      <RouterLink class="src" :to="{ name: 'source' }" data-test="link-source">資料來源與門檻說明</RouterLink>
    </footer>
  </section>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.found {
  align-self: flex-start;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--tp-secondary-100);
  color: var(--tp-secondary-900);
  font-size: 14px;
  font-weight: 700;
}
.title {
  margin: 0;
  font-size: var(--tp-fs-h2, 24px);
  font-weight: 800;
  line-height: 1.35;
  color: var(--tp-grayscale-900);
}
.answers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
  font-size: 14px;
  color: var(--tp-grayscale-700);
}
.answers-label {
  font-weight: 700;
  color: var(--tp-grayscale-900);
}
.edit {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 0 4px;
  font-weight: 700;
  color: var(--tp-primary-700);
  text-decoration: underline;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.no-match {
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--tp-secondary-50);
  color: var(--tp-grayscale-900);
  font-size: 14px;
  line-height: 1.6;
}
.no-match p,
.no-match ul {
  margin: 4px 0;
}
.no-match a {
  color: var(--tp-primary-700);
  font-weight: 700;
}
/* 不符合摺疊（原型：白卡＋右側「展開」）；提示字用 ::after，不進 summary 的文字內容 */
.fold > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: 0 16px;
  border-radius: 16px;
  background: var(--tp-white);
  font-weight: 700;
  color: var(--tp-grayscale-800);
  list-style: none;
  cursor: pointer;
}
.fold > summary::-webkit-details-marker {
  display: none;
}
.fold > summary::after {
  content: '展開';
  font-size: 13px;
  font-weight: 600;
  color: var(--tp-primary-700);
}
.fold[open] > summary::after {
  content: '收起';
}
.fold[open] > summary {
  margin-bottom: 8px;
}
.foot {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--tp-grayscale-600);
  text-align: center;
}
.foot p {
  margin: 2px 0;
}
.src {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  color: var(--tp-primary-700);
  font-weight: 700;
}
</style>
