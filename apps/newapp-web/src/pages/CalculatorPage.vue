<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AGE_BANDS, ANSWER_IDENTITIES, INCOME_BRACKETS, INCOME_HINT, INCOME_UNKNOWN, type AgeBand, type AnswerIdentity, type IncomeBracket } from '@app/shared';
import IncomeBars from '@/components/calc/IncomeBars.vue';
import MemberCard from '@/components/calc/MemberCard.vue';
import { AGE_BAND_SUB, IDENTITY_ICON, IDENTITY_SUB } from '@/components/calc/calcCopy';
import { answeredCount, liveCount } from '@/components/calc/liveMatch';
import { useQuery } from '@/composables/useQuery';
import { QUESTION_COUNT, firstErrorIndex } from '@/lib/answers';
import { prefersReducedMotion } from '@/lib/intro';
import { formatUpdatedAt } from '@/lib/resultView';

/**
 * 試算頁（v3，16.png）：四題表單＋即時比對。邏輯與驗證沿用首頁表單：
 * [SUBS-R11] 送出時才檢查必填、捲到第一張有錯的卡；[SUBS-R22] 清單不能用時整張表單停用、沒有送出鈕；
 * [SUBS-R24] 年齡、戶籍來自台北通帳號時標示。答案只在 useQuery 記憶體（SUBS-R21）。
 */
const router = useRouter();
const q = useQuery();
const { listState, canStart, canRetry } = q;
const a = computed(() => q.answers.value);

// ---------- 進度與即時比對 ----------
const done = computed(() => answeredCount(a.value));
const pct = computed(() => Math.round((done.value / QUESTION_COUNT) * 100));
const total = computed(() => q.list.value?.items.length ?? 0);
const live = computed(() => (q.list.value ? liveCount(q.list.value.items, a.value) : 0));

// ---------- 台北通帶入 ----------
const linked = computed(() => q.prefill.value.ageBand !== null || q.prefill.value.residency !== null);
const ageFromTp = computed(() => {
  const tp = q.prefilledFrom.value;
  return !!tp && tp.ageBand !== null && a.value.ageBand === tp.ageBand;
});
const resFromTp = computed(() => {
  const tp = q.prefilledFrom.value;
  return !!tp && tp.residency !== null && a.value.residency === tp.residency;
});
/** 下拉只是樣式：帳號戶籍在臺北市且有區時，臺北市選項顯示「臺北市 · ○○區」；外縣市帳號的區不掛到臺北市上。比對只看是不是臺北市 */
const taipeiLabel = computed(() => {
  const { residency, town } = q.prefill.value;
  return residency === true && town ? `臺北市 · ${town}` : '臺北市';
});

// ---------- 作答 ----------
function onBand(v: AgeBand): void {
  q.setAgeBand(v);
  clearErr(0);
}
function setRes(v: boolean | null): void {
  q.setResidency(v);
  clearErr(1);
}
const resValue = computed(() => (a.value.residency === null ? '' : String(a.value.residency)));
function onResSelect(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  setRes(v === '' ? null : v === 'true');
}
function onId(v: AnswerIdentity): void {
  q.toggleIdentity(v);
  clearErr(2);
}
function setBr(v: IncomeBracket): void {
  q.setIncomeBracket(v);
  clearErr(3);
}
const INCOME_OPTS = [...INCOME_BRACKETS.map((b) => ({ value: b.value as IncomeBracket, label: b.label })), { value: INCOME_UNKNOWN as IncomeBracket, label: '不清楚' }];

// ---------- 送出與錯誤 ----------
const errors = ref<Array<string | null>>(Array.from({ length: QUESTION_COUNT }, () => null));
function clearErr(i: number): void {
  if (errors.value[i] !== null) errors.value = errors.value.map((e, j) => (j === i ? null : e));
}
const cards: Array<HTMLElement | null> = [null, null, null, null];
const bandBtn0 = ref<HTMLButtonElement | null>(null);
const resBtn0 = ref<HTMLButtonElement | null>(null);

