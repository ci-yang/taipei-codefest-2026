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
  taipeiResident: Answer;
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
  if (selected.has('infantUnder2')) selected.add('childUnder3');
  if (selected.has('infantUnder2') || selected.has('childUnder3') || selected.has('childAge2To5')) {
    selected.add('childUnder12');
    selected.add('minorChild');
  }
  if (selected.has('childUnder12')) selected.add('minorChild');
  const { rule } = program;

  if (rule.minAge !== undefined || rule.maxAge !== undefined) {
    if (age === null) missing.push('需要出生日期才能核對年齡');
    else if (rule.minAge !== undefined && age < rule.minAge) conflicts.push(`目前 ${age} 歲，未達 ${rule.minAge} 歲`);
    else if (rule.maxAge !== undefined && age > rule.maxAge) conflicts.push(`目前 ${age} 歲，已超過 ${rule.maxAge} 歲`);
    else matched.push(`年齡 ${age} 歲在資料條件內`);
  }

  if (rule.requiresTaipei) {
    if (profile.taipeiResident === true) matched.push('設籍／市民條件已填為符合');
    else if (profile.taipeiResident === false) conflicts.push('目前填寫為未設籍臺北市');
    else missing.push('需要確認是否設籍臺北市');
  }

  if (rule.requires183Days) {
    if (profile.domestic183Days === true) matched.push('近一年居住國內超過 183 日');
    else if (profile.domestic183Days === false) conflicts.push('近一年居住國內未超過 183 日');
    else missing.push('需要確認近一年是否居住國內超過 183 日');
  }

  if (rule.recognitionAny?.length) {
    const recognized = rule.recognitionAny.some((trait) => selected.has(trait));
    if (recognized) matched.push(`已勾選：${rule.recognitionAny.filter((trait) => selected.has(trait)).map((trait) => TRAIT_LABELS[trait]).join('、')}`);
    else missing.push(`尚須確認或先取得：${rule.recognitionAny.map((trait) => TRAIT_LABELS[trait]).join('／')}`);
  }

  if (rule.traitAny?.length) {
    const traits = rule.traitAny.filter((trait) => selected.has(trait));
    if (traits.length) matched.push(`符合情況：${traits.map((trait) => TRAIT_LABELS[trait]).join('、')}`);
    else conflicts.push(`未勾選必要情況：${rule.traitAny.map((trait) => TRAIT_LABELS[trait]).join('／')}`);
  }

  if (rule.traitAll?.length) {
    const absent = rule.traitAll.filter((trait) => !selected.has(trait));
    const present = rule.traitAll.filter((trait) => selected.has(trait));
    if (present.length) matched.push(`已確認：${present.map((trait) => TRAIT_LABELS[trait]).join('、')}`);
    if (absent.length) conflicts.push(`未勾選必要情況：${absent.map((trait) => TRAIT_LABELS[trait]).join('／')}`);
  }

  if (rule.specialCheck === 'taipeiHappinessRent') {
    const isSingle = selected.has('single');
    const isMarried = selected.has('married');
    const hasYoungChild = selected.has('childUnder12');
    if (isSingle && isMarried) conflicts.push('單身與已婚不可同時勾選');
    if (hasYoungChild) matched.push('符合育有 12 歲以下子女的育兒家庭類別');
    else if (isSingle) {
      if (age === null) missing.push('需要出生日期才能確認是否為未滿 40 歲單身青年');
      else if (age >= 40) conflicts.push(`目前 ${age} 歲，不符合未滿 40 歲單身青年條件`);
      else matched.push(`目前 ${age} 歲，符合未滿 40 歲單身青年條件`);
    } else if (isMarried) {
      if (age === null) missing.push('需要出生日期才能確認是否為 45 歲以下已婚青年家庭');
      else if (age > 45) conflicts.push(`目前 ${age} 歲，不符合 45 歲以下已婚青年家庭條件`);
      else matched.push(`目前 ${age} 歲，符合 45 歲以下已婚青年家庭條件`);
    } else {
      missing.push('需要確認屬於未滿 40 歲單身、45 歲以下已婚，或育有 12 歲以下子女的家庭');
    }
  }

  const incomeOverride = rule.incomeLimitOverride;
  const incomeLimit = incomeOverride?.traitAny.some((trait) => selected.has(trait))
    ? incomeOverride.limit
    : rule.incomeLimit;
  compareLimit(profile.monthlyIncomePerPerson, incomeLimit, '每人每月所得', matched, missing, conflicts);
  compareLimit(profile.movableAssetsPerPerson, rule.movableAssetsLimit, '每人動產', matched, missing, conflicts);
  compareLimit(profile.realEstateHousehold, rule.realEstateLimit, '全家不動產', matched, missing, conflicts);

  if (program.id === '5' || program.id === '6') {
    missing.push('動產門檻需依家戶人數計算，本版不自動判定');
  }
  if (program.id === '9') {
    missing.push('醫療費用、財稅與保護安置資格仍需承辦單位審核');
  }
  if (program.id === '10') {
    missing.push('急難事由與申請時效仍需區公所認定');
  }

  const status: EligibilityStatus = conflicts.length ? 'unlikely' : missing.length ? 'review' : 'possible';
  return { program, status, matched, missing, conflicts };
}

export function evaluateBenefits(profile: EligibilityProfile, today = new Date()): EligibilityResult[] {
  const priority: Record<EligibilityStatus, number> = { possible: 0, review: 1, unlikely: 2 };
  return BENEFIT_PROGRAMS.map((program) => evaluateBenefit(program, profile, today)).sort(
    (left, right) => priority[left.status] - priority[right.status] || Number(left.program.id) - Number(right.program.id),
  );
}
