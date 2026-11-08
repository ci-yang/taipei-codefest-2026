<script setup lang="ts">
/** 試算頁會員卡：只說明有沒有串接台北通，不顯示任何帳號欄位（姓名、身分證、email、電話都不讀） */
defineProps<{ linked: boolean }>();
</script>

<template>
  <div class="member" :class="{ off: !linked }" data-test="member-card">
    <svg class="illus" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="12" width="52" height="40" rx="8" class="card" />
      <circle cx="22" cy="30" r="7" class="face" />
      <path d="M12 46c2-6 6-8 10-8s8 2 10 8" class="face" />
      <path d="M38 26h12M38 34h12M38 42h8" class="line" />
    </svg>
    <div class="txt">
      <template v-if="linked">
        <b data-test="member-title"><span class="dot" aria-hidden="true" />台北通會員</b>
        <p data-test="member-text">已串接台北通會員資料，年齡區間與戶籍已自動帶入</p>
      </template>
      <template v-else>
        <b data-test="member-title"><span class="dot" aria-hidden="true" />手動填寫</b>
        <p data-test="member-text">未串接台北通，請手動填寫</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.member { display: flex; gap: 14px; align-items: center; padding: 16px; border-radius: 18px; background: var(--tp-white); border: 1px solid var(--tp-grayscale-200); margin: 12px 0; }
.illus { flex: none; width: 64px; height: 64px; border-radius: 12px; background: var(--tp-primary-50); }
.illus .card { fill: var(--tp-primary-100); stroke: var(--tp-primary-700); stroke-width: 2; }
.illus .face { fill: none; stroke: var(--tp-primary-700); stroke-width: 2.4; stroke-linecap: round; }
.illus .line { fill: none; stroke: var(--tp-primary-500); stroke-width: 2.4; stroke-linecap: round; }
.off .illus .card { fill: var(--tp-grayscale-100); stroke: var(--tp-grayscale-600); }
.off .illus .face, .off .illus .line { stroke: var(--tp-grayscale-600); }
.txt b { display: flex; align-items: center; gap: 8px; font-size: var(--tp-fs-h3); color: var(--tp-grayscale-900); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tp-primary-700); }
.off .dot { background: var(--tp-grayscale-500); }
.txt p { margin: 4px 0 0; font-size: var(--tp-fs-body); color: var(--tp-grayscale-700); line-height: 1.5; }
</style>
