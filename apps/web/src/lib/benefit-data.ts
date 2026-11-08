/**
 * 新北市政府「福利補助資訊」開放資料與 115 年度官方方案的結構化初篩規則。
 *
 * 所得、財產與家戶人口仍須由主管機關依最新法規審查；這裡只做保守的本機初篩。
 */

export type BenefitTrait =
  | 'lowIncome'
  | 'middleLowIncome'
  | 'student'
  | 'newTaipeiSchoolStudent'
  | 'disabled'
  | 'indigenous'
  | 'newImmigrant'
  | 'militaryFamily'
  | 'violenceVictim'
  | 'protectedOrPlaced'
  | 'recentEmergency'
  | 'specialFamilyCircumstance'
  | 'farmer'
  | 'petOwner'
  | 'renter'
  | 'noOwnedHome'
  | 'noOtherHousingSubsidy'
  | 'single'
  | 'married'
  | 'newlywedWithin2Years'
  | 'minorChild'
  | 'childUnder15'
  | 'newTaipeiWorkOrStudy'
  | 'currentlyPregnant'
  | 'pregnantOrRecentLoss'
  | 'recentBirth'
  | 'infantUnder2'
  | 'childAge2To5'
  | 'childUnder6'
  | 'homeCareWithoutPublicChildcare'
  | 'publicOrQuasiChildcare'
  | 'childcare30Hours'
  | 'childNotPubliclyPlaced'
  | 'newTaipeiResidentTenMonths'
  | 'birthApplicationInTime'
  | 'secondChild'
  | 'thirdOrLaterChild'
  | 'spouseNewTaipeiResident'
  | 'medicalFinancialHardship'
  | 'seriouslyIllSenior'
  | 'immuneCompromised'
  | 'assistiveDeviceNeeded'
  | 'assistiveDeviceSubsidyConditionsMet'
  | 'childMedicalEligibility'
  | 'developmentalDelayChild'
  | 'elderCareRecipientEligible'
  | 'familyCaregiverEligible'
  | 'unemployed'
  | 'longTermUnemployed180Days'
  | 'atypicalWorker'
  | 'willingToTrain';

export interface BenefitRule {
  minAge?: number;
  maxAge?: number;
  requiresNewTaipei: boolean;
  requires183Days?: boolean;
  recognitionAny?: BenefitTrait[];
  traitAny?: BenefitTrait[];
  traitAll?: BenefitTrait[];
  incomeLimit?: number;
  movableAssetsLimit?: number;
  realEstateLimit?: number;
  specialCheck?: 'newTaipeiYouthRent' | 'newTaipeiConnection' | 'goodPregnancyRide' | 'shinglesVaccine';
}

export interface BenefitProgram {
  id: string;
  name: string;
  audience: string;
  benefitContent: string;
  officialIncome: string;
  officialAssets: string;
  otherConditions: string;
  office: string;
  contact: string;
  officialUrl: string;
  rule: BenefitRule;
}

const welfareUrl = (id: string) =>
  `https://welfare.ntpc.gov.tw/viewService/show/${id}?actionName=list6&fromOpa=1`;

export const BENEFIT_SOURCE = {
  name: '新北市政府福利補助資訊',
  provider: '新北市政府研究發展考核委員會',
  catalogUrl: 'https://data.ntpc.gov.tw/datasets/73c24d1c-e1f0-44ce-8a31-cf835ef37e74',
  resourceUrl:
    'https://data.ntpc.gov.tw/api/datasets/73c24d1c-e1f0-44ce-8a31-cf835ef37e74/json?page=0&size=1000',
  welfareUrl: 'https://welfare.ntpc.gov.tw/',
  catalogUpdatedAt: '每日更新',
  license: '政府資料開放授權條款第 1 版',
  count: 28,
  catalogCount: 152,
} as const;

export const ADDITIONAL_BENEFIT_SOURCES = [
  {
    name: '2026 新北市社會福利手冊',
    url: 'https://www.sw.ntpc.gov.tw/uploaddowndoc?dis=anounce&file=anounce%2F202605251059560.pdf&filedisplay=2026%E6%96%B0%E5%8C%97%E5%B8%82%E7%A4%BE%E6%9C%83%E7%A6%8F%E5%88%A9%E6%89%8B%E5%86%8A.pdf&flag=doc',
  },
  { name: '116 年度新北市青年租金補貼', url: 'https://www.planning.ntpc.gov.tw/home.jsp?act=be4f48068b2b0031&dataserno=fe742ca76643d3d08232f452a681532a&id=22' },
  { name: '新北市生育獎勵金', url: 'https://www.ca.ntpc.gov.tw/home.jsp?id=3af0fb3ede4a9056' },
] as const;

