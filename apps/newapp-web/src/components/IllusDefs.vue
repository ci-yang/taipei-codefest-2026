<script setup lang="ts">
/** 插畫共用漸層（3D 卡通質感：亮部、本色、暗部）；逐字取自原型，App 掛一次，lib/illustrations.ts 的 #g-* 都參照這裡 */
</script>

<template>
  <svg class="defs" aria-hidden="true" focusable="false"><defs>
    <radialGradient id="g-mint" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f4fffd"/><stop offset=".5" stop-color="#c8e3e0"/><stop offset="1" stop-color="#7fb0aa"/></radialGradient>
    <radialGradient id="g-orange" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffc09a"/><stop offset=".5" stop-color="#ff7a33"/><stop offset="1" stop-color="#c8430d"/></radialGradient>
    <radialGradient id="g-gold" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff3b8"/><stop offset=".5" stop-color="#ffcc40"/><stop offset="1" stop-color="#c98a12"/></radialGradient>
    <radialGradient id="g-cream" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f6efe4"/><stop offset="1" stop-color="#cbbfae"/></radialGradient>
    <radialGradient id="g-char" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#8a8a94"/><stop offset=".5" stop-color="#45454d"/><stop offset="1" stop-color="#1e1e22"/></radialGradient>
    <radialGradient id="g-sky" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#eef7ff"/><stop offset=".5" stop-color="#a9d1f7"/><stop offset="1" stop-color="#5a8fc8"/></radialGradient>
    <radialGradient id="g-red" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffb3a8"/><stop offset=".5" stop-color="#f0503c"/><stop offset="1" stop-color="#a8231a"/></radialGradient>
    <radialGradient id="g-green" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#e9fbd9"/><stop offset=".5" stop-color="#92d66c"/><stop offset="1" stop-color="#4b9a2f"/></radialGradient>
    <radialGradient id="g-hi"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="g-sh"><stop offset="0" stop-color="#3a2a20" stop-opacity=".32"/><stop offset="1" stop-color="#3a2a20" stop-opacity="0"/></radialGradient>
  </defs></svg>
</template>
