<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTownPassBridge } from '@/composables/useTownPassBridge';
import {
  ADDITIONAL_BENEFIT_SOURCES,
  BENEFIT_SOURCE,
  TRAIT_LABELS,
  type BenefitTrait,
} from '@/lib/benefit-data';
import {
  CATALOG_SOURCE,
  CATEGORY_LABELS,
  rankCatalogPrograms,
  type RankedCatalogProgram,
} from '@/lib/benefit-catalog';
import {
  ageFromBirthday,
  evaluateBenefits,
  type Answer,
  type EligibilityProfile,
  type EligibilityResult,
  type EligibilityStatus,
} from '@/lib/benefit-eligibility';

const bridge = useTownPassBridge();
const catalogSnapshotDate = new Intl.DateTimeFormat('zh-TW', {
  dateStyle: 'medium',
  timeZone: 'Asia/Taipei',
}).format(new Date(CATALOG_SOURCE.fetchedAt));
const birthday = ref('');
const taipeiResident = ref<Answer>(null);
const domestic183Days = ref<Answer>(null);
const monthlyIncomePerPerson = ref<number | null>(null);
const movableAssetsPerPerson = ref<number | null>(null);
const realEstateHousehold = ref<number | null>(null);
const traits = ref<BenefitTrait[]>([]);
const results = ref<EligibilityResult[]>([]);
const catalogResults = ref<RankedCatalogProgram[]>([]);
const searched = ref(false);
const showAllCatalog = ref(false);
const loadingTownPass = ref(false);
const townPassMessage = ref('');

const traitGroups: { title: string; traits: BenefitTrait[] }[] = [
  {
    title: '身分與生活情況',
    traits: ['lowIncome', 'middleLowIncome', 'student', 'disabled', 'indigenous', 'newImmigrant', 'militaryFamily', 'violenceVictim', 'protectedOrPlaced', 'recentEmergency', 'specialFamilyCircumstance', 'farmer', 'petOwner'],
  },
  {
    title: '租屋與家庭狀態',
    traits: ['renter', 'noOwnedHome', 'centralRentApproved', 'single', 'married', 'newlywedWithin2Years', 'minorChild', 'childUnder12', 'taipeiResidentFourMonths', 'spouseTaipeiResident'],
  },
  {
    title: '生育與托育',
    traits: ['currentlyPregnant', 'pregnancyHealthHandbook', 'pregnantOrRecentLoss', 'infantUnder2', 'childUnder3', 'childAge2To5', 'childUnder6', 'recentBirth', 'homeCareWithoutPublicChildcare', 'publicOrQuasiChildcare', 'childcare30Hours', 'childNotPubliclyPlaced', 'northNorthKeelungTenMonths', 'birthApplicationInTime'],
  },
  {
    title: '醫療、高齡與照顧',
    traits: ['seriouslyIllSenior', 'assistiveDeviceNeeded', 'assistiveDeviceSubsidyConditionsMet', 'taipeiResidentOneYear', 'taxRateUnder20', 'noFullNhiSubsidy', 'childTaipeiResident', 'parentTaipeiTenMonths', 'childMedicalSpecialEligibility', 'thirdOrLaterChildUnder6', 'elderCareRecipientEligible', 'familyCaregiverEligible'],
  },
  {
    title: '失業與求職',
    traits: ['unemployed', 'involuntaryUnemployed', 'employmentInsuranceOneYear', 'willingToWork', 'jobRegistered14Days'],
  },
];
const age = computed(() => ageFromBirthday(birthday.value));
const personalizedCatalogCount = computed(() => catalogResults.value.filter((item) => item.score >= 4).length);
const visibleCatalogResults = computed(() =>
  showAllCatalog.value ? catalogResults.value : catalogResults.value.slice(0, 24),
);
const resultCounts = computed(() =>
  results.value.reduce(
    (counts, result) => ({ ...counts, [result.status]: counts[result.status] + 1 }),
    { possible: 0, review: 0, unlikely: 0 } as Record<EligibilityStatus, number>,
  ),
);
const statusText: Record<EligibilityStatus, string> = {
  possible: '值得進一步申請',
  review: '補資料後再確認',
  unlikely: '目前條件可能不符',
};