/** [SUBS-R11] 沒過的卡標錯誤並捲到第一張；全過到結果頁 */
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
  const target = first === 0 ? bandBtn0.value : first === 1 ? resBtn0.value : card;
  target?.focus({ preventScroll: true });
}
function back(): void {
  void router.push({ name: 'home' });
}

/** [SUBS-R10] 重試：再取一次清單 */
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
</script>

<template>
  <section class="calc" data-test="page-calc">
    <!-- 進度列 -->
    <div class="prog">
      <div class="prog-row">
        <button type="button" class="back" aria-label="返回首頁" data-test="btn-back" @click="back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        </button>
        <span class="prog-title" data-test="prog-step">填寫基本資料 ({{ done }}/4)</span>
        <span class="prog-pct" data-test="prog-pct">已完成 {{ pct }}%</span>
      </div>
      <div class="prog-bar" role="progressbar" aria-label="填寫進度" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: `${pct}%` }" />
      </div>
    </div>

    <!-- 即時結果卡 -->
    <div class="live" role="status" data-test="live-card">
      <span class="live-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.01" /></svg>
      </span>
      <div class="live-txt">
        <div class="live-head"><b>試算權益提示</b><span class="pill red" data-test="live-pill">即時比對</span></div>
        <!-- 沒填完時講清楚只是依已填題數的估計（原型 16.png 文案），不說成已符合 -->
        <p v-if="done === 0" data-test="live-text">還沒填答，<em>{{ live }}</em> 項補助都在比對範圍；填完四題就知道哪些可能符合。</p>
        <p v-else-if="done < 4" data-test="live-text">依你目前填的 {{ done }} 題，有 <em>{{ live }}</em> 項可能符合的補助；填完四題會更準。</p>
        <p v-else data-test="live-text">目前已偵測到 <em>{{ live }}</em> 項您可能符合的補助</p>
      </div>
    </div>

    <MemberCard :linked="linked" />

    <!-- [SUBS-R10][SUBS-R22] 清單狀態 -->
    <div v-if="listState === 'cached'" class="note warn" role="status" data-test="list-cached">目前顯示的是上次載入的資料（{{ updatedText }}）。</div>
    <div v-else-if="listState === 'unavailable'" class="note err" role="alert" data-test="list-unavailable">暫時無法取得補助資料，請稍後重試。</div>
    <div v-else-if="listState === 'notLoaded'" class="note" role="status" data-test="list-loading">補助資料載入中…</div>
    <button v-if="canRetry" type="button" class="retry" data-test="btn-retry" :disabled="retrying" @click="retry">{{ retrying ? '重試中…' : '重試' }}</button>

    <fieldset class="qform" :disabled="!canStart" data-test="q-form">
      <legend hidden>試算四題</legend>

      <!-- 1. 年齡區間 -->
      <div :ref="(el) => (cards[0] = el as HTMLElement | null)" class="qc" :class="{ err: errors[0] }" data-test="card-age">
        <div class="qh"><b id="cLblAge">1. 年齡區間</b><span class="tag">單選</span></div>
        <div class="age-grid" role="radiogroup" aria-labelledby="cLblAge" data-test="age-bands">
          <button
            v-for="(b, i) in AGE_BANDS"
            :key="b.value"
            :ref="i === 0 ? (el) => (bandBtn0 = el as HTMLButtonElement | null) : undefined"
            type="button"
            class="age"
            :class="{ on: a.ageBand === b.value, wide: i === AGE_BANDS.length - 1 }"
            role="radio"
            :aria-checked="a.ageBand === b.value ? 'true' : 'false'"
            :data-test="`band-${b.value}`"
            @click="onBand(b.value)"
          >
            <span class="age-l">{{ b.label }}</span>
            <span class="age-s">{{ AGE_BAND_SUB[b.value] }}</span>
            <span v-if="ageFromTp && a.ageBand === b.value" class="tp" data-test="age-tp">台北通帶入</span>
            <svg v-if="a.ageBand === b.value" class="check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6" /></svg>
          </button>
        </div>
        <div v-if="errors[0]" class="ferr" role="alert" data-test="err-0">{{ errors[0] }}</div>
      </div>

      <!-- 2. 戶籍縣市 -->
      <div :ref="(el) => (cards[1] = el as HTMLElement | null)" class="qc" :class="{ err: errors[1] }" tabindex="-1" data-test="card-res">
        <div class="qh">
          <b id="cLblRes">2. 戶籍縣市</b>
          <span v-if="resFromTp" class="tag loc" data-test="res-tp">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>已定位
          </span>
        </div>
        <div class="res-row" role="radiogroup" aria-labelledby="cLblRes">
          <button
            ref="resBtn0"
            type="button"
            class="res"
            :class="{ on: a.residency === true }"
            role="radio"
            :aria-checked="a.residency === true ? 'true' : 'false'"
            data-test="res-true"
            @click="setRes(true)"
          >台北市</button>
          <button
            type="button"
            class="res"
            :class="{ on: a.residency === false }"
            role="radio"
            :aria-checked="a.residency === false ? 'true' : 'false'"
            data-test="res-false"
            @click="setRes(false)"
          >其他縣市</button>
        </div>
        <div class="sel">
          <select aria-labelledby="cLblRes" data-test="in-res" :value="resValue" @change="onResSelect">
            <option value="">請選擇戶籍縣市</option>
            <option value="true" data-test="opt-taipei">{{ taipeiLabel }}</option>
            <option value="false">其他縣市</option>
          </select>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <div v-if="errors[1]" class="ferr" role="alert" data-test="err-1">{{ errors[1] }}</div>
      </div>

      <!-- 3. 身分與家庭狀況 -->
      <div :ref="(el) => (cards[2] = el as HTMLElement | null)" class="qc" :class="{ err: errors[2] }" tabindex="-1" data-test="card-ids">
        <div class="qh"><b id="cLblIds">3. 身分與家庭狀況</b><span class="tag">可複選</span></div>
        <div class="ids" role="group" aria-labelledby="cLblIds">
          <button
            v-for="o in ANSWER_IDENTITIES"
            :key="o.value"
            type="button"
            class="idr"
            :class="{ on: a.identities.includes(o.value) }"
            role="checkbox"
            :aria-checked="a.identities.includes(o.value) ? 'true' : 'false'"
            :data-test="`id-${o.value}`"
            @click="onId(o.value)"
          >
            <span class="idr-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path :d="IDENTITY_ICON[o.value]" /></svg></span>
            <span class="idr-t"><b>{{ o.label }}</b><small>{{ IDENTITY_SUB[o.value] }}</small></span>
            <span class="box" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-8" /></svg></span>
          </button>
        </div>
        <div v-if="errors[2]" class="ferr" role="alert" data-test="err-2">{{ errors[2] }}</div>
      </div>

      <!-- 4. 每人月收入 -->
      <div :ref="(el) => (cards[3] = el as HTMLElement | null)" class="qc" :class="{ err: errors[3] }" tabindex="-1" data-test="card-br">
        <div class="qh"><b id="cLblBr">4. 每人月收入</b><span class="tag warn">影響補助資格</span></div>
        <div class="br-grid" role="radiogroup" aria-labelledby="cLblBr">
          <button
            v-for="o in INCOME_OPTS"
            :key="o.value"
            type="button"
            class="br"
            :class="{ on: a.incomeBracket === o.value }"
            role="radio"
            :aria-checked="a.incomeBracket === o.value ? 'true' : 'false'"
            :data-test="o.value === INCOME_UNKNOWN ? 'br-unknown' : `br-${o.value}`"
            @click="setBr(o.value)"
          >{{ o.label }}</button>
        </div>
        <IncomeBars :selected="a.incomeBracket" />
        <p class="hint">{{ INCOME_HINT }}</p>
        <div v-if="errors[3]" class="ferr" role="alert" data-test="err-3">{{ errors[3] }}</div>
      </div>
    </fieldset>

    <!-- 底部摘要 -->
    <div class="sum" data-test="sum-card">
      <span class="sum-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
      <div class="sum-t"><small>目前可能符合</small><b data-test="sum-count">{{ live }} 項</b></div>
      <span class="pill" data-test="sum-total">已比對 {{ total }} 項</span>
    </div>

    <button v-if="canStart" type="button" class="cta" data-test="btn-submit" @click="submit">
      完成資料填寫，查看可領取補助方案 ({{ live }}) <span aria-hidden="true">→</span>
    </button>
    <p class="fine" data-test="calc-fine">答案只留在這支手機，不會送出</p>
  </section>
