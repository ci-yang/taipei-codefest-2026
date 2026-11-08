import type { AnswerIdentity, SubsidyItem } from '@app/shared';
import { formatYuan, isUnmatched } from '@/lib/match';

/**
 * [SUBS-R76] 估算可領金額（ADR-036）：只加總「可能符合」且 benefitText 有明確金額的項目。
 * 每條規則的數字都要能從該項 benefitText 原文推得（figures 必須逐字出現在原文，測試會對官方原文檢查）：
 * 月額 × 12、每學期金額 × 2、一次性金額算一次；「最高」「最多」的金額照上限估。
 * 金額依個案核定、比例或實支實付而推不出數字的項目不在表內，畫面另列「未計入 N 項」。
 * 名稱必須與規則相同才套用（序號被換掉時不張冠李戴），否則算未計入。
 * 核心資格四題沒有問到的項目（prerequisite，例如要有新生兒、原住民身分、在租屋），「可能符合」只代表沒被排除，
 * 不加總、另列未計入，免得總額把明顯不適用的人也算進去；作答勾了對應身分（satisfiedBy）才視為已確認。
 */
export interface EstimateRule {
  no: number;
  name: string;
  /** 單次（單月、單學期或一次性）金額下限與上限，新臺幣元 */
  unitMin: number;
  unitMax: number;
  /** 一年內的次數下限與上限（月額 12、學期 2、一次性 1） */
  timesMin: number;
  timesMax: number;
  /** 算法說明（畫面逐項明細） */
  basis: string;
  /** 原文裡必須逐字出現的字串（金額與期間依據） */
  figures: string[];
  /** 四題沒有問到的核心資格（取自該項還需確認）；有值時不加總，除非作答勾了 satisfiedBy */
  prerequisite?: string;
  satisfiedBy?: AnswerIdentity;
}

