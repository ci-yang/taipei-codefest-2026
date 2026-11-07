<script setup lang="ts">
import type { GroupedResults } from '@/lib/match';
import { art, toneOf } from '@/lib/illustrations';
import { badgeText, kindLabel } from '@/lib/resultView';
import type { ResultView } from '@/composables/useQuery';

/**
 * 結果卡片（原型 bigCard／card）：grid 大圖卡（插畫、名稱、一句原因、標籤），
 * list 小圖清單（小插畫、名稱、一句原因、標籤、收件單位）。不符合項目插畫降飽和、原因用強調色（spec 7.10）。
 */
const props = defineProps<{ row: GroupedResults['eligible'][number]; view: ResultView }>();
const emit = defineEmits<{ (e: 'open', no: number): void }>();
</script>

<template>
  <button
    v-if="props.view === 'grid'"
    class="bcard"
    :class="{ no: !props.row.result.ok }"
    :data-no="props.row.item.no"
    :data-kind="props.row.item.kind"
    data-test="card"
    @click="emit('open', props.row.item.no)"
  >
    <!-- 插畫為原創 SVG 字串常數（lib/illustrations.ts），依序號對應 -->
    <span class="illus" :style="{ '--tone': toneOf(props.row.item.no) }" data-test="card-illus">
      <span v-html="art(props.row.item.no)" />
      <span class="fab" aria-hidden="true">↗</span>
      <span class="pill glass">{{ badgeText(props.row.item) }}</span>
    </span>
    <b>{{ props.row.item.name }}</b>
    <span class="why">{{ props.row.result.reason }}</span>
    <span class="tags">
      <span class="tag" :class="props.row.item.kind" data-test="kind-tag">{{ kindLabel(props.row.item) }}</span>
      <span v-if="props.row.result.ok && props.row.result.toVerify.length" class="tag verify">還需確認</span>
    </span>
  </button>
  <button
    v-else
    class="item"
    :class="{ no: !props.row.result.ok }"
    :data-no="props.row.item.no"
    :data-kind="props.row.item.kind"
    data-test="card"
    @click="emit('open', props.row.item.no)"
  >
    <span class="thumb" :style="{ '--tone': toneOf(props.row.item.no) }" data-test="card-illus" v-html="art(props.row.item.no)" />
    <span class="rtxt">
      <b>{{ props.row.item.name }}</b>
      <span class="why">{{ props.row.result.reason }}</span>
      <span class="meta">
        <span class="tag" :class="props.row.item.kind" data-test="kind-tag">{{ kindLabel(props.row.item) }}</span>
        <span v-if="props.row.result.ok && props.row.result.toVerify.length" class="tag verify">還需確認</span>
        <span class="org">{{ props.row.item.office }}</span>
      </span>
    </span>
  </button>
</template>
