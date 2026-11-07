<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AGE_BANDS, ANSWER_IDENTITIES, INCOME_BRACKETS, INCOME_UNKNOWN, type AgeBand, type IncomeBracket } from '@app/shared';
import CardWrinkles from '@/components/CardWrinkles.vue';
import IntroHand from '@/components/IntroHand.vue';
import { useQuery } from '@/composables/useQuery';
import { MSG_CLEARED, showToast } from '@/composables/useToast';
import { DEMO_SCENARIOS, QUESTION_COUNT, firstErrorIndex } from '@/lib/answers';
import { consumeIntro, INTRO_MS, prefersReducedMotion } from '@/lib/intro';
import { formatUpdatedAt, incomeText } from '@/lib/resultView';

/**
 * 首頁：標題與單頁表單四張題卡（sa-3-s1.md 改版，原型 #page-start）。
 * [SUBS-R11] 送出時才檢查必填；年齡只選區間（ADR-030）；[SUBS-R22] 清單不能用時整張表單停用、不顯示送出鈕與示範情境；
 * [SUBS-R24] 年齡、戶籍來自台北通帳號時標示；[SUBS-R26] 主按鈕依查詢答案狀態；[SUBS-R27] 重新查詢。
 */
const router = useRouter();
const q = useQuery();
const { listState, canStart, canRetry, answersState } = q;
const a = computed(() => q.answers.value);

// ---------- 年齡（ADR-030：五顆單選膠囊，沒有實際歲數輸入） ----------
function onBand(v: AgeBand): void {
  q.setAgeBand(v);
  clearErr(0);
}
/** [SUBS-R24] 欄位值仍等於這份答案建立時帶入的台北通值才標示（示範情境的答案不標，原型 fromTp） */
const ageFromTp = computed(() => {
  const tp = q.prefilledFrom.value;
  return !!tp && tp.ageBand !== null && a.value.ageBand === tp.ageBand;
});
const resFromTp = computed(() => {
  const tp = q.prefilledFrom.value;
  return !!tp && tp.residency !== null && a.value.residency === tp.residency;
});
/** [SUBS-R24] 台北通帶入臺北市且帳號有區時，戶籍選項顯示「臺北市 · ○○區」（只顯示，不參與比對） */
const taipeiLabel = computed(() =>
  resFromTp.value && a.value.residency === true && q.prefill.value.town ? `臺北市 · ${q.prefill.value.town}` : '臺北市',
);

// ---------- 戶籍 ----------
const resValue = computed(() => (a.value.residency === null ? '' : String(a.value.residency)));
function onRes(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  q.setResidency(v === '' ? null : v === 'true');
  clearErr(1);
}

// ---------- 身分 ----------
function onId(v: (typeof ANSWER_IDENTITIES)[number]['value']): void {
  q.toggleIdentity(v);
  clearErr(2);
}

// ---------- 收入 ----------
const brOn = computed(() => a.value.incomeBracket !== null && a.value.incomeBracket !== INCOME_UNKNOWN);
const sliderValue = computed(() => (brOn.value ? a.value.incomeBracket! : 3));
const sliderPct = computed(() => (brOn.value ? `${((a.value.incomeBracket! - 1) / 4) * 100}%` : '0%'));
const brLabel = computed(() => incomeText(a.value.incomeBracket));
function setBr(v: IncomeBracket): void {
  q.setIncomeBracket(v);
  clearErr(3);
}
function onSlider(e: Event): void {
  setBr(Number((e.target as HTMLInputElement).value) as IncomeBracket);
}
/** 還沒選或選了不清楚時，點滑桿目前位置也算選（值沒變不會觸發 input，原型 onclick） */
function onSliderClick(e: MouseEvent): void {
  if (!brOn.value) onSlider(e);
}

// ---------- 送出與錯誤 ----------
const errors = ref<Array<string | null>>(Array.from({ length: QUESTION_COUNT }, () => null));
function clearErr(i: number): void {
  if (errors.value[i] !== null) errors.value = errors.value.map((e, j) => (j === i ? null : e));
}
/** 四張題卡的 DOM（非響應式，只給捲動與入場動畫定位用） */
const cards: Array<HTMLElement | null> = [null, null, null, null];
const bandBtn0 = ref<HTMLButtonElement | null>(null);
const resSelect = ref<HTMLSelectElement | null>(null);

