import { readonly, ref } from 'vue';

/**
 * 詳細資訊彈窗（sa-2-overview.md 4.8、ADR-025）：開啟時推一筆 history，返回鍵（popstate）關閉；
 * 關閉鈕、Esc、點背景關閉時若目前的 history 是彈窗那筆就 history.back()；關閉後焦點回到觸發的卡片或列。
 * 推入的 state 保留原本的 history.state（vue-router 的位置資訊），只多一個 detail 欄位。
 */
const openNo = ref<number | null>(null);
let returnFocus: HTMLElement | null = null;
let listening = false;

function hasDetailState(): boolean {
  const s = window.history.state as { detail?: unknown } | null;
  return !!s && typeof s.detail === 'number';
}

function onPopState(): void {
  close(true);
}

function ensureListener(): void {
  if (listening) return;
  window.addEventListener('popstate', onPopState);
  listening = true;
}

/** 開彈窗；已開著時只換內容，不再推 history */
function open(no: number, from?: HTMLElement | null): void {
  ensureListener();
  const wasOpen = openNo.value !== null;
  openNo.value = no;
  if (!wasOpen) {
    returnFocus = from ?? (document.activeElement as HTMLElement | null);
    try {
      window.history.pushState({ ...(window.history.state ?? {}), detail: no }, '');
    } catch {
      // 不支援 pushState 的環境略過，返回鍵就不會關彈窗
    }
  }
}

/** 關彈窗；viaPop＝已經是返回鍵觸發，不再 history.back() */
function close(viaPop = false): void {
  if (openNo.value === null) return;
  openNo.value = null;
  if (!viaPop && hasDetailState()) window.history.back();
  const el = returnFocus;
  returnFocus = null;
  if (el && el.isConnected && typeof el.focus === 'function') el.focus({ preventScroll: true });
}

export function useDetail() {
  return { openNo: readonly(openNo), open, close };
}
