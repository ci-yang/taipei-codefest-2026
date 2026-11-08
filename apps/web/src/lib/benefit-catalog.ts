import snapshot from '@/data/benefit-catalog.json';
import { ageFromBirthday, type EligibilityProfile } from './benefit-eligibility';
import { BENEFIT_PROGRAMS, type BenefitTrait } from './benefit-data';

export type CatalogCategory =
  | 'family'
  | 'senior'
  | 'disability'
  | 'indigenous'
  | 'medical'
  | 'education'
  | 'work'
  | 'housing'
  | 'emergency'
  | 'transport'
  | 'tax'
  | 'other';

export interface CatalogProgram {
  id: string;
  name: string;
  summary: string;
  contacts: string;
  requiredDocuments: string;
  applicationMethods: string;
  deliveryMethod: string;
  processingTime: string;
  notes: string;
  benefitContent: string;
  officialUrl: string;
  formUrl: string;
  lastUpdated: string;
  dateCreated: string;
}

export interface CatalogBenefit {
  content: string;
  isConcrete: boolean;
  note: string;
}

export interface CatalogAcceptance {
  status: 'open' | 'closed' | 'unknown';
  note: string;
}

export interface RankedCatalogProgram {
  program: CatalogProgram;
  category: CatalogCategory;
  benefit: CatalogBenefit;
  score: number;
  reasons: string[];
  excluded: boolean;
  exclusionReasons: string[];
  acceptance: CatalogAcceptance;
}

export const CATALOG_SOURCE = snapshot.source;
export const CATALOG_PROGRAMS = snapshot.programs as CatalogProgram[];

const DEEP_PROGRAM_BY_ID = new Map(BENEFIT_PROGRAMS.map((program) => [program.id, program]));

function searchable(program: CatalogProgram): string {
  return [
    program.name,
    program.summary,
    program.applicationMethods,
    program.benefitContent,
    program.notes,
  ].join(' ');
}

export function catalogAcceptance(program: CatalogProgram): CatalogAcceptance {
  const text = [program.summary, program.applicationMethods, program.processingTime, program.notes].join(' ');
  if (/(目前停止受理|現已停止受理|暫停受理|現已不再受理|自.{0,20}起不再受理|受理期間已截止|已停止辦理)/.test(text)) {
    return { status: 'closed', note: '官方開放資料文字顯示目前停止或暫停受理。' };
  }
  if (/(全年受理|隨到隨辦|無須申請|免申請|主動辦理)/.test(text)) {
    return { status: 'open', note: '官方開放資料標示全年受理、免申請或由機關主動辦理。' };
  }
  return { status: 'unknown', note: '官方開放資料未提供一致的即時受理狀態，請開啟官方明細確認。' };
}

export function catalogOfficialSearchUrl(program: CatalogProgram): string {
  return program.officialUrl;
}

export function catalogBenefit(program: CatalogProgram): CatalogBenefit {
  const deepProgram = DEEP_PROGRAM_BY_ID.get(program.id);
  if (deepProgram) {
    return {
      content: deepProgram.benefitContent,
      isConcrete: true,
      note: '已依新北市官方資料整理成可讀的給付內容；實際核定以最新公告為準。',
    };
  }
  if (program.benefitContent.trim()) {
    return {
      content: program.benefitContent.replace(/\s+/g, ' ').trim(),
      isConcrete: true,
      note: '內容直接取自新北市政府福利補助開放資料。',
    };
  }
  return {
    content: '官方資料有列出這項服務，但未提供可機讀的給付金額或內容。',
    isConcrete: false,
    note: '請開啟官方明細確認最新補助內容。',
  };
}

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  family: '育兒與家庭',
  senior: '長者',
  disability: '身心障礙',
  indigenous: '原住民族',
  medical: '醫療照護',
  education: '教育就學',
  work: '就業與創業',
  housing: '居住與修繕',
  emergency: '急難與被害',
  transport: '交通',
  tax: '稅費減免',
  other: '其他',
};

