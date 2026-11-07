<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import IntroHand from '@/components/IntroHand.vue';
import MyInfoCarousel from '@/components/MyInfoCarousel.vue';
import { useQuery } from '@/composables/useQuery';
import { DEMO_SCENARIOS } from '@/lib/answers';
import { formatUpdatedAt } from '@/lib/resultView';
import { consumeIntro, INTRO_MS } from '@/lib/intro';
import { MSG_CLEARED, showToast } from '@/composables/useToast';

const router = useRouter();
const q = useQuery();
const { listState, canStart, canRetry, answersState } = q;

/** 開始查詢：新的一輪作答，年齡與設籍先帶入台北通帳號值，從第 1 題開始（SUBS-R24，原型 startQuery） */
function start(): void {
  q.startQuery(0);
  void router.push({ name: 'question' });
}
/** 繼續作答：回到上次停的題（題號在 useQuery，原型 continueQuery） */
function resume(): void {
  void router.push({ name: 'question' });
}
function viewResult(): void {
  void router.push({ name: 'result' });
}
/** [SUBS-R27] 重新查詢：清除答案後留在開始頁，回到未填；不立即帶入台北通帳號值（原型 requery） */
function requery(): void {
  q.startOver();
  showToast(MSG_CLEARED);
}
/** [SUBS-R26] 點卡片跳題：未填時建立帶入 prefill 的新答案；填寫中或已完成保留答案。清單不能用時不給進問答頁（SUBS-R22） */
function editField(step: number): void {
  if (!canStart.value) return;
  q.startQuery(step);
  void router.push({ name: 'question' });
}
/** [SUBS-R23] 示範情境一鍵帶入並直接看結果 */
function useDemo(i: number): void {
  q.applyDemo(i);
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

const DEMO_ICON = ['mint', 'accent', 'light'] as const;
const demoAge = (i: number) => DEMO_SCENARIOS[i]!.answers.age;

/**
 * [W6] 入場動畫：每次進入服務只在開始頁播一次（spec 7.9）；減少動態效果時手與皺摺都不掛（CSS 也擋）。
 * 不阻塞清單載入（清單在 App.vue 進入時就取）；播放中按鈕都能按（手 pointer-events: none）。
 */
const pulled = ref(consumeIntro());
let introTimer: ReturnType<typeof setTimeout> | null = null;
onMounted(() => {
  if (pulled.value) introTimer = setTimeout(() => (pulled.value = false), INTRO_MS);
});
onBeforeUnmount(() => {
  if (introTimer) clearTimeout(introTimer);
});
</script>

<template>
  <section class="page" :class="{ pulled }" data-test="page-start">
    <!-- 手要相對畫面固定：.pulled 的 transform 會讓 fixed 改成相對本頁，所以掛到 body（原型 #intro-hand 也在 body 層） -->
    <Teleport to="body"><IntroHand v-if="pulled" /></Teleport>
    <MyInfoCarousel :pulled="pulled" @edit="editField" />
    <div class="hero">
      <div class="chips">
        <span class="pill accent">4 題</span><span class="pill accent">答案不離開手機</span>
      </div>
      <h2>回答四題，看看你<span class="hl">抓得到</span>哪些補助</h2>
      <p class="muted">年齡、是否設籍臺北市、身分、每人月收入。答案只留在這支手機上，不會送出，離開就清除。</p>
      <!-- 大按鈕依查詢答案狀態（spec 7.10、8）：未填＝開始查詢（加示範情境）；填寫中＝繼續作答；已完成＝查看結果；後兩者另有重新查詢 -->
      <template v-if="answersState === 'empty'">
        <!-- [SUBS-R22] 清單可用才給開始；載入中先停用，無法使用時不顯示 -->
        <button
          v-if="listState !== 'unavailable'"
          class="btn primary"
          data-test="btn-start"
          :disabled="!canStart"
          @click="start"
        >
          {{ canStart ? '開始查詢' : '補助資料載入中…' }}
        </button>
      </template>
      <template v-else>
        <button v-if="answersState === 'inProgress'" class="btn primary" data-test="btn-continue" @click="resume">
          繼續作答
        </button>
        <button v-else class="btn primary" data-test="btn-view-result" @click="viewResult">查看結果</button>
        <button class="btn ghost" data-test="btn-requery" @click="requery">重新查詢</button>
      </template>
      <!-- [SUBS-R10] cached、unavailable 時給重試 -->
      <button v-if="canRetry" class="btn" data-test="btn-retry" :disabled="retrying" @click="retry">
        {{ retrying ? '重試中…' : '重試' }}
      </button>
    </div>

    <div v-if="listState === 'cached'" class="banner warn" role="status" data-test="list-cached">
      目前顯示的是上次載入的資料（{{ updatedText }}）。
    </div>
    <div v-else-if="listState === 'unavailable'" class="banner err" role="alert" data-test="list-unavailable">
      暫時無法取得補助資料，請稍後重試。
    </div>

    <!-- [SUBS-R22][SUBS-R23] 未填且清單可用時才有示範情境 -->
    <div v-if="showDemo" data-test="demo-box">
      <p class="group-title">示範情境（一鍵帶入）</p>
      <button
        v-for="(d, i) in DEMO_SCENARIOS"
        :key="d.title"
        class="btn demo"
        :data-test="`demo-${i}`"
        @click="useDemo(i)"
      >
        <span class="ico" :class="DEMO_ICON[i]" aria-hidden="true">{{ demoAge(i) }}</span>
        <span class="txt"><b>{{ d.title }}</b><span class="sub">{{ d.sub }}</span></span>
      </button>
    </div>
    <p class="muted fine">結果只是初步篩選，不代表一定可以領；門檻以社會局最新公告為準。</p>
  </section>
</template>
