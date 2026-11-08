import type { SubsidyItem } from '@app/shared';
import { categoryOf, keyCondition, type KeyCondition } from '@/lib/categories';
import { UNMATCHED_LABEL, kindLabel } from '@/lib/resultView';
import { kindRank, type MatchResult } from '@/lib/match';

/** 清單卡片（19.png）用的文字：分類標籤、狀態標籤、右側條件、底列摘要。result 為 null＝沒作答，只顯示資料類型 */
export type CardStatus = 'eligible' | 'mock' | 'ineligible' | 'none';

export interface CardRow {
  item: SubsidyItem;
  result: MatchResult | null;
}

/** 標籤 1：分類（不在對照表時寫「其他」；台北服務通寫「申辦服務」） */
export function categoryText(no: number, kind?: SubsidyItem['kind']): string {
  if (kind === 'catalog') return '申辦服務';
  return categoryOf(no)?.label ?? '其他';
}

/**
 * 標籤 2：可能符合寫「開放資料 · 可能符合」或「官方網頁整理 · 可能符合」；模擬資料一律帶「模擬資料」（比賽規則要標示）；
 * 不符合寫「不符合」。沒作答時只寫資料類型。
 */
export function statusOf(row: CardRow): CardStatus {
  if (row.result === null) return 'none';
  if (!row.result.ok) return 'ineligible';
  return row.item.kind === 'mock' ? 'mock' : 'eligible';
}

export function statusText(row: CardRow): string {
  const mock = row.item.kind === 'mock';
  switch (statusOf(row)) {
    case 'eligible':
      return `${kindLabel(row.item)} · 可能符合`;
    case 'mock':
      return '模擬資料';
    case 'ineligible':
      return mock ? '模擬資料 · 不符合' : '不符合';
    default:
      return kindLabel(row.item);
  }
}

/** 右側：不符合時改顯示第一個不符合的原因；有實際補助原文時顯示原文（畫面截兩行）；其餘用最關鍵的真實條件 */
export function cardKey(row: CardRow): KeyCondition & { benefit: boolean } {
  // [SUBS-R75] 台北服務通沒有條件欄可以顯示，不寫「不限」免得誤會
  if (row.item.kind === 'catalog') return { label: '資格與金額', value: '見官方案件頁', benefit: false };
  if (row.result && !row.result.ok) {
    return { label: '不符合原因', value: row.result.failures[0] ?? row.result.reason, benefit: false };
  }
  if (row.item.benefitText !== null) return { label: '實際補助', value: row.item.benefitText, benefit: true };
  return { ...keyCondition(row.item), benefit: false };
}

/** 底列左邊：設籍條件加還需確認條數；不符合時寫另有幾項不符合 */
export function cardSummary(row: CardRow): string {
  if (row.item.kind === 'catalog') return `${UNMATCHED_LABEL} · 資格請見官方案件頁`;
  const residency = row.item.residency ? '需設籍臺北市' : '不限設籍';
  const r = row.result;
  if (r === null) {
    const n = row.item.toVerify.length;
    return n ? `${residency} · 另有 ${n} 項要再確認` : residency;
  }
  if (!r.ok) {
    const more = r.failures.length - 1;
    return more > 0 ? `另有 ${more} 項不符合` : residency;
  }
  return r.toVerify.length ? `${residency} · 另有 ${r.toVerify.length} 項要再確認` : `${residency} · ${r.reason}`;
}

/** 可能符合的排序：真實資料（開放、官方網頁整理）在前，還需確認少的在前，同數依序號 */
export function sortEligible<T extends { item: SubsidyItem; result: MatchResult }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (x, y) =>
      kindRank(x.item) - kindRank(y.item) ||
      x.result.toVerify.length - y.result.toVerify.length ||
      x.item.no - y.item.no,
  );
}

/** 卡片右側實際補助的字寬預算（430 寬手機上右欄約 11 個中文字一行，兩行再扣折行損耗） */
export const BENEFIT_BRIEF_UNITS = 15;

/**
 * 實際補助原文的精簡版：依字寬截斷（中文全形算 1，半形算 0.55），超過加「…」；全文在申辦詳情。
 * 用程式截而不只靠 CSS line-clamp：Chrome 在右對齊、行尾剛好填滿時不畫「…」。
 */
export function benefitBrief(text: string, units = BENEFIT_BRIEF_UNITS): string {
  let used = 0;
  let out = '';
  for (const ch of text) {
    const w = (ch.codePointAt(0) ?? 0) <= 0xff ? 0.55 : 1;
    if (used + w > units) return `${out.replace(/[\s，、；：。]+$/, '')}…`;
    used += w;
    out += ch;
  }
  return out;
}
