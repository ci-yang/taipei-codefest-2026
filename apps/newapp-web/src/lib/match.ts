import {
  AGE_BANDS,
  ELDER_BAND,
  INCOME_BRACKETS,
  INCOME_UNKNOWN,
  SUBSIDY_IDENTITY_LABELS,
  type AgeBand,
  type Answers,
  type IncomeBracket,
  type SubsidyIdentity,
  type SubsidyItem,
} from '@app/shared';

/** 四題都答完的答案（由 isCompleted 收窄） */
export interface CompletedAnswers {
  ageBand: AgeBand;
  residency: boolean;
  identities: Answers['identities'];
  incomeBracket: IncomeBracket;
}

export interface MatchResult {
  no: number;
  ok: boolean;
  reason: string;
  /** 白話不過原因，依年齡、設籍、身分、收入順序 */
  failures: string[];
  /** SubsidyItem.toVerify 加上年齡區間跨門檻、收入選不清楚時各一條（排在最前面） */
  toVerify: string[];
}

export const REASON_ALL_OK = '年齡、設籍、身分、收入都在條件內';
export const REASON_INCOME_UNKNOWN = '其他條件都在範圍內，收入要再確認';
export const REASON_AGE_CHECK = '其他條件都在範圍內，年齡要再確認';
export const REASON_AGE_INCOME_CHECK = '其他條件都在範圍內，年齡與收入要再確認';
export const REASON_HAS_STATUS = '已具此身分，可洽區公所確認扶助內容';
export const REASON_INCOME_MAY_EXCEED = '收入可能超過上限';

