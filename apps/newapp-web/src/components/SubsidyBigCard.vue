<script setup lang="ts">
import { computed, ref } from 'vue';
import FavButton from '@/components/FavButton.vue';
import type { GroupedResults } from '@/lib/match';
import { art, toneOf } from '@/lib/illustrations';
import { openLink } from '@/lib/townpass';
import { agencyShort, bigCardDesc, bigCardPoints, kindLabel } from '@/lib/resultView';

/**
 * 輪播大卡（原型 bigCard，sa-3-s2.md W9）：狀態膠囊、書籤、插畫、名稱、機關名（SUBS-R29）、三點重點、說明、
 * 前往官網申請（模擬資料為「模擬資料・沒有官網」不能按）。點卡片或名稱開詳細資訊彈窗。
 */
const props = defineProps<{ row: GroupedResults['eligible'][number] }>();
const emit = defineEmits<{ (e: 'open', no: number, from: HTMLElement | null): void }>();
const nameBtn = ref<HTMLButtonElement | null>(null);
const item = computed(() => props.row.item);

function openDetail(): void {
  emit('open', item.value.no, nameBtn.value);
}
function onApply(): void {
  openLink(item.value.url);
}
</script>

<template>
  <div class="slide" :data-kind="item.kind">
    <div class="big" :data-no="item.no" data-test="big-card" @click="openDetail">
      <div class="big-top">
        <span class="stat">{{ kindLabel(item) }} · 可能符合</span>
        <FavButton :no="item.no" :name="item.name" />
      </div>
      <span class="big-ic" :style="{ '--tone': toneOf(item.no) }" data-test="card-illus" v-html="art(item.no)" />
      <h3>
        <button ref="nameBtn" type="button" class="big-name" data-test="big-name" @click.stop="openDetail">{{ item.name }}</button>
      </h3>
      <p class="org">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
        <span data-test="big-org">{{ agencyShort(item.office) }}</span>
      </p>
      <div class="points" data-test="big-points">
        <span v-for="p in bigCardPoints(item)" :key="p">{{ p }}</span>
      </div>
      <p class="desc">{{ bigCardDesc(props.row.result) }}</p>
      <a v-if="item.url" class="go" :href="item.url" data-test="big-apply" @click.stop.prevent="onApply">
        前往官網申請<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </a>
      <span v-else class="go off" aria-disabled="true" data-test="big-apply-off" @click.stop>模擬資料・沒有官網</span>
    </div>
  </div>
</template>
