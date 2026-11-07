import {
  ANSWER_IDENTITIES,
  INCOME_BRACKETS,
  INCOME_UNKNOWN_LABEL,
  SUBSIDY_IDENTITY_LABELS,
  type Answers,
  type SubsidyItem,
} from '@app/shared';
import type { GroupedResults } from '@/lib/match';
import type { KindFilter } from '@/composables/useQuery';
import type { Prefill } from '@/lib/userinfo';

/** [SUBS-R18] 結果頁與每筆詳細資訊都要顯示的門檻提醒 */
export const THRESHOLD_NOTICE = '門檻以社會局最新公告為準。';

type Row = GroupedResults['eligible'][number];

/** 依序號找結果列（詳細資訊頁用） */
export function findRow(grouped: GroupedResults, no: number): Row | null {
  return [...grouped.eligible, ...grouped.ineligible].find((r) => r.item.no === no) ?? null;
}

/** [SUBS-R25] 資料類型篩選只過濾畫面上的卡片；計數與 noMatch 用未過濾的 results */
export function filterKind(rows: Row[], kind: KindFilter): Row[] {
  return kind === 'all' ? rows : rows.filter((r) => r.item.kind === kind);
}

/** 資料類型標籤文字（spec 7.4：模擬資料標籤為「模擬資料」） */
export function kindLabel(item: SubsidyItem): string {
  return item.kind === 'mock' ? '模擬資料' : '開放資料';
}

/** 大圖卡左下膠囊（原型 badge）：年齡區間 → 身分 → 需設籍臺北市 */
export function badgeText(item: SubsidyItem): string {
  if (item.ageMin !== null && item.ageMax !== null) return `${item.ageMin}～${item.ageMax} 歲`;
  if (item.ageMin !== null) return `${item.ageMin} 歲以上`;
  if (item.ageMax !== null) return `${item.ageMax} 歲以下`;
  if (item.identities.length) return item.identities.map((id) => SUBSIDY_IDENTITY_LABELS[id]).join('、');
  return '需設籍臺北市';
}

/** 撥打 1999 只給聯繫方式含 1999 的開放資料項目（spec 7.10、sa-3-s2.md W11） */
export const CITY_HOTLINE = '1999';
export function canCall1999(item: SubsidyItem): boolean {
  return item.kind === 'open' && item.contact.includes(CITY_HOTLINE);
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
  if (a.age === null || a.residency === null || a.incomeBracket === null) return '';
  return `你的答案：${a.age} 歲・${a.residency ? '設籍臺北市' : '未設籍臺北市'}・${identitiesText(a.identities)}・每人月收入 ${incomeText(a.incomeBracket)}`;
}

/** 開始頁「我的資料」前 4 張卡的內容（原型 renderCarousel） */
export interface InfoCard {
  /** 0～3 對應題號 */
  step: number;
  label: string;
  value: string | null;
  fromTownPass: boolean;
}

const CARD_LABELS = ['年齡', '戶籍', '身分', '每人每月收入'] as const;

/**
 * [SUBS-R24] 卡片讀 Answers（還沒開始作答時讀 prefill）；欄位值等於 prefill 時標「來自台北通帳號」。
 */
export function infoCards(a: Answers, prefill: Prefill, notStarted: boolean): InfoCard[] {
  const src: Answers = notStarted ? { age: prefill.age, residency: prefill.residency, identities: [], incomeBracket: null } : a;
  const values: Array<string | null> = [
    src.age !== null ? `${src.age} 歲` : null,
    src.residency === null ? null : src.residency ? '設籍臺北市' : '未設籍臺北市',
    src.identities.length ? identitiesText(src.identities) : null,
    incomeText(src.incomeBracket),
  ];
  const fromTp = [
    src.age !== null && src.age === prefill.age,
    src.residency !== null && src.residency === prefill.residency,
    false,
    false,
  ];
  return CARD_LABELS.map((label, step) => ({ step, label, value: values[step]!, fromTownPass: fromTp[step]! }));
}
