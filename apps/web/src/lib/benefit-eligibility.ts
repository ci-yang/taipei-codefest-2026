import {
  BENEFIT_PROGRAMS,
  TRAIT_LABELS,
  type BenefitProgram,
  type BenefitTrait,
} from './benefit-data';

export type Answer = boolean | null;
export type EligibilityStatus = 'possible' | 'review' | 'unlikely';

export interface EligibilityProfile {
  birthday: string;
  newTaipeiResident: Answer;
  domestic183Days: Answer;
  monthlyIncomePerPerson: number | null;
  movableAssetsPerPerson: number | null;
  realEstateHousehold: number | null;
  traits: BenefitTrait[];
}

export interface EligibilityResult {
  program: BenefitProgram;
  status: EligibilityStatus;
  matched: string[];
  missing: string[];
  conflicts: string[];
}

const money = new Intl.NumberFormat('zh-TW');

export function ageFromBirthday(birthday: string, today = new Date()): number | null {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(birthday.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const valid = new Date(year, month - 1, day);
  if (valid.getFullYear() !== year || valid.getMonth() !== month - 1 || valid.getDate() !== day) return null;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 0 ? age : null;
}

function compareLimit(
  value: number | null,
  limit: number | undefined,
  label: string,
  matched: string[],
  missing: string[],
  conflicts: string[],
): void {
  if (limit === undefined) return;
  if (value === null || !Number.isFinite(value)) {
    missing.push(`${label}尚未填寫（本資料門檻 ${money.format(limit)} 元）`);
  } else if (value <= limit) {
    matched.push(`${label}未超過資料門檻 ${money.format(limit)} 元`);
  } else {
    conflicts.push(`${label}${money.format(value)} 元，超過資料門檻 ${money.format(limit)} 元`);
  }
}

function addDerivedTraits(selected: Set<BenefitTrait>): void {
  if (selected.has('currentlyPregnant')) selected.add('pregnantOrRecentLoss');
  if (selected.has('infantUnder2')) {
    selected.add('childUnder6');
    selected.add('childUnder15');
    selected.add('minorChild');
  }
  if (selected.has('childAge2To5') || selected.has('childUnder6')) {
    selected.add('childUnder15');
    selected.add('minorChild');
  }
  if (selected.has('childUnder15')) selected.add('minorChild');
  if (selected.has('newlywedWithin2Years')) selected.add('married');
}

export function evaluateBenefit(
  program: BenefitProgram,
  profile: EligibilityProfile,
  today = new Date(),
): EligibilityResult {
  const matched: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const age = ageFromBirthday(profile.birthday, today);
  const selected = new Set(profile.traits);
  addDerivedTraits(selected);
  const { rule } = program;

  if (rule.minAge !== undefined || rule.maxAge !== undefined) {
    if (age === null) missing.push('需要出生日期才能核對年齡');
    else if (rule.minAge !== undefined && age < rule.minAge) conflicts.push(`目前 ${age} 歲，未達 ${rule.minAge} 歲`);
    else if (rule.maxAge !== undefined && age > rule.maxAge) conflicts.push(`目前 ${age} 歲，已超過 ${rule.maxAge} 歲`);
    else matched.push(`年齡 ${age} 歲在資料條件內`);
  }

  if (rule.requiresNewTaipei) {
    if (profile.newTaipeiResident === true) matched.push('已填寫為設籍新北市');
    else if (profile.newTaipeiResident === false) conflicts.push('目前填寫為未設籍新北市');
    else missing.push('需要確認是否設籍新北市');
  }

  if (rule.requires183Days) {
    if (profile.domestic183Days === true) matched.push('近一年居住國內超過 183 日');
    else if (profile.domestic183Days === false) conflicts.push('近一年居住國內未超過 183 日');
    else missing.push('需要確認近一年是否居住國內超過 183 日');
  }

  if (rule.recognitionAny?.length) {
    const present = rule.recognitionAny.filter((trait) => selected.has(trait));
    if (present.length) matched.push(`已具資格：${present.map((trait) => TRAIT_LABELS[trait]).join('、')}`);
    else missing.push(`尚須先確認或取得：${rule.recognitionAny.map((trait) => TRAIT_LABELS[trait]).join('／')}`);
  }

  if (rule.traitAny?.length) {
    const present = rule.traitAny.filter((trait) => selected.has(trait));
    if (present.length) matched.push(`符合情況：${present.map((trait) => TRAIT_LABELS[trait]).join('、')}`);
    else conflicts.push(`未勾選必要情況：${rule.traitAny.map((trait) => TRAIT_LABELS[trait]).join('／')}`);
  }

  if (rule.traitAll?.length) {
    const absent = rule.traitAll.filter((trait) => !selected.has(trait));
    const present = rule.traitAll.filter((trait) => selected.has(trait));
    if (present.length) matched.push(`已確認：${present.map((trait) => TRAIT_LABELS[trait]).join('、')}`);
    if (absent.length) conflicts.push(`未勾選必要情況：${absent.map((trait) => TRAIT_LABELS[trait]).join('／')}`);
  }

  if (rule.specialCheck === 'newTaipeiConnection') {
    if (profile.newTaipeiResident === true || selected.has('newTaipeiWorkOrStudy')) {
      matched.push(profile.newTaipeiResident === true ? '已設籍新北市' : '已在新北市就業或就學');
    } else if (profile.newTaipeiResident === false) {
      conflicts.push('未設籍新北市，且未勾選在新北市就業或就學');
    } else {
      missing.push('需要確認是否設籍、居住、就業或就學於新北市');
    }
  }

  if (rule.specialCheck === 'newTaipeiYouthRent') {
    const familyCategory = selected.has('single') || selected.has('married') || selected.has('currentlyPregnant') || selected.has('minorChild');
    if (!familyCategory) conflicts.push('須屬單身、新婚、懷孕或育有未成年子女的青年家庭之一');
    if (selected.has('single') && selected.has('married')) conflicts.push('單身與已婚不可同時勾選');
  }

  if (rule.specialCheck === 'goodPregnancyRide') {
    if (profile.newTaipeiResident === true) matched.push('孕婦本人已設籍新北市');
    else if (selected.has('spouseNewTaipeiResident')) matched.push('符合非本國籍孕婦配偶設籍新北市途徑');
    else if (profile.newTaipeiResident === false) conflicts.push('孕婦未設籍新北市，且未勾選配偶設籍資格');
    else missing.push('需要確認孕婦本人或配偶是否設籍新北市');
  }

  if (rule.specialCheck === 'shinglesVaccine') {
    if (age === null) missing.push('需要出生日期才能核對疫苗年齡');
    else {
      const minimumAge = selected.has('indigenous') ? 55 : 65;
      if (age < minimumAge) conflicts.push(`目前 ${age} 歲，未達${selected.has('indigenous') ? '原住民' : '一般市民'} ${minimumAge} 歲門檻`);
      else matched.push(`目前 ${age} 歲，符合疫苗年齡門檻`);
    }
  }

  compareLimit(profile.monthlyIncomePerPerson, rule.incomeLimit, '每人每月所得', matched, missing, conflicts);
  compareLimit(profile.movableAssetsPerPerson, rule.movableAssetsLimit, '每人動產', matched, missing, conflicts);
  compareLimit(profile.realEstateHousehold, rule.realEstateLimit, '全家不動產', matched, missing, conflicts);

  if (program.id === '22180' || program.id === '22036') {
    missing.push('動產與不動產門檻會依家戶人口及年度調整，仍須由區公所複核');
  }
  if (program.id === '22022') missing.push('醫療項目、保險給付與財稅資格仍須由社會局審查');
  if (program.id === '22213') missing.push('急難事由與救助金額仍須由區公所訪視認定');

  const status: EligibilityStatus = conflicts.length ? 'unlikely' : missing.length ? 'review' : 'possible';
  return { program, status, matched, missing, conflicts };
}

export function evaluateBenefits(profile: EligibilityProfile, today = new Date()): EligibilityResult[] {
  const priority: Record<EligibilityStatus, number> = { possible: 0, review: 1, unlikely: 2 };
  return BENEFIT_PROGRAMS.map((program) => evaluateBenefit(program, profile, today)).sort(
    (left, right) =>
      priority[left.status] - priority[right.status] ||
      left.program.name.localeCompare(right.program.name, 'zh-Hant'),
  );
}
