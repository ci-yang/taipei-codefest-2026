<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import SubsidyBigCard from '@/components/SubsidyBigCard.vue';
import SubsidyRow from '@/components/SubsidyRow.vue';
import { useDetail } from '@/composables/useDetail';
import { useQuery, type KindFilter, type ResultView } from '@/composables/useQuery';
import { MSG_CLEARED, showToast } from '@/composables/useToast';
import { prefersReducedMotion } from '@/lib/intro';
import { openLink } from '@/lib/townpass';
import { THRESHOLD_NOTICE, answerSummary, filterKind, filterSearch, formatUpdatedAt, searchNoteText } from '@/lib/resultView';

/**
 * 結果頁（原型 #page-result）：HEY 膠囊與大標、計數膠囊、閱讀模式（輪播只放可能符合／清單兩組）、資料類型篩選、
 * 搜尋提示、無符合、答案摘要與門檻提醒、修改答案、清除填寫答案、資料來源。點卡片或列開詳細資訊彈窗。
 */
const router = useRouter();
const q = useQuery();
const detail = useDetail();

/** [SUBS-R18] 兩組、組內開放資料在前、模擬在後、同類依序號（排序在 match.ts groupResults） */
const groups = computed(() => q.results.value ?? { eligible: [], ineligible: [] });
const query = computed(() => q.searchQuery.value.trim());
/** [SUBS-R25] 搜尋與篩選只過濾畫面上的卡片與列；計數膠囊與無符合用未過濾的 groups */
const searchedYes = computed(() => filterSearch(groups.value.eligible, query.value));
const searchedNo = computed(() => filterSearch(groups.value.ineligible, query.value));
const listYes = computed(() => filterKind(searchedYes.value, q.kindFilter.value));
const listNo = computed(() => filterKind(searchedNo.value, q.kindFilter.value));
const carousel = computed(() => filterKind(searchedYes.value, q.kindFilter.value));
const summary = computed(() => answerSummary(q.answers.value));
const updatedText = computed(() => (q.list.value ? formatUpdatedAt(q.list.value.updatedAt) : ''));
const view = computed(() => q.resultView.value);

const VIEWS: Array<{ v: ResultView; label: string }> = [
  { v: 'carousel', label: '輪播' },
  { v: 'list', label: '清單' },
];
const KINDS: Array<{ k: KindFilter; label: string }> = [
  { k: 'all', label: '全部' },
  { k: 'open', label: '開放資料' },
  { k: 'mock', label: '模擬資料' },
];

// ---------- 輪播 ----------
const car = ref<HTMLElement | null>(null);
const carIdx = ref(0);
function carGo(i: number, instant = false): void {
  carIdx.value = i;
  const c = car.value;
  const s = c?.children[i] as HTMLElement | undefined;
  if (!c || !s || !c.clientWidth || typeof c.scrollTo !== 'function') return;
  c.scrollTo({ left: s.offsetLeft - (c.clientWidth - s.offsetWidth) / 2, behavior: instant || prefersReducedMotion() ? 'auto' : 'smooth' });
}
function onCarScroll(): void {
  const c = car.value;
  const s = c?.children[0] as HTMLElement | undefined;
  if (!c || !s) return;
  const i = Math.round(c.scrollLeft / (s.offsetWidth + 12));
  carIdx.value = Math.max(0, Math.min(i, c.children.length - 1));
}
// 篩選、搜尋改變時回第一張
watch([() => q.kindFilter.value, query], () => {
  carIdx.value = 0;
  void nextTick(() => carGo(0, true));
});
onMounted(() => {
  if (carIdx.value >= carousel.value.length) carIdx.value = 0;
  carGo(carIdx.value, true);
});

// ---------- 分組與模式 ----------
type Group = 'yes' | 'no';
const activeChip = ref<Group>('yes');
const grpYes = ref<HTMLElement | null>(null);
const grpNo = ref<HTMLElement | null>(null);
const viewCarousel = ref<HTMLElement | null>(null);

