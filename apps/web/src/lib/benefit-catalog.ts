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
  tags: string[];
  online: boolean;
  counter: boolean;
  onlineAcceptStatus?: 'Accepting' | 'NeedLoginAccount' | 'NotPeriodAccepting' | 'StopAccepting' | 'Unknown';
  acceptPeriod?: string;
  acceptStopReason?: string;
  applicationMethods: string;
  officialUrl: string;
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

export interface CatalogBenefit {
  content: string;
  isConcrete: boolean;
  note: string;
}

export interface CatalogAcceptance {
  status: 'open' | 'closed' | 'unknown';
  note: string;
  onlineStatus: 'open' | 'closed' | 'unknown';
  counterStatus: 'open' | 'closed';
}

export const CATALOG_SOURCE = snapshot.source;
export const CATALOG_PROGRAMS = snapshot.programs as CatalogProgram[];

const DEEP_PROGRAM_BY_ID = new Map(BENEFIT_PROGRAMS.map((program) => [program.id, program]));
const CATALOG_TO_DEEP_PROGRAM: Record<string, string> = {
  AC042: '16',
  AE001: '17',
  AI001: '24',
  AI004: '20',
  AI005: '6',
  AI013: '21',
  AI022: '9',
  AI030: '22',
  AI031: '10',
  AI032: '25',
  AI040: '4',
  AI043: '8',
  AI053: '7',
  AI054: '2',
  AI063: '18',
  AI085: '9',
  AI094: '5',
  AL039: '23',
  BE018: '15',
  EG001: '17',
  EG002: '17',
  EG003: '17',
  EO006: '10',
  EP003: '6',
  EP004: '5',
};

const CONCRETE_CATALOG_BENEFITS: Record<string, string> = {
  AI041: '本項是取得「低收入戶」身分，不是固定現金；核定後可依戶別與家庭成員身分申請生活、醫療、就學、托育及住宅等扶助。',
  AL087: '每案最高補助 32,000 元：凍卵療程 20,000 元，終身 1 次；保存費每年最高 3,000 元、最多 4 年。',
  AL088: '人工生殖（試管嬰兒）療程依實際費用補助，每次最高 25,000 元，每年限 1 次。',
  BE005: '原住民族服飾購製每人每年限 1 套：0 至 6 歲 1,500 元、7 至 12 歲 2,000 元、13 歲以上 2,500 元。',
  BE036: '補助心理諮商費，不含掛號等其他費用；每人每年最多 6 次，每次最高 1,600 元。',
  BE039: '補助平板電腦實際購置金額的 80%，每人最高 10,000 元，每 3 年限申請 1 次。',
  BE022: '職業訓練生活津貼差額每年限申請 1 次，最高補助 30,000 元。',
  BE026: '職業訓練學費及材料費：首次申請每年最高 30,000 元，再次申請每年最高 15,000 元。',
  EA012: '雇主每聘僱 1 名符合資格的本國籍照顧服務員，每月補助 10,000 元，最長 12 個月。',
  EA014: '個案津貼按公告每小時基本工資核給、每月不超過基本工資；用人單位行政管理及輔導費按實際津貼的 30% 核給。',
  EA016: '符合資格的特定對象失業者穩定就業後，每人每月補助 5,000 元，2 年內合計最長 6 個月。',
  EA018: '依就業地與原居住地距離，每月補助交通費 1,000、2,000 或 3,000 元，最長 12 個月。',
  EA019: '搬遷費依收據核實補助，每人每次最高 30,000 元。',
  EA020: '補助租約所列租金的 60%，每月最高 5,000 元，最長 12 個月。',
  EA026: '勞動部穩定就業津貼每月 5,000 元，最長 36 個月；另有教育部每月 5,000 元準備金，合計每月 10,000 元。',
};

/** 這些目錄案件的申請人明確是雇主、事業、機構或團體，不是個人市民。 */
const NON_PERSONAL_CATALOG_IDS = new Set([
  'AF014',
  'AF127',
  'AJ018',
  'AJ047',
  'AJ063',
  'AO034',
  'AO049',
  'AX001',
  'BE007',
  'BE016',
  'BE020',
  'BF007',
  'BU011',
  'BU048',
  'EA012',
  'EB003',
  'EB004',
  'EB006',
  'EB008',
  'EB009',
  'EB011',
  'PO006',
  'PO010',
]);

