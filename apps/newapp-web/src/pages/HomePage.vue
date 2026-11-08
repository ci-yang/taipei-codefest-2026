<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { SubsidyItem } from '@app/shared';
import CardWrinkles from '@/components/CardWrinkles.vue';
import IntroHand from '@/components/IntroHand.vue';
import { useQuery } from '@/composables/useQuery';
import { MSG_CLEARED, showToast } from '@/composables/useToast';
import { DEMO_SCENARIOS } from '@/lib/answers';
import { keyCondition, type KeyCondition } from '@/lib/categories';
import { consumeIntro, INTRO_MS } from '@/lib/intro';
import { formatUpdatedAt } from '@/lib/resultView';

/**
 * 首頁（v3，18.png）：大標、白色大卡（N 項補助與三列真實補助）、主 CTA 到試算頁。
 * 表單已移到試算頁（/calc）。不放金額、人數、百分比等編造數字，只用清單的真實欄位。
 * [SUBS-R10] 清單狀態提示與重試；[SUBS-R23] 示範情境；[SUBS-R26] 主按鈕依查詢答案狀態；[SUBS-R27] 重新查詢。
 */
const router = useRouter();
const q = useQuery();
const { list, listState, canStart, canRetry, answersState } = q;

/** 首頁大卡三列：中低收入戶、市民醫療補助、中低收入老人生活津貼（資料集序號） */
const FEATURED_NOS = [4, 9, 6] as const;
const DOT = ['dot-a', 'dot-b', 'dot-c'] as const;

/** 社會局公告的開放資料筆數（模擬資料不算進「依臺北市社會局公告」） */
const openCount = computed(() => list.value?.items.filter((i) => i.kind === 'open').length ?? 0);
/** 官方網頁整理筆數（ADR-035）：不算進上面的 N，另起一行小字 */
const curatedCount = computed(() => list.value?.items.filter((i) => i.kind === 'curated').length ?? 0);
/** 台北服務通筆數（ADR-036）：不比對，跟官方網頁整理同一行小字 */
const catalogCount = computed(() => list.value?.items.filter((i) => i.kind === 'catalog').length ?? 0);
const totalCount = computed(() => list.value?.items.length ?? 0);
const featured = computed(() => {
  const items = list.value?.items ?? [];
  return FEATURED_NOS.flatMap((no, i) => {
    const item = items.find((it) => it.no === no);
    return item ? [{ item, cond: featuredCond(item), dot: DOT[i] }] : [];
  });
});
/** 第三列（中低收入老人生活津貼）照原型用年齡呈現，取資料集的 ageMin；其餘沿用 keyCondition（收入優先） */
function featuredCond(item: SubsidyItem): KeyCondition {
  if (item.no === 6 && item.ageMin !== null) return { label: '', value: `需 ${item.ageMin} 歲以上` };
  return keyCondition(item);
}
const updatedText = computed(() => (list.value ? formatUpdatedAt(list.value.updatedAt) : ''));
const completed = computed(() => answersState.value === 'completed');
/** [SUBS-R22][SUBS-R23] 清單可用且還沒完成時才有示範情境 */
const showDemo = computed(() => canStart.value && !completed.value);

function toCalc(): void {
  void router.push('/calc');
}
function toResult(): void {
  void router.push('/result');
}
function onMain(): void {
  if (completed.value) toResult();
  else toCalc();
}
/** [SUBS-R27] 重新查詢：回到未填（立刻帶入台北通帳號值），留在首頁 */
function requery(): void {
  q.startOver();
  showToast(MSG_CLEARED);
}
/** [SUBS-R23] 示範情境一鍵帶入並直接看結果 */
function useDemo(i: number): void {
  q.applyDemo(i);
  toResult();
}

/** [SUBS-R10] 重試：再取一次清單；成功改 fresh */
const retrying = ref(false);
async function retry(): Promise<void> {
  if (retrying.value) return;
  retrying.value = true;
  try {
    await q.retryList();
  } finally {
    retrying.value = false;
  }
}

