import type { EligibilityProfile, EligibilityResult } from './benefit-eligibility';

export interface BenefitAcceptance {
  status: 'open' | 'closed' | 'unknown';
  note: string;
}

export interface OpportunityLine {
  programId: string;
  name: string;
  minimum: number;
  maximum: number;
  basis: string;
}

export interface OpportunityEstimate {
  lines: OpportunityLine[];
  totalMinimum: number;
  totalMaximum: number;
  unquantifiedCount: number;
}

interface AmountRange {
  minimum: number;
  maximum: number;
  basis: string;
}

const AMOUNT_RANGES: Record<string, AmountRange> = {
  '2': { minimum: 81_900, maximum: 81_900, basis: '每月 6,825 元，兩學期各 6 個月' },
  '3': { minimum: 1_000, maximum: 4_000, basis: '依年齡與是否跨縣市通學估算每年兩學期' },
  '5': { minimum: 48_588, maximum: 113_820, basis: '每月 4,049 至 9,485 元，估算 12 個月' },
  '6': { minimum: 27_480, maximum: 99_948, basis: '依資格每月 2,290 至 8,329 元，估算 12 個月' },
  '7': { minimum: 1_000, maximum: 6_000, basis: '每兩個月最多 1,000 元，估算一年 1 至 6 次' },
  '8': { minimum: 33_000, maximum: 33_000, basis: '單胎一次性生育補助；雙生以上另加' },
  '10': { minimum: 6_000, maximum: 30_000, basis: '依急難事由的一次性救助常見區間' },
  '11': { minimum: 36_000, maximum: 96_000, basis: '每月 3,000 至 8,000 元，估算 12 個月' },
  '13': { minimum: 18_000, maximum: 18_000, basis: '每月最高 1,500 元，估算 12 個月' },
  '14': { minimum: 36_000, maximum: 90_000, basis: '依同住人數每月最高 3,000 至 7,500 元，估算 12 個月' },
  '15': { minimum: 48_000, maximum: 102_000, basis: '每月 4,000 至 8,500 元，估算 12 個月' },
  '16': { minimum: 40_000, maximum: 50_000, basis: '每名新生兒依胎次一次發給' },
  '17': { minimum: 60_000, maximum: 84_000, basis: '每名兒童每月 5,000 至 7,000 元，估算 12 個月' },
  '18': { minimum: 30_000, maximum: 120_000, basis: '臺北市友善托育每月 2,500 至 10,000 元，估算 12 個月' },
  '22': { minimum: 9_912, maximum: 9_912, basis: '每月最高 826 元，估算 12 個月' },
  '24': { minimum: 10_000, maximum: 10_000, basis: '每次懷孕核發 10,000 元電子乘車金' },
  '25': { minimum: 60_000, maximum: 60_000, basis: '每月 5,000 元，估算 12 個月' },
};

function monthDayKey(month: number, day: number): number {
  return month * 100 + day;
}

/**
 * 深度比對資料中，只有都市原住民租屋補貼有固定的年度受理月份。
 * 其餘項目的即時狀態無法由開放資料可靠判定，因此標為 unknown，而不是擅自宣稱開放。
 */
export function benefitAcceptance(programId: string, today = new Date()): BenefitAcceptance {
  if (programId !== '15') {
    return { status: 'unknown', note: '官方資料未提供可機讀的即時受理狀態。' };
  }

  const current = monthDayKey(today.getMonth() + 1, today.getDate());
  const isOpen =
    (current >= monthDayKey(4, 1) && current <= monthDayKey(4, 30)) ||
    (current >= monthDayKey(8, 1) && current <= monthDayKey(8, 31));
  return {
    status: isOpen ? 'open' : 'closed',
    note: '每年僅 4 月 1 日至 4 月 30 日、8 月 1 日至 8 月 31 日受理。',
  };
}

function amountRangeFor(result: EligibilityResult, profile: EligibilityProfile): AmountRange | undefined {
  if (result.program.id !== '12') return AMOUNT_RANGES[result.program.id];

  const selected = new Set(profile.traits);
  if (selected.has('childUnder12')) {
    return {
      minimum: 12_000,
      maximum: 12_000,
      basis: '至少一名 12 歲以下子女每月加碼 1,000 元；未計多名子女加碼',
    };
  }
  if (selected.has('married')) {
    return { minimum: 30_000, maximum: 30_000, basis: '已婚未育家庭每月加碼 2,500 元，估算 12 個月' };
  }
  if (selected.has('single')) {
    return { minimum: 12_000, maximum: 12_000, basis: '單身青年每月加碼 1,000 元，估算 12 個月' };
  }
  return undefined;
}

export function estimateMissedOpportunity(
  results: EligibilityResult[],
  profile: EligibilityProfile,
  today = new Date(),
): OpportunityEstimate {
  const possible = results.filter(
    (result) => result.status === 'possible' && benefitAcceptance(result.program.id, today).status !== 'closed',
  );
  const lines = possible.flatMap((result): OpportunityLine[] => {
    const range = amountRangeFor(result, profile);
    return range
      ? [{ programId: result.program.id, name: result.program.name, ...range }]
      : [];
  });

  return {
    lines,
    totalMinimum: lines.reduce((sum, line) => sum + line.minimum, 0),
    totalMaximum: lines.reduce((sum, line) => sum + line.maximum, 0),
    unquantifiedCount: possible.length - lines.length,
  };
}

export function formatOpportunityAmount(minimum: number, maximum: number): string {
  const money = new Intl.NumberFormat('zh-TW');
  if (minimum === maximum) return `NT$${money.format(minimum)}`;
  return `NT$${money.format(minimum)}～${money.format(maximum)}`;
}
