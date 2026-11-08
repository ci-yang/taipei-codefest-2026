import { SUBSIDY_IDENTITY_LABELS, type SubsidyItem } from '@app/shared';
import { formatYuan } from '@/lib/match';

/** 補助分類（v3）：依資料集序號歸類；102、103 為模擬資料 */
export const CATEGORIES = [
  { id: 'living', label: '生活扶助', nos: [1, 4, 10] },
  { id: 'medical', label: '醫療補助', nos: [9] },
  { id: 'school', label: '就學補助', nos: [2, 3] },
  { id: 'family', label: '育兒生育', nos: [7, 8, 101] },
  { id: 'elder-dis', label: '長者與身障', nos: [5, 6] },
  { id: 'housing-job', label: '租屋就業', nos: [102, 103] },
] as const;

export type Category = (typeof CATEGORIES)[number];
export type CategoryId = Category['id'];

/** 序號所屬分類；不在對照表回 null */
export function categoryOf(no: number): Category | null {
  return CATEGORIES.find((c) => (c.nos as readonly number[]).includes(no)) ?? null;
}

export interface KeyCondition {
  label: string;
  value: string;
}

/** 卡片右側的最關鍵真實條件：收入上限 > 年齡 > 身分 > 不限 */
export function keyCondition(item: SubsidyItem): KeyCondition {
  if (item.incomeMax !== null) return { label: '每人月收入上限', value: `${formatYuan(item.incomeMax)} 元` };
  if (item.ageMin !== null && item.ageMax !== null) return { label: '年齡', value: `${item.ageMin}～${item.ageMax} 歲` };
  if (item.ageMin !== null) return { label: '年齡', value: `${item.ageMin} 歲以上` };
  if (item.ageMax !== null) return { label: '年齡', value: `${item.ageMax} 歲以下` };
  if (item.identities.length > 0) {
    return { label: '身分', value: item.identities.map((id) => SUBSIDY_IDENTITY_LABELS[id]).join('或') };
  }
  return { label: '條件', value: '不限' };
}
