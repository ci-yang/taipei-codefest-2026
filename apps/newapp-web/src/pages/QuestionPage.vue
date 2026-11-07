<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  ANSWER_IDENTITIES,
  INCOME_BRACKETS,
  INCOME_HINT,
  INCOME_UNKNOWN,
  INCOME_UNKNOWN_LABEL,
  type AnswerIdentity,
  type IncomeBracket,
} from '@app/shared';
import { useQuery } from '@/composables/useQuery';
import { MSG_AGE, parseAgeInput, validateStep } from '@/lib/answers';
import { MSG_CLEARED, showToast } from '@/composables/useToast';

const TOTAL = 4;
const router = useRouter();
const q = useQuery();

/** 目前第幾題（0～3）存在 useQuery：回首頁再「繼續作答」回到原題；開始查詢、修改答案由呼叫端先設成第 1 題 */
const step = computed(() => q.currentQuestion.value);
const error = ref('');
/** 年齡欄位的原始輸入；按下一題才驗證並寫入答案（SUBS-R11） */
const ageInput = ref(q.answers.value.age === null ? '' : String(q.answers.value.age));
// 答案的年齡被外部改掉（清除填寫答案回填台北通值）時，欄位跟著換
watch(
  () => q.answers.value.age,
  (age) => {
    ageInput.value = age === null ? '' : String(age);
  },
);

const incomeOptions: Array<{ value: IncomeBracket; label: string }> = [
  ...INCOME_BRACKETS.map((b) => ({ value: b.value as IncomeBracket, label: b.label })),
  { value: INCOME_UNKNOWN as IncomeBracket, label: INCOME_UNKNOWN_LABEL },
];

const answers = computed(() => q.answers.value);

function pickResidency(v: boolean): void {
  q.setResidency(v);
  error.value = '';
}
/** [SUBS-R12] 以上皆無與其他身分互斥（邏輯在 answers.ts） */
function pickIdentity(id: AnswerIdentity): void {
  q.toggleIdentity(id);
  error.value = '';
}
function pickIncome(v: IncomeBracket): void {
  q.setIncomeBracket(v);
  error.value = '';
}

/** [SUBS-R11] 不過就停在該題並顯示提示；第 4 題過了到結果頁 */
function next(): void {
  if (step.value === 0) {
    const age = parseAgeInput(ageInput.value);
    if (age === null) {
      error.value = MSG_AGE;
      return;
    }
    q.setAge(age);
  }
  const msg = validateStep(step.value, q.answers.value);
  if (msg) {
    error.value = msg;
    return;
  }
  error.value = '';
  if (step.value < TOTAL - 1) {
    q.setQuestion(step.value + 1);
    return;
  }
  void router.push({ name: 'result' });
}

/** [SUBS-R20] 清除填寫答案：回第 1 題，年齡與設籍回填台北通帳號值，其餘清空；留在問答頁 */
function clearAnswers(): void {
  q.resetAnswers();
  ageInput.value = q.answers.value.age === null ? '' : String(q.answers.value.age);
  error.value = '';
  showToast(MSG_CLEARED);
}

function prev(): void {
  if (step.value === 0) return;
  error.value = '';
  q.setQuestion(step.value - 1);
}
</script>

<template>
  <section class="page" data-test="page-question">
    <div class="progress" aria-hidden="true">
      <span v-for="i in TOTAL" :key="i" :class="{ on: i - 1 <= step }" />
    </div>
    <p class="q-step" data-test="q-step">第 {{ step + 1 }} 題，共 {{ TOTAL }} 題</p>

    <div class="q-body">
      <template v-if="step === 0">
        <h2><label for="in-age">你幾歲？</label></h2>
        <input
          id="in-age"
          v-model="ageInput"
          class="num"
          data-test="in-age"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="例如 35"
          @keydown.enter.prevent="next"
          @input="error = ''"
        />
      </template>

      <template v-else-if="step === 1">
        <h2>你的戶籍在臺北市嗎？</h2>
        <label
          v-for="opt in [{ v: true, t: '是' }, { v: false, t: '否' }]"
          :key="opt.t"
          class="opt"
          :class="{ on: answers.residency === opt.v }"
        >
          <input
            type="radio"
            name="residency"
            :checked="answers.residency === opt.v"
            :data-test="`res-${opt.v}`"
            @change="pickResidency(opt.v)"
          />
          {{ opt.t }}
        </label>
      </template>

      <template v-else-if="step === 2">
        <h2>你具有下列哪些身分？</h2>
        <p class="muted">可複選；65 歲以上不用另外勾，會用年齡判斷。</p>
        <label
          v-for="opt in ANSWER_IDENTITIES"
          :key="opt.value"
          class="opt"
          :class="{ on: answers.identities.includes(opt.value) }"
        >
          <input
            type="checkbox"
            :checked="answers.identities.includes(opt.value)"
            :data-test="`id-${opt.value}`"
            @change="pickIdentity(opt.value)"
          />
          {{ opt.label }}
        </label>
      </template>

      <template v-else>
        <h2>家中每人每月收入大約多少？</h2>
        <p class="muted">{{ INCOME_HINT }}。</p>
        <label
          v-for="opt in incomeOptions"
          :key="opt.value"
          class="opt"
          :class="{ on: answers.incomeBracket === opt.value }"
        >
          <input
            type="radio"
            name="income"
            :checked="answers.incomeBracket === opt.value"
            :data-test="`inc-${opt.value}`"
            @change="pickIncome(opt.value)"
          />
          {{ opt.label }}
        </label>
      </template>
    </div>

    <div class="field-err" role="alert" data-test="q-err">{{ error }}</div>
    <div class="actions">
      <button class="btn" data-test="btn-prev" :disabled="step === 0" @click="prev">上一題</button>
      <button class="btn primary" data-test="btn-next" @click="next">
        {{ step === TOTAL - 1 ? '看結果' : '下一題' }}
      </button>
    </div>
    <button class="btn ghost" data-test="btn-clear" @click="clearAnswers">清除填寫答案</button>
  </section>
</template>