export function catalogCategory(program: CatalogProgram): CatalogCategory {
  const text = searchable(program);
  if (/原住/.test(text)) return 'indigenous';
  if (/身心障礙|身障|失能|輔具|氣切/.test(text)) return 'disability';
  if (/老人|高齡|長者|獨居/.test(text)) return 'senior';
  if (/育兒|托育|兒童|幼兒|嬰兒|生育|孕婦|孕產|家庭|鮮奶/.test(text)) return 'family';
  if (/住宅|租屋|租金|住屋|房屋|修繕/.test(program.name)) return 'housing';
  if (/醫療|健康|疫苗|照護|看護|療育|生殖|假牙/.test(text)) return 'medical';
  if (/學生|就學|學費|教育|午餐|獎學金/.test(text)) return 'education';
  if (/急難|災害|慰問|被害|性侵|家庭暴力|喪葬/.test(text)) return 'emergency';
  if (/住宅|租屋|租金|住屋|房屋|修繕/.test(text)) return 'housing';
  if (/地價稅|房屋稅|牌照稅|稅.*減免|規費/.test(text)) return 'tax';
  if (/交通|乘車|車輛|計程車|停車|復康巴士/.test(text)) return 'transport';
  if (/就業|失業|職業|勞工|職災|職場|技術士|創業|求職/.test(text)) return 'work';
  return 'other';
}

const CHILD_TRAITS: BenefitTrait[] = [
  'newTaipeiSchoolStudent',
  'minorChild',
  'childUnder15',
  'currentlyPregnant',
  'recentBirth',
  'infantUnder2',
  'childAge2To5',
  'childUnder6',
  'developmentalDelayChild',
];

function hasAnyTrait(selected: Set<BenefitTrait>, required: BenefitTrait[]): boolean {
  return required.some((trait) => selected.has(trait));
}

function catalogExclusionReasons(program: CatalogProgram, selected: Set<BenefitTrait>, age: number | null): string[] {
  const text = searchable(program);
  const reasons: string[] = [];
  const excludeUnless = (matches: boolean, allowed: boolean, reason: string) => {
    if (matches && !allowed && !reasons.includes(reason)) reasons.push(reason);
  };
  const hasChild = hasAnyTrait(selected, CHILD_TRAITS);

  if (
    /(補助對象|申請對象|申請資格).{0,80}(政府機關|學校|幼兒園|雇主|事業單位|人民團體|社區發展協會)/s.test(text) &&
    !/(學生|學童|受僱者|勞工|個人|市民|家庭)/.test(text)
  ) {
    reasons.push('申請對象是機關、學校、雇主、機構或團體，不是個人市民');
  }
  excludeUnless(/原住民|原住民族/.test(program.name), selected.has('indigenous'), '未勾選原住民族身分');
  excludeUnless(/新住民/.test(program.name), selected.has('newImmigrant'), '未勾選新住民身分');
  excludeUnless(/役男|服兵役|軍公教遺族/.test(program.name), selected.has('militaryFamily'), '未勾選役男家庭或遺族身分');
  excludeUnless(/家庭暴力|性侵害/.test(program.name), selected.has('violenceVictim'), '未勾選暴力或性侵害情況');
  excludeUnless(/特殊境遇家庭/.test(program.name), selected.has('specialFamilyCircumstance'), '未勾選特殊境遇家庭情況');
  excludeUnless(/犬|貓|寵物/.test(program.name), selected.has('petOwner'), '未勾選飼主身分');
  excludeUnless(/身心障礙|身障|輔具/.test(program.name), selected.has('disabled') || selected.has('assistiveDeviceNeeded'), '未勾選身心障礙或輔具需求');
  excludeUnless(/老人|高齡|長者|獨居老人/.test(program.name) && age !== null, (age ?? 0) >= 55 || selected.has('seriouslyIllSenior') || selected.has('elderCareRecipientEligible'), '年齡與高齡照顧資料不符');
  excludeUnless(/青年/.test(program.name) && age !== null, (age ?? 0) >= 15 && (age ?? 99) <= 45, '年齡不在青年方案的保守範圍');
  excludeUnless(/孕婦|好孕|生育獎勵|坐月子/.test(program.name), selected.has('currentlyPregnant') || selected.has('recentBirth') || selected.has('pregnantOrRecentLoss'), '未勾選孕產或近期生育情況');
  excludeUnless(/兒童|少年|幼兒|嬰兒|育兒|托育|學童|學生午餐|鮮奶/.test(program.name), hasChild || selected.has('student'), '未填寫家中有兒童、幼兒或學生');
  excludeUnless(/失業|求職|就業計畫|就業獎勵/.test(program.name), selected.has('unemployed') || selected.has('atypicalWorker'), '未勾選待業、失業或非典型工作情況');
  excludeUnless(/租屋|租金補貼/.test(program.name), selected.has('renter'), '未勾選目前在新北市租屋');
  excludeUnless(/急難|災害救助/.test(program.name), selected.has('recentEmergency'), '未勾選近期急難事故');
  excludeUnless(/低收入戶/.test(program.name) && !/中低收入/.test(program.name), selected.has('lowIncome'), '未勾選低收入戶資格');
  excludeUnless(/中低收入/.test(program.name), selected.has('lowIncome') || selected.has('middleLowIncome'), '未勾選低收入或中低收入資格');

  return reasons;
}

