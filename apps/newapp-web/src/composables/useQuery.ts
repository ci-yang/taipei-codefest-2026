import { computed, readonly, ref, type Ref } from 'vue';
import {
  SubsidyListSchema,
  type AgeBand,
  type AnswerIdentity,
  type Answers,
  type IncomeBracket,
  type SubsidyList,
} from '@app/shared';
import { apiGet } from '@/lib/api';
import { demoAnswers, emptyAnswers, toggleIdentity, validateAnswers } from '@/lib/answers';
import {
  findNoMatch,
  groupResults,
  isCompleted,
  type GroupedResults,
  type NoMatchResult,
} from '@/lib/match';
import { readCachedList, writeCachedList } from '@/lib/subsidyCache';
import { requestUserInfo } from '@/lib/townpass';
import { EMPTY_PREFILL, prefillFrom, type Prefill } from '@/lib/userinfo';

/** [SUBS-R10] 請求完成前 notLoaded；成功 fresh；失敗有上次清單 cached，沒有 unavailable */
export type ListState = 'notLoaded' | 'fresh' | 'cached' | 'unavailable';
export type AnswersState = 'empty' | 'inProgress' | 'completed';
/** [SUBS-R25] 結果頁閱讀模式：carousel 輪播（預設，只放可能符合）、list 清單（兩組） */
export type ResultView = 'carousel' | 'list';
/** [SUBS-R25] 資料類型篩選，只改顯示 */
export type KindFilter = 'all' | 'open' | 'mock';

/**
 * [SUBS-R21] 查詢答案只放在這個模組的記憶體 ref：
 * 不寫 localStorage、sessionStorage、cookie，也不放進任何請求。頁面關閉即消失。
 * 用模組層級狀態，讓首頁表單、結果頁、我的珍藏與詳細資訊彈窗共用同一份答案。
 */
const answers = ref<Answers>(emptyAnswers());
const list = ref<SubsidyList | null>(null);
const listState = ref<ListState>('notLoaded');
/**
 * 作答旗標（sa-2-overview.md 0.3）：`touched` 市民動過表單任一題；`submitted` 送出成功（或示範情境）且之後沒改過。
 * 台北通帳號帶入不設 touched。只在記憶體（SUBS-R21）。
 */
const touched = ref(false);
const submitted = ref(false);
/**
 * [SUBS-R24][SUBS-R25] 台北通帳號帶入值、閱讀模式、篩選、搜尋關鍵字：只在這個模組的記憶體，
 * 不寫任何儲存、不放進任何請求；開關詳細資訊彈窗保留，重新進入服務（重載）即回預設。
 */
const prefill = ref<Prefill>({ ...EMPTY_PREFILL });
const resultView = ref<ResultView>('carousel');
const kindFilter = ref<KindFilter>('all');
const searchQuery = ref('');
/**
 * [SUBS-R24] 目前這份 Answers 建立時帶入的台北通值（原型 answers.tp）：欄位仍等於它時畫面標「台北通帶入」。
 * 示範情境的答案不是帶入的，設為 null（不標）。
 */
const prefilledFrom = ref<Pick<Prefill, 'ageBand' | 'residency'> | null>(null);
let prefillRequested = false;

/** 由作答旗標推得，不另存（sa-2-overview.md 0.3） */
const answersState = computed<AnswersState>(() => {
  if (submitted.value) return 'completed';
  return touched.value ? 'inProgress' : 'empty';
});

/** 送出成功後才有結果；之後改任一題（submitted 變假）就沒有，等再送出 */
const results = computed<GroupedResults | null>(() => {
  const a = answers.value;
  if (!submitted.value || !list.value || !isCompleted(a)) return null;
  return groupResults(list.value.items, a);
});

/** [SUBS-R19] 送出後可能符合為 0 項時才有值 */
const noMatch = computed<NoMatchResult | null>(() => (results.value ? findNoMatch(results.value) : null));

/** [SUBS-R22] 只有 fresh、cached 能送出與用示範情境；notLoaded、unavailable 時表單整張停用 */
const canStart = computed(() => listState.value === 'fresh' || listState.value === 'cached');
/** [SUBS-R10] cached、unavailable 時首頁顯示重試 */
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

/** 市民改了任一題：填寫中，之前的送出失效（結果要再送出才更新） */
function edit(next: Answers): void {
  answers.value = next;
  touched.value = true;
  submitted.value = false;
}
/** 年齡區間單選（ADR-030） */
function setAgeBand(ageBand: AgeBand | null): void {
  edit({ ...answers.value, ageBand });
}
function setResidency(residency: boolean | null): void {
  edit({ ...answers.value, residency });
}
/** [SUBS-R12] */
function toggle(id: AnswerIdentity): void {
  edit({ ...answers.value, identities: toggleIdentity(answers.value.identities, id) });
}
function setIncomeBracket(incomeBracket: IncomeBracket | null): void {
  edit({ ...answers.value, incomeBracket });
}

