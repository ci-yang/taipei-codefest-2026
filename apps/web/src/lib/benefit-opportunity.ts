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
  '22024': { minimum: 36_096, maximum: 159_636, basis: '依低收入戶款別與家庭成員身分，估算 12 個月' },
  '22180': { minimum: 48_588, maximum: 113_820, basis: '每月 4,049 至 9,485 元，估算 12 個月' },
  '22036': { minimum: 49_968, maximum: 99_948, basis: '每月 4,164 或 8,329 元，估算 12 個月' },
  '22025': { minimum: 20_400, maximum: 20_400, basis: '每次生育或符合規定的流產／死產補助' },
  '22042': { minimum: 28_800, maximum: 52_800, basis: '每月最高 2,400 至 4,400 元，估算 12 個月' },
  '1008042': { minimum: 84_000, maximum: 264_000, basis: '公共、準公共、出生序與新北合作聯盟加碼，估算 12 個月' },
  '22170': { minimum: 9_912, maximum: 9_912, basis: '每月最高 826 元，估算 12 個月' },
  '22216': { minimum: 9_000, maximum: 9_000, basis: '每趟最高 250 元、最多 36 趟' },
  '22008': { minimum: 60_000, maximum: 60_000, basis: '每月 5,000 元，估算 12 個月' },
  '22020': { minimum: 26_364, maximum: 27_756, basis: '依兒少年齡每月 2,197 或 2,313 元，估算 12 個月' },
  '22081': { minimum: 18_000, maximum: 18_000, basis: '每月 3,000 元，原則補助 6 個月' },
  '22016': { minimum: 48_000, maximum: 72_000, basis: '一般戶每月最高 4,000 元、低收入戶 6,000 元，估算 12 個月' },
  '268437678': { minimum: 30_000, maximum: 45_000, basis: '依尋職或非典型勞動青年方案上限' },
  '268437101': { minimum: 600, maximum: 2_000, basis: '依公母及是否由新北市公立動物之家認養' },
  '268437141': { minimum: 36_000, maximum: 36_000, basis: '免費 120 小時坐月子到宅服務的官方折算價值' },
};

/**
 * 只有新北市青年租金補貼有已核對的 116 年度受理終日；其他方案若開放資料未提供
 * 結構化即時狀態，就保守標記 unknown，不擅自宣稱仍在受理。
 */
export function benefitAcceptance(programId: string, today = new Date()): BenefitAcceptance {
  if (programId !== '163') {
    return { status: 'unknown', note: '官方開放資料未提供可機讀的即時受理狀態。' };
  }
  const start = new Date(2026, 9, 1);
  const end = new Date(2027, 11, 31, 23, 59, 59);
  const open = today >= start && today <= end;
  return {
    status: open ? 'open' : 'closed',
    note: '116 年度受理至 2027 年 12 月 31 日，或經費用罄為止。',
  };
}

function birthOrderAmount(
  profile: EligibilityProfile,
  first: number,
  second: number,
  third: number,
  basis: string,
): AmountRange {
  const selected = new Set(profile.traits);
  const amount = selected.has('thirdOrLaterChild') ? third : selected.has('secondChild') ? second : first;
  return { minimum: amount, maximum: amount, basis };
}

function amountRangeFor(result: EligibilityResult, profile: EligibilityProfile): AmountRange | undefined {
  if (result.program.id === '163') {
    const selected = new Set(profile.traits);
    const monthly = selected.has('thirdOrLaterChild')
      ? 7_000
      : selected.has('secondChild')
        ? 6_000
        : selected.has('minorChild') || selected.has('currentlyPregnant')
          ? 5_000
          : selected.has('married')
            ? 4_500
            : 3_500;
    return { minimum: monthly * 12, maximum: monthly * 12, basis: `依家庭類別每月 ${monthly.toLocaleString('zh-TW')} 元，估算 12 個月` };
  }
  if (result.program.id === '1008103') {
    return birthOrderAmount(profile, 40_000, 45_000, 50_000, '依 115 年出生序一次發給');
  }
  if (result.program.id === '1008029' || result.program.id === '268437092') {
    return birthOrderAmount(profile, 60_000, 72_000, 84_000, '依出生序每月 5,000、6,000 或 7,000 元，估算 12 個月');
  }
  return AMOUNT_RANGES[result.program.id];
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
    return range ? [{ programId: result.program.id, name: result.program.name, ...range }] : [];
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
