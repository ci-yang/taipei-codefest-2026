<script setup lang="ts">
/**
 * 入場動畫的可愛小手（spec 7.9、ADR-017，sa-3-s2.md W6）。
 * 原創 SVG，逐字取自 .plan/.1108/sprint/prototype/index.html 的 #intro-hand；
 * 動作（伸下、收攏、上提、放開、收回）在本檔 scoped style 的 handMove／grab／fingersFade／fistFade。
 * 疊在頁面上、pointer-events: none，不擋操作；減少動態效果時由 HomePage 不掛載（CSS 也隱藏）。
 * top：手的垂直位置（px），HomePage 依大卡上緣算（卡片 top − 138）。
 * left：抓點的水平位置（px，手的中心線），HomePage 依大卡寬度 2/3 算；手臂沿這條垂直線從畫面上緣伸下來。
 */
const props = defineProps<{ top?: number | null; left?: number | null }>();
</script>

<template>
  <svg class="hand" data-test="intro-hand" viewBox="0 0 160 260" aria-hidden="true" :style="{ ...(props.top != null ? { top: `${props.top}px` } : {}), ...(props.left != null ? { left: `${props.left}px` } : {}) }">
    <defs>
      <!-- 可愛小手：淺桃粉，亮部 #ffe3d6、中間 #ffc4ae、暗部 #f7b8a2 -->
      <linearGradient id="hArm" gradientUnits="userSpaceOnUse" x1="38" y1="0" x2="122" y2="0">
        <stop offset="0" stop-color="#f6b8a3"/><stop offset=".22" stop-color="#ffc4ae"/><stop offset=".45" stop-color="#ffe3d6"/>
        <stop offset=".72" stop-color="#ffc4ae"/><stop offset="1" stop-color="#f5b5a0"/>
      </linearGradient>
      <radialGradient id="hSkin2" cx=".38" cy=".35" r=".8">
        <stop offset="0" stop-color="#ffe9df"/><stop offset=".55" stop-color="#ffc4ae"/><stop offset="1" stop-color="#f7b8a2"/>
      </radialGradient>
      <radialGradient id="hBall" cx=".36" cy=".32" r=".75">
        <stop offset="0" stop-color="#ffeae0"/><stop offset=".6" stop-color="#ffc4ae"/><stop offset="1" stop-color="#f6b59f"/>
      </radialGradient>
      <radialGradient id="hVol" gradientUnits="userSpaceOnUse" cx="72" cy="160" r="46">
        <stop offset="0" stop-color="#fff1ea" stop-opacity=".95"/><stop offset=".6" stop-color="#ffe3d6" stop-opacity=".3"/><stop offset="1" stop-color="#ffe3d6" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="hBlush"><stop offset="0" stop-color="#ff8fa6" stop-opacity=".55"/><stop offset="1" stop-color="#ff8fa6" stop-opacity="0"/></radialGradient>
      <radialGradient id="hHi"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <radialGradient id="hAO"><stop offset="0" stop-color="#d98a74" stop-opacity=".3"/><stop offset="1" stop-color="#c8664f" stop-opacity="0"/></radialGradient>
      <linearGradient id="hRim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#DBF1F5" stop-opacity="0"/><stop offset=".78" stop-color="#DBF1F5" stop-opacity="0"/><stop offset="1" stop-color="#DBF1F5" stop-opacity=".8"/>
      </linearGradient>
    </defs>
    <!-- 拇指（在手掌後面長出） -->
    <g transform="translate(50 157) rotate(48)">
      <rect x="-10.5" y="0" width="21" height="29" rx="10.5" fill="url(#hSkin2)" stroke="url(#hRim)" stroke-width="1.2"/>
      <ellipse cx="-3" cy="19" rx="4" ry="5" fill="url(#hHi)"/>
    </g>
    <!-- 細短手臂到圓胖手掌一體成形，手臂往上延伸出畫面 -->
    <path d="M65 -700H95V126C95 134 121 140 121 170C121 197 102 210 80 210C58 210 39 197 39 170C39 140 65 134 65 126Z" fill="url(#hArm)" stroke="url(#hRim)" stroke-width="1.4"/>
    <path d="M65 -700H95V126C95 134 121 140 121 170C121 197 102 210 80 210C58 210 39 197 39 170C39 140 65 134 65 126Z" fill="url(#hVol)"/>
    <ellipse cx="74" cy="60" rx="5" ry="48" fill="url(#hHi)" opacity=".5"/>
    <ellipse cx="44" cy="168" rx="6" ry="12" fill="url(#hAO)" opacity=".4"/>
    <circle cx="99" cy="172" r="15" fill="url(#hBlush)"/>
    <ellipse cx="64" cy="154" rx="13" ry="9" transform="rotate(-25 64 154)" fill="url(#hHi)"/>
    <circle cx="58" cy="150" r="2.4" fill="#fff" opacity=".9"/>
    <ellipse cx="80" cy="197" rx="34" ry="9" fill="url(#hAO)" opacity=".25"/>
    <g class="fingers">
      <ellipse cx="62" cy="200" rx="3.2" ry="12" fill="url(#hAO)"/>
      <ellipse cx="80" cy="202" rx="3.2" ry="12" fill="url(#hAO)"/>
      <ellipse cx="98" cy="200" rx="3.2" ry="12" fill="url(#hAO)"/>
      <g transform="rotate(7 53 184)">
        <rect x="43.5" y="184" width="19" height="30" rx="9.5" fill="url(#hSkin2)" stroke="url(#hRim)" stroke-width="1.2"/>
        <ellipse cx="50.0" cy="203.6" rx="3.8" ry="4.9" fill="url(#hHi)"/>
        <circle cx="49.2" cy="199.2" r="1.3" fill="#fff" opacity=".85"/>
        <ellipse cx="53" cy="209.5" rx="3.8" ry="2.4" fill="#ffd3d6" opacity=".9"/>
      </g>
      <g transform="rotate(2 71 186)">
        <rect x="61.0" y="186" width="20" height="35" rx="10.0" fill="url(#hSkin2)" stroke="url(#hRim)" stroke-width="1.2"/>
        <ellipse cx="67.8" cy="210.0" rx="4.0" ry="5.2" fill="url(#hHi)"/>
        <circle cx="67.0" cy="205.4" r="1.3" fill="#fff" opacity=".85"/>
        <ellipse cx="71" cy="216.5" rx="4.0" ry="2.4" fill="#ffd3d6" opacity=".9"/>
      </g>
      <g transform="rotate(-2 89 186)">
        <rect x="79.0" y="186" width="20" height="34" rx="10.0" fill="url(#hSkin2)" stroke="url(#hRim)" stroke-width="1.2"/>
        <ellipse cx="85.8" cy="209.0" rx="4.0" ry="5.2" fill="url(#hHi)"/>
        <circle cx="85.0" cy="204.4" r="1.3" fill="#fff" opacity=".85"/>
        <ellipse cx="89" cy="215.5" rx="4.0" ry="2.4" fill="#ffd3d6" opacity=".9"/>
      </g>
      <g transform="rotate(-7 106 184)">
        <rect x="97.0" y="184" width="18" height="28" rx="9.0" fill="url(#hSkin2)" stroke="url(#hRim)" stroke-width="1.2"/>
        <ellipse cx="103.1" cy="202.1" rx="3.6" ry="4.7" fill="url(#hHi)"/>
        <circle cx="102.4" cy="198.0" r="1.3" fill="#fff" opacity=".85"/>
        <ellipse cx="106" cy="207.5" rx="3.6" ry="2.4" fill="#ffd3d6" opacity=".9"/>
      </g>
    </g>
    <!-- 握拳：圓滾滾的四顆指節，與 grab 時段 crossfade -->
    <g class="fist">
      <ellipse cx="65.5" cy="201" rx="2.6" ry="9" fill="url(#hAO)"/>
      <ellipse cx="82.5" cy="203" rx="2.6" ry="9" fill="url(#hAO)"/>
      <ellipse cx="99" cy="201" rx="2.6" ry="9" fill="url(#hAO)"/>
      <circle cx="57" cy="199" r="10.5" fill="url(#hBall)" stroke="url(#hRim)" stroke-width="1.1"/>
      <ellipse cx="53.6" cy="195.4" rx="3.6" ry="2.6" fill="#fff" opacity=".7"/>
      <circle cx="74" cy="203" r="11" fill="url(#hBall)" stroke="url(#hRim)" stroke-width="1.1"/>
      <ellipse cx="70.6" cy="199.4" rx="3.6" ry="2.6" fill="#fff" opacity=".7"/>
      <circle cx="91" cy="203" r="11" fill="url(#hBall)" stroke="url(#hRim)" stroke-width="1.1"/>
      <ellipse cx="87.6" cy="199.4" rx="3.6" ry="2.6" fill="#fff" opacity=".7"/>
      <circle cx="107" cy="199" r="10" fill="url(#hBall)" stroke="url(#hRim)" stroke-width="1.1"/>
      <ellipse cx="103.6" cy="195.4" rx="3.6" ry="2.6" fill="#fff" opacity=".7"/>
    </g>
  </svg>