</template>

<style scoped>
.calc { padding: 0 16px 24px; }
/* 進度列 */
.prog { padding: 8px 0 4px; }
.prog-row { display: flex; align-items: center; gap: 8px; }
.back { flex: none; display: grid; place-items: center; width: 48px; height: 48px; border: 0; border-radius: 50%; background: var(--tp-white); color: var(--tp-grayscale-900); }
.back svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.prog-title { flex: 1; font-weight: 600; color: var(--tp-primary-800); }
.prog-pct { font-size: var(--tp-fs-caption); font-weight: 600; color: var(--tp-secondary-800); }
.prog-bar { height: 6px; margin-top: 6px; border-radius: 3px; background: var(--tp-grayscale-200); overflow: hidden; }
.prog-bar span { display: block; height: 100%; background: var(--tp-primary-700); transition: width .3s; }

/* 即時結果卡 */
.live { display: flex; gap: 12px; margin: 12px 0; padding: 16px; border-radius: 18px; background: var(--tp-red-50); border: 1px solid var(--tp-red-200); }
.live-ic { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--tp-red-600); }
.live-ic svg { width: 20px; height: 20px; fill: none; stroke: var(--tp-white); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.live-txt { flex: 1; min-width: 0; }
.live-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.live-head b { color: var(--tp-red-700); }
.live-txt p { margin: 6px 0 0; color: var(--tp-red-800); font-size: var(--tp-fs-h3); line-height: 1.5; }
.live-txt em { font-style: normal; font-weight: 700; font-size: 1.3em; color: var(--tp-red-700); text-decoration: underline; text-underline-offset: 4px; }
.pill { flex: none; padding: 4px 12px; border-radius: 999px; font-size: var(--tp-fs-caption); font-weight: 600; background: var(--tp-white); color: var(--tp-primary-800); border: 1px solid var(--tp-primary-200); }
.pill.red { background: var(--tp-red-700); color: var(--tp-white); border-color: var(--tp-red-700); }

/* 狀態提示 */
.note { margin: 12px 0; padding: 12px 16px; border-radius: 14px; background: var(--tp-white); border-left: 6px solid var(--tp-primary-600); }
.note.warn { border-left-color: var(--tp-secondary-500); }
.note.err { border-left-color: var(--tp-red-600); }
.retry { width: 100%; min-height: 48px; border-radius: 999px; border: 1px solid var(--tp-grayscale-300); background: var(--tp-white); margin-bottom: 12px; }

/* 題卡 */
.qform { border: 0; margin: 0; padding: 0; min-width: 0; }
.qform:disabled { opacity: .55; }
.qc { margin: 12px 0; padding: 16px; border-radius: 18px; background: var(--tp-white); border: 2px solid transparent; }
.qc.err { border-color: var(--tp-red-600); }
.qh { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.qh b { position: relative; padding-left: 12px; font-size: var(--tp-fs-h3); color: var(--tp-grayscale-900); }
.qh b::before { content: ""; position: absolute; left: 0; top: 3px; bottom: 3px; width: 4px; border-radius: 2px; background: var(--tp-primary-700); }
.tag { display: inline-flex; align-items: center; gap: 4px; font-size: var(--tp-fs-caption); color: var(--tp-grayscale-700); }
.tag.loc { color: var(--tp-primary-800); }
.tag.loc svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; }
.tag.warn { color: var(--tp-secondary-800); font-weight: 600; }
.ferr { margin-top: 8px; color: var(--tp-red-600); }
.hint { margin: 8px 0 0; font-size: var(--tp-fs-caption); color: var(--tp-grayscale-600); }

/* 年齡 */
.age-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.age { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 64px; padding: 10px 12px; border: 2px solid transparent; border-radius: 12px; background: var(--tp-primary-50); text-align: left; }
.age.wide { grid-column: span 2; }
.age.on { border-color: var(--tp-primary-700); background: var(--tp-primary-100); }
.age-l { font-weight: 600; font-size: var(--tp-fs-h3); color: var(--tp-grayscale-900); }
.age.on .age-l { color: var(--tp-primary-800); }
.age-s { font-size: var(--tp-fs-caption); color: var(--tp-grayscale-700); }
.age .tp { margin-top: 4px; font-size: 11px; line-height: 1.5; padding: 1px 8px; border-radius: 999px; background: var(--tp-primary-700); color: var(--tp-white); }
.check { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; }
.check circle { fill: var(--tp-primary-700); }
.check path { fill: none; stroke: var(--tp-white); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }

/* 戶籍 */
.res-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.res { min-height: 48px; border-radius: 12px; border: 2px solid transparent; background: var(--tp-primary-50); font-weight: 600; color: var(--tp-grayscale-900); }
.res.on { background: var(--tp-primary-700); color: var(--tp-white); }
.sel { position: relative; margin-top: 10px; }
.sel select { width: 100%; min-height: 48px; padding: 0 40px 0 14px; border: 0; border-radius: 12px; background: var(--tp-grayscale-50); color: var(--tp-grayscale-900); font: inherit; appearance: none; -webkit-appearance: none; }
.chev { position: absolute; right: 12px; top: 50%; width: 20px; height: 20px; transform: translateY(-50%); fill: none; stroke: var(--tp-grayscale-700); stroke-width: 2; pointer-events: none; }

/* 身分 */
.ids { display: flex; flex-direction: column; gap: 8px; }
.idr { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 10px 12px; border: 2px solid transparent; border-radius: 12px; background: var(--tp-primary-50); text-align: left; }
.idr.on { border-color: var(--tp-primary-700); }
.idr-ic { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--tp-white); }
.idr-ic svg { width: 20px; height: 20px; fill: none; stroke: var(--tp-primary-700); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.idr-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.idr-t b { color: var(--tp-grayscale-900); }
.idr-t small { font-size: var(--tp-fs-caption); color: var(--tp-grayscale-700); }
.box { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border: 2px solid var(--tp-grayscale-500); border-radius: 4px; background: var(--tp-white); }
.box svg { width: 18px; height: 18px; fill: none; stroke: transparent; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.idr.on .box { border-color: var(--tp-primary-700); background: var(--tp-primary-700); }
.idr.on .box svg { stroke: var(--tp-white); }

/* 收入 */
.br-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.br { min-height: 52px; padding: 6px; border-radius: 12px; border: 2px solid transparent; background: var(--tp-primary-50); font-size: var(--tp-fs-caption); font-weight: 600; color: var(--tp-grayscale-900); line-height: 1.35; }
.br.on { background: var(--tp-primary-700); color: var(--tp-white); }

/* 摘要與按鈕 */
.sum { display: flex; align-items: center; gap: 12px; margin: 16px 0 12px; padding: 16px; border-radius: 18px; background: var(--tp-primary-100); }
.sum-ic { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--tp-secondary-500); }
.sum-ic svg { width: 22px; height: 22px; fill: none; stroke: var(--tp-grayscale-900); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.sum-t { flex: 1; display: flex; flex-direction: column; }
.sum-t small { font-size: var(--tp-fs-caption); color: var(--tp-grayscale-700); }
.sum-t b { font-size: var(--tp-fs-h2); color: var(--tp-grayscale-900); }
.cta { display: block; width: 100%; min-height: 56px; padding: 14px 20px; border: 0; border-radius: 16px; background: var(--tp-primary-800); color: var(--tp-white); font-weight: 600; font-size: var(--tp-fs-h3); }
.cta:active { transform: scale(.98); }
.fine { margin: 10px 0 0; text-align: center; font-size: var(--tp-fs-caption); color: var(--tp-grayscale-600); }
</style>