function normalizeBirthday(value: string): string {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(value.trim());
  if (!match) return '';
  return `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`;
}

function isTaipeiAddress(value: string): boolean {
  return /^(臺北市|台北市)/.test(value.trim());
}

async function importTownPassProfile(): Promise<void> {
  loadingTownPass.value = true;
  townPassMessage.value = '';
  try {
    const user = await bridge.getUserInfo();
    if (!user) {
      townPassMessage.value = bridge.isAvailable.value
        ? '台北通目前沒有可用的帳號資料，請手動填寫。'
        : '一般瀏覽器沒有台北通連線，請手動填寫；本機 demo 可在網址加上 ?mockBridge=1。';
      return;
    }
    const normalized = normalizeBirthday(user.birthday ?? '');
    if (normalized) birthday.value = normalized;
    const addressInTaipei = isTaipeiAddress(user.residentAddress ?? '') || user.addresses?.some((item) => isTaipeiAddress(item.city));
    taipeiResident.value = Boolean(user.citizen || addressInTaipei);
    if (user.nativePeople && !traits.value.includes('indigenous')) traits.value.push('indigenous');
    townPassMessage.value = `已帶入出生日期、臺北市民資訊${user.nativePeople ? '與原住民族身分' : ''}${age.value === null ? '' : `（${age.value} 歲）`}；姓名、身分證字號、電話與 Email 不會顯示、儲存或用於判斷。`;
  } catch {
    townPassMessage.value = '台北通資料暫時無法讀取，仍可手動完成初篩。';
  } finally {
    loadingTownPass.value = false;
  }
}