/** [SUBS-R11] 送出：沒過的卡標錯誤並捲到第一張；全過到結果頁（比對在 useQuery.results） */
async function submit(): Promise<void> {
  if (!canStart.value) return;
  const errs = q.submit();
  errors.value = errs;
  const first = firstErrorIndex(errs);
  if (first < 0) {
    void router.push({ name: 'result' });
    return;
  }
  await nextTick();
  const card = cards[first];
  card?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  const target = first === 0 ? bandBtn0.value : first === 1 ? resSelect.value : card;
  target?.focus({ preventScroll: true });
}
function viewResult(): void {
  void router.push({ name: 'result' });
}
/** [SUBS-R27] 重新查詢：留在首頁回到未填，立刻帶入台北通帳號值，清掉各題錯誤 */
function requery(): void {
  q.startOver();
  errors.value = errors.value.map(() => null);
  showToast(MSG_CLEARED);
}
/** [SUBS-R23] 示範情境一鍵帶入並直接看結果 */
function useDemo(i: number): void {
  q.applyDemo(i);
  errors.value = errors.value.map(() => null);
  void router.push({ name: 'result' });
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

const updatedText = computed(() => (q.list.value ? formatUpdatedAt(q.list.value.updatedAt) : ''));
const showDemo = computed(() => canStart.value && answersState.value === 'empty');
const yesCount = computed(() => q.results.value?.eligible.length ?? 0);
const DEMO_ICON = ['mint', 'accent', 'light'] as const;

/**
 * [W6] 入場動畫：每次進入服務只在首頁播一次（spec 7.9）；減少動態效果時手與皺摺都不掛（CSS 也擋）。
 * 手對準年齡卡上緣（原型 boot()：卡片 top − 138）；不阻塞清單載入，播放中表單都能操作（手 pointer-events: none）。
 */
const pulled = ref(consumeIntro());
const handTop = ref<number | null>(null);
let introTimer: ReturnType<typeof setTimeout> | null = null;
onMounted(() => {
  if (!pulled.value) return;
  const card = cards[0];
  handTop.value = Math.round((card?.getBoundingClientRect().top ?? 0) - 138);
  introTimer = setTimeout(() => (pulled.value = false), INTRO_MS);
});
onBeforeUnmount(() => {
  if (introTimer) clearTimeout(introTimer);
});
</script>

<template>
  <section class="page" :class="{ pulled }" data-test="page-start">
    <!-- 手要相對畫面固定：.pulled 的 transform 會讓 fixed 改成相對本頁，所以掛到 body（原型 #intro-hand 也在 body 層） -->
    <Teleport to="body"><IntroHand v-if="pulled && handTop !== null" :top="handTop" /></Teleport>
    <div class="intro">
      <h2 class="hero-title">規劃你的未來，<br />領取你的<span class="tagword">補助計畫</span></h2>
      <svg class="doodle" viewBox="0 0 398 70" aria-hidden="true">
        <path class="wave" d="M0 40 C 60 22, 120 58, 190 40 S 320 22, 398 44" />
        <path class="arrow" d="M352 4 C 362 26, 356 46, 330 58" />
        <path class="arrow" d="M330 58 l 13 -1 M330 58 l 4 -12" />
      </svg>
    </div>

    <!-- [SUBS-R26] 已完成：上次比對找到 N 項 -->
    <div v-if="answersState === 'completed'" class="done-box" data-test="done-box">
      <span class="ic"><svg class="ico-line" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
      <div>
        <b>上次比對找到 {{ yesCount }} 項可能符合</b>
        <span class="muted">改任何一題就會重新比對；按「查看結果」回到結果頁。</span>
      </div>
    </div>

    <!-- [SUBS-R10][SUBS-R22] 清單狀態提示 -->
    <div v-if="listState === 'cached'" class="banner warn" role="status" data-test="list-cached">
      目前顯示的是上次載入的資料（{{ updatedText }}）。
    </div>
    <div v-else-if="listState === 'unavailable'" class="banner err" role="alert" data-test="list-unavailable">
      暫時無法取得補助資料，請稍後重試。
    </div>
    <div v-else-if="listState === 'notLoaded'" class="banner" role="status" data-test="list-loading">補助資料載入中…</div>

    <fieldset class="qform" :disabled="!canStart" data-test="q-form">
      <legend hidden>查詢四題</legend>
      <!-- 年齡 -->
      <div id="card-age" :ref="(el) => (cards[0] = el as HTMLElement | null)" class="qcard" :class="{ err: errors[0] }" data-test="card-age">
        <CardWrinkles v-if="pulled" />
        <div class="qhead">
          <span class="qic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg></span>
          <b id="lblAge">年齡</b><span class="qhint req">必填</span>
        </div>
        <!-- 年齡只選區間（ADR-030）：單選，台北通帶入時自動選好 -->
        <div class="opts bands" role="radiogroup" aria-labelledby="lblAge" aria-describedby="ageNote errAge" data-test="age-bands">
          <button
            v-for="(b, i) in AGE_BANDS"
            :key="b.value"
            :ref="i === 0 ? (el) => (bandBtn0 = el as HTMLButtonElement | null) : undefined"
            type="button"
            class="opt-chip"
            :class="{ on: a.ageBand === b.value }"
            role="radio"
            :aria-checked="a.ageBand === b.value ? 'true' : 'false'"
            :data-test="`band-${b.value}`"
            @click="onBand(b.value)"
          >
            {{ b.label }}
          </button>
        </div>
        <p v-if="ageFromTp" id="ageNote" class="qnote" data-test="age-tp">台北通帶入・可修改</p>
        <div v-if="errors[0]" id="errAge" class="field-err" role="alert" data-test="err-0">{{ errors[0] }}</div>
      </div>

      <!-- 戶籍縣市 -->
      <div :ref="(el) => (cards[1] = el as HTMLElement | null)" class="qcard" :class="{ err: errors[1] }" tabindex="-1" data-test="card-res">
        <div class="qhead">
          <span class="qic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg></span>
          <b id="lblRes">戶籍縣市</b><span class="qhint plain">影響補助資格</span>
        </div>
        <div class="sel" :class="{ 'sel-none': a.residency === null }">
          <span class="sdot" aria-hidden="true" />
          <select
            ref="resSelect"
            aria-labelledby="lblRes"
            aria-describedby="resNote errRes"
            data-test="in-res"
            :value="resValue"
            @change="onRes"
          >
            <option value="">請選擇戶籍縣市</option>
            <option value="true" data-test="opt-taipei">{{ taipeiLabel }}</option>
            <option value="false">其他縣市</option>
          </select>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <p v-if="resFromTp" id="resNote" class="qnote" data-test="res-tp">來自台北通帳號，可修改</p>
        <div v-if="errors[1]" id="errRes" class="field-err" role="alert" data-test="err-1">{{ errors[1] }}</div>
      </div>

      <!-- 身分別 -->
      <div :ref="(el) => (cards[2] = el as HTMLElement | null)" class="qcard" :class="{ err: errors[2] }" tabindex="-1" data-test="card-ids">
        <div class="qhead">
          <span class="qic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8" r="1.5" /></svg></span>
          <b id="lblIds">身分別 (可複選)</b>
          <span v-if="a.identities.length" class="qhint val">已選 {{ a.identities.length }} 項</span>
          <span v-else class="qhint req">必填</span>
        </div>
        <p class="qsub">65 歲以上不用另外勾，會用年齡判斷。</p>
        <div class="opts" role="group" aria-labelledby="lblIds">
          <button
            v-for="o in ANSWER_IDENTITIES"
            :key="o.value"
            type="button"
            class="opt-chip multi"
            :class="{ on: a.identities.includes(o.value) }"
            :aria-pressed="a.identities.includes(o.value) ? 'true' : 'false'"
            :data-test="`id-${o.value}`"
            @click="onId(o.value)"
          >
            {{ o.label }}
          </button>
        </div>
        <div v-if="errors[2]" class="field-err" role="alert" data-test="err-2">{{ errors[2] }}</div>
      </div>

      <!-- 家庭每人月收入 -->
      <div :ref="(el) => (cards[3] = el as HTMLElement | null)" class="qcard" :class="{ err: errors[3] }" tabindex="-1" data-test="card-br">
        <div class="qhead">
          <span class="qic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15 8.5c-.6-1-1.7-1.5-3-1.5c-1.7 0-3 .9-3 2.3c0 3.2 6 1.7 6 4.9c0 1.4-1.3 2.3-3 2.3c-1.4 0-2.6-.6-3.1-1.6M12 5.5v1.5M12 17v1.5" /></svg></span>
          <b id="lblBr">家庭每人月收入</b>
          <span v-if="brLabel" class="qhint val" data-test="br-hint">{{ brLabel }}</span>
          <span v-else class="qhint req">必填</span>
        </div>
        <p class="qsub">全家每月總收入除以家中人數。</p>
        <div class="br-row">
          <div class="slider" :class="{ unset: !brOn }">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              aria-labelledby="lblBr"
              :aria-valuetext="brOn ? brLabel ?? '' : '尚未選擇'"
              :style="{ '--p': sliderPct }"
              :value="sliderValue"
              data-test="in-br"
              @input="onSlider"
              @click="onSliderClick"
            />
            <div class="ticks" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <div class="tlabels" aria-hidden="true">
              <span>{{ INCOME_BRACKETS[0].label }}</span><span>24,294～28,550</span><span>{{ INCOME_BRACKETS[4].label }}</span>
            </div>
          </div>
          <button
            type="button"
            class="opt-chip"
            :class="{ on: a.incomeBracket === INCOME_UNKNOWN }"
            :aria-pressed="a.incomeBracket === INCOME_UNKNOWN ? 'true' : 'false'"
            data-test="br-unknown"
            @click="setBr(INCOME_UNKNOWN)"
          >
            不清楚
          </button>
        </div>
        <div v-if="errors[3]" class="field-err" role="alert" data-test="err-3">{{ errors[3] }}</div>
      </div>
    </fieldset>

    <!-- [SUBS-R26] 主按鈕依查詢答案狀態；[SUBS-R22] 清單不能用時沒有送出鈕 -->
    <div class="cta-bar">
      <button v-if="answersState === 'completed'" class="cta-main" data-test="btn-view-result" @click="viewResult">
        查看結果<span class="arrow-box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
      </button>
      <button v-else-if="canStart" class="cta-main" data-test="btn-submit" @click="submit">
        填寫資料，開始你的智能試算<span class="arrow-box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
      </button>
    </div>
    <button v-if="answersState !== 'empty'" class="btn ghost" data-test="btn-requery" @click="requery">重新查詢</button>
    <!-- [SUBS-R10] cached、unavailable 時給重試 -->
    <button v-if="canRetry" class="btn" data-test="btn-retry" :disabled="retrying" @click="retry">
      {{ retrying ? '重試中…' : '重試' }}
    </button>

    <!-- [SUBS-R22][SUBS-R23] 未填且清單可用時才有示範情境 -->
    <div v-if="showDemo" data-test="demo-box">
      <p class="group-title">示範情境（一鍵帶入）</p>
      <button v-for="(d, i) in DEMO_SCENARIOS" :key="d.title" class="btn demo" :data-test="`demo-${i}`" @click="useDemo(i)">
        <span class="ico" :class="DEMO_ICON[i]" aria-hidden="true">{{ d.icon }}</span>
        <span class="txt"><b>{{ d.title }}</b><span class="sub">{{ d.sub }}</span></span>
      </button>
    </div>
    <p class="muted fine" data-test="home-fine">
      答案只留在這支手機上，不會送出，離開就清除。結果只是初步篩選，不代表一定可以領；門檻以社會局最新公告為準。<span>年齡、戶籍為示範帳號資料（模擬台北通帳號帶入）。</span>
    </p>
    <RouterLink class="btn link" :to="{ name: 'source' }" data-test="link-source">資料來源</RouterLink>
  </section>
</template>
