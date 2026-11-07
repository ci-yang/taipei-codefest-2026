import snapshot from '@/data/benefit-catalog.json';
import { ageFromBirthday, type EligibilityProfile } from './benefit-eligibility';

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
  applicationMethods: string;
  officialUrl: string;
}

export interface RankedCatalogProgram {
  program: CatalogProgram;
  category: CatalogCategory;
  score: number;
  reasons: string[];
}

export const CATALOG_SOURCE = snapshot.source;
export const CATALOG_PROGRAMS = snapshot.programs as CatalogProgram[];

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
    const reasons: string[] = [];
    let score = 0;

    if (program.online) score += 0.1;
    if (age !== null && age >= 65 && category === 'senior') {
      score += 6;
      reasons.push('年齡可能與長者方案相關');
    }
    if (age !== null && age >= 18 && age <= 40 && /青年/.test(text)) {
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
    if (selected.has('student') && /學生|就學|學費|留學|獎助學金/.test(text)) {
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
    if (selected.has('unemployed') && /失業|就業|職業訓練|職涯/.test(text)) {
      score += 6;
      reasons.push('你勾選了待業或失業情況');
    }
    if (selected.has('renter') && /租屋|租金|住宅/.test(text)) {
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
    return { program, category, score, reasons };
  }).sort((left, right) => right.score - left.score || left.program.name.localeCompare(right.program.name, 'zh-Hant'));
}