/**
 * [W6] 入場動畫：每次進入服務只在首頁播一次；減少動態效果時手與皺摺都不掛（consumeIntro 回 false，CSS 也擋）。
 * 手抓白色大卡右上 1/3（卡寬約 2/3、卡片上緣）；手臂從畫面上緣沿同一條垂直線伸下來。
 * 垂直位置沿用原型 boot()：卡片 top − 138。手掛 body、pointer-events: none，不擋操作。
 */
const GRAB_X = 2 / 3;
const heroCard = ref<HTMLElement | null>(null);
const pulled = ref(consumeIntro());
const hand = ref<{ top: number; left: number } | null>(null);
let introTimer: ReturnType<typeof setTimeout> | null = null;
onMounted(() => {
  if (!pulled.value) return;
  const r = heroCard.value?.getBoundingClientRect();
  hand.value = {
    top: Math.round((r?.top ?? 0) - 138),
    left: Math.round((r?.left ?? 0) + (r?.width ?? 0) * GRAB_X),
  };
  introTimer = setTimeout(() => (pulled.value = false), INTRO_MS);
});
onBeforeUnmount(() => {
  if (introTimer) clearTimeout(introTimer);
});
</script>

<template>
  <section class="home" :class="{ 'home-pulled': pulled }" data-test="page-start">
    <Teleport to="body"><IntroHand v-if="pulled && hand" :top="hand.top" :left="hand.left" /></Teleport>

    <div class="hero">
      <h2 class="hero-title" data-test="hero-title">規劃你的未來，<br />領取你的<span class="tagword">補助計畫</span></h2>
      <svg class="doodle" viewBox="0 0 398 64" preserveAspectRatio="none" aria-hidden="true">
        <path class="wave" d="M0 36 C 60 18, 120 54, 190 36 S 320 18, 398 40" />
        <path class="arrow" d="M300 2 C 318 18, 316 38, 290 50" />
        <path class="arrow" d="M290 50 l 13 -1 M290 50 l 5 -12" />
      </svg>
    </div>

    <!-- 白色大卡：手抓這張的右上 1/3 -->
    <div ref="heroCard" class="hero-card" data-test="hero-card">
      <CardWrinkles v-if="pulled" :x="`${GRAB_X * 100}%`" />
      <div class="card-top">
        <span class="alert-pill" data-test="alert-pill">⚠️ 臺北市{{ list ? ` ${openCount} 項` : '' }}社會救助補助</span>
        <span class="by">依臺北市社會局公告</span>
      </div>

      <template v-if="list">
        <p class="miss">若是未經試算，您可能正在錯過</p>
        <p class="big-row">
          <b class="big" data-test="big-count">{{ openCount }} 項補助</b><span class="open-tag">開放資料</span>
        </p>
        <p v-if="curatedCount" class="also" data-test="curated-count">
          另含 {{ curatedCount }} 項官方網頁整理的補助<template v-if="catalogCount">、{{ catalogCount }} 項台北服務通申辦服務</template>
        </p>
        <p class="remind">⚠️ 補助多需主動申請，未申請就領不到；先試算看看自己可能符合哪些。</p>
        <ul class="feat" data-test="featured">
          <li v-for="f in featured" :key="f.item.no" class="feat-row" :data-test="`feat-${f.item.no}`">
            <span class="fdot" :class="f.dot" aria-hidden="true" />
            <span class="fname">{{ f.item.name }}</span>
            <span class="fcond"><small v-if="f.cond.label">{{ f.cond.label }}</small> <b>{{ f.cond.value }}</b></span>
          </li>
        </ul>
        <!-- [SUBS-R10] 用的是上次清單 -->
        <p v-if="listState === 'cached'" class="note warn" role="status" data-test="list-cached">
          目前顯示的是上次載入的資料（{{ updatedText }}）。
          <button type="button" class="link-btn" data-test="btn-retry" :disabled="retrying" @click="retry">
            {{ retrying ? '重試中…' : '重試' }}
          </button>
        </p>
      </template>
      <!-- [SUBS-R10][SUBS-R22] 清單還沒到或拿不到 -->
      <div v-else-if="listState === 'unavailable'" class="note err" role="alert" data-test="list-unavailable">
        <span>暫時無法取得補助資料，請稍後重試。</span>
        <button v-if="canRetry" type="button" class="retry-btn" data-test="btn-retry" :disabled="retrying" @click="retry">
          {{ retrying ? '重試中…' : '重試' }}
        </button>
      </div>
      <p v-else class="note" role="status" data-test="list-loading">補助資料載入中…</p>

      <div class="card-foot">
        <span class="src-group">
          <span class="dots" aria-hidden="true"><i class="dot-a" /><i class="dot-b" /><i class="dot-c" /></span>
          <span class="src">資料來源：臺北市社會局・政府資料開放平臺</span>
        </span>
        <RouterLink class="free-pill" to="/calc" data-test="link-calc-pill">即刻免費試算</RouterLink>
      </div>
    </div>

    <!-- [SUBS-R26] 主按鈕：已完成時看上次結果；[SUBS-R22] 清單不能用且沒完成時不顯示 -->
    <button v-if="completed || canStart" type="button" class="cta" data-test="btn-cta" @click="onMain">
      <span>{{ completed ? '查看上次結果' : '填寫資料，開始你的智能試算' }}</span>
      <span class="cta-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
    </button>
    <button v-if="completed" type="button" class="ghost" data-test="btn-requery" @click="requery">重新查詢</button>

    <RouterLink v-if="list" class="all-link" to="/all" data-test="link-all">
      瀏覽全部 {{ totalCount }} 項補助<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </RouterLink>

    <!-- [SUBS-R23] 示範情境：一鍵帶入並直接看結果 -->
    <div v-if="showDemo" class="demo" data-test="demo-box">
      <p class="demo-title">示範情境（一鍵帶入）</p>
      <button v-for="(d, i) in DEMO_SCENARIOS" :key="d.title" type="button" class="demo-btn" :data-test="`demo-${i}`" @click="useDemo(i)">
        <span class="demo-ico" :class="DOT[i]" aria-hidden="true">{{ d.icon }}</span>
        <span class="demo-txt"><b>{{ d.title }}</b><small>{{ d.sub }}</small></span>
      </button>
    </div>

    <p class="fine" data-test="home-fine">
      答案只留在這支手機上，不會送出，離開就清除。結果只是初步篩選，不代表一定可以領；門檻以社會局最新公告為準。
    </p>
    <RouterLink class="src-link" to="/source" data-test="link-source">資料來源</RouterLink>
  </section>
