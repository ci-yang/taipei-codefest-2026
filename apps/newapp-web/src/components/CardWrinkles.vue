<script setup lang="ts">
/**
 * 卡片被揪起的放射皺摺（spec 7.9、ADR-017）；形狀逐字取自原型 #card-age > .wrinkles，暗紋 primary-800／900 配淺色主卡。
 * v3：抓首頁白色大卡右上 1/3。x 是抓點在卡片寬度的位置（CSS 長度，預設 50%）；放射中心（viewBox 0,0）對準 (x, 卡片上緣 +6px)。
 * 父層要 position: relative。動作在本檔 scoped style 的 clothWrinkle。
 */
const props = withDefaults(defineProps<{ x?: string }>(), { x: '50%' });
</script>

<template>
  <svg class="wrinkles" data-test="wrinkles" viewBox="-170 -30 340 260" aria-hidden="true" :style="{ left: `calc(${props.x} - 170px)` }">
      <defs>
        <radialGradient id="wFade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="175"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <mask id="wMask" maskUnits="userSpaceOnUse" x="-170" y="-30" width="340" height="260"><rect x="-170" y="-30" width="340" height="260" fill="url(#wFade)"/></mask>
        <filter id="wSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
        <radialGradient id="wPinch"><stop offset="0" stop-color="#112629" stop-opacity=".45"/><stop offset="1" stop-color="#112629" stop-opacity="0"/></radialGradient>
      </defs>
      <g mask="url(#wMask)" filter="url(#wSoft)">
        <g fill="#22474E" fill-opacity=".3"><path d="M6.8 1.7Q11.3 9.2 32.2 16.2Q72.6 18.1 109.4 16.1Q75.0 8.6 36.6 -1.1Q14.4 -3.0 6.8 1.7Z"/><path d="M5.2 4.7Q9.8 15.7 30.2 37.3Q71.8 70.9 109.4 100.1Q77.1 65.1 39.9 26.7Q16.5 8.3 5.2 4.7Z"/><path d="M3.4 6.1Q4.5 18.3 18.3 45.3Q52.0 89.1 85.7 126.0Q58.9 85.3 30.9 38.4Q13.3 13.5 3.4 6.1Z"/><path d="M0.1 7.0Q-4.7 20.6 -5.5 54.9Q2.7 116.5 13.6 171.2Q10.9 116.4 9.3 54.7Q5.6 20.5 0.1 7.0Z"/><path d="M-3.0 6.3Q-14.6 16.7 -31.7 47.8Q-54.0 107.9 -71.8 162.3Q-45.3 112.0 -15.9 55.2Q-3.5 21.9 -3.0 6.3Z"/><path d="M-5.6 4.3Q-16.6 4.3 -39.1 18.5Q-73.0 52.7 -101.3 85.4Q-66.6 61.1 -27.5 33.8Q-8.5 15.0 -5.6 4.3Z"/><path d="M-6.6 2.3Q-14.2 -1.0 -35.7 3.4Q-72.4 17.0 -105.2 28.6Q-69.5 25.3 -30.4 18.3Q-10.5 9.5 -6.6 2.3Z"/><path d="M5.8 -3.9Q7.8 -1.0 18.3 -6.1Q34.6 -19.4 48.8 -31.6Q31.6 -23.9 12.7 -14.4Q3.9 -6.8 5.8 -3.9Z"/><path d="M-6.2 -3.3Q-4.4 -6.3 -14.0 -12.9Q-33.8 -19.9 -52.1 -24.8Q-36.5 -15.0 -18.8 -4.1Q-7.8 -0.2 -6.2 -3.3Z"/></g>
        <g fill="#ffffff" fill-opacity=".55"><path d="M7.0 13.2Q8.2 17.0 27.7 22.6Q64.5 25.7 97.9 25.7Q65.8 20.5 30.1 13.0Q9.9 10.3 7.0 13.2Z"/><path d="M1.3 13.4Q4.2 19.7 23.5 39.0Q61.0 70.8 94.6 98.7Q63.9 67.6 28.9 33.1Q7.9 15.6 1.3 13.4Z"/><path d="M-3.1 13.1Q-2.2 20.3 11.2 44.7Q41.2 85.6 71.0 120.2Q45.0 83.5 18.2 40.9Q2.7 17.6 -3.1 13.1Z"/><path d="M-9.0 10.1Q-11.7 19.1 -11.5 50.6Q-5.2 107.3 3.3 157.6Q-0.7 107.2 -3.4 50.5Q-6.0 19.0 -9.0 10.1Z"/><path d="M-14.1 4.4Q-21.2 11.6 -36.1 40.7Q-57.9 95.4 -75.9 144.6Q-53.2 97.6 -27.4 44.8Q-15.1 14.5 -14.1 4.4Z"/><path d="M-15.2 -3.4Q-21.1 -3.6 -41.1 10.4Q-73.2 40.5 -100.4 69.0Q-69.7 45.1 -34.7 18.7Q-16.6 2.3 -15.2 -3.4Z"/><path d="M-12.8 -6.1Q-15.7 -8.3 -35.2 -3.5Q-69.4 7.9 -100.1 17.0Q-67.8 12.4 -32.3 4.8Q-13.6 -2.5 -12.8 -6.1Z"/><path d="M11.8 -0.3Q9.9 3.2 19.3 -2.0Q34.8 -13.5 48.4 -23.8Q33.1 -16.0 16.2 -6.5Q7.7 0.0 11.8 -0.3Z"/><path d="M-5.9 -10.2Q-1.7 -10.2 -10.8 -15.8Q-28.6 -22.9 -45.0 -28.3Q-30.1 -20.2 -13.4 -10.9Q-3.6 -6.8 -5.9 -10.2Z"/></g>
      </g>
      <ellipse cx="0" cy="4" rx="34" ry="18" fill="url(#wPinch)"/>
    </svg>
</template>

<style scoped>
/* 340×260、viewBox 原點在 (170, 30)：top −24px 讓放射中心落在卡片上緣 +6px */
.wrinkles { position: absolute; z-index: 2; left: calc(50% - 170px); top: -24px; width: 340px; height: 260px; pointer-events: none; opacity: 0; transform-origin: 170px 30px; animation: clothWrinkle 1.8s linear both; }
/* 揪布：手指收攏時皺摺由抓點長出，上提最明顯，放開快速淡出 */
@keyframes clothWrinkle {
  0%, 32% { opacity: 0; transform: scale(.3); animation-timing-function: cubic-bezier(.3,0,.4,1); }
  40% { opacity: .6; transform: scale(.72); animation-timing-function: cubic-bezier(.45,0,.55,1); }
  60%, 66% { opacity: 1; transform: scale(1); animation-timing-function: cubic-bezier(.4,0,1,1); }
  74%, 100% { opacity: 0; transform: scale(1.06); }
}
@media (prefers-reduced-motion: reduce) { .wrinkles { display: none; } }
</style>
