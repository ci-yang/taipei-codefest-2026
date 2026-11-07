import { computed, readonly, ref, type Ref } from 'vue';
import {
  SubsidyListSchema,
  type AnswerIdentity,
  type Answers,
  type IncomeBracket,
  type SubsidyList,
} from '@app/shared';
import { apiGet } from '@/lib/api';
import { demoAnswers, emptyAnswers, toggleIdentity } from '@/lib/answers';
import {
  findNoMatch,
  groupResults,
  isCompleted,
  type GroupedResults,
  type NoMatchResult,
} from '@/lib/match';
import { readCachedList, writeCachedList } from '@/lib/subsidyCache';
import { requestUserInfo } from '@/lib/townpass';
import { prefillFrom, type Prefill } from '@/lib/userinfo';

/** [SUBS-R10] 請求完成前 notLoaded；成功 fresh；失敗有上次清單 cached，沒有 unavailable */
export type ListState = 'notLoaded' | 'fresh' | 'cached' | 'unavailable';
export type AnswersState = 'empty' | 'inProgress' | 'completed';
/** [SUBS-R25] 結果頁閱讀模式：grid 大圖卡（預設）、list 小圖清單 */
export type ResultView = 'grid' | 'list';
/** [SUBS-R25] 資料類型篩選，只改顯示 */
export type KindFilter = 'all' | 'open' | 'mock';
/** 我的資料第 5 張卡的文件（原型 DOCS） */
export const DOCS = ['身分證', '戶口名簿', '存摺封面'] as const;

/**
 * [SUBS-R21] 查詢答案只放在這個模組的記憶體 ref：
 * 不寫 localStorage、sessionStorage、cookie，也不放進任何請求。頁面關閉即消失。
 * 用模組層級狀態，讓問答頁與結果頁共用同一份答案。
 */
const answers = ref<Answers>(emptyAnswers());
const list = ref<SubsidyList | null>(null);
const listState = ref<ListState>('notLoaded');
/** 問答頁目前停在第幾題（0～3）；回首頁再「繼續作答」時回到這一題。只在記憶體（SUBS-R21） */
const currentQuestion = ref(0);
export const LAST_STEP = 3;
/**
 * [SUBS-R24][SUBS-R25] 台北通帳號帶入值、閱讀模式、篩選、文件勾選：只在這個模組的記憶體，
 * 不寫任何儲存、不放進任何請求；進出詳細資訊頁保留，重新進入服務（重載）即回預設。
 */
const prefill = ref<Prefill>({ age: null, residency: null });
const resultView = ref<ResultView>('grid');
const kindFilter = ref<KindFilter>('all');
const docsReady = ref<boolean[]>(DOCS.map(() => false));
let prefillRequested = false;

/** 由 Answers 現值推得，不另存；一律 `=== null` 判斷 */
const answersState = computed<AnswersState>(() => {
  const a = answers.value;
  if (a.age === null && a.residency === null && a.identities.length === 0 && a.incomeBracket === null) {
    return 'empty';
  }
  return isCompleted(a) ? 'completed' : 'inProgress';
});

/** 答完且有清單時才有結果；答案一改就重算 */
const results = computed<GroupedResults | null>(() => {
  const a = answers.value;
  if (!list.value || !isCompleted(a)) return null;
  return groupResults(list.value.items, a);
});

/** [SUBS-R19] 答完且可能符合為 0 項時才有值 */
const noMatch = computed<NoMatchResult | null>(() => (results.value ? findNoMatch(results.value) : null));

/** [SUBS-R22] 只有 fresh、cached 能開始與用示範情境 */
const canStart = computed(() => listState.value === 'fresh' || listState.value === 'cached');
/** [SUBS-R10] cached、unavailable 時開始頁顯示重試 */
const canRetry = computed(() => listState.value === 'cached' || listState.value === 'unavailable');

/**
 * [SUBS-R10] 取一次清單（逾時 8 秒在 apiGet）。成功寫入上次清單並為 fresh；
 * 失敗改用上次清單（localStorage，讀不到時用本次記憶體裡已有的清單）為 cached，都沒有為 unavailable。
 * 重試也呼叫這個；重試成功改 fresh 並更新上次清單。只改清單，不動查詢答案（spec 7.8）。
 * [SUBS-R70] 補助清單請求不帶 query 與 body。
 */
async function loadList(): Promise<void> {
  try {
    const fresh = await apiGet('/api/v1/subsidies', SubsidyListSchema);
    list.value = fresh;
    listState.value = 'fresh';
    writeCachedList(fresh);
  } catch (err) {
    console.warn('[useQuery] 取得補助清單失敗：', (err as Error).message);
    const fallback = readCachedList() ?? (canStart.value ? list.value : null);
    list.value = fallback;
    listState.value = fallback ? 'cached' : 'unavailable';
  }
}