</template>

<style scoped>
.home { position: relative; display: flex; flex-direction: column; gap: 16px; padding: 8px 20px 32px; }

/* ---------- 大標 ---------- */
.hero { position: relative; }
.hero-title { position: relative; z-index: 1; margin: 12px 0 0; font-size: var(--tp-fs-h1); line-height: 1.4; font-weight: 700; color: var(--tp-grayscale-900); }
.tagword {
  display: inline-block; margin-left: 6px; padding: 0 14px; border-radius: 14px;
  background: var(--tp-primary-700); color: var(--tp-white); line-height: 1.45;
  transform: rotate(-2.5deg); box-shadow: 0 10px 20px rgba(53, 108, 119, .3);
}
.doodle { display: block; width: 100%; height: 64px; margin-top: -8px; overflow: visible; fill: none; }
.doodle .wave { stroke: var(--tp-grayscale-300); stroke-width: 1.5; stroke-dasharray: 5 6; }
.doodle .arrow { stroke: var(--tp-primary-500); stroke-width: 2.2; stroke-linecap: round; }
@media (max-width: 380px) { .hero-title { font-size: 30px; } }

/* ---------- 白色大卡 ---------- */
.hero-card {
  position: relative; margin-top: -12px; padding: 18px 18px 14px; border-radius: 28px;
  background: var(--tp-white); box-shadow: 0 18px 40px rgba(17, 38, 41, .1), 0 2px 6px rgba(17, 38, 41, .05);
}
.card-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.alert-pill {
  display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px;
  background: var(--tp-red-50); border: 1px solid var(--tp-red-200); color: var(--tp-red-700);
  font-size: var(--tp-fs-body); font-weight: 600;
}
.by { color: var(--tp-grayscale-600); font-size: var(--tp-fs-caption); }
.miss { margin: 14px 0 0; color: var(--tp-grayscale-700); font-size: var(--tp-fs-body); }
.big-row { display: flex; align-items: center; gap: 10px; margin: 2px 0 0; }
.big { font-size: 40px; line-height: 1.2; font-weight: 800; color: var(--tp-grayscale-900); letter-spacing: .5px; }
.open-tag { padding: 4px 10px; border-radius: 8px; background: var(--tp-primary-100); color: var(--tp-primary-700); font-size: var(--tp-fs-body); font-weight: 600; }
.also { margin: 2px 0 0; color: var(--tp-grayscale-600); font-size: 14px; }
.remind { margin: 12px 0 0; padding: 12px 14px; border-radius: 14px; background: var(--tp-grayscale-50); color: var(--tp-grayscale-700); font-size: var(--tp-fs-body); line-height: 1.6; }
.feat { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.feat-row {
  display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 14px;
  border: 1px solid var(--tp-grayscale-100); border-radius: 14px; background: var(--tp-white);
}
.fdot { flex: none; width: 9px; height: 9px; border-radius: 50%; }
.fname { flex: 1; min-width: 0; color: var(--tp-grayscale-900); font-size: var(--tp-fs-body); font-weight: 600; }
.fcond { flex: none; text-align: right; color: var(--tp-grayscale-900); font-size: var(--tp-fs-body); }
.fcond small { color: var(--tp-grayscale-600); font-size: var(--tp-fs-caption); font-weight: 400; }
.dot-a { background: var(--tp-primary-500); }
.dot-b { background: var(--tp-secondary-500); }
.dot-c { background: var(--tp-primary-900); }
.note { margin: 14px 0 0; padding: 12px 14px; border-radius: 14px; background: var(--tp-grayscale-50); color: var(--tp-grayscale-700); font-size: var(--tp-fs-body); line-height: 1.6; }
.note.warn { background: var(--tp-secondary-50); color: var(--tp-secondary-900); }
.note.err { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; background: var(--tp-red-50); color: var(--tp-red-700); }
.link-btn { min-height: 48px; padding: 0 6px; border: 0; background: none; color: var(--tp-primary-700); font: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; }
.retry-btn { min-height: 48px; padding: 0 22px; border: 0; border-radius: 999px; background: var(--tp-primary-700); color: var(--tp-white); font: inherit; font-weight: 600; cursor: pointer; }
.retry-btn:disabled, .link-btn:disabled { opacity: .5; cursor: not-allowed; }
.card-foot { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--tp-grayscale-100); }
/* 圓點與來源文字同一群靠左；右側膠囊 flex: none，不撐開左群 */
.src-group { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.dots { display: inline-flex; flex: none; }
.dots i { display: block; width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--tp-white); }
.dots i + i { margin-left: -4px; }
.src { min-width: 0; color: var(--tp-grayscale-600); font-size: var(--tp-fs-caption); line-height: 1.4; }
.free-pill {
  position: relative; flex: none; padding: 7px 12px; border-radius: 999px;
  background: var(--tp-primary-100); color: var(--tp-primary-700); font-size: var(--tp-fs-body); font-weight: 600; text-decoration: none;
}
/* 視覺小、點擊範圍放大到 48px 高 */
.free-pill::after { content: ''; position: absolute; inset: -9px -4px; }