function nullableMoney(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function search(): void {
  const profile: EligibilityProfile = {
    birthday: birthday.value,
    taipeiResident: taipeiResident.value,
    domestic183Days: domestic183Days.value,
    monthlyIncomePerPerson: nullableMoney(monthlyIncomePerPerson.value),
    movableAssetsPerPerson: nullableMoney(movableAssetsPerPerson.value),
    realEstateHousehold: nullableMoney(realEstateHousehold.value),
    traits: traits.value,
  };
  results.value = evaluateBenefits(profile);
  catalogResults.value = rankCatalogPrograms(profile);
  showAllCatalog.value = false;
  searched.value = true;
  requestAnimationFrame(() => document.querySelector('#benefit-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function catalogSummary(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 170 ? `${normalized.slice(0, 170)}…` : normalized;
}
</script>

<template>
  <main class="page benefits-page">
    <header class="hero">
      <p class="eyebrow">台北通服務實驗</p>
      <h1>福利雷達</h1>
      <p>用台北通帶入少量基本資料，再補幾個家戶條件，找出可能漏領的臺北市社會救助。</p>
      <div class="source-pill">{{ CATALOG_SOURCE.candidateCount }} 項官方候選 · {{ BENEFIT_SOURCE.count }} 項可深度比對</div>
    </header>

    <section class="notice" aria-label="重要說明">
      <strong>這是資格初篩，不是核定結果。</strong>
      <span>法規、所得認列與家戶計算仍以承辦單位最新審查為準。</span>
    </section>

    <form class="form-card" @submit.prevent="search">
      <div class="section-heading">
        <div><span class="step">1</span><h2>帶入基本資料</h2></div>
        <span class="local-badge">只在本機計算</span>
      </div>
      <p class="muted">不顯示也不使用姓名、身分證字號、電話與 Email。</p>
      <button class="townpass-button" type="button" :disabled="loadingTownPass" @click="importTownPassProfile">
        <span aria-hidden="true">◎</span>
        {{ loadingTownPass ? '正在讀取…' : '從台北通帶入' }}
      </button>
      <p v-if="townPassMessage" class="bridge-message" role="status">{{ townPassMessage }}</p>

      <div class="field-grid">
        <label>
          出生日期
          <input v-model="birthday" type="date" autocomplete="bday" />
          <small v-if="age !== null">目前約 {{ age }} 歲</small>
        </label>
        <label>
          是否設籍臺北市
          <select v-model="taipeiResident">
            <option :value="null">尚未確認</option>
            <option :value="true">是</option>
            <option :value="false">否</option>
          </select>
        </label>
        <label>
          近一年居住國內超過 183 日
          <select v-model="domestic183Days">
            <option :value="null">尚未確認</option>
            <option :value="true">是</option>
            <option :value="false">否</option>
          </select>
        </label>
      </div>

      <div class="section-heading compact">
        <div><span class="step">2</span><h2>補充家戶條件</h2></div>
      </div>
      <p class="muted">不知道可留白，結果會列為「補資料後再確認」。金額只做門檻初比，不代替政府的所得與財產調查。</p>
      <div class="field-grid money-grid">
        <label>
          每人每月所得（元）
          <input v-model.number="monthlyIncomePerPerson" type="number" min="0" inputmode="numeric" placeholder="例如 22000" />
        </label>
        <label>
          每人動產（元）
          <input v-model.number="movableAssetsPerPerson" type="number" min="0" inputmode="numeric" placeholder="存款、投資等" />
        </label>
        <label>
          全家不動產（元）
          <input v-model.number="realEstateHousehold" type="number" min="0" inputmode="numeric" placeholder="土地、房屋等" />
        </label>
      </div>

      <fieldset>
        <legend>目前符合的身分或情況（請將符合者全部勾選）</legend>
        <p class="muted trait-help">未勾選的必要條件會視為目前不符合；不確定時可先不勾，並以官方審查為準。</p>
        <div v-for="group in traitGroups" :key="group.title" class="trait-section">
          <h3>{{ group.title }}</h3>
          <div class="trait-grid">
            <label v-for="value in group.traits" :key="value" class="trait-option">
              <input v-model="traits" type="checkbox" :value="value" />
              <span>{{ TRAIT_LABELS[value] }}</span>
            </label>
          </div>
        </div>
      </fieldset>

      <button class="primary search-button" type="submit">查看我可能符合的項目</button>
    </form>

    <section v-if="searched" id="benefit-results" class="results" aria-live="polite">
      <div class="results-heading">
        <div>
          <p class="eyebrow">有結構化門檻</p>
          <h2>{{ results.length }} 項深度比對</h2>
        </div>
        <div class="score" :aria-label="`${resultCounts.possible} 項值得申請`">
          <strong>{{ resultCounts.possible }}</strong><span>值得申請</span>
        </div>
      </div>
      <div class="summary-chips">
        <span class="possible">{{ resultCounts.possible }} 項值得申請</span>
        <span class="review">{{ resultCounts.review }} 項待補資料</span>
        <span class="unlikely">{{ resultCounts.unlikely }} 項可能不符</span>
      </div>

      <article v-for="result in results" :key="result.program.id" class="result-card" :class="result.status">
        <div class="result-title">
          <div>
            <span class="status">{{ statusText[result.status] }}</span>
            <h3>{{ result.program.name }}</h3>
          </div>
          <span class="number">#{{ result.program.id }}</span>
        </div>
        <p class="audience"><strong>適用對象：</strong>{{ result.program.audience }}</p>
        <div class="benefit-content">
          <span>實際補助</span>
          <p>{{ result.program.benefitContent }}</p>
        </div>
        <ul v-if="result.conflicts.length" class="reason-list conflict-list">
          <li v-for="reason in result.conflicts" :key="reason">{{ reason }}</li>
        </ul>
        <ul v-if="result.status !== 'unlikely' && result.missing.length" class="reason-list missing-list">
          <li v-for="reason in result.missing.slice(0, 3)" :key="reason">{{ reason }}</li>
        </ul>
        <details>
          <summary>查看門檻與判斷依據</summary>
          <dl>
            <div><dt>所得</dt><dd>{{ result.program.officialIncome }}</dd></div>
            <div><dt>財產</dt><dd>{{ result.program.officialAssets }}</dd></div>
            <div><dt>其他</dt><dd>{{ result.program.otherConditions }}</dd></div>
            <div><dt>洽辦</dt><dd>{{ result.program.office }}；{{ result.program.contact }}</dd></div>
          </dl>
          <p v-if="result.matched.length" class="evidence"><strong>已符合的輸入：</strong>{{ result.matched.join('；') }}</p>
          <p v-if="result.missing.length" class="evidence"><strong>仍需確認：</strong>{{ result.missing.join('；') }}</p>
        </details>
        <a class="official-link" :href="result.program.officialUrl" target="_blank" rel="noopener">前往官方資訊 →</a>
      </article>
    </section>

    <section v-if="searched" class="catalog-results" aria-labelledby="catalog-title">
      <div class="catalog-heading">
        <div>
          <p class="eyebrow">台北服務通目錄</p>
          <h2 id="catalog-title">另外 {{ CATALOG_SOURCE.candidateCount }} 項官方服務候選</h2>
        </div>
        <div class="score catalog-score">
          <strong>{{ personalizedCatalogCount }}</strong><span>依資料優先</span>
        </div>
      </div>
      <p class="catalog-explainer">
        由全站 {{ CATALOG_SOURCE.totalServiceCount.toLocaleString() }} 個服務中，以「{{ CATALOG_SOURCE.terms.join('、') }}」找到
        {{ CATALOG_SOURCE.keywordMatchCount }} 筆，再排除核銷、請款及明顯機構型案件。官方目錄沒有一致的所得與資格欄位，因此這裡只排序、不判定符合。
      </p>
      <p class="muted">部分項目可能與上方 {{ BENEFIT_SOURCE.count }} 項重複；保留是為了提供目前有效的官方申辦入口。</p>

      <div class="catalog-list">
        <article v-for="item in visibleCatalogResults" :key="item.program.id" class="catalog-card">
          <div class="catalog-card-top">
            <span class="category">{{ CATEGORY_LABELS[item.category] }}</span>
            <span v-if="item.score >= 4" class="relevant">依你的資料優先</span>
          </div>
          <h3>{{ item.program.name }}</h3>
          <p class="match-reason">{{ item.reasons.join('；') }}</p>
          <p v-if="item.program.summary" class="catalog-summary">{{ catalogSummary(item.program.summary) }}</p>
          <div class="method-row">
            <span v-if="item.program.online">可網路申辦</span>
            <span v-if="item.program.counter">可臨櫃申辦</span>
            <span v-if="!item.program.online && !item.program.counter">{{ item.program.applicationMethods || '方式見官方頁面' }}</span>
          </div>
          <a class="official-link" :href="item.program.officialUrl" target="_blank" rel="noopener">查看申請資格 →</a>
        </article>
      </div>
      <button
        v-if="catalogResults.length > 24"
        class="catalog-toggle"
        type="button"
        @click="showAllCatalog = !showAllCatalog"
      >
        {{ showAllCatalog ? '收合，只看前 24 項' : `顯示全部 ${catalogResults.length} 項` }}
      </button>
    </section>

    <footer class="data-note">
      <h2>資料來源與範圍</h2>
      <p>
        本版以開放資料 {{ BENEFIT_SOURCE.openDataCount }} 項，加上各主管機關官方頁面整理的
        {{ BENEFIT_SOURCE.additionalRuleCount }} 項常用方案，共 {{ BENEFIT_SOURCE.count }} 項做深度門檻比對；另收錄台北服務通
        {{ CATALOG_SOURCE.candidateCount }} 項補助相關候選。候選數是本專案的關鍵字與排除規則結果，不是官方公布的補助總數。
      </p>
      <a :href="BENEFIT_SOURCE.catalogUrl" target="_blank" rel="noopener">{{ BENEFIT_SOURCE.name }}（{{ BENEFIT_SOURCE.provider }}）</a>
      <template v-for="source in ADDITIONAL_BENEFIT_SOURCES" :key="source.url">
        <br />
        <a :href="source.url" target="_blank" rel="noopener">{{ source.name }}</a>
      </template>
      <br />
      <a :href="CATALOG_SOURCE.catalogUrl" target="_blank" rel="noopener">{{ CATALOG_SOURCE.name }}（{{ CATALOG_SOURCE.provider }}）</a>
      <p class="muted">開放資料目錄更新 {{ BENEFIT_SOURCE.catalogUpdatedAt }}；服務目錄快照 {{ catalogSnapshotDate }}。門檻若與官方頁面不同，以最新公告為準。</p>
    </footer>
  </main>
</template>

<style scoped>
.benefits-page { background: #f4f7f5; min-height: 100vh; max-width: 720px; }
.hero { margin: -16px -16px 0; padding: 28px 20px 24px; color: #fff; background: linear-gradient(145deg, #073f35, #0b6e4f 70%, #1a8d63); }
.eyebrow { margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.hero h1 { margin: 0; font-size: 32px; letter-spacing: .04em; }
.hero p:not(.eyebrow) { margin: 10px 0 16px; max-width: 540px; line-height: 1.65; color: #e7fff5; }
.source-pill, .local-badge { display: inline-flex; align-items: center; border-radius: 999px; font-size: 12px; font-weight: 700; }
.source-pill { padding: 6px 10px; color: #073f35; background: #d9ff77; }
.notice { display: grid; gap: 4px; margin: 16px 0; padding: 13px 15px; border-left: 4px solid #e0a000; border-radius: 8px; background: #fff9e7; font-size: 14px; line-height: 1.5; }
.form-card, .result-card, .catalog-card, .data-note { border: 1px solid #dbe4df; border-radius: 16px; background: #fff; box-shadow: 0 4px 18px rgba(7, 63, 53, .06); }
.form-card { padding: 18px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-heading > div { display: flex; align-items: center; gap: 9px; }
.section-heading.compact { margin-top: 28px; }
.section-heading h2, .results h2, .catalog-results h2, .data-note h2 { margin: 0; font-size: 19px; }
.step { display: grid; width: 28px; height: 28px; place-items: center; color: white; background: var(--brand); border-radius: 50%; font-weight: 800; }
.local-badge { padding: 5px 9px; color: #22604d; background: #e9f6f0; }
.townpass-button { width: 100%; min-height: 46px; margin: 8px 0 0; border: 1px solid #0b6e4f; border-radius: 10px; color: #0b6e4f; background: white; font-weight: 750; cursor: pointer; }
.townpass-button:disabled { opacity: .6; cursor: wait; }
.bridge-message { margin: 8px 0 0; padding: 9px 11px; border-radius: 8px; background: #eef8f3; color: #195943; font-size: 13px; line-height: 1.5; }
.field-grid { display: grid; gap: 14px; margin-top: 16px; }
label { display: grid; gap: 7px; color: #293b35; font-size: 14px; font-weight: 650; }
input[type='date'], input[type='number'], select { width: 100%; min-height: 44px; padding: 9px 11px; border: 1px solid #b9c8c1; border-radius: 9px; color: var(--text); background: white; font: inherit; }
input:focus-visible, select:focus-visible, button:focus-visible, summary:focus-visible, a:focus-visible { outline: 3px solid #8ae0bd; outline-offset: 2px; }
small { color: var(--muted); font-weight: 400; }
fieldset { margin: 22px 0 0; padding: 0; border: 0; }
legend { margin-bottom: 11px; font-size: 14px; font-weight: 750; }
.trait-help { margin: -3px 0 14px; }
.trait-section + .trait-section { margin-top: 18px; }
.trait-section h3 { margin: 0 0 9px; color: #315448; font-size: 14px; }
.trait-grid { display: grid; gap: 8px; }
.trait-option { display: flex; align-items: flex-start; gap: 9px; padding: 10px; border: 1px solid #dbe4df; border-radius: 9px; font-weight: 500; line-height: 1.4; cursor: pointer; }
.trait-option:has(input:checked) { border-color: var(--brand); background: var(--brand-weak); }
.trait-option input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--brand); flex: 0 0 auto; }
.search-button { width: 100%; min-height: 50px; margin-top: 22px; border: 0; font-weight: 800; cursor: pointer; }
.results { scroll-margin-top: 10px; margin-top: 28px; }
.results-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.results-heading .eyebrow { color: var(--brand); }
.score { display: grid; min-width: 70px; text-align: center; }
.score strong { color: var(--brand); font-size: 28px; line-height: 1; }
.score span { margin-top: 4px; color: var(--muted); font-size: 11px; }
.summary-chips { display: flex; flex-wrap: wrap; gap: 7px; margin: 14px 0; }
.summary-chips span, .status { padding: 5px 8px; border-radius: 999px; font-size: 12px; font-weight: 750; }
.possible { color: #0b6143; background: #dff7eb; }
.review { color: #7a5700; background: #fff0bd; }
.unlikely { color: #7c3c39; background: #f7e6e4; }
.result-card { margin-bottom: 12px; padding: 16px; border-left-width: 5px; }
.result-card.possible { border-left-color: #20a66a; }
.result-card.review { border-left-color: #e0a000; }
.result-card.unlikely { border-left-color: #be716b; }
.result-card .status { display: inline-flex; margin-bottom: 7px; }
.result-card.possible .status { color: #0b6143; background: #dff7eb; }
.result-card.review .status { color: #7a5700; background: #fff0bd; }
.result-card.unlikely .status { color: #7c3c39; background: #f7e6e4; }
.result-title { display: flex; justify-content: space-between; gap: 12px; }
.result-title h3 { margin: 0; font-size: 18px; }
.number { color: #8a9591; font-size: 12px; }
.audience { color: #45564f; line-height: 1.55; }
.benefit-content { margin: 12px 0; padding: 12px 13px; border: 1px solid #bfe5d3; border-radius: 10px; background: #effaf5; }
.benefit-content span { display: block; margin-bottom: 4px; color: #0b6e4f; font-size: 12px; font-weight: 800; letter-spacing: .08em; }
.benefit-content p { margin: 0; color: #183f32; font-size: 14px; font-weight: 650; line-height: 1.6; }
.reason-list { margin: 10px 0; padding-left: 20px; font-size: 14px; line-height: 1.55; }
.conflict-list { color: #7c3c39; }
.missing-list { color: #705400; }
details { margin: 12px 0; border-top: 1px solid #e2e8e5; border-bottom: 1px solid #e2e8e5; }
summary { padding: 11px 0; color: #315e4e; font-size: 14px; font-weight: 700; cursor: pointer; }
dl { margin: 0 0 12px; font-size: 13px; }
dl div { display: grid; grid-template-columns: 52px 1fr; gap: 8px; margin: 6px 0; }
dt { color: var(--muted); font-weight: 700; }
dd { margin: 0; line-height: 1.45; }
.evidence { font-size: 13px; line-height: 1.55; }
.official-link { display: inline-flex; min-height: 40px; align-items: center; font-weight: 700; text-decoration: none; }
.catalog-results { margin-top: 32px; }
.catalog-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.catalog-heading .eyebrow { color: var(--brand); }
.catalog-score strong { color: #3268a8; }
.catalog-explainer { padding: 13px 14px; border-radius: 10px; background: #eaf3fb; color: #294e70; font-size: 14px; line-height: 1.6; }
.catalog-list { display: grid; gap: 11px; }
.catalog-card { padding: 15px; }
.catalog-card-top, .method-row { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.category, .relevant, .method-row span { padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 750; }
.category { color: #315e4e; background: #e9f3ef; }
.relevant { color: #734f00; background: #ffefb8; }
.catalog-card h3 { margin: 9px 0 6px; font-size: 17px; line-height: 1.45; }
.match-reason { margin: 5px 0; color: #315e4e; font-size: 13px; font-weight: 650; }
.catalog-summary { margin: 8px 0; color: #52605b; font-size: 13px; line-height: 1.55; }
.method-row span { color: #4a5b54; background: #f0f3f2; }
.catalog-toggle { width: 100%; min-height: 46px; margin-top: 14px; border: 1px solid var(--brand); border-radius: 10px; color: var(--brand); background: white; font-weight: 750; cursor: pointer; }
.data-note { margin-top: 24px; padding: 16px; }
.data-note p { line-height: 1.6; }
@media (min-width: 560px) {
  .field-grid { grid-template-columns: repeat(2, 1fr); }
  .money-grid { grid-template-columns: repeat(3, 1fr); }
  .trait-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
