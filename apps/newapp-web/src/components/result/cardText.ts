import type { SubsidyItem } from '@app/shared';
import { categoryOf, keyCondition, type KeyCondition } from '@/lib/categories';
import type { MatchResult } from '@/lib/match';

/** 清單卡片（19.png）用的文字：分類標籤、狀態標籤、右側條件、底列摘要。result 為 null＝沒作答，只顯示資料類型 */
export type CardStatus = 'eligible' | 'mock' | 'ineligible' | 'none';

export interface CardRow {
  item: SubsidyItem;
  result: MatchResult | null;
}

/** 標籤 1：分類（不在對照表時寫「其他」） */
export function categoryText(no: number): string {
  return categoryOf(no)?.label ?? '其他';
}

/**
 * 標籤 2：可能符合寫「開放資料 · 可能符合」；模擬資料一律帶「模擬資料」（比賽規則要標示）；不符合寫「不符合」。
 * 沒作答時只寫資料類型。
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
      return '開放資料 · 可能符合';
    case 'mock':
      return '模擬資料';
    case 'ineligible':
      return mock ? '模擬資料 · 不符合' : '不符合';
    default:
      return mock ? '模擬資料' : '開放資料';
  }
}

/** 右側：不符合時改顯示第一個不符合的原因，其餘用最關鍵的真實條件 */
export function cardKey(row: CardRow): KeyCondition {
  if (row.result && !row.result.ok) return { label: '不符合原因', value: row.result.failures[0] ?? row.result.reason };
  return keyCondition(row.item);
}

/** 底列左邊：設籍條件加還需確認條數；不符合時寫另有幾項不符合 */
export function cardSummary(row: CardRow): string {
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

/** 可能符合的排序：開放資料在前，還需確認少的在前，同數依序號 */
export function sortEligible<T extends { item: SubsidyItem; result: MatchResult }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (x, y) =>
      (x.item.kind === y.item.kind ? 0 : x.item.kind === 'open' ? -1 : 1) ||
      x.result.toVerify.length - y.result.toVerify.length ||
      x.item.no - y.item.no,
  );
}
