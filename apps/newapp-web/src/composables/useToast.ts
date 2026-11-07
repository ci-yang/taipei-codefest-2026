import { readonly, ref } from 'vue';

/** 底部短提示（原型 toast()）：顯示 2.2 秒；只放畫面文字，不存任何資料 */
export const TOAST_MS = 2200;
const message = ref('');
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(text: string): void {
  message.value = text;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    message.value = '';
    timer = null;
  }, TOAST_MS);
}

export function useToast() {
  return { message: readonly(message), showToast };
}

/** 清除填寫答案、重新查詢共用的提示文字（原型 clearAnswers、requery） */
export const MSG_CLEARED = '已清除填寫答案';