</template>

<style scoped>
/* 手中心線對準 left（預設畫面中央）；手臂 path 往上延伸到 y=-700，整條手臂不會斷 */
.hand { position: fixed; top: -9px; left: 50%; width: 124px; margin-left: -62px; z-index: 6; pointer-events: none; overflow: visible; opacity: 0; transform: translateY(-140px); will-change: transform; animation: handMove 1.8s linear forwards, handFade .3s ease-out forwards; }
.hand .fingers { transform-origin: 80px 192px; transform: scale(1.08, 1); animation: grab 1.8s linear forwards, fingersFade 1.8s linear forwards; }
.hand .fist { opacity: 0; animation: fistFade 1.8s linear forwards; }
@keyframes fingersFade { 0%, 31% { opacity: 1; } 39%, 67% { opacity: 0; } 75%, 100% { opacity: 1; } }
@keyframes fistFade { 0%, 31% { opacity: 0; } 39%, 67% { opacity: 1; } 75%, 100% { opacity: 0; } }
@keyframes handFade { to { opacity: 1; } }
@keyframes handMove {
  0% { transform: translateY(-140px); filter: drop-shadow(0 0 1px rgba(255,236,226,.12)) drop-shadow(0 22px 28px rgba(0,0,0,.18)); animation-timing-function: cubic-bezier(.16,.84,.3,1); }
  30% { transform: translateY(0); filter: drop-shadow(0 0 1px rgba(255,236,226,.12)) drop-shadow(0 10px 16px rgba(0,0,0,.26)); animation-timing-function: cubic-bezier(.45,0,.55,1); }
  40% { transform: translateY(7px); filter: drop-shadow(0 0 1px rgba(255,236,226,.12)) drop-shadow(0 7px 14px rgba(0,0,0,.3)); animation-timing-function: cubic-bezier(.45,0,.55,1); }
  60%, 70% { transform: translateY(-11px); filter: drop-shadow(0 0 1px rgba(255,236,226,.12)) drop-shadow(0 14px 20px rgba(0,0,0,.22)); animation-timing-function: cubic-bezier(.5,0,.75,.2); }
  100% { transform: translateY(-380px); filter: drop-shadow(0 0 1px rgba(255,236,226,.12)) drop-shadow(0 26px 30px rgba(0,0,0,.12)); }
}
@keyframes grab {
  0%, 30% { transform: scale(1.08, 1); animation-timing-function: cubic-bezier(.45,0,.55,1); }
  40%, 66% { transform: scale(.94, .8); animation-timing-function: cubic-bezier(.3,0,.3,1); }
  76%, 100% { transform: scale(1.08, 1); }
}
@media (prefers-reduced-motion: reduce) { .hand { display: none; } }
</style>