/** 金額千分位（不依賴執行環境 locale） */
export function formatYuan(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 一律用 `=== null` 判斷，收入不清楚（0）也算有值 */
export function isCompleted(a: Answers): a is Answers & CompletedAnswers {
  return a.ageBand !== null && a.residency !== null && a.identities.length > 0 && a.incomeBracket !== null;
}

/** 年齡區間涵蓋的歲數上下界（ADR-030） */
export function bandRange(band: AgeBand): { min: number; max: number } {
  const b = AGE_BANDS.find((x) => x.value === band);
  if (!b) throw new Error(`未知的年齡區間：${band}`);
  return { min: b.min, max: b.max };
}

/** [SUBS-R15] 答案身分去掉 none，選 65歲以上時加上 elder */
export function effectiveIdentities(a: CompletedAnswers): Set<SubsidyIdentity> {
  const have = new Set<SubsidyIdentity>();
  for (const id of a.identities) if (id !== 'none' && id !== 'stu') have.add(id);
  if (a.ageBand === ELDER_BAND) have.add('elder');
  return have;
}

/** 單項比對（SUBS-R13～R17） */
export function matchItem(item: SubsidyItem, a: CompletedAnswers): MatchResult {
  const failures: string[] = [];
  const toVerify = [...item.toVerify];

  // [SUBS-R13] 年齡用區間上下界比：完全在限制外不過；跨門檻不算不過，還需確認最前面加一條（ADR-030）
  const band = bandRange(a.ageBand);
  let ageCheck = false;
  if (item.ageMin !== null) {
    if (band.max < item.ageMin) failures.push(`需 ${item.ageMin} 歲以上`);
    else if (band.min < item.ageMin) {
      toVerify.unshift(`年齡：需 ${item.ageMin} 歲以上，你選的區間跨過門檻`);
      ageCheck = true;
    }
  }
  if (item.ageMax !== null) {
    if (band.min > item.ageMax) failures.push(`需 ${item.ageMax} 歲以下`);
    else if (band.max > item.ageMax) {
      toVerify.unshift(`年齡：需 ${item.ageMax} 歲以下，你選的區間跨過門檻`);
      ageCheck = true;
    }
  }

  // [SUBS-R14] 需設籍而答否
  if (item.residency && a.residency === false) failures.push('需設籍臺北市');

  // [SUBS-R15] 有身分條件且不是申請取得身分的項目，至少命中一個
  const have = effectiveIdentities(a);
  const hasItemIdentity = item.identities.some((id) => have.has(id));
  if (!item.appliesForStatus && item.identities.length > 0 && !hasItemIdentity) {
    failures.push(`需具${item.identities.map((id) => SUBSIDY_IDENTITY_LABELS[id]).join('或')}身分`);
  }

  // [SUBS-R16] 收入：null 直接過；不清楚不判改列還需確認；下界超過不過；跨上限不過
  const incomeUnknown = a.incomeBracket === INCOME_UNKNOWN;
  if (item.incomeMax !== null) {
    const limit = `每人每月收入需在 ${formatYuan(item.incomeMax)} 元以下`;
    if (incomeUnknown) {
      toVerify.unshift(`${limit}（你選了不清楚）`);
    } else {
      const bracket = INCOME_BRACKETS.find((b) => b.value === a.incomeBracket);
      if (!bracket) throw new Error(`未知的收入級距：${a.incomeBracket}`);
      if (bracket.min > item.incomeMax) failures.push(limit);
      else if (bracket.max === null || bracket.max > item.incomeMax) failures.push(REASON_INCOME_MAY_EXCEED);
    }
  }

  // [SUBS-R17] 原因
  let reason: string;
  if (failures.length > 0) reason = failures[0]!;
  else if (item.appliesForStatus && hasItemIdentity) reason = REASON_HAS_STATUS;
  else if (ageCheck && incomeUnknown && item.incomeMax !== null) reason = REASON_AGE_INCOME_CHECK;
  else if (ageCheck) reason = REASON_AGE_CHECK;
  else if (incomeUnknown && item.incomeMax !== null) reason = REASON_INCOME_UNKNOWN;
  else reason = REASON_ALL_OK;

  return { no: item.no, ok: failures.length === 0, reason, failures, toVerify };
}

/** [SUBS-R72] 每個參與比對的 SubsidyItem 恰有一個 MatchResult（台北服務通不比對，SUBS-R75） */
export function matchAll(items: SubsidyItem[], a: CompletedAnswers): MatchResult[] {
  return items.map((item) => matchItem(item, a));
}

export interface GroupedResults {
  eligible: Array<{ item: SubsidyItem; result: MatchResult }>;
  ineligible: Array<{ item: SubsidyItem; result: MatchResult }>;
  /** [SUBS-R75] 未補條件的台北服務通：資料集沒有資格欄位，不比對、不進兩組，依序號（補好的照常比對，SUBS-R77） */
  catalog: SubsidyItem[];
}

/** [SUBS-R75] 台北服務通項目不依四題比對（ADR-036）；已補資格條件（enriched）的照常比對（SUBS-R77，ADR-037） */
export function isUnmatched(item: SubsidyItem): boolean {
  return item.kind === 'catalog' && item.enriched !== true;
}

/**
 * [SUBS-R18] 排序級別（ADR-035、ADR-036、ADR-037）：開放資料、官方網頁整理與補好條件的台北服務通同一級（0），
 * 模擬資料排後（1），未補條件的台北服務通最後（2）。比對本身不看 kind，一律照四題；只有未補條件的台北服務通不比對（SUBS-R75）。
 */
export function kindRank(item: SubsidyItem): number {
  if (item.kind === 'catalog') return item.enriched === true ? 0 : 2;
  return item.kind === 'mock' ? 1 : 0;
}

/**
 * [SUBS-R18] 分可能符合與不符合兩組，組內真實資料（開放、官方網頁整理）在前、模擬在後，同級依序號；
 * [SUBS-R75] 台北服務通另放 catalog，不比對。
 */
export function groupResults(items: SubsidyItem[], a: CompletedAnswers): GroupedResults {
  const rows = items.filter((item) => !isUnmatched(item)).map((item) => ({ item, result: matchItem(item, a) }));
  rows.sort((x, y) => kindRank(x.item) - kindRank(y.item) || x.item.no - y.item.no);
  return {
    eligible: rows.filter((r) => r.result.ok),
    ineligible: rows.filter((r) => !r.result.ok),
    catalog: items.filter(isUnmatched).sort((x, y) => x.no - y.no),
  };
}

/** [SUBS-R19] 無符合時的聯繫對象（ADR-009，固定文案常數；網址取自資料集序號 7 的聯繫方式） */
export const SOCIAL_WELFARE_CENTER = {
  name: '臺北市各區社會福利服務中心',
  url: 'https://dosw.gov.taipei/News_Content.aspx?n=17C64AC7DE8F40A9&s=6D266CB98FB2DEC9',
} as const;

/** 無符合結果列出的最接近項數 */
export const CLOSEST_COUNT = 3;

export interface NoMatchResult {
  /** 真實資料（開放、官方網頁整理）中不過條件數最少的 3 項，同數依序號；firstFailure 是第一條不過的條件 */
  closest: Array<{ item: SubsidyItem; result: MatchResult; firstFailure: string }>;
  center: typeof SOCIAL_WELFARE_CENTER;
}

/**
 * [SUBS-R19] 可能符合（含模擬項目）為 0 項時回無符合結果，否則回 null。
 * 最接近只取真實資料（開放、官方網頁整理）；模擬類別照常留在 grouped.ineligible，由畫面列在不符合組。
 */
export function findNoMatch(grouped: GroupedResults): NoMatchResult | null {
  if (grouped.eligible.length > 0) return null;
  const closest = grouped.ineligible
    .filter((r) => r.item.kind !== 'mock')
    .sort((x, y) => x.result.failures.length - y.result.failures.length || x.item.no - y.item.no)
    .slice(0, CLOSEST_COUNT)
    .map((r) => ({ ...r, firstFailure: r.result.failures[0] ?? r.result.reason }));
  return { closest, center: SOCIAL_WELFARE_CENTER };
}
