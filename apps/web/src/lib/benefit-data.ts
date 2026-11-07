/**
 * 臺北市政府社會局「臺北市社會救助補助項目」開放資料快照。
 *
 * 來源：https://data.gov.tw/dataset/129839
 * 資料集目錄更新：2026-10-13
 * 授權：政府資料開放授權條款第 1 版
 *
 * 原始開放資料有 10 筆，另依各主管機關現行官方頁面整理 15 項常用方案。
 * 部分門檻仍須由承辦單位依家戶組成、所得認列與最新法規複核；本檔不把初篩當成核定。
 */

export type BenefitTrait =
  | 'lowIncome'
  | 'middleLowIncome'
  | 'student'
  | 'disabled'
  | 'pregnantOrRecentLoss'
  | 'infantUnder2'
  | 'seriouslyIllSenior'
  | 'recentBirth'
  | 'protectedOrPlaced'
  | 'recentEmergency'
  | 'indigenous'
  | 'newImmigrant'
  | 'unemployed'
  | 'renter'
  | 'noOwnedHome'
  | 'centralRentApproved'
  | 'single'
  | 'married'
  | 'newlywedWithin2Years'
  | 'minorChild'
  | 'childUnder12'
  | 'taipeiResidentFourMonths'
  | 'childUnder3'
  | 'childAge2To5'
  | 'homeCareWithoutPublicChildcare'
  | 'publicOrQuasiChildcare'
  | 'childcare30Hours'
  | 'childNotPubliclyPlaced'
  | 'northNorthKeelungTenMonths'
  | 'birthApplicationInTime'
  | 'involuntaryUnemployed'
  | 'employmentInsuranceOneYear'
  | 'willingToWork'
  | 'jobRegistered14Days'
  | 'specialFamilyCircumstance'
  | 'spouseTaipeiResident'
  | 'assistiveDeviceNeeded'
  | 'assistiveDeviceSubsidyConditionsMet'
  | 'taipeiResidentOneYear'
  | 'taxRateUnder20'
  | 'noFullNhiSubsidy'
  | 'childTaipeiResident'
  | 'childUnder6'
  | 'parentTaipeiTenMonths'
  | 'childMedicalSpecialEligibility'
  | 'thirdOrLaterChildUnder6'
  | 'currentlyPregnant'
  | 'pregnancyHealthHandbook'
  | 'elderCareRecipientEligible'
  | 'familyCaregiverEligible'
  | 'militaryFamily'
  | 'violenceVictim'
  | 'farmer'
  | 'petOwner';