function setView(v: ResultView): void {
  q.setResultView(v);
  if (v === 'carousel') void nextTick(() => carGo(carIdx.value, true));
}
/** [W9] 看不符合的 N 項：切清單並捲到不符合組 */
async function seeNo(): Promise<void> {
  setView('list');
  await nextTick();
  jumpTo('no');
}
/** 計數膠囊：點了捲到該組；輪播時點不符合等同「看不符合的 N 項」 */
function jumpTo(g: Group): void {
  if (view.value === 'carousel' && g === 'no') {
    void seeNo();
    return;
  }
  activeChip.value = g;
  const el = view.value === 'carousel' ? viewCarousel.value : g === 'yes' ? grpYes.value : grpNo.value;
  el?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function openDetail(no: number, from: HTMLElement | null): void {
  detail.open(no, from);
}
/** 修改答案：保留目前答案回首頁表單；改任一題後主按鈕變回送出（SUBS-R26） */
function editAnswers(): void {
  void router.push({ name: 'home' });
}
/** [SUBS-R20] 清除填寫答案：回首頁未填，年齡與戶籍立刻回填台北通帳號值 */
function clearAnswers(): void {
  q.startOver();
  void router.push({ name: 'home' });
  showToast(MSG_CLEARED);
}
function onCenterClick(url: string): void {
  openLink(url);
}
</script>

<template>
  <section class="page" data-test="page-result">
    <span class="hey" data-test="hey">HEY, 找到了 {{ groups.eligible.length }} 項方案 ✨</span>
    <h2 class="page-title">為你量身試算的<br />專屬補助方案</h2>
    <div class="tool-row">
      <div class="chip-row" role="group" aria-label="結果分組">
        <button class="chip" :class="{ on: activeChip === 'yes' }" data-test="chip-yes" @click="jumpTo('yes')">
          可能符合 <span class="count" data-test="count-yes">{{ groups.eligible.length }}</span>
        </button>
        <button class="chip" :class="{ on: activeChip === 'no' }" data-test="chip-no" @click="jumpTo('no')">
          不符合 <span class="count" data-test="count-no">{{ groups.ineligible.length }}</span>
        </button>
      </div>
      <!-- [SUBS-R25] 閱讀模式 -->
      <div class="seg" role="group" aria-label="閱讀模式">
        <button
          v-for="o in VIEWS"
          :key="o.v"
          :class="{ on: view === o.v }"
          :aria-pressed="view === o.v ? 'true' : 'false'"
          :aria-label="o.label"
          :data-test="`view-${o.v}`"
          @click="setView(o.v)"
        >
          <svg v-if="o.v === 'carousel'" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="12" height="16" rx="3" /><path d="M2.5 7v10M21.5 7v10" /></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>
        </button>
      </div>
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
    <p v-if="query" class="search-note" data-test="search-note">{{ searchNoteText(query, searchedYes.length + searchedNo.length) }}</p>

    <!-- [SUBS-R19] 可能符合（含模擬）為 0 項：最接近 3 項與各差在哪一條、社會福利服務中心 -->
    <div v-if="q.noMatch.value" class="no-match" data-test="no-match">
      <div class="banner warn">
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
    </div>

    <!-- 輪播：只放可能符合（SUBS-R25） -->
    <div v-show="view === 'carousel'" ref="viewCarousel" data-test="view-carousel-box">
      <div
        v-show="carousel.length"
        ref="car"
        class="car"
        aria-roledescription="carousel"
        aria-label="可能符合的補助"
        data-test="carousel"
        @scroll.passive="onCarScroll"
      >
        <SubsidyBigCard v-for="r in carousel" :key="r.item.no" :row="r" @open="openDetail" />
      </div>
      <div v-if="!carousel.length && groups.eligible.length" class="empty car-empty" data-test="car-empty">
        {{ query ? '沒有名稱符合搜尋的項目' : '這個篩選下沒有可能符合的項目' }}
      </div>
      <div class="dots" data-test="car-dots">
        <template v-if="carousel.length > 1">
          <button
            v-for="(r, i) in carousel"
            :key="r.item.no"
            class="dot"
            :class="{ on: i === carIdx }"
            :aria-label="`第 ${i + 1} 張：${r.item.name}`"
            :aria-current="i === carIdx ? 'true' : 'false'"
            :data-test="`dot-${i}`"
            @click="carGo(i)"
          />
        </template>
      </div>
      <button v-if="groups.ineligible.length" class="btn more" data-test="btn-see-no" @click="seeNo">
        看不符合的 {{ groups.ineligible.length }} 項
      </button>
    </div>

    <!-- 清單：兩組 -->
    <div v-show="view === 'list'" data-test="view-list-box">
      <p id="grp-yes" ref="grpYes" class="group-title">可能符合</p>
      <div data-test="list-yes">
        <template v-if="searchedYes.length">
          <SubsidyRow
            v-for="r in listYes"
            :key="r.item.no"
            :item="r.item"
            :ok="true"
            :why="r.result.reason"
            :verify="r.result.toVerify.length > 0"
            @open="openDetail"
          />
        </template>
        <div v-else class="empty" data-test="empty-yes">
          {{ groups.eligible.length ? '沒有名稱符合搜尋的項目' : '目前沒有可能符合的補助' }}
        </div>
      </div>
      <p id="grp-no" ref="grpNo" class="group-title">不符合</p>
      <div data-test="list-no">
        <SubsidyRow v-for="r in listNo" :key="r.item.no" :item="r.item" :ok="false" :why="r.result.reason" @open="openDetail" />
      </div>
    </div>

    <div class="result-note">
      <p class="muted answer-summary" data-test="answer-summary">{{ summary }}</p>
      <div class="banner info" data-test="result-notice">這是初步篩選，不代表一定可以領。{{ THRESHOLD_NOTICE }}</div>
    </div>
    <div class="stack">
      <button class="btn primary" data-test="btn-edit" @click="editAnswers">修改答案</button>
      <button class="btn ghost" data-test="btn-clear" @click="clearAnswers">清除填寫答案</button>
      <RouterLink class="btn link" :to="{ name: 'source' }" data-test="link-source">資料來源與門檻說明</RouterLink>
    </div>
  </section>
</template>