export function rankCatalogPrograms(profile: EligibilityProfile, today = new Date()): RankedCatalogProgram[] {
  const selected = new Set(profile.traits);
  const age = ageFromBirthday(profile.birthday, today);
  const hasChild = hasAnyTrait(selected, CHILD_TRAITS);

  return CATALOG_PROGRAMS.map((program) => {
    const text = searchable(program);
    const category = catalogCategory(program);
    const benefit = catalogBenefit(program);
    const acceptance = catalogAcceptance(program);
    const exclusionReasons = catalogExclusionReasons(program, selected, age);
    const reasons: string[] = [];
    let score = 0;

    if (profile.newTaipeiResident === true && /設籍.*新北|本市市民|新北市民/.test(text)) {
      score += 2;
      reasons.push('你填寫為設籍新北市');
    }
    if (age !== null && age >= 65 && category === 'senior') {
      score += 6;
      reasons.push('年齡可能與長者方案相關');
    }
    if (age !== null && age >= 15 && age <= 45 && /青年/.test(program.name)) {
      score += 5;
      reasons.push('年齡可能符合青年方案範圍');
    }
    if (selected.has('disabled') && category === 'disability') {
      score += 7;
      reasons.push('你勾選了身心障礙身分');
    }
    if (selected.has('indigenous') && category === 'indigenous') {
      score += 7;
      reasons.push('你勾選了原住民族身分');
    }
    if ((selected.has('lowIncome') || selected.has('middleLowIncome')) && /低收入|中低收入|弱勢|清寒/.test(text)) {
      score += 7;
      reasons.push('你勾選了低收入或中低收入資格');
    }
    if ((selected.has('student') || selected.has('newTaipeiSchoolStudent')) && category === 'education') {
      score += 6;
      reasons.push('你填寫了本人或家中學童的在學情況');
    }
    if ((selected.has('currentlyPregnant') || selected.has('pregnantOrRecentLoss') || selected.has('recentBirth') || hasChild) && category === 'family') {
      score += 6;
      reasons.push('你填寫的孕產或育兒情況可能相關');
    }
    if ((selected.has('unemployed') || selected.has('atypicalWorker')) && category === 'work') {
      score += 6;
      reasons.push('你勾選了待業、失業或非典型工作情況');
    }
    if (selected.has('renter') && category === 'housing') {
      score += 6;
      reasons.push('你勾選了在新北市租屋');
    }
    if (selected.has('newImmigrant') && /新住民/.test(text)) {
      score += 7;
      reasons.push('你勾選了新住民身分');
    }
    if (selected.has('militaryFamily') && /役男|服役|遺族/.test(text)) {
      score += 7;
      reasons.push('你勾選了役男家庭或遺族身分');
    }
    if (selected.has('violenceVictim') && /家庭暴力|性侵害|被害/.test(text)) {
      score += 8;
      reasons.push('你勾選了暴力或性侵害情況');
    }
    if (selected.has('petOwner') && /犬|貓|寵物|動物/.test(text)) {
      score += 6;
      reasons.push('你勾選了飼主或動物照護情況');
    }
    if (selected.has('recentEmergency') && category === 'emergency') {
      score += 7;
      reasons.push('你勾選了近期急難情況');
    }
    if (selected.has('specialFamilyCircumstance') && (category === 'family' || category === 'emergency')) {
      score += 7;
      reasons.push('你勾選了特殊境遇家庭情況');
    }
    if (selected.has('assistiveDeviceNeeded') && category === 'disability') {
      score += 6;
      reasons.push('你勾選了輔具需求');
    }
    if ((selected.has('elderCareRecipientEligible') || selected.has('familyCaregiverEligible')) && category === 'senior') {
      score += 7;
      reasons.push('你勾選了高齡家庭照顧情況');
    }

    if (!reasons.length) reasons.push('官方福利目錄項目，尚無足夠欄位自動判斷');
    return {
      program,
      category,
      benefit,
      score,
      reasons,
      excluded: exclusionReasons.length > 0,
      exclusionReasons,
      acceptance,
    };
  }).sort(
    (left, right) =>
      Number(left.acceptance.status === 'closed') - Number(right.acceptance.status === 'closed') ||
      Number(left.excluded) - Number(right.excluded) ||
      right.score - left.score ||
      Number(right.benefit.isConcrete) - Number(left.benefit.isConcrete) ||
      left.program.name.localeCompare(right.program.name, 'zh-Hant'),
  );
}