export const TRAIT_LABELS: Record<BenefitTrait, string> = {
  lowIncome: '已具低收入戶資格',
  middleLowIncome: '已具中低收入戶資格',
  student: '本人目前在學',
  newTaipeiSchoolStudent: '家中有 2 至 15 歲、戶籍或學籍在新北市的學童',
  disabled: '持有身心障礙證明',
  indigenous: '具原住民族身分',
  newImmigrant: '具新住民身分',
  militaryFamily: '屬役男家庭或軍公教遺族',
  violenceVictim: '遭遇家庭暴力或性侵害',
  protectedOrPlaced: '由政府保護、寄養或安置',
  recentEmergency: '近期因傷病、失業、死亡或災害陷入急難',
  specialFamilyCircumstance: '符合特殊境遇家庭或弱勢單親等情況',
  farmer: '具農漁民或農戶身分',
  petOwner: '飼養犬貓或由新北市公立動物之家認養',
  renter: '目前在新北市租屋居住',
  noOwnedHome: '本人、配偶及未成年子女均無自有住宅',
  noOtherHousingSubsidy: '未領中央租補或其他不得重複的住宅補助',
  single: '單身',
  married: '已婚',
  newlywedWithin2Years: '結婚登記未滿 2 年',
  minorChild: '家中有未成年子女或胎兒',
  childUnder15: '家中有未滿 15 歲子女',
  newTaipeiWorkOrStudy: '目前在新北市就業或就學',
  currentlyPregnant: '目前懷孕',
  pregnantOrRecentLoss: '懷孕，或近期自然流產／死產',
  recentBirth: '近期有新生兒',
  infantUnder2: '家中有未滿 2 歲兒童',
  childAge2To5: '家中有 2 歲至入國小前幼兒',
  childUnder6: '家中有未滿 6 歲兒童',
  homeCareWithoutPublicChildcare: '未領公共／準公共托育補助或就讀受補助幼兒園',
  publicOrQuasiChildcare: '送托公共、準公共或新北合作聯盟托育',
  childcare30Hours: '每週送托 30 小時以上',
  childNotPubliclyPlaced: '兒童未經政府公費安置',
  newTaipeiResidentTenMonths: '父或母符合新北市 10 個月設籍規定',
  birthApplicationInTime: '可在出生次日起 1 年內提出申請',
  secondChild: '該名兒童為第 2 名子女',
  thirdOrLaterChild: '該名兒童為第 3 名以上子女',
  spouseNewTaipeiResident: '本人未設籍，但配偶設籍新北市',
  medicalFinancialHardship: '有重大醫療支出且家庭經濟困難',
  seriouslyIllSenior: '家中有罹患重病的長者',
  immuneCompromised: '有免疫功能低下、高風險慢性病或重大傷病',
  assistiveDeviceNeeded: '有身心障礙輔具需求',
  assistiveDeviceSubsidyConditionsMet: '尚未購買，且符合補助年限與未重複補助規定',
  childMedicalEligibility: '兒少具早產、重大傷病、弱勢扶助等醫療補助身分',
  developmentalDelayChild: '家中有發展遲緩、疑似遲緩或身心障礙幼兒',
  elderCareRecipientEligible: '受照顧長者領中低收入老人津貼且經評估重度失能',
  familyCaregiverEligible: '16 至 64 歲家屬未全時工作並實際照顧長者',
  unemployed: '目前待業或失業',
  longTermUnemployed180Days: '未就學未就業連續 180 日以上',
  atypicalWorker: '近 2 年有非典型工作或平台接案經驗',
  willingToTrain: '有就業意願並願意參加職業訓練',
};

