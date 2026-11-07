<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import SubsidyCard from '@/components/SubsidyCard.vue';
import { useQuery, type KindFilter, type ResultView } from '@/composables/useQuery';
import { openLink } from '@/lib/townpass';
import { MSG_CLEARED, showToast } from '@/composables/useToast';
import { THRESHOLD_NOTICE, answerSummary, filterKind, formatUpdatedAt } from '@/lib/resultView';

const router = useRouter();
const q = useQuery();

/** [SUBS-R18] 兩組、組內開放資料在前、模擬在後、同類依序號（排序在 match.ts groupResults）；S2 起模擬項目照常呈現 */
const groups = computed(() => q.results.value ?? { eligible: [], ineligible: [] });
/** [SUBS-R25] 篩選只過濾畫面上的卡片；計數膠囊與無符合用未過濾的 groups */
const shownYes = computed(() => filterKind(groups.value.eligible, q.kindFilter.value));
const shownNo = computed(() => filterKind(groups.value.ineligible, q.kindFilter.value));
const summary = computed(() => answerSummary(q.answers.value));
const updatedText = computed(() => (q.list.value ? formatUpdatedAt(q.list.value.updatedAt) : ''));

type Group = 'yes' | 'no';
const activeChip = ref<Group>('yes');
const grpYes = ref<HTMLElement | null>(null);
const grpNo = ref<HTMLElement | null>(null);

/** 計數膠囊：點了捲到該組（sprint-1-plan.md S1 驗收） */
function jumpTo(g: Group): void {
  activeChip.value = g;
  const el = g === 'yes' ? grpYes.value : grpNo.value;
  el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

const VIEWS: Array<{ v: ResultView; label: string }> = [
  { v: 'grid', label: '大圖模式' },
  { v: 'list', label: '小圖模式' },
];
const KINDS: Array<{ k: KindFilter; label: string }> = [
  { k: 'all', label: '全部' },
  { k: 'open', label: '開放資料' },
  { k: 'mock', label: '模擬資料' },
];

function openDetail(no: number): void {
  void router.push({ name: 'detail', params: { no: String(no) } });
}

/** 修改答案：保留目前答案回第 1 題，答完回結果頁重新比對 */
function editAnswers(): void {
  q.setQuestion(0);
  void router.push({ name: 'question' });
}
/** [SUBS-R20] 清除填寫答案：回第 1 題，年齡與設籍回填台北通帳號值 */
function clearAnswers(): void {
  q.resetAnswers();
  void router.push({ name: 'question' });
  showToast(MSG_CLEARED);
}
function onCenterClick(url: string): void {
  openLink(url);
}
</script>

<template>
  <section class="page" data-test="page-result">
    <div class="title-row">
      <h2 class="page-title">比對結果</h2>
      <div class="tr-act">
        <!-- [SUBS-R25] 閱讀模式，所有組一起套用 -->
        <div class="seg" role="group" aria-label="閱讀模式">
          <button
            v-for="o in VIEWS"
            :key="o.v"
            :class="{ on: q.resultView.value === o.v }"
            :aria-pressed="q.resultView.value === o.v ? 'true' : 'false'"
            :aria-label="o.label"
            :data-test="`view-${o.v}`"
            @click="q.setResultView(o.v)"
          >
            <svg v-if="o.v === 'grid'" viewBox="0 0 24 24">
              <rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" />
              <rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" />
            </svg>
            <svg v-else viewBox="0 0 24 24">
              <rect x="3" y="4.5" width="5" height="5" rx="1.5" /><rect x="3" y="14.5" width="5" height="5" rx="1.5" />
              <path d="M11 7h10M11 17h10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <p class="muted answer-summary" data-test="answer-summary">{{ summary }}</p>

    <div class="chip-row" role="group" aria-label="結果分組">
      <button class="chip" :class="{ on: activeChip === 'yes' }" data-test="chip-yes" @click="jumpTo('yes')">
        可能符合 <span class="count" data-test="count-yes">{{ groups.eligible.length }}</span>
      </button>
      <button class="chip" :class="{ on: activeChip === 'no' }" data-test="chip-no" @click="jumpTo('no')">
        不符合 <span class="count" data-test="count-no">{{ groups.ineligible.length }}</span>
      </button>
    </div>
    <div class="chip-row sub" role="group" aria-label="資料類型">
      <button
        v-for="o in KINDS"
        :key="o.k"
        class="chip"
        :class="{ on: q.kindFilter.value === o.k }"
        :aria-pressed="q.kindFilter.value === o.k ? 'true' : 'false'"
        :data-test="`kind-${o.k}`"
        @click="q.setKindFilter(o.k)"
      >
        {{ o.label }}
      </button>
    </div>

    <div v-if="q.listState.value === 'cached'" class="banner warn" data-test="result-cached">
      目前顯示的是上次載入的資料（{{ updatedText }}）。
    </div>
    <div class="banner info" data-test="result-notice">這是初步篩選，不代表一定可以領。{{ THRESHOLD_NOTICE }}</div>

    <!-- [SUBS-R19] 可能符合（含模擬）為 0 項：最接近 3 項與各差在哪一條、社會福利服務中心 -->
    <div v-if="q.noMatch.value" class="banner warn no-match" data-test="no-match">
      <b>目前沒有可能符合的補助</b><br />最接近的 3 項：
      <ul data-test="no-match-closest">
        <li v-for="c in q.noMatch.value.closest" :key="c.item.no">{{ c.item.name }}：差在「{{ c.firstFailure }}」</li>
      </ul>
      可以洽
      <a :href="q.noMatch.value.center.url" data-test="no-match-center" @click.prevent="onCenterClick(q.noMatch.value.center.url)">{{
        q.noMatch.value.center.name
      }}</a>
      問問其他資源。
    </div>

    <p id="grp-yes" ref="grpYes" class="group-title">可能符合</p>
    <template v-if="groups.eligible.length">
      <div v-if="q.resultView.value === 'grid'" class="grid" data-test="list-yes">
        <SubsidyCard v-for="r in shownYes" :key="r.item.no" :row="r" view="grid" @open="openDetail" />
      </div>
      <div v-else data-test="list-yes">
        <SubsidyCard v-for="r in shownYes" :key="r.item.no" :row="r" view="list" @open="openDetail" />
      </div>
    </template>
    <div v-else class="empty" data-test="empty-yes">目前沒有可能符合的補助</div>

    <p id="grp-no" ref="grpNo" class="group-title">不符合</p>
    <template v-if="groups.ineligible.length">
      <div v-if="q.resultView.value === 'grid'" class="grid" data-test="list-no">
        <SubsidyCard v-for="r in shownNo" :key="r.item.no" :row="r" view="grid" @open="openDetail" />
      </div>
      <div v-else data-test="list-no">
        <SubsidyCard v-for="r in shownNo" :key="r.item.no" :row="r" view="list" @open="openDetail" />
      </div>
    </template>

    <div class="stack">
      <button class="btn primary" data-test="btn-edit" @click="editAnswers">修改答案</button>
      <button class="btn ghost" data-test="btn-clear" @click="clearAnswers">清除填寫答案</button>
      <RouterLink class="btn link" :to="{ name: 'source' }" data-test="link-source">資料來源與門檻說明</RouterLink>
    </div>
  </section>
</template>