const FIXED_ACCEPTANCE_WINDOWS: Record<string, { start: string; end: string; note: string }> = {
  AJ054: { start: '2026-01-01', end: '2026-11-30', note: '115 年受理至 11 月 30 日。' },
  BE005: { start: '2026-01-01', end: '2026-11-30', note: '115 年受理至 11 月底。' },
  BE039: { start: '2026-01-01', end: '2026-12-20', note: '115 年受理至 12 月 20 日。' },
  BU003: { start: '2026-01-01', end: '2026-12-20', note: '115 年原則受理至 12 月 20 日，仍可能提前用罄。' },
  BU007: { start: '2026-01-01', end: '2026-12-20', note: '115 年原則受理至 12 月 20 日，仍可能提前用罄。' },
  PO003: { start: '2026-08-01', end: '2026-11-10', note: '115 年最遲應於 11 月 10 日前送件。' },
  PO004: { start: '2026-01-01', end: '2026-11-30', note: '115 年原則受理至 11 月 30 日。' },
  PO010: { start: '2026-01-01', end: '2026-11-10', note: '115 年實習單位最後申請日為 11 月 10 日。' },
};

const RECURRING_ACCEPTANCE_WINDOWS: Record<string, Array<{ start: [number, number]; end: [number, number] }>> = {
  AE002: [
    { start: [3, 1], end: [4, 15] },
    { start: [9, 1], end: [10, 15] },
  ],
  BE018: [
    { start: [4, 1], end: [4, 30] },
    { start: [8, 1], end: [8, 31] },
  ],
};

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthDayKey(month: number, day: number): number {
  return month * 100 + day;
}

export function catalogAcceptance(program: CatalogProgram, today = new Date()): CatalogAcceptance {
  const onlineStatus =
    program.onlineAcceptStatus === 'Accepting' || program.onlineAcceptStatus === 'NeedLoginAccount'
      ? 'open'
      : program.onlineAcceptStatus === 'NotPeriodAccepting' || program.onlineAcceptStatus === 'StopAccepting'
        ? 'closed'
        : 'unknown';
  const counterStatus = program.counter ? 'open' : 'closed';

  if (program.id === 'PO006') {
    return {
      status: 'closed',
      note: '115 年 6 月 16 日起不再受理，且作業要點已於 115 年 11 月 5 日廢止。',
      onlineStatus: 'closed',
      counterStatus: 'closed',
    };
  }

  if (program.id === 'EA016') {
    return {
      status: 'closed',
      note: '115 年度補助預算已用罄，官方自 115 年 8 月 31 日起不再受理。',
      onlineStatus: 'closed',
      counterStatus: 'closed',
    };
  }

  const fixed = FIXED_ACCEPTANCE_WINDOWS[program.id];
  if (fixed) {
    const todayKey = localDateKey(today);
    return {
      status: todayKey >= fixed.start && todayKey <= fixed.end ? 'open' : 'closed',
      note: fixed.note,
      onlineStatus,
      counterStatus,
    };
  }

  const recurring = RECURRING_ACCEPTANCE_WINDOWS[program.id];
  if (recurring) {
    const current = monthDayKey(today.getMonth() + 1, today.getDate());
    const isOpen = recurring.some(
      (window) => current >= monthDayKey(...window.start) && current <= monthDayKey(...window.end),
    );
    return {
      status: isOpen ? 'open' : 'closed',
      note:
        program.id === 'BE018'
          ? '每年僅 4 月 1 日至 4 月 30 日、8 月 1 日至 8 月 31 日受理。'
          : '每年僅 3 月 1 日至 4 月 15 日、9 月 1 日至 10 月 15 日受理。',
      onlineStatus,
      counterStatus,
    };
  }

  if (onlineStatus === 'closed') {
    if (counterStatus === 'open') {
      return {
        status: 'open',
        note: '線上申辦目前暫停；官方案件頁仍列臨櫃申辦。',
        onlineStatus,
        counterStatus,
      };
    }
    return {
      status: 'closed',
      note: program.acceptStopReason || program.acceptPeriod || '官方案件頁目前顯示暫停受理。',
      onlineStatus,
      counterStatus,
    };
  }

  if (onlineStatus === 'open') {
    return {
      status: 'open',
      note: program.onlineAcceptStatus === 'NeedLoginAccount' ? '官方案件頁顯示登入後可申辦。' : '官方案件頁顯示可線上申辦。',
      onlineStatus,
      counterStatus,
    };
  }

  return {
    status: counterStatus === 'open' ? 'open' : 'unknown',
    note: counterStatus === 'open' ? '官方案件頁仍列臨櫃申辦。' : '官方目錄未提供可機讀的即時受理狀態。',
    onlineStatus,
    counterStatus,
  };
}