export const ESTIMATE_RULES: readonly EstimateRule[] = [
  {
    no: 2,
    name: '低收入戶18歲以上就學生活補助',
    unitMin: 6_825,
    unitMax: 6_825,
    timesMin: 12,
    timesMax: 12,
    basis: '每月 6,825 元 × 12 個月（兩學期各 6 個月）',
    figures: ['6,825', '7～12 月', '1～6 月'],
    prerequisite: '在學學生',
    satisfiedBy: 'stu',
  },
  {
    no: 3,
    name: '低收入戶國中以上就學子女交通補助',
    unitMin: 500,
    unitMax: 1_500,
    timesMin: 2,
    timesMax: 2,
    basis: '每學期 500～1,500 元（依年齡）× 2 學期',
    figures: ['每學期', '500', '1,500'],
    prerequisite: '在學學生',
    satisfiedBy: 'stu',
  },
  {
    no: 5,
    name: '身心障礙者生活補助',
    unitMin: 4_049,
    unitMax: 9_485,
    timesMin: 12,
    timesMax: 12,
    basis: '每月 4,049～9,485 元（依障礙程度與列冊身分）× 12 個月',
    figures: ['4,049', '9,485', '每月'],
  },
  {
    no: 6,
    name: '中低收入老人生活津貼',
    unitMin: 2_290,
    unitMax: 8_329,
    timesMin: 12,
    timesMax: 12,
    basis: '每月 2,290～8,329 元（依家庭收入）× 12 個月',
    figures: ['2,290', '8,329', '每月'],
  },
  {
    no: 7,
    name: '營養品補助',
    unitMin: 1_000,
    unitMax: 1_000,
    timesMin: 1,
    timesMax: 6,
    basis: '每次 1,000 元，每兩個月最多一次，一年 1～6 次',
    figures: ['1,000', '每兩個月'],
    prerequisite: '懷孕分娩、2 歲以下嬰兒或 65 歲以上罹患重病',
    satisfiedBy: 'preg',
  },
  {
    no: 8,
    name: '生育補助',
    unitMin: 33_000,
    unitMax: 33_000,
    timesMin: 1,
    timesMax: 1,
    basis: '一次發給 33,000 元（雙生以上增給未計）',
    figures: ['一次發給 33,000 元'],
    prerequisite: '分娩、流產或死產',
    satisfiedBy: 'preg',
  },
  {
    no: 203,
    name: '低收入戶承租住宅租金補貼',
    unitMin: 1_500,
    unitMax: 1_500,
    timesMin: 12,
    timesMax: 12,
    basis: '每月最高 1,500 元 × 12 個月（租金較低者按實際租金）',
    figures: ['每月補貼 1,500 元'],
    prerequisite: '在臺北市租屋且家庭成員都沒有自有住宅',
  },
  {
    no: 205,
    name: '都市原住民家庭租屋補貼',
    unitMin: 4_000,
    unitMax: 8_500,
    timesMin: 12,
    timesMax: 12,
    basis: '每月 4,000～8,500 元（依人口數與所得級距）× 12 個月',
    figures: ['每月補貼 4,000 至 8,500 元'],
    prerequisite: '具原住民族身分',
  },
  {
    no: 206,
    name: '臺北市生育補助',
    unitMin: 40_000,
    unitMax: 50_000,
    timesMin: 1,
    timesMax: 1,
    basis: '每名新生兒一次 40,000～50,000 元（依胎次）',
    figures: ['40,000', '50,000'],
    prerequisite: '有新生兒出生',
    satisfiedBy: 'preg',
  },
  {
    no: 207,
    name: '育有未滿 2 歲兒童育兒津貼',
    unitMin: 5_000,
    unitMax: 7_000,
    timesMin: 12,
    timesMax: 12,
    basis: '每月 5,000～7,000 元（依子女排行）× 12 個月',
    figures: ['每月 5,000 元', '每月 7,000 元'],
    prerequisite: '家中有未滿 2 歲幼兒',
  },
  {
    no: 208,
    name: '公共化／準公共托育補助與臺北市友善托育補助',
    unitMin: 2_500,
    unitMax: 8_000,
    timesMin: 12,
    timesMax: 12,
    basis: '臺北市友善托育每月 2,500～8,000 元（依托育方式）× 12 個月；中央托育補助另計，未加入',
    figures: ['2,500 元', '8,000 元', '每月補助'],
    prerequisite: '未滿 3 歲幼兒送托公共化或準公共托育',
  },
  {
    no: 212,
    name: '老人全民健康保險保險費自付額補助',
    unitMin: 826,
    unitMax: 826,
    timesMin: 12,
    timesMax: 12,
    basis: '每月最多 826 元 × 12 個月',
    figures: ['每月最多補助 826 元'],
  },
  {
    no: 214,
    name: '臺北市好孕 2U 孕婦乘車補助',
    unitMin: 10_000,
    unitMax: 10_000,
    timesMin: 1,
    timesMax: 1,
    basis: '每次懷孕一次 10,000 元電子乘車金',
    figures: ['每次懷孕補助 10,000 元'],
  },
  {
    no: 215,
    name: '中低收入老人特別照顧津貼',
    unitMin: 5_000,
    unitMax: 5_000,
    timesMin: 12,
    timesMax: 12,
    basis: '每月 5,000 元 × 12 個月',
    figures: ['每月 5,000 元'],
    prerequisite: '在家照顧重度失能的中低收入老人',
  },
  // ---- 台北服務通補好資格條件的項目（ADR-037）：原文在 catalog-enriched.json ----
  {
    no: 308,
    name: '身心障礙者承租停車位租金補助',
    unitMin: 1_000,
    unitMax: 1_000,
    timesMin: 12,
    timesMax: 12,
    basis: '每月最高 1,000 元 × 12 個月（依身分補助租金 25%～50%）',
    figures: ['每月補助金額不得逾新臺幣一千元'],
    prerequisite: '已承租停車位且身心障礙者是車主',
  },
  {
    no: 309,
    name: '發展遲緩兒童早期療育補助',
    unitMin: 4_000,
    unitMax: 6_000,
    timesMin: 12,
    timesMax: 12,
    basis: '每月最高 4,000 元（臺北市低收入戶 6,000 元）× 12 個月',
    figures: ['每人每月最高補助四千元', '最高補助六千元'],
    prerequisite: '家中有發展遲緩或身心障礙的學齡前兒童',
  },
  {
    no: 315,
    name: '弱勢家庭兒童及少年緊急生活扶助',
    unitMin: 3_000,
    unitMax: 3_000,
    timesMin: 6,
    timesMax: 12,
    basis: '每月 3,000 元 × 6 個月（延長最多再 6 個月）',
    figures: ['每人每月補助三千元', '以六個月為原則', '最多延長六個月'],
    prerequisite: '家中未滿 18 歲子女因家庭變故生活陷困',
  },
  {
    no: 318,
    name: '協力照顧補助',
    unitMin: 2_000,
    unitMax: 5_000,
    timesMin: 12,
    timesMax: 12,
    basis: '每月 2,000～5,000 元（依家庭條件與送托方式）× 12 個月',
    figures: ['每月二千元至五千元'],
    prerequisite: '未滿 3 歲幼兒送托協力照顧單位',
  },
  {
    no: 320,
    name: '低收入戶及受保護安置市民喪葬補助',
    unitMin: 40_000,
    unitMax: 40_000,
    timesMin: 1,
    timesMax: 1,
    basis: '一次 40,000 元',
    figures: ['核撥新臺幣四萬元'],
    prerequisite: '協助低收入戶家人或受保護安置市民完成殮葬',
  },
  {
    no: 323,
    name: '04、臺北市失業勞工子女就學費用補助',
    unitMin: 60_000,
    unitMax: 60_000,
    timesMin: 1,
    timesMax: 1,
    basis: '每名子女每學期最高 60,000 元，同一年內限申請一次',
    figures: ['每學期最高補助金額以新臺幣六萬元為限', '同一年內申請補助以一次為限'],
    prerequisite: '非自願離職失業未滿 6 個月且子女就讀大專校院',
  },
  {
    no: 331,
    name: '臺北市氣切個案進住照護機構費用補助申請',
    unitMin: 10_000,
    unitMax: 15_000,
    timesMin: 12,
    timesMax: 12,
    basis: '每月 10,000 元（中低收入戶）～15,000 元（低收入戶）× 12 個月',
    figures: ['每人每月補助新臺幣一萬五千元', '每人每月補助新臺幣一萬元'],
    prerequisite: '家中氣切個案進住護理之家或長期照護機構',
  },
  {
    no: 332,
    name: '助孕生殖「醫療性凍卵」補助',
    unitMin: 20_000,
    unitMax: 20_000,
    timesMin: 1,
    timesMax: 1,
    basis: '凍卵療程一次 20,000 元（保存費每年最高 3,000 元未計）',
    figures: ['凍卵療程：2萬元', '終身補助1次'],
    prerequisite: '因罹癌治療影響生育功能',
  },
  {
    no: 333,
    name: '助孕生殖「人工生殖(試管嬰兒)加碼」補助',
    unitMin: 25_000,
    unitMax: 25_000,
    timesMin: 1,
    timesMax: 1,
    basis: '每年一次 25,000 元',
    figures: ['補助2萬5,000元', '每年補助1次為限'],
    prerequisite: '不孕配偶接受試管嬰兒療程',
  },
  {
    no: 379,
    name: '申請低收入戶(無親屬)喪葬補助',
    unitMin: 25_000,
    unitMax: 25_000,
    timesMin: 1,
    timesMax: 1,
    basis: '一次 25,000 元',
    figures: ['核撥新臺幣二萬五千元'],
    prerequisite: '協助無親屬的低收入戶死亡者完成殮葬',
  },
];

