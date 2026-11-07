<script setup lang="ts">
import { computed, ref } from 'vue';
import CardWrinkles from '@/components/CardWrinkles.vue';
import { DOCS, useQuery } from '@/composables/useQuery';
import { PREP_TONE, art } from '@/lib/illustrations';
import { infoCards } from '@/lib/resultView';

/**
 * 開始頁「我的資料」旋轉木馬（spec 7.10、ADR-018，sa-3-s2.md W8；版面與行為照原型 renderCarousel／carGo／carTap）。
 * 前 4 張讀 Answers（還沒開始作答時讀 prefill，SUBS-R24）；第 5 張文件勾選寫 docsReady（SUBS-R25，只在記憶體）。
 * 點前排前 4 張卡跳到該題（SUBS-R26）；點非前排的卡先轉到那張。
 */
const props = defineProps<{ pulled?: boolean }>();
const emit = defineEmits<{ (e: 'edit', step: number): void }>();
const q = useQuery();

const TOTAL = 5;
const LABELS = ['年齡', '戶籍', '身分', '收入', '申請文件'];
const cur = ref(0);

const notStarted = computed(() => q.answersState.value === 'empty');
const cards = computed(() => infoCards(q.answers.value, q.prefill.value, notStarted.value));
/** 年齡卡插畫上的數字（原型 p1 的 __V__）：卡片顯示的年齡，未填為 ? */
const ageOnArt = computed(() => {
  const age = notStarted.value ? q.prefill.value.age : q.answers.value.age;
  return age === null ? '?' : age;
});
const docsCount = computed(() => q.docsReady.value.filter(Boolean).length);
const docsDone = computed(() => docsCount.value === DOCS.length);

/** 相對前排的位置（原型 data-pos）：0 前排、1、2 疊在後、out 剛滑走、hide 隱藏 */
function pos(i: number): string {
  const k = (i - cur.value + TOTAL) % TOTAL;
  if (k === 0) return '0';
  if (k === 1) return '1';
  if (k === 2) return '2';
  return k === TOTAL - 1 ? 'out' : 'hide';
}
function go(i: number): void {
  cur.value = (i + TOTAL) % TOTAL;
}

let x0: number | null = null;
let moved = false;
function onDown(e: PointerEvent): void {
  x0 = e.clientX;
  moved = false;
}
function onUp(e: PointerEvent): void {
  if (x0 === null) return;
  const dx = e.clientX - x0;
  x0 = null;
  if (Math.abs(dx) > 40) {
    moved = true;
    go(cur.value + (dx < 0 ? 1 : -1));
  }
}
function onCancel(): void {
  x0 = null;
}

function tap(i: number): void {
  if (moved) {
    moved = false;
    return;
  }
  if (i !== cur.value) {
    go(i);
    return;
  }
  if (i < 4) emit('edit', i);
}
function onKey(e: KeyboardEvent, i: number): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    tap(i);
  }
}

defineExpose({ go });
</script>

<template>
  <div class="stage" data-test="my-info">
    <div class="stage-tag"><span class="pill light">我的資料</span></div>
    <div
      class="carousel"
      aria-roledescription="carousel"
      aria-label="已填寫與已準備的資料"
      @pointerdown="onDown"
      @pointerup="onUp"
      @pointercancel="onCancel"
    >
      <div class="car-track">
        <div
          v-for="c in cards"
          :key="c.step"
          class="pcard"
          :class="{ unfilled: c.value === null }"
          :data-i="c.step"
          :data-pos="pos(c.step)"
          :data-test="`card-${c.step}`"
          :style="{ '--tone': PREP_TONE[c.step] }"
          role="button"
          :tabindex="pos(c.step) === '0' ? 0 : -1"
          :aria-hidden="pos(c.step) === '0' ? 'false' : 'true'"
          @click="tap(c.step)"
          @keydown="onKey($event, c.step)"
        >
          <!-- 入場動畫：皺摺只在第 1 張（進入時的前排卡），播放中才掛 -->
          <CardWrinkles v-if="c.step === 0 && props.pulled" />
          <span class="pnum">{{ String(c.step + 1).padStart(2, '0') }}</span>
          <span class="pstat" :class="c.value !== null ? 'ok' : 'todo'" data-test="card-stat">{{
            c.value !== null ? '已填寫' : '尚未填寫'
          }}</span>
          <!-- 插畫為本服務原創 SVG 字串常數（lib/illustrations.ts），不含使用者輸入以外的內容；p1 只代入整數年齡 -->
          <span class="art" v-html="art(`p${c.step + 1}`, c.step === 0 ? ageOnArt : '?')" />
          <span class="pl">{{ c.label }}</span>
          <b class="pv" data-test="card-value">{{ c.value ?? '尚未填寫' }}</b>
          <span class="pd" data-test="card-note">{{
            c.value === null ? '按開始查詢填寫' : c.fromTownPass ? '來自台北通帳號・點卡片可修改' : '點卡片可修改'
          }}</span>
        </div>
        <div
          class="pcard doc-card"
          data-i="4"
          :data-pos="pos(4)"
          data-test="card-4"
          :style="{ '--tone': PREP_TONE[4] }"
          role="group"
          aria-label="申請時常要準備的文件"
          :aria-hidden="pos(4) === '0' ? 'false' : 'true'"
          @click="tap(4)"
        >
          <span class="pnum">05</span>
          <span class="pstat" :class="docsDone ? 'ok' : 'todo'" data-test="card-stat">{{ docsDone ? '已備齊' : '尚未備齊' }}</span>
          <span class="art" v-html="art('p5')" />
          <span class="pl">申請時常要準備</span>
          <b class="pv" data-test="card-value">已準備 {{ docsCount }}／{{ DOCS.length }}</b>
          <span class="docs">
            <button
              v-for="(d, j) in DOCS"
              :key="d"
              class="doc"
              :class="{ on: q.docsReady.value[j] }"
              :aria-pressed="q.docsReady.value[j] ? 'true' : 'false'"
              :data-test="`doc-${j}`"
              @click.stop="q.toggleDoc(j)"
            >
              {{ d }}
            </button>
          </span>
        </div>
      </div>
    </div>
    <div class="dots">
      <button
        v-for="(l, i) in LABELS"
        :key="l"
        class="dot"
        :class="{ on: i === cur }"
        :aria-current="i === cur ? 'true' : 'false'"
        :aria-label="`第 ${i + 1} 張：${l}`"
        :data-test="`dot-${i}`"
        @click="go(i)"
      />
    </div>
    <!-- sa-3-s2.md W7：開源台北通殼只有固定假帳號，比賽版本一律標示 -->
    <p class="acct-note" data-test="acct-note">年齡、戶籍為示範帳號資料（模擬台北通帳號帶入）</p>
  </div>
</template>