export const BENEFIT_PROGRAMS: BenefitProgram[] = [
  {
    id: '22024', name: '低收入戶資格與生活扶助',
    audience: '設籍並實際居住新北市、所得與財產低於 115 年門檻的家戶',
    benefitContent: '依款別每月發給：一款每人 13,303 元；二款每戶 6,825 元，未滿 15 歲子女每人另 3,008 元；學生、身障者及長者另有生活扶助。',
    officialIncome: '家庭平均每人每月低於 17,750 元', officialAssets: '動產每人每年不超過 10 萬元；全家不動產不超過 472 萬元',
    otherConditions: '最近一年居住國內超過 183 日；家戶人口與所得認列由區公所審查', office: '戶籍地區公所社會課／社會人文課', contact: '新北市社會局 02-2960-3456', officialUrl: welfareUrl('22024'),
    rule: { requiresNewTaipei: true, requires183Days: true, incomeLimit: 17_750, movableAssetsLimit: 100_000, realEstateLimit: 4_720_000 },
  },
  {
    id: '22208', name: '中低收入戶資格與相關扶助',
    audience: '設籍並實際居住新北市、所得與財產低於 115 年門檻的家戶',
    benefitContent: '核定後可取得健保費減免、未成年子女健保全額補助；列冊身心障礙者每月可領 4,049 或 5,437 元。',
    officialIncome: '家庭平均每人每月不超過 26,625 元', officialAssets: '動產每人每年不超過 15 萬元；全家不動產不超過 708 萬元',
    otherConditions: '最近一年居住國內超過 183 日；實際給付依家庭成員身分', office: '戶籍地區公所社會課／社會人文課', contact: '新北市社會局 02-2960-3456', officialUrl: welfareUrl('22208'),
    rule: { requiresNewTaipei: true, requires183Days: true, incomeLimit: 26_625, movableAssetsLimit: 150_000, realEstateLimit: 7_080_000 },
  },
  {
    id: '22180', name: '身心障礙者生活補助',
    audience: '設籍實住新北市、持身心障礙證明且所得財產符合規定者',
    benefitContent: '依障礙程度及低收身分，每月補助 4,049 至 9,485 元。',
    officialIncome: '115 年度每人每月不超過 39,960 元', officialAssets: '動產依家戶人數計算；全家不動產依年度標準',
    otherConditions: '近一年居住國內超過 183 日，且未受機構安置', office: '戶籍地區公所', contact: '新北市社會局身心障礙福利科', officialUrl: welfareUrl('22180'),
    rule: { requiresNewTaipei: true, requires183Days: true, traitAll: ['disabled'], incomeLimit: 39_960 },
  },
  {
    id: '22036', name: '中低收入老人生活津貼',
    audience: '65 歲以上、所得財產符合中低收入老人標準的新北市長者',
    benefitContent: '依所得級距每月發給 8,329 元或 4,164 元。',
    officialIncome: '每人每月 26,625 元以下領 8,329 元；超過 26,625 元至 39,960 元領 4,164 元', officialAssets: '依中低收入老人審核標準',
    otherConditions: '須設籍並實際居住新北市，家戶人口仍由公所審查', office: '戶籍地區公所', contact: '新北市社會局老人福利科', officialUrl: welfareUrl('22036'),
    rule: { minAge: 65, requiresNewTaipei: true, requires183Days: true, incomeLimit: 39_960 },
  },
  {
    id: '22213', name: '強化社會安全網急難紓困',
    audience: '居住新北市，因死亡、失蹤、重傷病、失業或其他急難使生活陷困者',
    benefitContent: '依急難情況一次發給關懷救助金 10,000 至 30,000 元。',
    officialIncome: '由訪視評估急難與家庭經濟狀況', officialAssets: '無單一固定財產門檻', otherConditions: '急難事由、申請時效與救助金額由區公所訪視認定',
    office: '居住地區公所', contact: '衛福部 1957 福利諮詢專線或新北市 1999', officialUrl: welfareUrl('22213'),
    rule: { requiresNewTaipei: false, traitAll: ['recentEmergency'], specialCheck: 'newTaipeiConnection' },
  },
  {
    id: '22022', name: '市民醫療補助',
    audience: '低收、中低收或因重大醫療支出陷入經濟困難的新北市民',
    benefitContent: '符合特定福利身分者扣除不補助項目後全額補助；其他資格途徑補助 70% 至 80%，每人每年最高 15 萬至 20 萬元。',
    officialIncome: '依福利身分或財稅調查認定', officialAssets: '依申請資格途徑查調', otherConditions: '應於就醫、出院或死亡後 3 個月內向戶籍地區公所申請',
    office: '戶籍地區公所', contact: '新北市社會局社會救助科', officialUrl: welfareUrl('22022'),
    rule: { requiresNewTaipei: true, traitAny: ['lowIncome', 'middleLowIncome', 'medicalFinancialHardship'] },
  },
  {
    id: '22025', name: '低收入戶產婦生育及營養補助',
    audience: '設籍新北市的列冊低收入戶產婦，含妊娠滿 3 個月後自然流產或死產者',
    benefitContent: '每次補助 20,400 元。', officialIncome: '須具低收入戶資格', officialAssets: '隨低收入戶資格審查',
    otherConditions: '出生、自然流產或死產日起 3 個月內申請', office: '戶籍地區公所', contact: '新北市社會局社會救助科', officialUrl: welfareUrl('22025'),
    rule: { requiresNewTaipei: true, traitAll: ['lowIncome'], traitAny: ['recentBirth', 'pregnantOrRecentLoss'] },
  },
  {
    id: '163', name: '新北市青年租金補貼',
    audience: '18 至 39 歲，在新北市就業或就學並租屋的單身、新婚或育兒青年',
    benefitContent: '116 年度每月補貼：單身 3,500 元、新婚 4,500 元；育有 1 名未成年子女 5,000 元、2 名 6,000 元、3 名以上 7,000 元。',
    officialIncome: '家庭年收入低於 145 萬元，且平均每人每月收入低於 62,125 元', officialAssets: '家庭成員在新北市、臺北市、桃園市及基隆市均無自有住宅',
    otherConditions: '須在新北市就業或就學且租屋；不得重複領中央租補或其他互斥住宅補助', office: '新北市政府城鄉發展局住宅發展科', contact: '02-8979-8800', officialUrl: 'https://nths.ntpc.gov.tw/FC',
    rule: { minAge: 18, maxAge: 39, requiresNewTaipei: false, traitAll: ['renter', 'noOwnedHome', 'noOtherHousingSubsidy', 'newTaipeiWorkOrStudy'], traitAny: ['single', 'married', 'currentlyPregnant', 'minorChild'], incomeLimit: 62_125, specialCheck: 'newTaipeiYouthRent' },
  },
  {
    id: '22042', name: '身心障礙者房屋租金補貼',
    audience: '設籍實住新北市、持身心障礙證明並在新北市租屋者',
    benefitContent: '補助租金 50% 內：單身每月最高 2,400 元、2 人家庭 3,200 元、3 人以上 4,400 元。',
    officialIncome: '家庭平均每人每月原則不超過 39,960 元', officialAssets: '家庭在新北市、臺北市、桃園市及基隆市無自有住宅',
    otherConditions: '租屋須位於新北市，且不得重複領取性質相同的住宅補助', office: '戶籍地區公所', contact: '新北市社會局身心障礙福利科', officialUrl: welfareUrl('22042'),
    rule: { requiresNewTaipei: true, traitAll: ['disabled', 'renter', 'noOwnedHome', 'noOtherHousingSubsidy'], incomeLimit: 39_960 },
  },
  {
    id: '1008103', name: '新北市生育獎勵金',
    audience: '符合設籍期間並在期限內申請的新生兒父母',
    benefitContent: '115 年出生的新生兒：第 1 名 40,000 元、第 2 名 45,000 元、第 3 名以上 50,000 元。',
    officialIncome: '不設所得門檻', officialAssets: '不設財產門檻', otherConditions: '父或母須符合 10 個月設籍規定，且於出生次日起 1 年內申請',
    office: '新北市任一戶政事務所', contact: '各戶政事務所', officialUrl: welfareUrl('1008103'),
    rule: { requiresNewTaipei: true, traitAll: ['recentBirth', 'newTaipeiResidentTenMonths', 'birthApplicationInTime'] },
  },
  {
    id: '1008029', name: '未滿 2 歲兒童育兒津貼',
    audience: '設籍新北市、未受公共或準公共托育且未公費安置的未滿 2 歲兒童',
    benefitContent: '依出生序每月發給：第 1 名 5,000 元、第 2 名 6,000 元、第 3 名以上 7,000 元。',
    officialIncome: '無排富門檻', officialAssets: '不查財產', otherConditions: '未接受公共／準公共托育服務，且未經政府公費安置', office: '各區公所社會課／社會人文課', contact: '新北市社會局兒童托育科', officialUrl: welfareUrl('1008029'),
    rule: { requiresNewTaipei: true, traitAll: ['infantUnder2', 'homeCareWithoutPublicChildcare', 'childNotPubliclyPlaced'] },
  },
  {
    id: '268437092', name: '2 歲至入國小前育兒津貼／就學補助',
    audience: '2 歲至入國小前、未領互斥托育補助或公費安置的幼兒',
    benefitContent: '依出生序每月發給：第 1 名 5,000 元、第 2 名 6,000 元、第 3 名以上 7,000 元。',
    officialIncome: '112 年起取消排富', officialAssets: '不查財產', otherConditions: '不得同時領 0 至 2 歲育兒津貼、公共／準公共托育補助或就讀指定受補助幼兒園', office: '幼兒戶籍地區公所', contact: '新北市教育局幼兒教育科 02-2252-2395', officialUrl: welfareUrl('268437092'),
    rule: { requiresNewTaipei: true, traitAll: ['childAge2To5', 'homeCareWithoutPublicChildcare', 'childNotPubliclyPlaced'] },
  },
  {
    id: '1008042', name: '公共、準公共與合作聯盟托育補助',
    audience: '將未滿 3 歲兒童送托公共、準公共或新北合作聯盟托育的家庭',
    benefitContent: '準公共每月 13,000 至 17,000 元；公共托育每月 7,000 至 9,000 元；新北合作聯盟另加 2,000 或 3,000 元，並依第 2／3 名子女加碼。',
    officialIncome: '無排富門檻；低收、中低收及弱勢家庭提高補助', officialAssets: '不查財產', otherConditions: '每週送托 30 小時以上、未公費安置、未同時領育兒津貼', office: '送托地居家托育服務中心或托嬰中心', contact: '新北市社會局兒童托育科', officialUrl: welfareUrl('1008042'),
    rule: { requiresNewTaipei: true, traitAll: ['infantUnder2', 'publicOrQuasiChildcare', 'childcare30Hours', 'childNotPubliclyPlaced'] },
  },
  {
    id: '22039', name: '特殊境遇家庭各項扶助',
    audience: '遭遇喪偶、家暴、單親照顧、配偶服刑或重大變故的家庭',
    benefitContent: '包含緊急生活扶助（最低生活費 1 倍、最高 3 個月）、子女生活津貼、傷病醫療、法律訴訟、教育及托育等扶助。',
    officialIncome: '家庭平均每人每月未超過最低生活費 2.5 倍', officialAssets: '依特殊境遇家庭扶助規定', otherConditions: '須符合七類特殊境遇之一；部分項目有 6 個月申請期限', office: '戶籍地區公所或社會福利服務中心', contact: '新北市社會局', officialUrl: welfareUrl('22039'),
    rule: { requiresNewTaipei: true, traitAll: ['specialFamilyCircumstance'], incomeLimit: 44_375 },
  },
  {
    id: '1008023', name: '身心障礙者輔具費用補助',
    audience: '持新北市身心障礙證明且有輔具需求者',
    benefitContent: '依中央輔具補助基準表核定品項與額度；原則每人每 2 年補助 4 項輔具。',
    officialIncome: '依身分別決定補助比例', officialAssets: '部分品項或身分須審查', otherConditions: '必須先申請核定再購買，並於核定後 6 個月內購置及請款', office: '新北市輔具資源中心', contact: '02-8286-7045', officialUrl: welfareUrl('1008023'),
    rule: { requiresNewTaipei: true, traitAll: ['disabled', 'assistiveDeviceNeeded', 'assistiveDeviceSubsidyConditionsMet'] },
  },
  {
    id: '22170', name: '65 至 69 歲中低收入老人健保費補助',
    audience: '65 歲以上未滿 70 歲的中低收入老人',
    benefitContent: '每人每月最高補助健保第六類地區人口自付額 826 元。',
    officialIncome: '須具中低收入老人資格', officialAssets: '隨中低收入老人資格審查', otherConditions: '原則由政府主動媒體申報；漏未減免者可申請核退', office: '戶籍地區公所', contact: '新北市社會局老人福利科', officialUrl: welfareUrl('22170'),
    rule: { minAge: 65, maxAge: 69, requiresNewTaipei: true, traitAll: ['middleLowIncome'] },
  },
  {
    id: '22183', name: '弱勢兒童及少年醫療補助',
    audience: '設籍新北市且具低收、中低收、弱勢扶助、早產或重大傷病等身分的兒少',
    benefitContent: '補助健保未給付的必要醫療、住院看護、早產兒醫療等費用；項目與上限依身分及實際支出核定。',
    officialIncome: '依既有弱勢或醫療資格認定', officialAssets: '依資格途徑', otherConditions: '同一事件已取得其他政府醫療扶助者不重複補助', office: '戶籍地區公所', contact: '新北市社會局兒童少年福利科', officialUrl: welfareUrl('22183'),
    rule: { requiresNewTaipei: true, traitAll: ['minorChild', 'childMedicalEligibility'] },
  },
  {
    id: '22216', name: '新北市好孕專車車資補貼',
    audience: '設籍新北市孕婦，或配偶設籍新北市的非本國籍孕婦',
    benefitContent: '每趟最高補貼 250 元，最多 36 趟，合計最高 9,000 元；使用至預產期後 6 個月。',
    officialIncome: '不設所得門檻', officialAssets: '不設財產門檻', otherConditions: '須在預產期前提出申請，並使用合作車隊', office: '線上申請後使用「我的新北市」App', contact: '新北市社會局', officialUrl: welfareUrl('22216'),
    rule: { requiresNewTaipei: false, traitAll: ['currentlyPregnant'], specialCheck: 'goodPregnancyRide' },
  },
  {
    id: '22008', name: '中低收入老人特別照顧津貼',
    audience: '由家屬實際照顧的重度失能中低收入老人',
    benefitContent: '每月補助實際照顧家屬 5,000 元。',
    officialIncome: '受照顧者須領中低收入老人生活津貼', officialAssets: '隨中低收入老人資格審查', otherConditions: '受照顧者不得接受機構、居服、日照或僱用看護；照顧者須 16 至 64 歲且未全時工作', office: '戶籍地區公所', contact: '新北市社會局老人福利科', officialUrl: welfareUrl('22008'),
    rule: { requiresNewTaipei: true, traitAll: ['elderCareRecipientEligible', 'familyCaregiverEligible'] },
  },
  {
    id: '22020', name: '弱勢兒童少年生活扶助',
    audience: '未滿 18 歲、家庭經濟及處境符合規定且未領其他互斥生活扶助者',
    benefitContent: '未滿 6 歲每人每月 2,313 元；6 歲以上未滿 18 歲每人每月 2,197 元。',
    officialIncome: '家庭平均每人每月不超過 26,625 元', officialAssets: '全家動產不超過 80 萬元；不動產不超過 650 萬元', otherConditions: '須有父母死亡、離婚、失蹤、重大傷病、服刑或未成年生育等困境之一', office: '戶籍地區公所', contact: '新北市社會局兒童少年福利科', officialUrl: welfareUrl('22020'),
    rule: { requiresNewTaipei: true, traitAll: ['minorChild', 'specialFamilyCircumstance'], incomeLimit: 26_625, realEstateLimit: 6_500_000 },
  },
  {
    id: '22081', name: '弱勢家庭兒童及少年緊急生活扶助',
    audience: '因父母失業、入獄、重大傷病、死亡、失蹤或家暴等使生活陷困的兒少',
    benefitContent: '核定兒少每人每月補助 3,000 元，原則扶助 6 個月。',
    officialIncome: '依弱勢家庭審查標準', officialAssets: '依家庭經濟狀況審查', otherConditions: '急難原因須導致家庭無力維持生活，且不得重複領取互斥扶助', office: '戶籍地區公所', contact: '新北市社會局兒童少年福利科', officialUrl: welfareUrl('22081'),
    rule: { requiresNewTaipei: true, traitAll: ['minorChild', 'recentEmergency'] },
  },
  {
    id: '22016', name: '發展遲緩兒童療育補助',
    audience: '設籍新北市的未達學齡發展遲緩、疑似遲緩或身心障礙兒童',
    benefitContent: '療育訓練及交通費合計：一般戶每月最高 4,000 元；低收入戶或安置兒童每月最高 6,000 元。',
    officialIncome: '一般戶也可申請；低收入戶提高上限', officialAssets: '不設統一財產門檻', otherConditions: '須持有效診斷、評估或身心障礙證明，並檢附合格療育單位單據', office: '新北市社會局兒童托育科', contact: '02-2960-3456 轉 3652、3662、3660、3859', officialUrl: welfareUrl('22016'),
    rule: { requiresNewTaipei: true, traitAll: ['childUnder6', 'developmentalDelayChild'] },
  },
  {
    id: '268437678', name: '新北市青年全方位就業計畫',
    audience: '18 至 29 歲、設籍或實際居住新北市的長期未就業或非典型勞動青年',
    benefitContent: '尋職青年最高 30,000 元；非典型勞動青年含轉業獎勵最高 45,000 元。',
    officialIncome: '不以家戶所得為主要門檻', officialAssets: '不查家戶財產', otherConditions: '未在學、有就業及參訓意願，並符合長期未就業、非典型工作或轉介資格之一', office: '新北市就業服務處所屬站臺', contact: '02-2246-5066 轉 1142', officialUrl: welfareUrl('268437678'),
    rule: { minAge: 18, maxAge: 29, requiresNewTaipei: false, traitAll: ['unemployed', 'willingToTrain'], traitAny: ['longTermUnemployed180Days', 'atypicalWorker'], specialCheck: 'newTaipeiConnection' },
  },
  {
    id: '268437101', name: '家犬貓絕育補助',
    audience: '設籍新北市飼主，或認養新北市公立動物之家犬貓者',
    benefitContent: '設籍飼主：公犬貓 600 元、母犬貓 1,200 元；公立動物之家認養：公犬貓 1,000 元、母犬貓 2,000 元。',
    officialIncome: '不設所得門檻', officialAssets: '不設財產門檻', otherConditions: '術後 14 日內申請，依先申請先審核至預算用罄', office: '新北市動物保護防疫處', contact: '02-2959-6353', officialUrl: welfareUrl('268437101'),
    rule: { requiresNewTaipei: true, traitAll: ['petOwner'] },
  },
  {
    id: '268437690', name: '高齡弱勢市民免費帶狀疱疹疫苗',
    audience: '65 歲以上（原住民 55 歲以上）的新北市低收或中低收入戶',
    benefitContent: '全額補助接種 2 劑帶狀疱疹疫苗。',
    officialIncome: '須具低收入戶或中低收入戶資格', officialAssets: '隨福利身分審查', otherConditions: '115 年 9 月 1 日起不再限制疾病條件，至新北市 29 區衛生所接種', office: '新北市各區衛生所', contact: '新北市衛生局 02-2257-7155 轉 1837', officialUrl: welfareUrl('268437690'),
    rule: { requiresNewTaipei: true, recognitionAny: ['lowIncome', 'middleLowIncome'], specialCheck: 'shinglesVaccine' },
  },
  {
    id: '268437687', name: '鮮奶幸福週—生生喝鮮乳',
    audience: '2 至 15 歲，戶籍或學籍在新北市的學幼童',
    benefitContent: '全年 52 週，每週可兌領 1 瓶指定鮮乳、豆漿或優酪乳；未兌領不能累積至次週。',
    officialIncome: '不設所得門檻', officialAssets: '不設財產門檻', otherConditions: '使用幸福卡、兒童卡或數位學生證於合作通路兌領', office: '新北市教育局', contact: '02-2960-3456 轉 2780', officialUrl: welfareUrl('268437687'),
    rule: { requiresNewTaipei: false, traitAll: ['newTaipeiSchoolStudent'] },
  },
  {
    id: '268437691', name: '新北市學生免費營養午餐',
    audience: '就讀新北市公私立國民中小學的學生',
    benefitContent: '學期間週一至週五上課日，每人每餐定額補助 75 元，由學校直接供餐。',
    officialIncome: '不設所得門檻', officialAssets: '不設財產門檻', otherConditions: '學生無須另行申請或提供證明', office: '就讀學校', contact: '新北市教育局', officialUrl: welfareUrl('268437691'),
    rule: { requiresNewTaipei: false, traitAll: ['newTaipeiSchoolStudent'] },
  },
  {
    id: '268437141', name: '新北市弱勢家庭坐月子到宅服務',
    audience: '生育新生兒且符合新北市弱勢資格的家庭',
    benefitContent: '免費提供 120 小時坐月子到宅服務，折合 36,000 元，包含產婦、新生兒照顧、簡易家務與月子餐。',
    officialIncome: '依低收、中低收或弱勢家庭資格', officialAssets: '依福利身分審查', otherConditions: '須有近期新生兒並符合方案所列弱勢資格', office: '新北市社會局', contact: '新北市 1999', officialUrl: welfareUrl('268437141'),
    rule: { requiresNewTaipei: true, traitAll: ['recentBirth'], recognitionAny: ['lowIncome', 'middleLowIncome', 'specialFamilyCircumstance'] },
  },
];