export interface EstimateLine {
  no: number;
  name: string;
  min: number;
  max: number;
  basis: string;
}

export interface Estimate {
  lines: EstimateLine[];
  totalMin: number;
  totalMax: number;
  /** 可能符合但官方原文推不出金額的項目名稱 */
  noAmount: string[];
  /** 可能符合但核心資格四題沒問到、要自己確認的項目 */
  noCondition: Array<{ name: string; prerequisite: string }>;
}

/** 畫面上的算法說明（固定文案） */
export const ESTIMATE_METHOD =
  '依官方公告金額估算：月額 × 12、每學期金額 × 2、一次性金額算一次，「最高」金額照上限估；實際以主管機關核定為準。';
/** 未計入的說明 */
export const NO_AMOUNT_NOTE = '金額依個案核定、比例或實支實付，推不出數字';
export const NO_CONDITION_NOTE = '核心資格四題沒問到（例如要有新生兒、原住民身分或在租屋），要自己確認';

/**
 * [SUBS-R76] 由可能符合的項目算估算；模擬資料、未補條件的台北服務通不算、也不列未計入（補好條件的照一般規則，ADR-037）；
 * identities 是作答勾的身分
 */
export function estimateFor(
  eligible: ReadonlyArray<{ item: SubsidyItem }>,
  identities: readonly AnswerIdentity[] = [],
): Estimate {
  const lines: EstimateLine[] = [];
  const noAmount: string[] = [];
  const noCondition: Estimate['noCondition'] = [];
  for (const { item } of eligible) {
    if (item.kind === 'mock' || isUnmatched(item)) continue;
    const rule = ESTIMATE_RULES.find((r) => r.no === item.no);
    if (!rule || rule.name !== item.name || item.benefitText === null) {
      noAmount.push(item.name);
      continue;
    }
    if (rule.prerequisite && !(rule.satisfiedBy && identities.includes(rule.satisfiedBy))) {
      noCondition.push({ name: item.name, prerequisite: rule.prerequisite });
      continue;
    }
    lines.push({
      no: item.no,
      name: item.name,
      min: rule.unitMin * rule.timesMin,
      max: rule.unitMax * rule.timesMax,
      basis: rule.basis,
    });
  }
  return {
    lines,
    totalMin: lines.reduce((s, l) => s + l.min, 0),
    totalMax: lines.reduce((s, l) => s + l.max, 0),
    noAmount,
    noCondition,
  };
}

/** NT$12,000 或 NT$12,000～18,000 */
export function formatRange(min: number, max: number): string {
  return min === max ? `NT$${formatYuan(min)}` : `NT$${formatYuan(min)}～${formatYuan(max)}`;
}