export interface BenefitRule {
  minAge?: number;
  maxAge?: number;
  requiresTaipei: boolean;
  requires183Days?: boolean;
  /** 這些是已認定資格；未勾選代表仍可詢問或先申請資格，不直接判成不符。 */
  recognitionAny?: BenefitTrait[];
  /** 客觀身分／事件；沒有符合任一項時，才判成目前可能不符。 */
  traitAny?: BenefitTrait[];
  /** 每一項都必須符合；未勾選即代表目前輸入不符。 */
  traitAll?: BenefitTrait[];
  incomeLimit?: number;
  incomeLimitOverride?: { traitAny: BenefitTrait[]; limit: number };
  movableAssetsLimit?: number;
  realEstateLimit?: number;
  specialCheck?:
    | 'taipeiHappinessRent'
    | 'specialFamilyResidence'
    | 'elderHealthInsurance'
    | 'childMedical'
    | 'goodPregnancyRide';
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

export const BENEFIT_SOURCE = {
  name: '臺北市社會救助補助項目',
  provider: '臺北市政府社會局',
  catalogUrl: 'https://data.gov.tw/dataset/129839',
  resourceUrl:
    'https://data.taipei/api/dataset/246337a0-751e-4523-a6c7-c185119b13d8/resource/549a3347-df6e-4bed-b818-368210d01544/download',
  catalogUpdatedAt: '2026-10-13',
  license: '政府資料開放授權條款第 1 版',
  count: 25,
  openDataCount: 10,
  additionalRuleCount: 15,
} as const;

export const ADDITIONAL_BENEFIT_SOURCES = [
  { name: '臺北市都市發展局居住服務', url: 'https://udd.gov.taipei/collection/oo2cmrc' },
  { name: '臺北市租金補貼網', url: 'https://rent-allowance.udd.gov.taipei/' },
  { name: '臺北市政府社會局育兒及托育補助', url: 'https://dosw.gov.taipei/Content_List.aspx?n=2C486AA08208CD74' },
  { name: '臺北市政府民政局生育補助', url: 'https://ca.gov.taipei/News_Content.aspx?n=59F2E04A34FDA3E8&s=B48A280E9EB5F920' },
  { name: '臺北市就業服務處失業給付', url: 'https://eso.gov.taipei/News_Content.aspx?n=B26586FCE6F04719&s=CDE5D0AFE68F030C&sms=87415A8B9CE81B16' },
  { name: '臺北市政府社會局特殊境遇家庭扶助', url: 'https://dosw.gov.taipei/News_Content.aspx?n=91F35523B74F69AC&s=F86046FC3A91FCAF&sms=87415A8B9CE81B16' },
  { name: '臺北市政府社會局身心障礙者輔具費用補助', url: 'https://dosw.gov.taipei/cp.aspx?n=49304F9B0793FFEF' },
  { name: '臺北市政府社會局老人健保補助', url: 'https://dosw.gov.taipei/cp.aspx?n=22B00B4927757FFE' },
  { name: '臺北市政府衛生局兒童醫療補助', url: 'https://health.gov.taipei/News_Content.aspx?n=232AD545CBF028A7&s=AD1271100D029C67&sms=D8A8AF6A9CFCB149' },
  { name: '臺北市好孕 2U 孕婦乘車補助', url: 'https://dosw.gov.taipei/News_Content.aspx?n=91F35523B74F69AC&s=79FC4665DF0CABCD&sms=87415A8B9CE81B16' },
  { name: '臺北市中低收入老人特別照顧津貼', url: 'https://dosw.gov.taipei/cp.aspx?n=3C3D1F78D6280694' },
] as const;

export const TRAIT_LABELS: Record<BenefitTrait, string> = {
  lowIncome: '已具低收入戶資格',
  middleLowIncome: '已具中低收入戶資格',
  student: '目前在學',
  disabled: '持有身心障礙證明',
  pregnantOrRecentLoss: '懷孕，或近 60 日內流產／死產',
  infantUnder2: '家中有 2 歲以下嬰兒',
  seriouslyIllSenior: '65 歲以上且罹患重病',
  recentBirth: '近期有生育事實',
  protectedOrPlaced: '由社會局保護或安置',
  recentEmergency: '近 3 個月內遭遇急難事故，生活陷入困境',
  indigenous: '具有原住民族身分',
  newImmigrant: '新住民',
  unemployed: '目前待業或失業',
  renter: '目前在臺北市租屋居住',
  noOwnedHome: '本人及家庭成員均無自有住宅',
  centralRentApproved: '已核准中央擴大租金補貼',
  single: '目前單身',
  married: '目前已婚',
  newlywedWithin2Years: '結婚登記未滿 2 年',
  minorChild: '本人或配偶育有未成年子女（含胎兒）',
  childUnder12: '本人或配偶育有 12 歲以下子女',
  taipeiResidentFourMonths: '已設籍並實際居住臺北市滿 4 個月',
  childUnder3: '家中有未滿 3 歲兒童',
  childAge2To5: '家中有 2 歲以上、未滿 5 歲兒童',
  homeCareWithoutPublicChildcare: '幼兒未使用公共／準公共托育，欲申請育兒津貼',
  publicOrQuasiChildcare: '幼兒使用公共／準公共托育服務',
  childcare30Hours: '每週托育達 30 小時以上',
  childNotPubliclyPlaced: '幼兒未經政府公費安置',
  northNorthKeelungTenMonths: '父或母連續設籍北北基滿 10 個月，申請時設籍臺北市',
  birthApplicationInTime: '已在生育補助申請期限內完成出生／初設戶籍登記',
  involuntaryUnemployed: '屬於非自願離職',
  employmentInsuranceOneYear: '離職退保前 3 年內，就業保險年資合計滿 1 年',
  willingToWork: '目前具有工作能力及繼續工作意願',
  jobRegistered14Days: '已辦求職登記，14 日內未獲推介就業或職訓',
  specialFamilyCircumstance: '符合喪偶／失蹤、家暴、孕產、單親照顧、配偶服刑或近期重大變故之一',
  spouseTaipeiResident: '本人未設籍，但與設籍臺北市的配偶實際居住臺北市',
  assistiveDeviceNeeded: '因身心障礙需要申請輔具，且尚未購買',
  assistiveDeviceSubsidyConditionsMet: '所需輔具未受其他同類補助；曾申請者已超過最低使用年限',
  taipeiResidentOneYear: '已設籍並實際居住臺北市滿 1 年',
  taxRateUnder20: '最近一年綜所稅未達申報標準或稅率未達 20%',
  noFullNhiSubsidy: '尚未獲其他政府機關全額補助健保自付額',
  childTaipeiResident: '申請兒童已設籍臺北市',
  childUnder6: '家中有未滿 6 歲兒童',
  parentTaipeiTenMonths: '兒童的父、母或監護人一方已設籍並實住臺北市連續滿 10 個月',
  childMedicalSpecialEligibility: '兒童符合低收入／特殊境遇、罕病重大傷病，或未滿 2 歲極低體重等醫療補助資格',
  thirdOrLaterChildUnder6: '未滿 6 歲兒童為同父或母所生第 3 名以上子女',
  currentlyPregnant: '目前懷孕中',
  pregnancyHealthHandbook: '已領有孕婦健康手冊',
  elderCareRecipientEligible: '受照顧長者領中低收入老人津貼、重度失能在家，且未使用其他照顧補助',
  familyCaregiverEligible: '照顧者 16 至 64 歲、未全職工作，與長者設籍同住且符合親屬資格',
  militaryFamily: '役男家屬或遺屬',
  violenceVictim: '家庭暴力或性侵害被害人',
  farmer: '農戶',
  petOwner: '飼主或動物照護者',
};

export const BENEFIT_PROGRAMS: BenefitProgram[] = [
  {
    id: '1',
    name: '低收入戶生活扶助',
    audience: '低收入戶',
    benefitContent: '依低收入戶類別與家戶成員身分按月發給生活扶助，另有年節慰問金；政府救助合計每人每月最高 29,500 元。',
    officialIncome: '115 年度每人每月 20,744 元',
    officialAssets: '動產每人 15 萬元；全家不動產 837 萬元',
    otherConditions: '最近一年居住國內超過 183 日',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=E6D700BD37E78592&s=AC5701100C4A434B',
    rule: {
      requiresTaipei: true,
      requires183Days: true,
      recognitionAny: ['lowIncome'],
      incomeLimit: 20_744,
      movableAssetsLimit: 150_000,
      realEstateLimit: 8_370_000,
    },
  },
  {
    id: '2',
    name: '低收入戶 18 歲以上就學生活補助',
    audience: '18 至 25 歲低收入戶學生',
    benefitContent: '符合資格者每人每月發給 6,825 元，第一、二學期各發給 6 個月。',
    officialIncome: '115 年度每人每月 20,744 元',
    officialAssets: '動產每人 15 萬元；全家不動產 837 萬元',
    otherConditions: '學生資格；最近一年居住國內超過 183 日',
    office: '臺北市政府社會局社會救助科',
    contact: '請由官方詳細資訊頁查詢',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=F9708F71674DF16E&s=D8656FCB81034B8F',
    rule: {
      minAge: 18,
      maxAge: 25,
      requiresTaipei: true,
      requires183Days: true,
      recognitionAny: ['lowIncome'],
      traitAny: ['student'],
      incomeLimit: 20_744,
      movableAssetsLimit: 150_000,
      realEstateLimit: 8_370_000,
    },
  },
  {
    id: '3',
    name: '低收入戶國中以上就學子女交通補助',
    audience: '25 歲以下低收入戶學生',
    benefitContent: '每學期補助交通費：12 至未滿 15 歲 500 元、15 至未滿 18 歲 1,000 元、18 至未滿 25 歲 1,500 元；部分外縣市通學者可再加發 500 元。',
    officialIncome: '115 年度每人每月 20,744 元',
    officialAssets: '動產每人 15 萬元；全家不動產 837 萬元',
    otherConditions: '學生資格；最近一年居住國內超過 183 日',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL078859',
    rule: {
      minAge: 12,
      maxAge: 25,
      requiresTaipei: true,
      requires183Days: true,
      recognitionAny: ['lowIncome'],
      traitAny: ['student'],
      incomeLimit: 20_744,
      movableAssetsLimit: 150_000,
      realEstateLimit: 8_370_000,
    },
  },
  {
    id: '4',
    name: '中低收入戶資格',
    audience: '符合所得及財產門檻的臺北市家戶',
    benefitContent: '本項是取得「中低收入戶」身分，不是固定現金；核定後可作為健保、醫療、就學、托育及住宅等減免或補助的資格。',
    officialIncome: '115 年度每人每月 29,635 元',
    officialAssets: '動產每人 16 萬元；全家不動產 992 萬元',
    otherConditions: '最近一年居住國內超過 183 日',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=E6D700BD37E78592&s=AC5701100C4A434B',
    rule: {
      requiresTaipei: true,
      requires183Days: true,
      incomeLimit: 29_635,
      movableAssetsLimit: 160_000,
      realEstateLimit: 9_920_000,
    },
  },
  {
    id: '5',
    name: '身心障礙者生活補助',
    audience: '身心障礙者',
    benefitContent: '按戶別與障礙程度每月補助 4,049 至 9,485 元；已列冊低收入戶或中低收入戶者由社會局主動核發。',
    officialIncome: '115 年度每人每月 39,960 元',
    officialAssets: '單人家庭動產 200 萬元，每增加一人加 25 萬元；全家不動產 992 萬元',
    otherConditions: '最近一年居住國內超過 183 日；動產需按家戶人數另算',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=C764A5808F9A3B08',
    rule: {
      requiresTaipei: true,
      requires183Days: true,
      traitAny: ['disabled'],
      incomeLimit: 39_960,
      realEstateLimit: 9_920_000,
    },
  },
  {
    id: '6',
    name: '中低收入老人生活津貼',
    audience: '65 歲以上長者',
    benefitContent: '依所得級距每月發給 4,164 元或 8,329 元；同時領榮民就養給付者為每月 2,290 元。',
    officialIncome: '115 年度每人每月 39,960 元',
    officialAssets: '單人家庭動產 250 萬元，每增加一人加 25 萬元；全家不動產 992 萬元',
    otherConditions: '最近一年居住國內超過 183 日；動產需按家戶人數另算',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=FCF3DAE98DDA289F&s=64180EEDD02DEE2A',
    rule: {
      minAge: 65,
      requiresTaipei: true,
      requires183Days: true,
      incomeLimit: 39_960,
      realEstateLimit: 9_920_000,
    },
  },
  {
    id: '7',
    name: '營養品補助',
    audience: '低／中低收入戶的孕產婦、2 歲以下嬰兒，或 65 歲以上重病者',
    benefitContent: '經醫師診斷需要補充營養者，每人每次補助 1,000 元，每兩個月最多申請一次。',
    officialIncome: '115 年度中低收入戶門檻為每人每月 29,635 元',
    officialAssets: '動產每人 16 萬元；全家不動產 992 萬元',
    otherConditions: '符合指定孕產、嬰兒或高齡重病情況之一',
    office: '臺北市政府社會局，或居住地社會福利服務中心',
    contact: '1999 分機 1609～1613',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=372850F2A8369C81',
    rule: {
      requiresTaipei: true,
      recognitionAny: ['lowIncome', 'middleLowIncome'],
      traitAny: ['pregnantOrRecentLoss', 'infantUnder2', 'seriouslyIllSenior'],
      incomeLimit: 29_635,
      movableAssetsLimit: 160_000,
      realEstateLimit: 9_920_000,
    },
  },
  {
    id: '8',
    name: '生育補助',
    audience: '低收入戶或中低收入戶生育者',
    benefitContent: '分娩、懷孕 12 週以上流產或死產者一次發給 33,000 元；雙生以上按胎數比例增加。',
    officialIncome: '115 年度中低收入戶門檻為每人每月 29,635 元',
    officialAssets: '動產每人 16 萬元；全家不動產 992 萬元',
    otherConditions: '須有生育事實',
    office: '臺北市政府社會局社會救助科',
    contact: '1999 分機 1621',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=372850F2A8369C81&s=3D545516AA427905',
    rule: {
      requiresTaipei: true,
      recognitionAny: ['lowIncome', 'middleLowIncome'],
      traitAny: ['recentBirth'],
      incomeLimit: 29_635,
      movableAssetsLimit: 160_000,
      realEstateLimit: 9_920_000,
    },
  },
  {
    id: '9',
    name: '市民醫療補助',
    audience: '低／中低收入戶、社會局保護安置者，或符合財稅審核資格的一般市民',
    benefitContent: '補助健保特約院所的合格自付醫療費：低收入戶及保護安置者扣除不補助項目後全額補助；中低收入戶與一般市民最近 6 個月費用超過 2 萬元的部分補助 80%，每年最高 30 萬元。',
    officialIncome: '115 年度每人每月 39,960 元',
    officialAssets: '動產扣除自行負擔醫療費後，按中低收入戶標準審查；不動產 992 萬元',
    otherConditions: '就醫期間須為臺北市市民；醫療支出與財稅資格須由承辦單位審核',
    office: '臺北市政府社會局社會救助科',
    contact: '1999 分機 2323',
    officialUrl: 'https://dosw.gov.taipei/Content_List.aspx?n=CBF8AAEF232010B8',
    rule: {
      requiresTaipei: true,
      incomeLimit: 39_960,
      realEstateLimit: 9_920_000,
    },
  },
  {
    id: '10',
    name: '急難救助',
    audience: '近期遭遇急難、生活陷入困難的市民',
    benefitContent: '依急難事由一次核發：喪葬最高 30,000 元；傷病或生活救助通常最高 6,000 元，特殊情形最高 20,000 元；另可核發返鄉車票。',
    officialIncome: '無固定所得門檻，依急難事由與生活困境訪視認定',
    officialAssets: '無固定財產門檻，依實際急難狀況審查',
    otherConditions: '急難事由須在最近 3 個月內發生，且同一事由原則擇一救助',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=0BF751F1B9F07AA1',
    rule: {
      requiresTaipei: true,
      traitAny: ['recentEmergency'],
    },
  },
  {
    id: '11',
    name: '300 億元中央擴大租金補貼',
    audience: '在臺北市租屋、家庭成員無自有住宅且所得符合門檻者',
    benefitContent: '臺北市租屋每戶每月補貼上限依級別為 3,000、5,000 或 8,000 元；新婚及育有未成年子女家庭可依規定再加碼。',
    officialIncome: '一般家庭每人每月低於 61,137 元；新婚或育有未成年子女家庭低於 71,327 元',
    officialAssets: '本方案以家庭成員持有住宅情形為主要住宅條件',
    otherConditions: '115 年度隨到隨辦；婚育家庭另有所得門檻放寬及金額加碼',
    office: '臺北市政府都市發展局住宅企劃科',
    contact: '02-2777-2186 轉 0 再轉 1',
    officialUrl: 'https://udd.gov.taipei/collection/oo2cmrc',
    rule: {
      requiresTaipei: false,
      traitAll: ['renter', 'noOwnedHome'],
      incomeLimit: 61_137,
      incomeLimitOverride: {
        traitAny: ['newlywedWithin2Years', 'minorChild'],
        limit: 71_327,
      },
    },
  },
  {
    id: '12',
    name: '臺北幸福租—民間租屋租金加碼補貼',
    audience: '已核准中央租金補貼的臺北市青年或育兒租屋家庭',
    benefitContent: '在中央租金補貼之外每月再加碼：未滿 40 歲單身青年 1,000 元、45 歲以下已婚未育家庭 2,500 元、育有 12 歲以下子女者每名子女 1,000 元。中央與市府補貼合計不超過實際租金。',
    officialIncome: '須先取得中央擴大租金補貼核准；所得資格由中央方案審查',
    officialAssets: '須符合中央租金補貼住宅條件',
    otherConditions: '設籍及租屋於臺北市，並符合單身青年、已婚青年家庭或育兒家庭之一',
    office: '臺北市政府都市發展局住宅企劃科',
    contact: '02-2777-2186 轉 0 再轉 1',
    officialUrl: 'https://udd.gov.taipei/collection/oo2cmrc',
    rule: {
      requiresTaipei: true,
      traitAll: ['renter', 'centralRentApproved'],
      specialCheck: 'taipeiHappinessRent',
    },
  },
  {
    id: '13',
    name: '低收入戶承租住宅租金補貼',
    audience: '在臺北市租屋且無自有住宅的列冊低收入戶',
    benefitContent: '每戶每月補貼 1,500 元；實際月租低於 1,500 元時，按實際租金核發。',
    officialIncome: '須具臺北市低收入戶資格',
    officialAssets: '申請人及規定家庭成員均無自有住宅',
    otherConditions: '不得重複接受政府住宅補貼或使用政府住宅；仍由都發局審查',
    office: '臺北市政府都市發展局',
    contact: '02-2777-2186 轉 0 再轉 1',
    officialUrl: 'https://rent-allowance.udd.gov.taipei/apply/low-income-subsidy',
    rule: {
      requiresTaipei: true,
      recognitionAny: ['lowIncome'],
      traitAll: ['renter', 'noOwnedHome'],
    },
  },
  {
    id: '14',
    name: '身心障礙者房屋租金補貼',
    audience: '設籍臺北市、持有身心障礙證明且符合所得及住宅條件的租屋者',
    benefitContent: '依同住人數每月最高補貼 3,000、4,500、6,000 或 7,500 元，且不超過實際房租 50%；保證金及管理費不補貼。',
    officialIncome: '115 年度家庭平均每人每月未超過 39,960 元',
    officialAssets: '家庭動產採家戶人數計算；不得持有自有住宅',
    otherConditions: '不得與臺北市身心障礙者津貼重複領取，租約及財產仍須承辦單位審查',
    office: '臺北市政府社會局身心障礙者福利科',
    contact: '1999 轉社會局身障福利科',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=a119f2d98118e1d5&s=C82846AD24E9F281',
    rule: {
      requiresTaipei: true,
      traitAll: ['disabled', 'renter', 'noOwnedHome'],
      incomeLimit: 39_960,
    },
  },
  {
    id: '15',
    name: '都市原住民家庭租屋補貼',
    audience: '設籍並實際居住臺北市滿 4 個月、在北北基無自有住宅的原住民租屋家庭',
    benefitContent: '依家戶條件每月補助租金 4,000 至 8,500 元。',
    officialIncome: '家庭平均每人每月不超過臺北市最低生活費 3.5 倍（115 年度 72,604 元）',
    officialAssets: '申請人及家庭成員在臺北市、新北市、基隆市無自有住宅',
    otherConditions: '原則每年 4 月及 8 月受理，實際期間以當年度公告為準',
    office: '臺北市各區公所原住民服務員',
    contact: '1999 轉 2077',
    officialUrl: 'https://www.ipc.gov.taipei/News_Content.aspx?n=4FDBC97163E1A185&s=0714FC733E0478C9',
    rule: {
      minAge: 18,
      requiresTaipei: true,
      traitAll: ['indigenous', 'renter', 'noOwnedHome', 'taipeiResidentFourMonths'],
      incomeLimit: 72_604,
    },
  },
  {
    id: '16',
    name: '臺北市生育補助',
    audience: '符合北北基連續設籍期間並在期限內完成新生兒登記的臺北市父母',
    benefitContent: '每名新生兒一次發給：第 1 名 40,000 元、第 2 名 45,000 元、第 3 名以上每名 50,000 元。',
    officialIncome: '無所得門檻',
    officialAssets: '無財產門檻',
    otherConditions: '114 年 9 月 9 日後出生者，父或母須連續設籍北北基滿 10 個月且申請時設籍臺北市；國內出生原則於出生次日起 60 日內申請',
    office: '臺北市各戶政事務所',
    contact: '臺北市民當家熱線 1999',
    officialUrl: 'https://ca.gov.taipei/News_Content.aspx?n=59F2E04A34FDA3E8&s=B48A280E9EB5F920',
    rule: {
      requiresTaipei: true,
      traitAll: ['recentBirth', 'northNorthKeelungTenMonths', 'birthApplicationInTime'],
    },
  },
  {
    id: '17',
    name: '0 至未滿 5 歲育兒津貼',
    audience: '自行或家庭照顧、未使用公共或準公共托育的未滿 5 歲幼兒家庭',
    benefitContent: '每名兒童按月發給：第 1 名子女 5,000 元、第 2 名 6,000 元、第 3 名以上 7,000 元。',
    officialIncome: '中央育兒津貼已取消所得稅率排富限制',
    officialAssets: '無財產門檻',
    otherConditions: '0 至未滿 2 歲由衛福部辦理；2 至未滿 5 歲由教育部辦理；不得與公共／準公共托育補助等同性質給付重複',
    office: '幼兒戶籍所在地區公所或教育主管機關',
    contact: '臺北市民當家熱線 1999',
    officialUrl: 'https://dosw.gov.taipei/News_Content.aspx?n=91F35523B74F69AC&s=EE4B1BD762F0F57A&sms=87415A8B9CE81B16',
    rule: {
      requiresTaipei: false,
      traitAny: ['infantUnder2', 'childAge2To5'],
      traitAll: ['homeCareWithoutPublicChildcare', 'childNotPubliclyPlaced'],
    },
  },
  {
    id: '18',
    name: '未滿 3 歲公共／準公共托育補助與臺北市友善托育補助',
    audience: '將未滿 3 歲幼兒送托臺北市公共或準公共托育服務的家庭',
    benefitContent: '中央托育補助之外，臺北市友善托育每月再補助：公辦民營托嬰中心 2,500 元、社區公共托育家園 6,000 元、準公共保母或托嬰中心 8,000 元；有其他兄姊者部分類型再加 2,000 元。',
    officialIncome: '一般家庭、低收入戶及中低收入戶均有不同補助標準',
    officialAssets: '無一般性財產門檻',
    otherConditions: '每週托育達 30 小時以上、未公費安置，且不得重複領取育兒津貼等同性質給付',
    office: '居家托育服務中心、托嬰中心或社區公共托育家園',
    contact: '臺北市民當家熱線 1999',
    officialUrl: 'https://dosw.gov.taipei/News_Content.aspx?n=91F35523B74F69AC&s=9AE6236C0066DD59&sms=87415A8B9CE81B16',
    rule: {
      requiresTaipei: true,
      traitAll: ['childUnder3', 'publicOrQuasiChildcare', 'childcare30Hours', 'childNotPubliclyPlaced'],
    },
  },
  {
    id: '19',
    name: '就業保險失業給付',
    audience: '15 歲以上、65 歲以下，符合就業保險及非自願離職條件的求職者',
    benefitContent: '每月發給離職前 6 個月平均月投保薪資的 60%，最長 6 個月；離職時滿 45 歲或為身心障礙者最長 9 個月，符合扶養條件者最高可加至 80%。',
    officialIncome: '依離職前 6 個月平均月投保薪資計算，非所得門檻型補助',
    officialAssets: '無財產門檻',
    otherConditions: '離職退保前 3 年內就業保險年資滿 1 年，辦理求職登記後 14 日內未獲推介就業或職訓',
    office: '公立就業服務機構',
    contact: '臺北市就業服務處',
    officialUrl: 'https://eso.gov.taipei/News_Content.aspx?n=B26586FCE6F04719&s=CDE5D0AFE68F030C&sms=87415A8B9CE81B16',
    rule: {
      minAge: 15,
      maxAge: 65,
      requiresTaipei: false,
      traitAll: ['unemployed', 'involuntaryUnemployed', 'employmentInsuranceOneYear', 'willingToWork', 'jobRegistered14Days'],
    },
  },
  {
    id: '20',
    name: '特殊境遇家庭扶助',
    audience: '遭遇喪偶、家暴、單親照顧、配偶服刑或近期重大變故等特殊境遇的臺北市家庭',
    benefitContent: '可依需要申請緊急生活、子女生活、托育、教育、傷病醫療、法律訴訟及創業貸款等扶助；例如 115 年緊急生活扶助每月 20,744 元，最多 3 個月。',
    officialIncome: '115 年度家庭平均每人每月未超過 39,960 元',
    officialAssets: '家庭動產平均每人未超過 62 萬 2,320 元；全戶不動產未超過 650 萬元',
    otherConditions: '須符合七類特殊境遇之一；新住民與設籍臺北市市民結婚且實住臺北市者，得不受本人設籍限制',
    office: '臺北市政府社會局婦女福利及兒童托育科',
    contact: '1999 轉 1951',
    officialUrl: 'https://dosw.gov.taipei/News_Content.aspx?n=91F35523B74F69AC&s=F86046FC3A91FCAF&sms=87415A8B9CE81B16',
    rule: {
      requiresTaipei: false,
      traitAll: ['specialFamilyCircumstance'],
      incomeLimit: 39_960,
      movableAssetsLimit: 622_320,
      realEstateLimit: 6_500_000,
      specialCheck: 'specialFamilyResidence',
    },
  },
  {
    id: '21',
    name: '身心障礙者輔具費用補助',
    audience: '設籍臺北市、領有本市身心障礙證明且有輔具需求者',
    benefitContent: '補助 242 項生活輔具，依輔具種類、戶別及基準表上限核實補助；每人每 2 年原則最多申請 4 項，必須先核定再購買。',
    officialIncome: '資格無一般所得上限；補助額度依低收入、中低收入或一般戶別及輔具項目計算',
    officialAssets: '資格無一般財產上限',
    otherConditions: '最近 1 年居住國內達 183 日；須先申請核定再購買，每 2 年原則最多 4 項',
    office: '臺北市政府社會局身心障礙者福利科或各區輔具中心',
    contact: '1999 轉 1558、1617',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=49304F9B0793FFEF',
    rule: {
      requiresTaipei: true,
      requires183Days: true,
      traitAll: ['disabled', 'assistiveDeviceNeeded', 'assistiveDeviceSubsidyConditionsMet'],
    },
  },
  {
    id: '22',
    name: '老人全民健康保險保險費自付額補助',
    audience: '符合年齡、設籍居住與所得稅條件，且未受其他全額健保補助的臺北市長者',
    benefitContent: '補助健保費自付額，每人每月最高 826 元；實際自付額低於 826 元時按實際金額補助。',
    officialIncome: '最近一年綜所稅未達申報標準或核定稅率未達 20%；65 至 69 歲中低收入老人另有資格途徑',
    officialAssets: '無財產門檻',
    otherConditions: '一般長者年滿 65 歲、原住民年滿 55 歲，原則須設籍實住臺北市滿 1 年且近一年住國內至少 183 日',
    office: '臺北市政府社會局老人福利科',
    contact: '1999 轉 1682、1684、1686、1687',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=22B00B4927757FFE',
    rule: {
      requiresTaipei: true,
      requires183Days: true,
      specialCheck: 'elderHealthInsurance',
    },
  },
  {
    id: '23',
    name: '臺北市兒童醫療補助',
    audience: '設籍臺北市且符合一般幼兒、特殊醫療或第 3 名以上子女資格的兒童',
    benefitContent: '依兒童資格類別補助特約院所的門、急診掛號費，門、急診與住院健保部分負擔，以及部分住院醫療自付費用。',
    officialIncome: '第 1、3 類無所得門檻；第 2 類依低收入、特殊境遇或指定醫療資格認定',
    officialAssets: '第 1、3 類無財產門檻',
    otherConditions: '第 1 類為未滿 6 歲且父母一方設籍實住滿 10 個月；第 2、3 類依兒童身分及年齡認定',
    office: '臺北市 12 區健康服務中心',
    contact: '臺北市民當家熱線 1999',
    officialUrl: 'https://health.gov.taipei/News_Content.aspx?n=232AD545CBF028A7&s=AD1271100D029C67&sms=D8A8AF6A9CFCB149',
    rule: {
      requiresTaipei: false,
      specialCheck: 'childMedical',
    },
  },
  {
    id: '24',
    name: '臺北市好孕 2U 孕婦乘車補助',
    audience: '設籍臺北市的孕婦，或配偶設籍臺北市的非本國籍孕婦',
    benefitContent: '每次懷孕核發 10,000 元台北通電子乘車金，搭乘合作車隊每趟最高折抵 250 元，可使用至預產期後 1 年。',
    officialIncome: '無所得門檻',
    officialAssets: '無財產門檻',
    otherConditions: '須在懷孕中並領有孕婦健康手冊；115 年每次懷孕補助 10,000 元電子乘車金',
    office: '合作醫療院所、健康服務中心、區公所、社福中心或線上申請',
    contact: '臺北市民當家熱線 1999',
    officialUrl: 'https://dosw.gov.taipei/News_Content.aspx?n=91F35523B74F69AC&s=79FC4665DF0CABCD&sms=87415A8B9CE81B16',
    rule: {
      requiresTaipei: false,
      traitAll: ['currentlyPregnant', 'pregnancyHealthHandbook'],
      specialCheck: 'goodPregnancyRide',
    },
  },
  {
    id: '25',
    name: '中低收入老人特別照顧津貼',
    audience: '在家照顧重度失能中低收入長者、因照顧無法全職工作的家屬',
    benefitContent: '審核通過後，每月發給實際照顧者 5,000 元。',
    officialIncome: '受照顧者須已領有中低收入老人生活津貼',
    officialAssets: '由中低收入老人生活津貼資格先行審查',
    otherConditions: '長者未接受機構、居家、日照、看護等補助；照顧者須 16 至 64 歲、與長者設籍同住且未全職工作',
    office: '臺北市政府社會局各區老人服務中心',
    contact: '1999 轉 1674',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=3C3D1F78D6280694',
    rule: {
      requiresTaipei: true,
      traitAll: ['elderCareRecipientEligible', 'familyCaregiverEligible'],
    },
  },
];
