import {
  AGE_BANDS,
  ANSWER_IDENTITIES,
  INCOME_BRACKETS,
  INCOME_UNKNOWN_LABEL,
  SUBSIDY_IDENTITY_LABELS,
  type Answers,
  type SubsidyItem,
} from '@app/shared';
import { formatYuan, type GroupedResults } from '@/lib/match';
import type { KindFilter } from '@/composables/useQuery';

/** [SUBS-R18] 結果頁與每筆詳細資訊都要顯示的門檻提醒 */
export const THRESHOLD_NOTICE = '門檻以社會局最新公告為準。';

type Row = GroupedResults['eligible'][number];

/** 依序號找結果列（詳細資訊彈窗用） */
export function findRow(grouped: GroupedResults, no: number): Row | null {
  return [...grouped.eligible, ...grouped.ineligible].find((r) => r.item.no === no) ?? null;
}

/** [SUBS-R25] 資料類型篩選只過濾畫面上的卡片；計數與 noMatch 用未過濾的 results */
export function filterKind<T extends { item: SubsidyItem }>(rows: T[], kind: KindFilter): T[] {
  return kind === 'all' ? rows : rows.filter((r) => r.item.kind === kind);
}

/** 資料類型標籤文字（spec 7.4：模擬資料標籤為「模擬資料」；ADR-035：官方網頁整理） */
export const KIND_LABELS: Record<SubsidyItem['kind'], string> = {
  open: '開放資料',
  curated: '官方網頁整理',
  mock: '模擬資料',
};
export function kindLabel(item: SubsidyItem): string {
  return KIND_LABELS[item.kind];
}

/** 詳細資訊彈窗次鈕「查看開放資料來源」（sa-3-s2.md W11） */
export const DATASET_URL = 'https://data.gov.tw/dataset/129839';

/** [SUBS-R29] 大卡機關名第一段是條文片段或空白時改顯示的機關 */
export const AGENCY_FALLBACK = '臺北市政府社會局';

/**
 * [SUBS-R29] 輪播大卡機關名：`office` 取第一段（遇「。」「；」「;」或空白截斷）；
 * 第一段為空、以編號（「1.」「1、」「1．」）或「依」開頭時顯示「臺北市政府社會局」。彈窗一律顯示原文。
 */
export function agencyShort(office: string): string {
  const first = String(office ?? '').trim().split(/[。；;\s]/)[0] ?? '';
  return !first || /^(\d+\s*[.、．]|依)/.test(first) ? AGENCY_FALLBACK : first;
}

/** 年齡條件（沒有限制寫「不限」） */
export function ageLimitText(item: SubsidyItem): string {
  if (item.ageMin !== null && item.ageMax !== null) return `${item.ageMin}～${item.ageMax} 歲`;
  if (item.ageMin !== null) return `${item.ageMin} 歲以上`;
  if (item.ageMax !== null) return `${item.ageMax} 歲以下`;
  return '不限';
}

/** 身分條件（沒有限制寫「不限」） */
export function identityLimitText(item: SubsidyItem): string {
  return item.identities.length ? item.identities.map((id) => SUBSIDY_IDENTITY_LABELS[id]).join('、') : '不限';
}

/** 收入上限（每人每月；沒有限制寫「不限」） */
export function incomeLimitText(item: SubsidyItem): string {
  return item.incomeMax !== null ? `${formatYuan(item.incomeMax)} 元` : '不限';
}

/** [W9] 輪播大卡三點重點：身分、年齡、收入上限 */
export function bigCardPoints(item: SubsidyItem): [string, string, string] {
  return [
    item.identities.length ? identityLimitText(item) : '不限身分',
    ageLimitText(item) === '不限' ? '不限年齡' : ageLimitText(item),
    item.incomeMax !== null ? `上限 ${formatYuan(item.incomeMax)} 元 / 月` : '不限收入',
  ];
}

/** [W9] 輪播大卡說明：判定原因加還需確認的條數 */
export function bigCardDesc(result: { reason: string; toVerify: string[] }): string {
  const n = result.toVerify.length;
  return `${result.reason}${n ? `；另有 ${n} 項條件要再確認。` : '。'}`;
}

/** [SUBS-R25] 搜尋：補助名稱包含關鍵字（前後空白不算）；空關鍵字全部通過 */
export function matchesSearch(name: string, query: string): boolean {
  const q = query.trim();
  return q === '' || name.includes(q);
}

/** [SUBS-R25] 依名稱搜尋過濾畫面上的列；不改結果與計數 */
export function filterSearch<T extends { item: SubsidyItem }>(rows: T[], query: string): T[] {
  return rows.filter((r) => matchesSearch(r.item.name, query));
}

/** 搜尋提示「名稱含「關鍵字」：N 項」 */
export function searchNoteText(query: string, n: number): string {
  return `名稱含「${query.trim()}」：${n} 項`;
}

/** 撥打 1999 只給聯繫方式含 1999 的真實資料項目（開放、官方網頁整理；spec 7.10、sa-3-s2.md W11） */
export const CITY_HOTLINE = '1999';
export function canCall1999(item: SubsidyItem): boolean {
  return item.kind !== 'mock' && item.contact.includes(CITY_HOTLINE);
}

/** 更新時間顯示成日期（updatedAt 格式 YYYY-MM-DDTHH:mm:ss+08:00，SUBS-R08）；格式不對時原樣回 */
export function formatUpdatedAt(updatedAt: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(updatedAt);
  return m ? m[1]! : updatedAt;
}

/** 網址去掉 https:// 給畫面顯示（原型資料來源頁 data.gov.tw/dataset/129839） */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

const IDENTITY_TEXT: Record<string, string> = Object.fromEntries(
  ANSWER_IDENTITIES.map((o) => [o.value, o.value === 'none' ? '無特殊身分' : o.label]),
);

export function identitiesText(ids: Answers['identities']): string {
  return ids.map((id) => IDENTITY_TEXT[id] ?? id).join('、');
}

export function incomeText(bracket: Answers['incomeBracket']): string | null {
  if (bracket === null) return null;
  return INCOME_BRACKETS.find((b) => b.value === bracket)?.label ?? INCOME_UNKNOWN_LABEL;
}

/** 結果頁「你的答案」一行（文字照原型） */
export function answerSummary(a: Answers): string {
  if (a.ageBand === null || a.residency === null || a.incomeBracket === null) return '';
  const band = AGE_BANDS.find((b) => b.value === a.ageBand)?.label ?? a.ageBand;
  return `你的答案：${band}・${a.residency ? '設籍臺北市' : '未設籍臺北市'}・${identitiesText(a.identities)}・每人月收入 ${incomeText(a.incomeBracket)}`;
}