/* ---------- CTA ---------- */
.cta {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 72px; margin-top: 8px;
  padding: 10px 10px 10px 22px; border: 0; border-radius: 22px; background: var(--tp-white);
  box-shadow: 0 12px 30px rgba(17, 38, 41, .1); color: var(--tp-grayscale-900); font: inherit; font-size: var(--tp-fs-title); font-weight: 700; text-align: left; cursor: pointer;
}
.cta-arrow { display: grid; place-items: center; flex: none; width: 52px; height: 52px; border-radius: 50%; background: var(--tp-grayscale-900); }
.cta-arrow svg { width: 24px; height: 24px; fill: none; stroke: var(--tp-white); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.ghost { min-height: 48px; border: 1px solid var(--tp-grayscale-200); border-radius: 999px; background: transparent; color: var(--tp-grayscale-800); font: inherit; font-weight: 600; cursor: pointer; }

/* ---------- 次要連結 ---------- */
.all-link { display: flex; align-items: center; justify-content: center; gap: 2px; min-height: 48px; color: var(--tp-primary-700); font-weight: 600; text-decoration: none; }
.all-link svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; }
.demo { display: flex; flex-direction: column; gap: 8px; }
.demo-title { margin: 0; color: var(--tp-grayscale-600); font-size: var(--tp-fs-body); font-weight: 600; }
.demo-btn { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 14px; border: 1px solid var(--tp-grayscale-100); border-radius: 16px; background: var(--tp-white); font: inherit; text-align: left; cursor: pointer; }
.demo-ico { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 50%; color: var(--tp-white); font-weight: 700; }
.demo-ico.dot-a { background: var(--tp-primary-700); }
.demo-ico.dot-b { background: var(--tp-secondary-500); color: var(--tp-grayscale-900); }
.demo-txt { display: flex; flex-direction: column; min-width: 0; color: var(--tp-grayscale-900); }
.demo-txt small { color: var(--tp-grayscale-600); font-size: var(--tp-fs-caption); }
.fine { margin: 4px 0 0; color: var(--tp-grayscale-600); font-size: var(--tp-fs-caption); line-height: 1.6; }
.src-link { align-self: center; display: inline-flex; align-items: center; min-height: 48px; padding: 0 12px; color: var(--tp-primary-700); font-size: var(--tp-fs-body); }
.cta:focus-visible, .ghost:focus-visible, .demo-btn:focus-visible, .free-pill:focus-visible, .all-link:focus-visible, .src-link:focus-visible, .retry-btn:focus-visible, .link-btn:focus-visible {
  outline: 3px solid var(--tp-primary-500); outline-offset: 2px;
}

/* ---------- 入場動畫：整頁被往上提、大卡以抓點為軸拉長 ---------- */
.home-pulled { animation: homePull 1.8s linear both; }
.home-pulled .hero-card { transform-origin: 66.67% 10px; animation: cardStretch 1.8s linear both; }
@keyframes homePull {
  0%, 40% { transform: translateY(0); animation-timing-function: cubic-bezier(.45, 0, .55, 1); }
  60%, 68% { transform: translateY(-18px); animation-timing-function: cubic-bezier(.34, 1.9, .6, 1); }
  100% { transform: translateY(0); }
}
@keyframes cardStretch {
  0%, 40% { transform: scaleY(1); animation-timing-function: cubic-bezier(.45, 0, .55, 1); }
  60%, 66% { transform: scaleY(1.026); animation-timing-function: cubic-bezier(.34, 1.9, .6, 1); }
  100% { transform: scaleY(1); }
}
@media (prefers-reduced-motion: reduce) { .home-pulled, .home-pulled .hero-card { animation: none; } }
</style>
