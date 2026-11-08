<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import AppToast from '@/components/AppToast.vue';
import DetailDialog from '@/components/DetailDialog.vue';
import IllusDefs from '@/components/IllusDefs.vue';
import { useDetail } from '@/composables/useDetail';
import { useQuery } from '@/composables/useQuery';

/**
 * 外框（v3）：頂列＋頁面＋詳情彈窗＋toast。沒有底部導覽列（任何頁面都沒有）。
 */
const route = useRoute();
const { listState, loadList, loadPrefill } = useQuery();
const detail = useDetail();

// [SUBS-R10] 進入服務時取一次補助清單（任何頁面進入都取）
// [SUBS-R24] 同時讀一次台北通帳號（逾時 3 秒），只算出年齡區間、設籍與區的帶入值；兩者並行，不互相等
onMounted(() => {
  if (listState.value === 'notLoaded') void loadList();
  void loadPrefill();
});

// 換頁時彈窗若還開著（例如連按兩次返回）就收起，不再動 history
watch(
  () => route.name,
  () => detail.close(true),
);
</script>

<template>
  <!-- 插畫共用漸層，全站一份 -->
  <IllusDefs />
  <div class="app">
    <AppHeader />
    <RouterView />
  </div>
  <DetailDialog />
  <AppToast />
</template>
