<script setup lang="ts">
import type { SubsidyItem } from '@app/shared';
import FavButton from '@/components/FavButton.vue';
import { art, toneOf } from '@/lib/illustrations';
import { kindLabel } from '@/lib/resultView';

/**
 * 清單列（原型 row，結果頁清單與我的珍藏共用）：小插畫、名稱、一句原因、資料類型標籤、還需確認、收件單位、書籤。
 * 不符合（ok === false）降低飽和度、原因用強調色（spec 7.10）。
 */
const props = defineProps<{ item: SubsidyItem; ok: boolean | null; why: string; verify?: boolean }>();
const emit = defineEmits<{ (e: 'open', no: number, from: HTMLElement | null): void }>();

function onOpen(e: MouseEvent): void {
  emit('open', props.item.no, e.currentTarget as HTMLElement);
}
</script>

<template>
  <div class="item" :class="{ no: props.ok === false }" :data-no="props.item.no" :data-kind="props.item.kind" data-test="row">
    <button class="item-main" data-test="row-main" @click="onOpen">
      <span class="thumb" :style="{ '--tone': toneOf(props.item.no) }" data-test="card-illus" v-html="art(props.item.no)" />
      <span class="rtxt">
        <b>{{ props.item.name }}</b>
        <span class="why" data-test="row-why">{{ props.why }}</span>
        <span class="meta">
          <span class="tag" :class="props.item.kind" data-test="kind-tag">{{ kindLabel(props.item) }}</span>
          <span v-if="props.verify" class="tag verify">還需確認</span>
          <span class="org-s">{{ props.item.office }}</span>
        </span>
      </span>
    </button>
    <FavButton :no="props.item.no" :name="props.item.name" small />
  </div>
</template>
