import { INCOME_UNKNOWN, type Answers, type SubsidyItem } from '@app/shared';
import { matchItem, type CompletedAnswers } from '@/lib/match';

/** 試算頁進度：四題中已填幾題（未答一律 null；身分以至少選一項算已填） */
export function answeredCount(a: Answers): number {
  return [a.ageBand !== null, a.residency !== null, a.identities.length > 0, a.incomeBracket !== null].filter(Boolean)
    .length;
}

/**
 * 只用已填的條件比對單項：沒填的那一題，把補助在該題的限制拿掉，再交給 matchItem（比對規則只有一份）。
 * - 年齡沒填：拿掉年齡上下限；身分條件含 elder（由年齡推得）的項目，身分也不判。
 * - 戶籍沒填：視同不限設籍。身分沒填：視同無身分限制。收入沒填：視同無收入上限。
 */
export function liveOk(item: SubsidyItem, a: Answers): boolean {
  const ageKnown = a.ageBand !== null;
  const idsKnown = a.identities.length > 0;
  // 年齡沒填時，要求 elder 的項目可能靠年齡就過，身分條件整條不判
  const elderOpen = !ageKnown && item.identities.includes('elder');
  const identities = idsKnown && !elderOpen ? item.identities : [];
  const relaxed: SubsidyItem = {
    ...item,
    ageMin: ageKnown ? item.ageMin : null,
    ageMax: ageKnown ? item.ageMax : null,
    residency: a.residency !== null ? item.residency : false,
    identities,
    incomeMax: a.incomeBracket !== null ? item.incomeMax : null,
  };
  const filled: CompletedAnswers = {
    // 沒填的題目填任意值；對應的限制已拿掉，不影響結果
    ageBand: a.ageBand ?? '26-39',
    residency: a.residency ?? true,
    identities: idsKnown ? a.identities : ['none'],
    incomeBracket: a.incomeBracket ?? INCOME_UNKNOWN,
  };
  return matchItem(relaxed, filled).ok;
}

/** 即時「可能符合」項數：已填的條件都沒有排除的項目數 */
export function liveCount(items: readonly SubsidyItem[], a: Answers): number {
  return items.filter((item) => liveOk(item, a)).length;
}
