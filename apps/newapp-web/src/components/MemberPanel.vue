<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { AGE_BANDS } from '@app/shared';
import { useQuery } from '@/composables/useQuery';
import { MSG_CLEARED, showToast } from '@/composables/useToast';
import { isTownPassBridgeAvailable } from '@/lib/townpass';

/**
 * 台北通會員面板（v3，底部抽屜）：只顯示由台北通帶入的年齡區間與「臺北市 · ○○區」（SUBS-R24）；
 * 不讀不顯示姓名、身分證字號。沒有 bridge 時寫「未串接台北通，請手動填寫」。
 * 連結：資料來源與門檻說明、瀏覽全部補助、清除填寫答案。
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const q = useQuery();
const route = useRoute();
const router = useRouter();
const sheet = ref<HTMLElement | null>(null);

const linked = computed(() => isTownPassBridgeAvailable());
const bandText = computed(() => {
  const v = q.prefill.value.ageBand;
  return AGE_BANDS.find((b) => b.value === v)?.label ?? '未取得';
});
const placeText = computed(() => {
  const { residency, town } = q.prefill.value;
  if (residency === true) return town ? `臺北市 · ${town}` : '臺北市';
  if (residency === false) return '非臺北市';
  return '未取得';
});

/** [SUBS-R27] 清除填寫答案：重設答案（重新帶入台北通值）；在結果頁時回試算頁，因為結果已不存在 */
function clearAnswers(): void {
  q.startOver();
  showToast(MSG_CLEARED);
  emit('close');
  if (route.name === 'result') void router.push({ name: 'calc' });
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) emit('close');
}
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));

watch(
  () => props.open,
  async (o) => {
    if (!o) return;
    await nextTick();
    sheet.value?.focus({ preventScroll: true });
  },
);
</script>

<template>
  <div v-if="open" class="mp-back" data-test="member-panel" @click.self="emit('close')">
    <section ref="sheet" class="mp" role="dialog" aria-modal="true" aria-labelledby="mpTitle" tabindex="-1">
      <div class="mp-grip" aria-hidden="true" />
      <div class="mp-top">
        <span class="mp-av" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" /><path d="M4.5 21c1.2-4 4-6 7.5-6s6.3 2 7.5 6" /></svg>
        </span>
        <h2 id="mpTitle">台北通會員</h2>
        <button class="circ" aria-label="關閉" data-test="mp-close" @click="emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <dl v-if="linked" class="mp-info" data-test="mp-info">
        <div>
          <dt>年齡區間</dt>
          <dd data-test="mp-band">{{ bandText }}</dd>
        </div>
        <div>
          <dt>戶籍</dt>
          <dd data-test="mp-place">{{ placeText }}</dd>
        </div>
      </dl>
      <p v-else class="mp-off" data-test="mp-unlinked">未串接台北通，請手動填寫</p>
      <p class="mp-note">只讀生日與地址的縣市、區，用來帶入試算；不顯示姓名、不送出、不儲存。</p>

      <nav class="mp-links" aria-label="會員面板">
        <RouterLink :to="{ name: 'source' }" class="mp-link" data-test="mp-source">資料來源與門檻說明</RouterLink>
        <RouterLink :to="{ name: 'all' }" class="mp-link" data-test="mp-all">瀏覽全部補助</RouterLink>
        <button class="mp-link danger" data-test="mp-clear" @click="clearAnswers">清除填寫答案</button>
      </nav>
    </section>
  </div>
</template>

<style scoped>
.mp-back {
  position: fixed;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 38, 41, 0.45);
}
.mp {
  width: 100%;
  max-width: 430px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 8px 18px calc(18px + env(safe-area-inset-bottom));
  border-radius: 28px 28px 0 0;
  background: var(--card);
  color: var(--text);
  box-shadow: 0 -12px 40px rgba(17, 38, 41, 0.25);
  animation: mp-up 0.22s ease-out;
}
.mp:focus {
  outline: none;
}
@keyframes mp-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mp {
    animation: none;
  }
}
.mp-grip {
  width: 40px;
  height: 4px;
  margin: 0 auto 10px;
  border-radius: 999px;
  background: var(--tp-grayscale-200);
}
.mp-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mp-top h2 {
  flex: 1;
  margin: 0;
  font-size: var(--fs-title);
}
.mp-top .circ {
  background: var(--tp-grayscale-50);
  border-color: transparent;
}
.mp-av {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary-faint);
  color: var(--primary-strong);
}
.mp-av svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}
.mp-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 16px 0 0;
  padding: 12px 0;
  border-radius: 18px;
  background: var(--primary-faint);
  border: 1px solid var(--tp-primary-100);
  text-align: center;
}
.mp-info div + div {
  border-left: 1px solid var(--tp-primary-200);
}
.mp-info dt {
  font-size: var(--fs-caption);
  color: var(--muted);
}
.mp-info dd {
  margin: 2px 0 0;
  font-weight: 600;
  color: var(--heading);
}
.mp-off {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: 18px;
  background: var(--tp-grayscale-50);
  color: var(--text);
  font-weight: 600;
}
.mp-note {
  margin: 8px 4px 0;
  font-size: var(--fs-caption);
  color: var(--muted);
}
.mp-links {
  display: flex;
  flex-direction: column;
  margin-top: 14px;
  border-top: 1px solid var(--line);
}
.mp-link {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0 4px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: none;
  color: var(--text);
  font-size: var(--fs-h3);
  font-weight: 600;
  text-align: left;
  text-decoration: none;
}
.mp-link::after {
  content: '›';
  margin-left: auto;
  color: var(--muted);
  font-size: 1.4rem;
}
.mp-link.danger {
  color: var(--danger);
}
</style>
