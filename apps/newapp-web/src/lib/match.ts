import {
  ELDER_AGE,
  INCOME_BRACKETS,
  INCOME_UNKNOWN,
  SUBSIDY_IDENTITY_LABELS,
  type Answers,
  type IncomeBracket,
  type SubsidyIdentity,
  type SubsidyItem,
} from '@app/shared';

/** 四題都答完的答案（由 isCompleted 收窄） */
export interface CompletedAnswers {
  age: number;
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
  /** SubsidyItem.toVerify 加上收入選不清楚時的一條 */
  toVerify: string[];
}

export const REASON_ALL_OK = '年齡、設籍、身分、收入都在條件內';
export const REASON_INCOME_UNKNOWN = '其他條件都在範圍內，收入要再確認';
export const REASON_HAS_STATUS = '已具此身分，可洽區公所確認扶助內容';
export const REASON_INCOME_MAY_EXCEED = '收入可能超過上限';

/** 金額千分位（不依賴執行環境 locale） */
export function formatYuan(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 一律用 `=== null` 判斷，0 歲與收入不清楚（0）都算有值 */
export function isCompleted(a: Answers): a is Answers & CompletedAnswers {
  return a.age !== null && a.residency !== null && a.identities.length > 0 && a.incomeBracket !== null;
}

/** [SUBS-R15] 答案身分去掉 none，加上年齡推得的 elder */
export function effectiveIdentities(a: CompletedAnswers): Set<SubsidyIdentity> {
  const have = new Set<SubsidyIdentity>();
  for (const id of a.identities) if (id !== 'none' && id !== 'stu') have.add(id);
  if (a.age >= ELDER_AGE) have.add('elder');
  return have;
}

/** 單項比對（SUBS-R13～R17） */
export function matchItem(item: SubsidyItem, a: CompletedAnswers): MatchResult {
  const failures: string[] = [];
  const toVerify = [...item.toVerify];

  // [SUBS-R13] 年齡含上下限
  if (item.ageMin !== null && a.age < item.ageMin) failures.push(`需 ${item.ageMin} 歲以上`);
  if (item.ageMax !== null && a.age > item.ageMax) failures.push(`需 ${item.ageMax} 歲以下`);

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
  else if (incomeUnknown && item.incomeMax !== null) reason = REASON_INCOME_UNKNOWN;
  else reason = REASON_ALL_OK;

  return { no: item.no, ok: failures.length === 0, reason, failures, toVerify };
}

/** [SUBS-R72] 每個 SubsidyItem 恰有一個 MatchResult */
export function matchAll(items: SubsidyItem[], a: CompletedAnswers): MatchResult[] {
  return items.map((item) => matchItem(item, a));
}

export interface GroupedResults {
  eligible: Array<{ item: SubsidyItem; result: MatchResult }>;
  ineligible: Array<{ item: SubsidyItem; result: MatchResult }>;
}

/** [SUBS-R18] 分可能符合與不符合兩組，組內開放資料在前、模擬在後，同類依序號 */
export function groupResults(items: SubsidyItem[], a: CompletedAnswers): GroupedResults {
  const rows = items.map((item) => ({ item, result: matchItem(item, a) }));
  rows.sort((x, y) =>
    x.item.kind === y.item.kind ? x.item.no - y.item.no : x.item.kind === 'open' ? -1 : 1,
  );
  return {
    eligible: rows.filter((r) => r.result.ok),
    ineligible: rows.filter((r) => !r.result.ok),
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
  /** 開放資料中不過條件數最少的 3 項，同數依序號；firstFailure 是第一條不過的條件 */
  closest: Array<{ item: SubsidyItem; result: MatchResult; firstFailure: string }>;
  center: typeof SOCIAL_WELFARE_CENTER;
}

/**
 * [SUBS-R19] 可能符合（含模擬項目）為 0 項時回無符合結果，否則回 null。
 * 最接近只取開放資料；模擬類別照常留在 grouped.ineligible，由畫面列在不符合組。
 */
export function findNoMatch(grouped: GroupedResults): NoMatchResult | null {
  if (grouped.eligible.length > 0) return null;
  const closest = grouped.ineligible
    .filter((r) => r.item.kind === 'open')
    .sort((x, y) => x.result.failures.length - y.result.failures.length || x.item.no - y.item.no)
    .slice(0, CLOSEST_COUNT)
    .map((r) => ({ ...r, firstFailure: r.result.failures[0] ?? r.result.reason }));
  return { closest, center: SOCIAL_WELFARE_CENTER };
}