function setAge(age: number | null): void {
  answers.value = { ...answers.value, age };
}
function setResidency(residency: boolean | null): void {
  answers.value = { ...answers.value, residency };
}
/** [SUBS-R12] */
function toggle(id: AnswerIdentity): void {
  answers.value = { ...answers.value, identities: toggleIdentity(answers.value.identities, id) };
}
function setIncomeBracket(incomeBracket: IncomeBracket | null): void {
  answers.value = { ...answers.value, incomeBracket };
}
/** [SUBS-R24] 新的 Answers：年齡、設籍先取 prefill（null 就不帶入），其餘未填 */
function answersWithPrefill(): Answers {
  return { ...emptyAnswers(), age: prefill.value.age, residency: prefill.value.residency };
}
/**
 * [SUBS-R24] 進入服務時讀一次台北通帳號（逾時 3 秒在 townpass.ts）。只取 birthday、addresses[0].city 算 prefill；
 * 帳號物件本身不保留。重複呼叫不再讀。
 */
async function loadPrefill(today: Date = new Date()): Promise<void> {
  if (prefillRequested) return;
  prefillRequested = true;
  const account = await requestUserInfo();
  prefill.value = prefillFrom(account, today);
}
/**
 * [SUBS-R20] 清除填寫答案：重設後依 SUBS-R24 回填台北通帳號值、題號回第 1 題，補助清單不動；
 * 開始查詢也用這支（新的一輪作答先帶入）。要不要導頁由頁面決定。
 */
function resetAnswers(): void {
  answers.value = answersWithPrefill();
  currentQuestion.value = 0;
}
/**
 * [SUBS-R24][SUBS-R26] 開始作答並停在第 step 題（點卡片跳題）：未填時先建立帶入 prefill 的新答案；
 * 填寫中或已完成時保留答案，只換題。
 */
function startQuery(step = 0): void {
  if (answersState.value === 'empty') answers.value = answersWithPrefill();
  setQuestion(step);
}
/**
 * [SUBS-R27] 重新查詢：答案重設為未填、題號回第 1 題，留在開始頁；不帶入台北通帳號值（清除填寫答案 resetAnswers 才回填，SUBS-R20）
 */
function startOver(): void {
  answers.value = emptyAnswers();
  currentQuestion.value = 0;
}
/** [SUBS-R25] */
function setResultView(v: ResultView): void {
  resultView.value = v;
}
/** [SUBS-R25] 只改顯示，不改 results、計數與 noMatch */
function setKindFilter(k: KindFilter): void {
  kindFilter.value = k;
}
/** [SUBS-R25] 文件勾選只在記憶體 */
function toggleDoc(index: number): void {
  if (index < 0 || index >= DOCS.length) return;
  docsReady.value = docsReady.value.map((v, i) => (i === index ? !v : v));
}
/** [SUBS-R26] 設定問答頁目前題號（超出 0～3 會夾回範圍） */
function setQuestion(step: number): void {
  currentQuestion.value = Math.min(Math.max(Math.trunc(step), 0), LAST_STEP);
}
/** [SUBS-R23] 一鍵帶入示範情境，答案直接成為已完成、結果立即算好 */
function applyDemo(index: number): void {
  answers.value = demoAnswers(index);
}

export interface UseQuery {
  answers: Readonly<Ref<Answers>>;
  answersState: Readonly<Ref<AnswersState>>;
  list: Readonly<Ref<SubsidyList | null>>;
  listState: Readonly<Ref<ListState>>;
  currentQuestion: Readonly<Ref<number>>;
  results: Readonly<Ref<GroupedResults | null>>;
  noMatch: Readonly<Ref<NoMatchResult | null>>;
  canStart: Readonly<Ref<boolean>>;
  canRetry: Readonly<Ref<boolean>>;
  prefill: Readonly<Ref<Prefill>>;
  resultView: Readonly<Ref<ResultView>>;
  kindFilter: Readonly<Ref<KindFilter>>;
  docsReady: Readonly<Ref<readonly boolean[]>>;
  loadList(): Promise<void>;
  loadPrefill(today?: Date): Promise<void>;
  /** [SUBS-R10] 重試＝再取一次清單 */
  retryList(): Promise<void>;
  setAge(age: number | null): void;
  setResidency(residency: boolean | null): void;
  toggleIdentity(id: AnswerIdentity): void;
  setIncomeBracket(incomeBracket: IncomeBracket | null): void;
  resetAnswers(): void;
  startOver(): void;
  startQuery(step?: number): void;
  setQuestion(step: number): void;
  applyDemo(index: number): void;
  setResultView(v: ResultView): void;
  setKindFilter(k: KindFilter): void;
  toggleDoc(index: number): void;
}

export function useQuery(): UseQuery {
  return {
    answers: readonly(answers) as Readonly<Ref<Answers>>,
    answersState,
    list: readonly(list) as Readonly<Ref<SubsidyList | null>>,
    listState: readonly(listState),
    currentQuestion: readonly(currentQuestion),
    results,
    noMatch,
    canStart,
    canRetry,
    prefill: readonly(prefill) as Readonly<Ref<Prefill>>,
    resultView: readonly(resultView),
    kindFilter: readonly(kindFilter),
    docsReady: readonly(docsReady) as Readonly<Ref<readonly boolean[]>>,
    loadList,
    loadPrefill,
    retryList: loadList,
    setAge,
    setResidency,
    toggleIdentity: toggle,
    setIncomeBracket,
    resetAnswers,
    startOver,
    startQuery,
    setQuestion,
    applyDemo,
    setResultView,
    setKindFilter,
    toggleDoc,
  };
}
