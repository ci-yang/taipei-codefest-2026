<script setup lang="ts">
import { computed } from 'vue';
import type { SubsidyItem } from '@app/shared';
import FavButton from '@/components/FavButton.vue';
import { benefitBrief, cardKey, cardSummary, categoryText, statusOf, statusText } from '@/components/result/cardText';
import { useDetail } from '@/composables/useDetail';
import type { MatchResult } from '@/lib/match';
import { agencyShort } from '@/lib/resultView';

/**
 * 補助清單卡片（19.png）：結果頁、全部補助、我的珍藏共用。
 * 第一列分類＋狀態標籤與書籤；第二列名稱、機關與右側條件（有實際補助原文時改顯示原文，最多兩行，超過截掉加…）；
 * 底列條件摘要與「申辦詳情」（開詳細資訊彈窗）。
 * result 為 null＝沒作答，狀態標籤只寫資料類型。
 */
const props = defineProps<{ item: SubsidyItem; result: MatchResult | null }>();
const detail = useDetail();

const row = computed(() => ({ item: props.item, result: props.result }));
const status = computed(() => statusOf(row.value));
const key = computed(() => cardKey(row.value));
/**
 * 實際補助原文截成兩行內的精簡版；空白換成不換行空白，數字與「元」不會被拆到兩行。
 */
const keyText = computed(() =>
  key.value.benefit ? benefitBrief(key.value.value).replace(/ /g, '\u00a0') : key.value.value,
);

function openDetail(e: MouseEvent): void {
  detail.open(props.item.no, e.currentTarget as HTMLElement | null);
}
</script>

<template>
  <article class="lc" :data-no="item.no" :data-status="status" :data-kind="item.kind" data-test="list-card">
    <div class="lc-top">
      <span class="tag cat" data-test="tag-cat">{{ categoryText(item.no) }}</span>
      <span class="tag st" :class="`st-${status}`" data-test="tag-status">{{ statusText(row) }}</span>
      <FavButton class="lc-bm" :no="item.no" :name="item.name" />
    </div>
    <div class="lc-mid">
      <div class="lc-main">
        <h3 class="lc-name" data-test="card-name">{{ item.name }}</h3>
        <p class="lc-org">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-6 10 6z" /></svg>
          <span data-test="card-org">{{ agencyShort(item.office) }}</span>
        </p>
      </div>
      <div class="lc-key" :class="{ fail: status === 'ineligible', benefit: key.benefit }" data-test="card-key">
        <span class="k-label" data-test="card-key-label">{{ key.label }}</span>
        <b class="k-value" :title="key.benefit ? key.value : undefined" data-test="card-key-value">{{ keyText }}</b>
      </div>
    </div>
    <div class="lc-foot">
      <span class="lc-sum" data-test="card-summary">{{ cardSummary(row) }}</span>
      <button type="button" class="lc-more" :aria-label="`${item.name} 申辦詳情`" data-test="card-detail" @click="openDetail">
        申辦詳情<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </div>
  </article>
</template>

<style scoped>
.lc {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 16px 8px;
  border: 1px solid var(--tp-primary-100);
  border-radius: 20px;
  background: var(--tp-white);
  box-shadow: 0 4px 14px rgba(17, 38, 41, 0.06);
}
.lc-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lc-bm {
  margin-left: auto;
}
.tag {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
}
.tag.cat {
  border: 1px solid var(--tp-primary-200);
  background: var(--tp-primary-50);
  color: var(--tp-primary-700);
}
.tag.st {
  background: var(--tp-primary-50);
  color: var(--tp-primary-700);
}
.tag.st-mock {
  background: var(--tp-secondary-100);
  color: var(--tp-secondary-800);
}
.tag.st-ineligible {
  background: var(--tp-grayscale-50);
  color: var(--tp-grayscale-700);
}
.tag.st-none {
  background: var(--tp-grayscale-50);
  color: var(--tp-grayscale-700);
}
.lc-mid {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.lc-main {
  flex: 1;
  min-width: 0;
}
.lc-name {
  margin: 0;
  font-size: var(--tp-fs-title, 18px);
  font-weight: 700;
  line-height: 1.4;
  color: var(--tp-grayscale-900);
}
.lc-org {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--tp-grayscale-600);
}
.lc-org svg {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--tp-primary-600);
  stroke-width: 1.8;
  stroke-linejoin: round;
}
.lc-key {
  flex: none;
  max-width: 45%;
  text-align: right;
}
.k-label {
  display: block;
  font-size: 13px;
  color: var(--tp-grayscale-600);
}
.k-value {
  display: block;
  margin-top: 2px;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.3;
  color: var(--tp-primary-700);
}
.lc-key.benefit {
  width: 45%;
}
/* 實際補助原文由 benefitBrief 截短加…；line-clamp 只是保險（全文在申辦詳情） */
.lc-key.benefit .k-value {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  font-size: 15px;
  overflow-wrap: anywhere;
}
.lc-key.fail .k-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--tp-red-700);
}
.lc-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--tp-grayscale-100);
}
.lc-sum {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--tp-grayscale-600);
}
.lc-more {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 48px;
  padding: 0 4px;
  border: 0;
  background: none;
  font-size: 14px;
  font-weight: 700;
  color: var(--tp-primary-700);
  cursor: pointer;
}
.lc-more svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.lc-more:focus-visible {
  outline: 3px solid var(--tp-primary-500);
  outline-offset: 2px;
  border-radius: 8px;
}
</style>