export function catalogOfficialSearchUrl(program: CatalogProgram): string {
  const query = new URLSearchParams({
    codeKind: '',
    classificationCode: '',
    keyword: program.name,
    p: '1',
  });
  return `${CATALOG_SOURCE.catalogUrl}?${query.toString()}`;
}

const CHILD_TRAITS: BenefitTrait[] = [
  'infantUnder2',
  'recentBirth',
  'minorChild',
  'childUnder12',
  'childUnder3',
  'childAge2To5',
  'childUnder6',
  'homeCareWithoutPublicChildcare',
  'publicOrQuasiChildcare',
  'childcare30Hours',
  'childNotPubliclyPlaced',
  'northNorthKeelungTenMonths',
  'birthApplicationInTime',
  'childTaipeiResident',
  'parentTaipeiTenMonths',
  'childMedicalSpecialEligibility',
  'thirdOrLaterChildUnder6',
];

function hasAnyTrait(selected: Set<BenefitTrait>, required: BenefitTrait[]): boolean {
  return required.some((trait) => selected.has(trait));
}

function catalogExclusionReasons(program: CatalogProgram, selected: Set<BenefitTrait>, age: number | null): string[] {
  const name = program.name;
  const reasons: string[] = [];
  const excludeUnless = (matches: boolean, allowed: boolean, reason: string) => {
    if (matches && !allowed && !reasons.includes(reason)) reasons.push(reason);
  };
  const hasChild = hasAnyTrait(selected, CHILD_TRAITS);
  const isSeniorOrCaregiver =
    (age !== null && age >= 55) ||
    selected.has('seriouslyIllSenior') ||
    selected.has('elderCareRecipientEligible') ||
    selected.has('familyCaregiverEligible');

  if (NON_PERSONAL_CATALOG_IDS.has(program.id)) reasons.push('申請對象是雇主、事業、機構或團體，不是個人市民');
  excludeUnless(/原住民|原住民族/.test(name), selected.has('indigenous'), '未勾選原住民族身分');
  excludeUnless(/新住民/.test(name), selected.has('newImmigrant'), '未勾選新住民身分');
  excludeUnless(/役男|服兵役|服義務役/.test(name), selected.has('militaryFamily'), '未勾選役男家屬或遺屬身分');
  excludeUnless(/家庭暴力被害人|性侵害被害人/.test(name), selected.has('violenceVictim'), '未勾選暴力或性侵害被害情況');
  excludeUnless(/特殊境遇家庭/.test(name), selected.has('specialFamilyCircumstance'), '未勾選特殊境遇家庭情況');
  excludeUnless(/\b(?:AT084|EN001|EN003)\b/.test(program.id), selected.has('farmer'), '未勾選農戶身分');
  excludeUnless(/\b(?:BU003|BU007|BU008)\b/.test(program.id), selected.has('petOwner'), '未勾選飼主或動物照護情況');
  excludeUnless(
    /身心障礙者|身心障礙人員|身心障礙.*藝人|視障按摩|失能者/.test(name),
    selected.has('disabled') || selected.has('assistiveDeviceNeeded'),
    '未勾選身心障礙或輔具需求',
  );
  excludeUnless(/老人|高齡|長者/.test(name) && age !== null, isSeniorOrCaregiver, '年齡與高齡照顧資料不符');
  excludeUnless(/青年/.test(name) && age !== null, age !== null && age >= 15 && age <= 45, '年齡不在青年方案的保守範圍');
  excludeUnless(
    program.id === 'AI001',
    selected.has('currentlyPregnant') || selected.has('pregnancyHealthHandbook') || selected.has('pregnantOrRecentLoss'),
    '未勾選目前孕產情況',
  );
  excludeUnless(
    program.id === 'AC042' || program.id === 'AI043',
    selected.has('recentBirth') || selected.has('birthApplicationInTime') || selected.has('infantUnder2'),
    '未勾選近期生育事實',
  );
  excludeUnless(
    (/兒童|幼兒|嬰兒|育兒|托育|新生兒/.test(name) || program.id === 'AI067') && program.id !== 'AI053',
    hasChild,
    '未填寫家中有兒童或幼兒',
  );
  excludeUnless(
    /學生|就學費用|就學生活|就學交通|留學生/.test(name),
    selected.has('student') || hasChild,
    '未勾選在學或家中有就學子女',
  );
  excludeUnless(/失業|跨域就業/.test(name) || program.id === 'EA003', selected.has('unemployed') || selected.has('involuntaryUnemployed'), '未勾選待業或失業情況');
  excludeUnless(/租屋/.test(name), selected.has('renter'), '未勾選目前在臺北市租屋');
  excludeUnless(/急難|災害救助/.test(name), selected.has('recentEmergency'), '未勾選近期急難事故');

  return reasons;
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

function searchable(program: CatalogProgram): string {
  return [program.name, program.summary, ...program.tags].join(' ');
}

function genericBenefit(program: CatalogProgram): string {
  const name = program.name.replace(/^\d+[、.．]\s*/, '').replace(/(?:申請|核定|查定|資格鑑定)$/, '').trim();
  if (/查定|資格|認定|證明|識別證/.test(program.name)) return `通過後可取得「${name}」資格或證明；這類項目不一定直接發放現金。`;
  if (/減免/.test(program.name)) return `通過後可減免「${name}」所列的稅費或費用。`;
  if (/貸款/.test(program.name)) return `通過後可取得「${name}」的貸款額度、利息或相關費用協助。`;
  if (/慰問金/.test(program.name)) return `通過後可取得「${name}」的一次性慰問金。`;
  if (/獎勵金|獎助學金|補助金|津貼|扶助|救助/.test(program.name)) return `通過後可取得「${name}」的現金給付或定期津貼。`;
  if (/補助/.test(program.name)) return `通過後可補助「${name}」所列的費用或服務。`;
  return `通過後可取得「${name}」所列的費用減免、金錢或服務協助。`;
}

export function catalogBenefit(program: CatalogProgram): CatalogBenefit {
  const deepProgramId = CATALOG_TO_DEEP_PROGRAM[program.id];
  const deepProgram = deepProgramId ? DEEP_PROGRAM_BY_ID.get(deepProgramId) : undefined;
  const concreteContent = deepProgram?.benefitContent ?? CONCRETE_CATALOG_BENEFITS[program.id];
  if (concreteContent) {
    return {
      content: concreteContent,
      isConcrete: true,
      note: '已依官方資料整理給付內容；實際核定仍以承辦機關最新公告為準。',
    };
  }

  return {
    content: genericBenefit(program),
    isConcrete: false,
    note: '台北服務通目錄未提供金額、比例或上限，需到官方頁面確認。',
  };
}

export function catalogCategory(program: CatalogProgram): CatalogCategory {
  const text = searchable(program);
  if (/原住/.test(text)) return 'indigenous';
  if (/身心障礙|身障|失能|輔具|氣切/.test(text)) return 'disability';
  if (/老人|高齡|長者/.test(text)) return 'senior';
  if (/育兒|托育|兒童|幼兒|嬰兒|生育|孕婦|孕產|家庭/.test(text)) return 'family';
  if (/醫療|健康|照護|看護|療育|生殖|凍卵|假牙/.test(text)) return 'medical';
  if (/學生|就學|學費|教育|留學|獎助學金/.test(text)) return 'education';
  if (/急難|災害|慰問|被害|性侵|家庭暴力|喪葬/.test(text)) return 'emergency';
  if (/住宅|租屋|住屋|房屋|建物|都市更新|耐震|外牆|化糞池/.test(text)) return 'housing';
  if (/地價稅|房屋稅|牌照稅|稅減免/.test(text)) return 'tax';
  if (/交通|乘車|車輛|機車|計程車|停車/.test(text)) return 'transport';
  if (/就業|失業|職業|勞工|職災|職場|技術士|創業|事業/.test(text)) return 'work';
  return 'other';
}

export function rankCatalogPrograms(profile: EligibilityProfile, today = new Date()): RankedCatalogProgram[] {
  const selected = new Set(profile.traits);
  const age = ageFromBirthday(profile.birthday, today);
  return CATALOG_PROGRAMS.map((program) => {
    const text = searchable(program);
    const category = catalogCategory(program);
    const benefit = catalogBenefit(program);
    const acceptance = catalogAcceptance(program, today);
    const exclusionReasons = catalogExclusionReasons(program, selected, age);
    const reasons: string[] = [];
    let score = 0;

    if (program.online) score += 0.1;
    if (age !== null && age >= 65 && category === 'senior') {
      score += 6;
      reasons.push('年齡可能與長者方案相關');
    }
    if (age !== null && age >= 18 && age <= 40 && /青年/.test(program.name)) {
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
    if ((selected.has('lowIncome') || selected.has('middleLowIncome')) && /低收入|中低收入|弱勢|清寒/.test(program.name)) {
      score += 7;
      reasons.push('你勾選了低收入或中低收入資格');
    }
    if (selected.has('student') && /學生|就學|學費|留學|獎助學金/.test(program.name)) {
      score += 6;
      reasons.push('你勾選了目前在學');
    }
    if (
      (selected.has('currentlyPregnant') || selected.has('pregnantOrRecentLoss') || selected.has('infantUnder2') || selected.has('recentBirth')) &&
      category === 'family'
    ) {
      score += 6;
      reasons.push('你填寫的孕產或育兒情況可能相關');
    }
    if (
      selected.has('unemployed') &&
      (/失業|就業津貼|就業獎勵|跨域就業|職業訓練|臨時工作/.test(program.name) || program.id === 'EA003')
    ) {
      score += 6;
      reasons.push('你勾選了待業或失業情況');
    }
    if (selected.has('renter') && /租屋|租金/.test(program.name)) {
      score += 6;
      reasons.push('你勾選了租屋居住');
    }
    if (selected.has('newImmigrant') && /新住民/.test(text)) {
      score += 7;
      reasons.push('你勾選了新住民身分');
    }
    if (selected.has('militaryFamily') && /役男|服役|遺屬/.test(text)) {
      score += 7;
      reasons.push('你勾選了役男家庭或遺屬身分');
    }
    if (selected.has('violenceVictim') && /家庭暴力|性侵害|被害/.test(text)) {
      score += 8;
      reasons.push('你勾選了暴力或性侵害被害情況');
    }
    if (selected.has('farmer') && /農戶|農業|耕地/.test(text)) {
      score += 6;
      reasons.push('你勾選了農戶身分');
    }
    if (selected.has('petOwner') && /犬|貓|寵物|動物/.test(text)) {
      score += 5;
      reasons.push('你勾選了飼主或動物照護情況');
    }
    if (selected.has('recentEmergency') && category === 'emergency') {
      score += 7;
      reasons.push('你勾選了近期急難情況');
    }
    if (selected.has('protectedOrPlaced') && /保護|安置/.test(text)) {
      score += 6;
      reasons.push('你勾選了保護或安置情況');
    }
    if (selected.has('specialFamilyCircumstance') && (category === 'family' || category === 'emergency')) {
      score += 7;
      reasons.push('你勾選了特殊境遇家庭情況');
    }
    if (selected.has('assistiveDeviceNeeded') && category === 'disability') {
      score += 6;
      reasons.push('你勾選了身心障礙輔具需求');
    }
    if (
      (selected.has('childMedicalSpecialEligibility') || selected.has('thirdOrLaterChildUnder6')) &&
      (category === 'family' || category === 'medical')
    ) {
      score += 6;
      reasons.push('你填寫的兒童醫療情況可能相關');
    }
    if ((selected.has('elderCareRecipientEligible') || selected.has('familyCaregiverEligible')) && category === 'senior') {
      score += 7;
      reasons.push('你勾選了高齡家庭照顧情況');
    }

    if (!reasons.length) reasons.push('官方服務目錄候選，尚無足夠欄位自動判斷');
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
