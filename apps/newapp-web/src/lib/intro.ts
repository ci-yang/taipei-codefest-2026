/**
 * 入場動畫只在「進入服務」時播一次（spec 7.9、ADR-017，sa-3-s2.md W6）。
 * 進入服務＝這次載入頁面；之後從別頁回開始頁不再播。減少動態效果時不播。
 */

/** 動畫 1.8 秒（style.css handMove 等），多留 0.1 秒才拿掉手與 .pulled，總長仍在 2 秒內 */
export const INTRO_MS = 1900;

let played = false;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 這次要不要播：第一次呼叫且沒有減少動態效果時回 true，之後都回 false */
export function consumeIntro(): boolean {
  if (played) return false;
  played = true;
  return !prefersReducedMotion();
}
