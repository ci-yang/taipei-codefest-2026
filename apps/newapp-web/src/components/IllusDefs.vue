<script setup lang="ts">
/**
 * 插畫共用漸層（3D 卡通質感：亮部、本色、暗部）；App 掛一次，lib/illustrations.ts 的 #g-* 都參照這裡。
 * 2026-11-08 改台北通色票（tp_colors.dart）：mint→primary 50/300/600、orange→orange 200/500/700、gold→secondary 100/500/700、
 * char→grayscale 400/700/900、red→red 200/500/700、陰影→grayscale-800。sky、green、cream 台北通沒有對應色系，保留原色。
 */
</script>

<template>
  <svg class="defs" aria-hidden="true" focusable="false"><defs>
    <radialGradient id="g-mint" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#EDF8FA"/><stop offset=".5" stop-color="#93D4DF"/><stop offset="1" stop-color="#468D9B"/></radialGradient>
    <radialGradient id="g-orange" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#F7CFB2"/><stop offset=".5" stop-color="#FD853A"/><stop offset="1" stop-color="#AE501F"/></radialGradient>
    <radialGradient id="g-gold" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#FCF2DF"/><stop offset=".5" stop-color="#F5BA4B"/><stop offset="1" stop-color="#AD7B2B"/></radialGradient>
    <radialGradient id="g-cream" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f6efe4"/><stop offset="1" stop-color="#cbbfae"/></radialGradient>
    <radialGradient id="g-char" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#91A0A8"/><stop offset=".5" stop-color="#475259"/><stop offset="1" stop-color="#171B1D"/></radialGradient>
    <radialGradient id="g-sky" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#eef7ff"/><stop offset=".5" stop-color="#a9d1f7"/><stop offset="1" stop-color="#5a8fc8"/></radialGradient>
    <radialGradient id="g-red" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#EBB6B6"/><stop offset=".5" stop-color="#D45251"/><stop offset="1" stop-color="#912522"/></radialGradient>
    <radialGradient id="g-green" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#e9fbd9"/><stop offset=".5" stop-color="#92d66c"/><stop offset="1" stop-color="#4b9a2f"/></radialGradient>
    <radialGradient id="g-hi"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="g-sh"><stop offset="0" stop-color="#30383D" stop-opacity=".28"/><stop offset="1" stop-color="#30383D" stop-opacity="0"/></radialGradient>
  </defs></svg>
</template>
