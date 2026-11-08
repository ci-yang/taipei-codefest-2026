import { SUBSIDY_IDENTITY_LABELS, type SubsidyItem } from '@app/shared';
import { formatYuan } from '@/lib/match';

/**
 * 補助分類（v3）：依序號歸類。1～10 開放資料、101～103 模擬資料、201～215 官方網頁整理（ADR-035）。
 * 官方網頁整理對照：
 * - 生活扶助：210 特殊境遇家庭扶助
 * - 醫療補助：212 老人健保自付額補助、213 兒童醫療補助
 * - 育兒生育：206 生育補助、207 未滿 2 歲育兒津貼、208 托育補助、214 好孕 2U 孕婦乘車補助
 * - 長者與身障：211 身障輔具補助、215 中低收入老人特別照顧津貼
 * - 租屋就業：201 中央租金補貼、202 臺北幸福租、203 低收入戶租金補貼、204 身障房屋租金補貼、
 *   205 都市原住民租屋補貼、209 就業保險失業給付（租屋類不另開「居住」分類：既有「租屋就業」已涵蓋，分類維持六類）
 */
export const CATEGORIES = [
  { id: 'living', label: '生活扶助', nos: [1, 4, 10, 210] },
  { id: 'medical', label: '醫療補助', nos: [9, 212, 213] },
  { id: 'school', label: '就學補助', nos: [2, 3] },
  { id: 'family', label: '育兒生育', nos: [7, 8, 101, 206, 207, 208, 214] },
  { id: 'elder-dis', label: '長者與身障', nos: [5, 6, 211, 215] },
  { id: 'housing-job', label: '租屋就業', nos: [102, 103, 201, 202, 203, 204, 205, 209] },
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
