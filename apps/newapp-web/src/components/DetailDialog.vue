<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useDetail } from '@/composables/useDetail';
import { useQuery } from '@/composables/useQuery';
import { isUnmatched } from '@/lib/match';
import { art, toneOf } from '@/lib/illustrations';
import { isTownPassBridgeAvailable, openLink, phoneCall } from '@/lib/townpass';
import {
  CITY_HOTLINE,
  DATASET_URL,
  UNMATCHED_LABEL,
  ageLimitText,
  agencyShort,
  canCall1999,
  findRow,
  identityLimitText,
  displayUrl,
  incomeLimitText,
} from '@/lib/resultView';

/**
 * 詳細資訊彈窗（v3，參考圖 20.png；sa-2-overview.md 4.8）：
 * 膠囊（資料類型＋判定）、圖示方塊、名稱、機關簡稱・臺北市適用、三格摘要、判定原因、還需確認、應備文件、
 * 收件洽辦單位（原文）、聯繫方式、門檻提醒；底部黃色主鈕前往官網申請（模擬資料不能按）、次鈕查看開放資料來源
 * （官方網頁整理改「查看官方來源」連到 sourceUrl）、聯繫方式含 1999 時撥打 1999（sa-3-s2.md W11）。
 * ADR-035：三格摘要後有實際補助原文時加「實際補助」（完整原文）與「資料來源」（網址、查證日、門檻年度說明）兩列。只有關閉鈕。返回鍵、Esc、點背景都關（useDetail 的 history state）。
 * 用手機記憶體的清單與比對結果，不打 API；沒送出時（從我的珍藏開）判定寫「尚未比對」。
 * ADR-036：台北服務通（catalog）判定一律寫「未依四題比對」，三格摘要寫「見案件頁」，次鈕連到來源資料集（sourceUrl），
 * 資料來源列標資料集名稱與下載日。
 * ADR-037：補好資格條件的台北服務通（enriched）照一般項目顯示判定與三格摘要，次鈕「查看官方來源」連到條件原文頁（sourceUrl）。
 */
const q = useQuery();
const { openNo, close } = useDetail();
const modal = ref<HTMLElement | null>(null);

const item = computed(() => {
  const no = openNo.value;
  if (no === null || !q.list.value) return null;
  return q.list.value.items.find((x) => x.no === no) ?? null;
});
const row = computed(() => (item.value && q.results.value ? findRow(q.results.value, item.value.no) : null));
const verify = computed(() => (row.value ? row.value.result.toVerify : (item.value?.toVerify ?? [])));
/** 未補條件的台北服務通（不比對）；補好的（enriched）照一般項目顯示 */
const catalog = computed(() => !!item.value && isUnmatched(item.value));
const enrichedCatalog = computed(() => item.value?.kind === 'catalog' && item.value.enriched === true);
const summary = computed(() => {
  const it = item.value;
  if (!it) return [];
  if (isUnmatched(it)) {
    return [
      { k: '身分條件', v: '見案件頁', n: '' },
      { k: '年齡', v: '見案件頁', n: '' },
      { k: '收入上限', v: '見案件頁', n: '' },
    ];
  }
  return [
    { k: '身分條件', v: identityLimitText(it), n: '' },
    { k: '年齡', v: ageLimitText(it), n: '' },
    { k: '收入上限', v: incomeLimitText(it), n: it.incomeMax !== null ? '每人每月' : '' },
  ];
});
/** 模擬資料或沒有網址時主鈕不能按 */
const canApply = computed(() => !!item.value && item.value.kind !== 'mock' && !!item.value.url);
const showCall = computed(() => (item.value ? canCall1999(item.value) : false));
const curated = computed(() => item.value?.kind === 'curated');
/** 次鈕：官方網頁整理連到 benefitText 原文所在頁，其餘連開放資料集 */
const secondary = computed(() => {
  if ((curated.value || enrichedCatalog.value) && item.value?.sourceUrl) return { label: '查看官方來源', url: item.value.sourceUrl };
  if (catalog.value && item.value?.sourceUrl) return { label: '查看開放資料來源', url: item.value.sourceUrl };
  return { label: '查看開放資料來源', url: DATASET_URL };
});
/** 資料來源列的門檻年度說明：官方網頁整理照來源頁；開放資料的收入門檻是資料集原值（舊年度） */
const sourceNote = computed(() => {
  if (catalog.value) return '資料來源：臺北市政府台北服務通申辦服務及承辦單位資訊（政府資料開放平臺）。資格與金額請見案件頁。';
  if (enrichedCatalog.value) return '案件取自台北服務通開放資料集；資格條件與金額依台北服務通案件頁、主管機關說明頁或臺北市法規原文整理。';
  return curated.value ? '門檻年度依來源頁。' : '實際補助依來源頁；收入門檻為資料集原值，年度較舊。';
});
/** 門檻提醒：開放資料由社會局公告；官方網頁整理、台北服務通含其他主管機關 */
const noticeAgency = computed(() => (curated.value || item.value?.kind === 'catalog' ? '主管機關' : '社會局'));

