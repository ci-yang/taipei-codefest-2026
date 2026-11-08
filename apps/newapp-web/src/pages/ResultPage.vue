<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SubsidyListCard from '@/components/SubsidyListCard.vue';
import { sortEligible } from '@/components/result/cardText';
import { useQuery } from '@/composables/useQuery';
import { openLink } from '@/lib/townpass';
import { ESTIMATE_METHOD, NO_AMOUNT_NOTE, NO_CONDITION_NOTE, estimateFor, formatRange } from '@/lib/estimate';
import { answerSummary, formatUpdatedAt } from '@/lib/resultView';

/**
 * 結果頁（19.png）：米黃膠囊「一共找到了 N 項合適計畫」、大標、你的答案＋修改答案、
 * 可能符合卡片直排（開放資料在前、還需確認少的在前）、不符合摺疊、無符合時最接近 3 項與社福中心、頁尾門檻與更新時間。
 * ADR-036：可能符合之前加「估算可領金額」（SUBS-R76，點開看逐項明細）；不符合之後加台北服務通摺疊（SUBS-R75，未依四題比對，展開才渲染卡片）。
 * 頂列由 App 外框負責。未完成狀態進來導回試算頁。
 */
const router = useRouter();
const q = useQuery();

const groups = computed(() => q.results.value ?? { eligible: [], ineligible: [], catalog: [] });
const eligible = computed(() => sortEligible(groups.value.eligible));
const ineligible = computed(() => groups.value.ineligible);
const catalog = computed(() => groups.value.catalog);
const estimate = computed(() => estimateFor(eligible.value, q.answers.value.identities));
const uncountedCount = computed(() => estimate.value.noAmount.length + estimate.value.noCondition.length);
/** 台北服務通摺疊展開過才渲染卡片（上百張，收合時不畫） */
const catalogOpened = ref(false);
function onCatalogToggle(e: Event): void {
  if ((e.target as HTMLDetailsElement).open) catalogOpened.value = true;
}
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

    <!-- [SUBS-R76] 估算可領金額：只加總可能符合且官方原文有明確金額的項目 -->
    <section v-if="eligible.length" class="est" data-test="estimate">
      <div class="est-head">
        <b>估算可領金額</b><span class="est-tag" data-test="estimate-tag">估算</span>
      </div>
      <template v-if="estimate.lines.length">
        <p class="est-total" data-test="estimate-total">
          一年合計約 <b>{{ formatRange(estimate.totalMin, estimate.totalMax) }}</b>
        </p>
        <p class="est-note" data-test="estimate-method">
          {{ ESTIMATE_METHOD }}加總 {{ estimate.lines.length }} 項可能符合且公告有明確金額的補助。
        </p>
      </template>
      <p v-else class="est-note" data-test="estimate-none">可能符合的項目沒有可加總的明確金額，無法估算。</p>
      <p v-if="uncountedCount" class="est-note" data-test="estimate-uncounted">
        另有 {{ uncountedCount }} 項未計入<template v-if="estimate.noAmount.length">：{{ estimate.noAmount.length }} 項{{ NO_AMOUNT_NOTE }}</template
        ><template v-if="estimate.noCondition.length">{{ estimate.noAmount.length ? '；' : '：' }}{{ estimate.noCondition.length }} 項{{ NO_CONDITION_NOTE }}</template>。
      </p>
      <details v-if="estimate.lines.length || uncountedCount" class="est-detail" data-test="estimate-detail">
        <summary>逐項明細</summary>
        <ul>
          <li v-for="l in estimate.lines" :key="l.no" data-test="estimate-line">
            <b>{{ l.name }}</b><span>{{ formatRange(l.min, l.max) }}</span><small>{{ l.basis }}</small>
          </li>
          <li v-for="n in estimate.noCondition" :key="`c-${n.name}`" class="un" data-test="estimate-uncounted-line">
            <b>{{ n.name }}</b><span>未計入</span><small>需{{ n.prerequisite }}，四題沒問到</small>
          </li>
          <li v-for="n in estimate.noAmount" :key="`a-${n}`" class="un" data-test="estimate-uncounted-line">
            <b>{{ n }}</b><span>未計入</span><small>{{ NO_AMOUNT_NOTE }}</small>
          </li>
        </ul>
      </details>
    </section>

    <div class="cards" data-test="list-yes">
      <SubsidyListCard v-for="r in eligible" :key="r.item.no" :item="r.item" :result="r.result" />
    </div>

    <details v-if="ineligible.length" class="fold" data-test="fold-no">
      <summary data-test="fold-no-summary">不符合的 {{ ineligible.length }} 項</summary>
      <div class="cards" data-test="list-no">
        <SubsidyListCard v-for="r in ineligible" :key="r.item.no" :item="r.item" :result="r.result" />
      </div>
    </details>

    <!-- [SUBS-R75] 台北服務通：資料集沒有資格欄位，不依四題比對 -->
    <details v-if="catalog.length" class="fold" data-test="fold-catalog" @toggle="onCatalogToggle">
      <summary data-test="fold-catalog-summary">台北服務通其他服務 {{ catalog.length }} 項（未依四題比對）</summary>
      <p class="fold-note" data-test="fold-catalog-note">
        取自政府資料開放平臺「臺北市政府台北服務通申辦服務及承辦單位資訊」的補助類案件。資料集沒有年齡、收入等資格欄位，請到各案件頁確認。
      </p>
      <div v-if="catalogOpened" class="cards" data-test="list-catalog">
        <SubsidyListCard v-for="it in catalog" :key="it.no" :item="it" :result="null" />
      </div>
    </details>

    <footer class="foot">
      <p data-test="result-notice">這是初步篩選，門檻以社會局及各主管機關最新公告為準</p>
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
.fold-note {
  margin: 0 4px 10px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--tp-grayscale-600);
}
/* 估算可領金額（SUBS-R76）：淺黃卡＋「估算」膠囊 */
.est {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--tp-secondary-50);
  color: var(--tp-grayscale-900);
}
.est-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}
.est-tag {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--tp-secondary-100);
  color: var(--tp-secondary-900);
  font-size: 12px;
  font-weight: 700;
}
.est-total {
  margin: 0;
  font-size: 15px;
}
.est-total b {
  font-size: 24px;
  font-weight: 800;
  color: var(--tp-grayscale-900);
}
.est-note {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--tp-grayscale-700);
}
.est-detail > summary {
  display: flex;
  align-items: center;
  min-height: 48px;
  font-weight: 700;
  color: var(--tp-primary-700);
  cursor: pointer;
}
.est-detail ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.est-detail li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 8px;
  padding: 8px 0;
  border-top: 1px solid var(--tp-secondary-100);
  font-size: 14px;
}
.est-detail li small {
  grid-column: 1 / -1;
  color: var(--tp-grayscale-600);
}
.est-detail li.un span {
  color: var(--tp-grayscale-600);
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
