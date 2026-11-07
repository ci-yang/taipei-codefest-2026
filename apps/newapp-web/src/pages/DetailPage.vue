<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import HomeButton from '@/components/HomeButton.vue';
import { useQuery } from '@/composables/useQuery';
import { art, toneOf } from '@/lib/illustrations';
import { isTownPassBridgeAvailable, openLink, phoneCall } from '@/lib/townpass';
import { CITY_HOTLINE, THRESHOLD_NOTICE, canCall1999, findRow, kindLabel } from '@/lib/resultView';

const route = useRoute();
const router = useRouter();
const q = useQuery();

/** 用手機記憶體的比對結果（sa-3-s1.md 1.7：本頁不打 API）；S2 起模擬項目也有詳細資訊 */
const row = computed(() => {
  if (!q.results.value) return null;
  return findRow(q.results.value, Number(route.params.no));
});

// 序號不在結果裡（亂打的網址）就回結果頁
watchEffect(() => {
  if (!row.value) void router.replace({ name: 'result' });
});

/** [W11] 撥打 1999 只給聯繫方式含 1999 的開放資料 */
const showCall = computed(() => (row.value ? canCall1999(row.value.item) : false));

/** 返回結果：從結果頁進來就退回上一頁（保留捲動位置與閱讀模式，4.8、SUBS-R25）；直接開網址時改導到結果頁 */
function backToResult(): void {
  const back = (window.history.state as { back?: unknown } | null)?.back;
  if (typeof back === 'string' && back.startsWith('/result')) router.back();
  else void router.replace({ name: 'result' });
}

/** 官網、詳細資訊網址用外部連結開（台北通殼走 open_link，瀏覽器走 window.open） */
function onUrlClick(url: string): void {
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
  <div v-if="row" class="detail" role="main" data-test="page-detail">
    <div class="d-top">
      <!-- 返回（回結果頁）與首頁鍵並排在左，照原型 d-top；右側是官網鈕（模擬資料為不可按的「模擬資料」） -->
      <button class="circ" aria-label="返回結果" data-test="btn-back-top" @click="backToResult">‹</button>
      <HomeButton />
      <span class="d-mini">{{ row.item.name }}</span>
      <a
        v-if="row.item.url"
        class="act"
        :href="row.item.url"
        data-test="d-act"
        @click.prevent="onUrlClick(row.item.url)"
        >官網</a
      >
      <span v-else class="act off" aria-disabled="true" data-test="d-act-off">模擬資料</span>
    </div>

    <!-- 大插畫與判定、資料類型膠囊（spec 7.10）；插畫為原創 SVG 字串常數 -->
    <div class="d-illus" :style="{ '--tone': toneOf(row.item.no) }" data-test="d-illus">
      <span class="art" v-html="art(row.item.no)" />
      <div class="d-pills">
        <span class="pill" :class="row.result.ok ? 'mint' : 'warn'" data-test="d-pill-verdict">{{
          row.result.ok ? '可能符合' : row.result.reason
        }}</span>
        <span class="pill glass" data-test="d-pill-kind">{{ kindLabel(row.item) }}</span>
      </div>
    </div>

    <h3 data-test="d-title">
      {{ row.item.name }}<span class="tag" :class="row.item.kind">{{ kindLabel(row.item) }}</span>
    </h3>

    <dl class="panel">
      <dt>
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>判定與原因
      </dt>
      <dd data-test="d-why">
        <div class="banner" :class="row.result.ok ? 'info' : 'err'">
          {{ row.result.ok ? '可能符合：' : '不符合：' }}{{ row.result.reason }}
        </div>
        <!-- [SUBS-R18] 每筆詳情都顯示門檻提醒 -->
        <p class="muted" data-test="d-notice">{{ THRESHOLD_NOTICE }}</p>
      </dd>

      <dt>
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg></span>還需確認的條件
      </dt>
      <dd data-test="d-verify">
        <ul v-if="row.result.toVerify.length">
          <li v-for="(v, i) in row.result.toVerify" :key="i">{{ v }}</li>
        </ul>
        <template v-else>無</template>
      </dd>

      <dt>
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M4 21V8l8-5l8 5v13M9 21v-6h6v6" /></svg></span>收件洽辦單位
      </dt>
      <dd class="pre" data-test="d-office">{{ row.item.office }}</dd>

      <dt>
        <span class="ic">
          <svg viewBox="0 0 24 24"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
        </span>聯繫方式
      </dt>
      <dd class="pre" data-test="d-contact">{{ row.item.contact }}</dd>

      <dt>
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z" /><path d="M10 12h5M10 16h5" /></svg></span>應備文件
      </dt>
      <dd data-test="d-docs">
        <ul class="docs">
          <li v-for="(d, i) in row.item.documents" :key="i">{{ d }}</li>
        </ul>
      </dd>

      <dt>
        <span class="ic">
          <svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
        </span>詳細資訊網址
      </dt>
      <dd data-test="d-url">
        <a v-if="row.item.url" :href="row.item.url" data-test="d-url-link" @click.prevent="onUrlClick(row.item.url)">{{ row.item.url }}</a>
        <template v-else>無（模擬資料）</template>
      </dd>
    </dl>

    <div class="d-bar">
      <button class="btn" data-test="btn-back" @click="backToResult">返回結果</button>
      <a
        v-if="row.item.url"
        class="btn primary"
        :href="row.item.url"
        data-test="btn-site"
        @click.prevent="onUrlClick(row.item.url)"
        >開官網</a
      >
      <a v-if="showCall" class="btn call" :href="`tel:${CITY_HOTLINE}`" aria-label="撥打 1999" data-test="btn-call" @click="onCall">
        <svg viewBox="0 0 24 24"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
      </a>
    </div>
  </div>
</template>