// 開啟時鎖住背景捲動、彈窗捲回頂端並取得焦點
watch(
  () => openNo.value,
  async (no) => {
    document.body.classList.toggle('locked', no !== null);
    if (no === null) return;
    await nextTick();
    if (modal.value) {
      modal.value.scrollTop = 0;
      modal.value.focus({ preventScroll: true });
    }
  },
);

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.classList.remove('locked');
});

function onBackdrop(e: MouseEvent): void {
  if (e.target === e.currentTarget) close();
}
function onLink(url: string): void {
  openLink(url);
}
/** [W11] 撥打 1999：台北通殼走 bridge phone_call；一般瀏覽器交給 tel: 連結預設行為 */
function onCall(e: MouseEvent): void {
  if (!isTownPassBridgeAvailable()) return;
  e.preventDefault();
  void phoneCall(CITY_HOTLINE);
}
</script>

<template>
  <div v-if="item" class="modal-back open" data-test="detail-dialog" @click="onBackdrop">
    <div ref="modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="dTitle" tabindex="-1">
      <div class="m-top">
        <div class="m-tags" data-test="d-tags">
          <span v-if="item.kind === 'mock'" class="mpill mock">模擬資料</span>
          <span v-else-if="item.kind === 'curated'" class="mpill" data-test="d-kind">官方網頁整理</span>
          <span v-else-if="enrichedCatalog" class="mpill" data-test="d-kind">台北服務通 · 資格已整理</span>
          <span v-else-if="item.kind === 'catalog'" class="mpill" data-test="d-kind">台北服務通 · 開放資料</span>
          <span v-else class="mpill">開放資料 · 臺北市社會局</span>
          <span v-if="catalog" class="verdict none" data-test="d-verdict">{{ UNMATCHED_LABEL }}</span>
          <span v-else-if="row" class="verdict ol" :class="{ no: !row.result.ok }" data-test="d-verdict">{{
            row.result.ok ? '可能符合' : '不符合'
          }}</span>
          <span v-else class="verdict none" data-test="d-verdict">尚未比對</span>
        </div>
        <button class="circ" aria-label="關閉" data-test="d-close" @click="close()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div class="m-head">
        <span class="m-ic" :style="{ '--tone': toneOf(item.no) }" data-test="card-illus" v-html="art(item.no)" />
        <div>
          <h3 id="dTitle" data-test="d-title">{{ item.name }}</h3>
          <p class="m-org">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            <span data-test="d-org">{{ agencyShort(item.office) }} · 臺北市適用</span>
          </p>
        </div>
      </div>
      <div class="m-sum" data-test="d-sum">
        <div v-for="s in summary" :key="s.k">
          <small>{{ s.k }}</small><b>{{ s.v }}</b><small v-if="s.n">{{ s.n }}</small>
        </div>
      </div>
      <div v-if="item.benefitText" class="m-row m-benefit" data-test="d-benefit">
        <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.2c0-1.2 1.1-1.7 2.5-1.7s2.5.6 2.5 1.7c0 2.6-5 1.2-5 3.8 0 1.1 1.1 1.7 2.5 1.7s2.5-.5 2.5-1.7" /></svg></span>
        <div>
          <b>實際補助：</b>
          <p class="d-benefit-text" data-test="d-benefit-text">{{ item.benefitText }}</p>
        </div>
      </div>
      <div v-if="item.sourceUrl" class="m-row" data-test="d-source">
        <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg></span>
        <div>
          <b>資料來源：</b>
          <div class="d-src">
            <a :href="item.sourceUrl" data-test="d-source-url" @click.prevent="onLink(item.sourceUrl)">{{ displayUrl(item.sourceUrl) }}</a>
            <span v-if="item.verifiedAt" data-test="d-verified">{{ catalog ? '資料下載日' : '查證日' }} {{ item.verifiedAt }}</span>
            <span data-test="d-source-note">{{ sourceNote }}</span>
          </div>
        </div>
      </div>
      <div class="m-row">
        <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
        <div>
          <b>判定原因：</b>
          <div class="d-why" data-test="d-why">
            <template v-if="catalog">{{ UNMATCHED_LABEL }}：台北服務通資料集沒有年齡、設籍、身分與收入欄位，請到案件頁確認資格。</template>
            <span v-else-if="row" :class="{ 'why-no': !row.result.ok }">{{ row.result.ok ? '可能符合：' : '不符合：' }}{{ row.result.reason }}</span>
            <template v-else>尚未比對，到試算頁填完四題就會看到判定。</template>
          </div>
        </div>
      </div>
      <div class="m-row">
        <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg></span>
        <div>
          <b>還需確認：</b>
          <div data-test="d-verify">
            <ul v-if="verify.length"><li v-for="(v, i) in verify" :key="i">{{ v }}</li></ul>
            <template v-else>無</template>
          </div>
        </div>
      </div>
      <div class="m-row">
        <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M10 12h5M10 16h5" /></svg></span>
        <div>
          <b>應備文件：</b>
          <div data-test="d-docs">
            <ul v-if="item.documents.length"><li v-for="(d, i) in item.documents" :key="i">{{ d }}</li></ul>
            <template v-else>未整理，請見官方說明頁</template>
          </div>
        </div>
      </div>
      <dl class="m-info">
        <dt>收件洽辦單位</dt>
        <dd data-test="d-office">{{ item.office }}</dd>
        <dt>聯繫方式</dt>
        <dd data-test="d-contact">{{ item.contact }}</dd>
      </dl>
      <!-- [SUBS-R18] 每筆詳情都顯示門檻提醒 -->
      <p class="m-note" data-test="d-notice">這是初步篩選，不代表一定可以領；門檻以{{ noticeAgency }}最新公告為準。</p>
      <div class="m-bar">
        <a v-if="canApply" class="btn cta" :href="item.url" data-test="d-apply" @click.prevent="onLink(item.url)">
          前往官網申請<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </a>
        <button v-else class="btn cta off" type="button" disabled data-test="d-apply-off">
          {{ item.kind === 'mock' ? '模擬資料・沒有官網可申請' : '沒有官網網址' }}
        </button>
        <a class="btn outline" :href="secondary.url" data-test="d-dataset" @click.prevent="onLink(secondary.url)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>{{ secondary.label }}
        </a>
        <a v-if="showCall" class="btn text" :href="`tel:${CITY_HOTLINE}`" data-test="d-call" @click="onCall">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>撥打 1999
        </a>
      </div>
    </div>
  </div>
</template>