/** [SUBS-R24] 新的 Answers：年齡區間、設籍先取 prefill（null 就不帶入），其餘未填 */
function answersWithPrefill(): Answers {
  prefilledFrom.value = { ageBand: prefill.value.ageBand, residency: prefill.value.residency };
  return { ...emptyAnswers(), ageBand: prefill.value.ageBand, residency: prefill.value.residency };
}

/**
 * [SUBS-R24] 進入服務時讀一次台北通帳號（逾時 3 秒在 townpass.ts）。只取 birthday（換成年齡區間）、addresses[0].city、town 算 prefill；
 * 帳號物件本身不保留。帳號回來時市民還沒動過表單，就立刻把年齡區間與設籍帶進目前的 Answers（帶入不算作答）。
 * 重複呼叫不再讀。
 */
async function loadPrefill(today: Date = new Date()): Promise<void> {
  if (prefillRequested) return;
  prefillRequested = true;
  const account = await requestUserInfo();
  prefill.value = prefillFrom(account, today);
  if (!touched.value && !submitted.value) answers.value = answersWithPrefill();
}

/**
 * [SUBS-R11] 送出：一次驗四題，回四個位置的錯誤訊息（null＝該題沒問題）。
 * 全部通過且清單可用時為已完成（submitted）；有錯或清單不能用時不比對。
 */
function submit(): Array<string | null> {
  const errors = validateAnswers(answers.value);
  if (canStart.value && errors.every((e) => e === null)) {
    touched.value = true;
    submitted.value = true;
  }
  return errors;
}

/**
 * [SUBS-R20][SUBS-R27] 重新查詢、清除填寫答案共用：Answers 重設為未填，依 SUBS-R24 立刻帶入台北通帳號值；
 * 作答旗標都設假。補助清單與收藏不動；要不要導頁由頁面決定。
 */
function startOver(): void {
  answers.value = answersWithPrefill();
  touched.value = false;
  submitted.value = false;
}

/** [SUBS-R23] 一鍵帶入示範情境，答案直接成為已完成（等同送出）、結果立即算好 */
function applyDemo(index: number): void {
  answers.value = demoAnswers(index);
  prefilledFrom.value = null;
  touched.value = true;
  submitted.value = canStart.value;
}

/** [SUBS-R25] */
function setResultView(v: ResultView): void {
  resultView.value = v;
}
/** [SUBS-R25] 只改顯示，不改 results、計數與 noMatch */
function setKindFilter(k: KindFilter): void {
  kindFilter.value = k;
}
/** [SUBS-R25] 搜尋關鍵字只改顯示；關閉搜尋或離開頁面時清空 */
function setSearchQuery(text: string): void {
  searchQuery.value = text;
}

export interface UseQuery {
  answers: Readonly<Ref<Answers>>;
  answersState: Readonly<Ref<AnswersState>>;
  list: Readonly<Ref<SubsidyList | null>>;
  listState: Readonly<Ref<ListState>>;
  results: Readonly<Ref<GroupedResults | null>>;
  noMatch: Readonly<Ref<NoMatchResult | null>>;
  canStart: Readonly<Ref<boolean>>;
  canRetry: Readonly<Ref<boolean>>;
  prefill: Readonly<Ref<Prefill>>;
  prefilledFrom: Readonly<Ref<Pick<Prefill, 'ageBand' | 'residency'> | null>>;
  resultView: Readonly<Ref<ResultView>>;
  kindFilter: Readonly<Ref<KindFilter>>;
  searchQuery: Readonly<Ref<string>>;
  loadList(): Promise<void>;
  loadPrefill(today?: Date): Promise<void>;
  /** [SUBS-R10] 重試＝再取一次清單 */
  retryList(): Promise<void>;
  setAgeBand(ageBand: AgeBand | null): void;
  setResidency(residency: boolean | null): void;
  toggleIdentity(id: AnswerIdentity): void;
  setIncomeBracket(incomeBracket: IncomeBracket | null): void;
  submit(): Array<string | null>;
  startOver(): void;
  applyDemo(index: number): void;
  setResultView(v: ResultView): void;
  setKindFilter(k: KindFilter): void;
  setSearchQuery(text: string): void;
}

export function useQuery(): UseQuery {
  return {
    answers: readonly(answers) as Readonly<Ref<Answers>>,
    answersState,
    list: readonly(list) as Readonly<Ref<SubsidyList | null>>,
    listState: readonly(listState),
    results,
    noMatch,
    canStart,
    canRetry,
    prefill: readonly(prefill) as Readonly<Ref<Prefill>>,
    prefilledFrom: readonly(prefilledFrom) as Readonly<Ref<Pick<Prefill, 'ageBand' | 'residency'> | null>>,
    resultView: readonly(resultView),
    kindFilter: readonly(kindFilter),
    searchQuery: readonly(searchQuery),
    loadList,
    loadPrefill,
    retryList: loadList,
    setAgeBand,
    setResidency,
    toggleIdentity: toggle,
    setIncomeBracket,
    submit,
    startOver,
    applyDemo,
    setResultView,
    setKindFilter,
    setSearchQuery,
  };
}
