<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useDetail } from '@/composables/useDetail';
import { useQuery } from '@/composables/useQuery';
import { art, toneOf } from '@/lib/illustrations';
import { isTownPassBridgeAvailable, openLink, phoneCall } from '@/lib/townpass';
import {
  CITY_HOTLINE,
  DATASET_URL,
  ageLimitText,
  canCall1999,
  findRow,
  identityLimitText,
  incomeLimitText,
} from '@/lib/resultView';

/**
 * 詳細資訊彈窗（sa-3-s1.md、sa-2-overview.md 4.8，原型 #modal-detail）：
 * 膠囊、插畫、名稱、機關原文、三格摘要、判定、還需確認、應備文件、收件洽辦單位、聯繫方式、網址、門檻提醒；
 * 底部主鈕前往官網申請、次鈕查看開放資料來源、撥打 1999（sa-3-s2.md W11）。只有關閉鈕，沒有首頁鍵（SUBS-R26）。
 * 用手機記憶體的清單與比對結果，不打 API；沒送出時（從我的珍藏開）判定寫「尚未比對」。
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
const summary = computed(() => {
  const it = item.value;
  if (!it) return [];
  return [
    { k: '身分條件', v: identityLimitText(it), n: '' },
    { k: '年齡', v: ageLimitText(it), n: '' },
    { k: '收入上限', v: incomeLimitText(it), n: it.incomeMax !== null ? '每人每月' : '' },
  ];
});
const showCall = computed(() => (item.value ? canCall1999(item.value) : false));

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
          <span v-else class="mpill">開放資料 · 臺北市社會局</span>
          <span v-if="row" class="verdict ol" :class="{ no: !row.result.ok }" data-test="d-verdict">{{
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
            <span data-test="d-org">{{ item.office }}</span>
          </p>
        </div>
      </div>
      <div class="m-sum" data-test="d-sum">
        <div v-for="s in summary" :key="s.k">
          <small>{{ s.k }}</small><b>{{ s.v }}</b><small v-if="s.n">{{ s.n }}</small>
        </div>
      </div>
      <div class="m-row">
        <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
        <div>
          <b>判定原因：</b>
          <div class="d-why" data-test="d-why">
            <span v-if="row" :class="{ 'why-no': !row.result.ok }">{{ row.result.ok ? '可能符合：' : '不符合：' }}{{ row.result.reason }}</span>
            <template v-else>尚未比對，回首頁填完四題就會看到判定。</template>
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
            <ul><li v-for="(d, i) in item.documents" :key="i">{{ d }}</li></ul>
          </div>
        </div>
      </div>
      <dl class="m-info">
        <dt>收件洽辦單位</dt>
        <dd data-test="d-office">{{ item.office }}</dd>
        <dt>聯繫方式</dt>
        <dd data-test="d-contact">{{ item.contact }}</dd>
        <dt>詳細資訊網址</dt>
        <dd data-test="d-url">
          <a v-if="item.url" :href="item.url" data-test="d-url-link" @click.prevent="onLink(item.url)">{{ item.url }}</a>
          <template v-else>無（模擬資料）</template>
        </dd>
      </dl>
      <!-- [SUBS-R18] 每筆詳情都顯示門檻提醒 -->
      <p class="m-note" data-test="d-notice">這是初步篩選，不代表一定可以領；門檻以社會局最新公告為準。</p>
      <div class="m-bar">
        <a v-if="item.url" class="btn cta" :href="item.url" data-test="d-apply" @click.prevent="onLink(item.url)">
          前往官網申請<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </a>
        <span v-else class="btn cta off" aria-disabled="true" data-test="d-apply-off">模擬資料・沒有官網</span>
        <a class="btn outline" :href="DATASET_URL" data-test="d-dataset" @click.prevent="onLink(DATASET_URL)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>查看開放資料來源
        </a>
        <a v-if="showCall" class="btn text" :href="`tel:${CITY_HOTLINE}`" data-test="d-call" @click="onCall">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>撥打 1999
        </a>
      </div>
    </div>
  </div>
</template>
