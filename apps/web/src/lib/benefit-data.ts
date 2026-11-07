/**
 * 臺北市政府社會局「臺北市社會救助補助項目」開放資料快照。
 *
 * 來源：https://data.gov.tw/dataset/129839
 * 資料集目錄更新：2026-10-13
 * 授權：政府資料開放授權條款第 1 版
 *
 * 原始資料只有 10 筆，且部分門檻仍須由承辦單位依家戶組成、所得認列與最新法規複核。
 * 本檔只保留初篩與導向官方頁面所需欄位，不把初篩結果當成核定。
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
  incomeLimit?: number;
  movableAssetsLimit?: number;
  realEstateLimit?: number;
}

export interface BenefitProgram {
  id: string;
  name: string;
  audience: string;
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
  count: 10,
} as const;

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
  recentEmergency: '近期遭遇急難事故',
  indigenous: '具有原住民族身分',
  newImmigrant: '新住民',
  unemployed: '目前待業或失業',
  renter: '目前租屋居住',
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
    officialIncome: '每人每月 17,005 元',
    officialAssets: '動產每人 15 萬元；全家不動產 740 萬元',
    otherConditions: '最近一年居住國內超過 183 日',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=E6D700BD37E78592&s=AC5701100C4A434B',
    rule: {
      requiresTaipei: true,
      requires183Days: true,
      recognitionAny: ['lowIncome'],
      incomeLimit: 17_005,
      movableAssetsLimit: 150_000,
      realEstateLimit: 7_400_000,
    },
  },
  {
    id: '2',
    name: '低收入戶 18 歲以上就學生活補助',
    audience: '18 至 25 歲低收入戶學生',
    officialIncome: '每人每月 17,005 元',
    officialAssets: '動產每人 15 萬元；全家不動產 740 萬元',
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
      incomeLimit: 17_005,
      movableAssetsLimit: 150_000,
      realEstateLimit: 7_400_000,
    },
  },
  {
    id: '3',
    name: '低收入戶國中以上就學子女交通補助',
    audience: '25 歲以下低收入戶學生',
    officialIncome: '每人每月 17,005 元',
    officialAssets: '動產每人 15 萬元；全家不動產 740 萬元',
    otherConditions: '學生資格；最近一年居住國內超過 183 日',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=F9708F71674DF16E&s=D8656FCB81034B8F',
    rule: {
      maxAge: 25,
      requiresTaipei: true,
      requires183Days: true,
      recognitionAny: ['lowIncome'],
      traitAny: ['student'],
      incomeLimit: 17_005,
      movableAssetsLimit: 150_000,
      realEstateLimit: 7_400_000,
    },
  },
  {
    id: '4',
    name: '中低收入戶資格',
    audience: '符合所得及財產門檻的臺北市家戶',
    officialIncome: '每人每月 24,293 元',
    officialAssets: '動產每人 15 萬元；全家不動產 876 萬元',
    otherConditions: '最近一年居住國內超過 183 日',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=E6D700BD37E78592&s=AC5701100C4A434B',
    rule: {
      requiresTaipei: true,
      requires183Days: true,
      incomeLimit: 24_293,
      movableAssetsLimit: 150_000,
      realEstateLimit: 8_760_000,
    },
  },
  {
    id: '5',
    name: '身心障礙者生活補助',
    audience: '身心障礙者',
    officialIncome: '每人每月 33,252 元',
    officialAssets: '單人家庭動產 200 萬元，每增加一人加 25 萬元；全家不動產 706 萬元',
    otherConditions: '最近一年居住國內超過 183 日；動產需按家戶人數另算',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=C764A5808F9A3B08',
    rule: {
      requiresTaipei: true,
      requires183Days: true,
      traitAny: ['disabled'],
      incomeLimit: 33_252,
      realEstateLimit: 7_060_000,
    },
  },
  {
    id: '6',
    name: '中低收入老人生活津貼',
    audience: '65 歲以上長者',
    officialIncome: '每人每月 33,252 元',
    officialAssets: '單人家庭動產 250 萬元，每增加一人加 25 萬元；全家不動產 876 萬元',
    otherConditions: '最近一年居住國內超過 183 日；動產需按家戶人數另算',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=FCF3DAE98DDA289F&s=64180EEDD02DEE2A',
    rule: {
      minAge: 65,
      requiresTaipei: true,
      requires183Days: true,
      incomeLimit: 33_252,
      realEstateLimit: 8_760_000,
    },
  },
  {
    id: '7',
    name: '營養品補助',
    audience: '低／中低收入戶的孕產婦、2 歲以下嬰兒，或 65 歲以上重病者',
    officialIncome: '每人每月 24,293 元',
    officialAssets: '動產每人 15 萬元；全家不動產 876 萬元',
    otherConditions: '符合指定孕產、嬰兒或高齡重病情況之一',
    office: '臺北市政府社會局，或居住地社會福利服務中心',
    contact: '1999 分機 1609～1613',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=372850F2A8369C81',
    rule: {
      requiresTaipei: true,
      recognitionAny: ['lowIncome', 'middleLowIncome'],
      traitAny: ['pregnantOrRecentLoss', 'infantUnder2', 'seriouslyIllSenior'],
      incomeLimit: 24_293,
      movableAssetsLimit: 150_000,
      realEstateLimit: 8_760_000,
    },
  },
  {
    id: '8',
    name: '生育補助',
    audience: '低收入戶或中低收入戶生育者',
    officialIncome: '每人每月 24,293 元',
    officialAssets: '動產每人 15 萬元；全家不動產 876 萬元',
    otherConditions: '須有生育事實',
    office: '臺北市政府社會局社會救助科',
    contact: '1999 分機 1621',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=372850F2A8369C81&s=3D545516AA427905',
    rule: {
      requiresTaipei: true,
      recognitionAny: ['lowIncome', 'middleLowIncome'],
      traitAny: ['recentBirth'],
      incomeLimit: 24_293,
      movableAssetsLimit: 150_000,
      realEstateLimit: 8_760_000,
    },
  },
  {
    id: '9',
    name: '市民醫療補助',
    audience: '低／中低收入戶、社會局保護安置者，或符合財稅審核資格的一般市民',
    officialIncome: '每人每月 28,550 元',
    officialAssets: '原始資料載「扣除自行負擔醫療費後每人 15 萬元為限」；不動產 876 萬元',
    otherConditions: '就醫期間須為臺北市市民；醫療支出與財稅資格須由承辦單位審核',
    office: '臺北市政府社會局社會救助科',
    contact: '1999 分機 2323',
    officialUrl: 'https://dosw.gov.taipei/Content_List.aspx?n=CBF8AAEF232010B8',
    rule: {
      requiresTaipei: true,
      incomeLimit: 28_550,
      realEstateLimit: 8_760_000,
    },
  },
  {
    id: '10',
    name: '急難救助',
    audience: '近期遭遇急難、生活陷入困難的市民',
    officialIncome: '每人每月 24,293 元',
    officialAssets: '動產每人 15 萬元；全家不動產 876 萬元',
    otherConditions: '急難事由、時效與家庭狀況須由區公所認定',
    office: '戶籍所在地區公所',
    contact: '戶籍所在地區公所社會課',
    officialUrl: 'https://dosw.gov.taipei/cp.aspx?n=0BF751F1B9F07AA1',
    rule: {
      requiresTaipei: true,
      traitAny: ['recentEmergency'],
      incomeLimit: 24_293,
      movableAssetsLimit: 150_000,
      realEstateLimit: 8_760_000,
    },
  },
];
