/**
 * 臺北市政府社會局「臺北市社會救助補助項目」開放資料快照。
 *
 * 來源：https://data.gov.tw/dataset/129839
 * 資料集目錄更新：2026-10-13
 * 授權：政府資料開放授權條款第 1 版
 *
 * 原始開放資料有 10 筆，另依各主管機關現行官方頁面整理 9 項常用方案。
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
  specialCheck?: 'taipeiHappinessRent';
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
  count: 19,
  openDataCount: 10,
  additionalRuleCount: 9,
} as const;

export const ADDITIONAL_BENEFIT_SOURCES = [
  { name: '臺北市都市發展局居住服務', url: 'https://udd.gov.taipei/collection/oo2cmrc' },
  { name: '臺北市租金補貼網', url: 'https://rent-allowance.udd.gov.taipei/' },
  { name: '臺北市政府社會局育兒及托育補助', url: 'https://dosw.gov.taipei/Content_List.aspx?n=2C486AA08208CD74' },
  { name: '臺北市政府民政局生育補助', url: 'https://ca.gov.taipei/News_Content.aspx?n=59F2E04A34FDA3E8&s=B48A280E9EB5F920' },
  { name: '臺北市就業服務處失業給付', url: 'https://eso.gov.taipei/News_Content.aspx?n=B26586FCE6F04719&s=CDE5D0AFE68F030C&sms=87415A8B9CE81B16' },
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
    officialIncome: '115 年度每人每月 20,744 元',
    officialAssets: '動產每人 15 萬元；全家不動產 837 萬元',
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
      incomeLimit: 20_744,
      movableAssetsLimit: 150_000,
      realEstateLimit: 8_370_000,
    },
  },
  {
    id: '4',
    name: '中低收入戶資格',
    audience: '符合所得及財產門檻的臺北市家戶',
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
    officialIncome: '家庭平均每人每月不超過臺北市最低生活費 3.5 倍（115 年度 71,327 元）',
    officialAssets: '申請人及家庭成員在臺北市、新北市、基隆市無自有住宅',
    otherConditions: '原則每年 4 月及 8 月受理，實際期間以當年度公告為準',
    office: '臺北市各區公所原住民服務員',
    contact: '1999 轉 2077',
    officialUrl: 'https://www.ipc.gov.taipei/News_Content.aspx?n=4FDBC97163E1A185&s=0714FC733E0478C9',
    rule: {
      minAge: 18,
      requiresTaipei: true,
      traitAll: ['indigenous', 'renter', 'noOwnedHome', 'taipeiResidentFourMonths'],
      incomeLimit: 71_327,
    },
  },
  {
    id: '16',
    name: '臺北市生育補助',
    audience: '符合北北基連續設籍期間並在期限內完成新生兒登記的臺北市父母',
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
];
