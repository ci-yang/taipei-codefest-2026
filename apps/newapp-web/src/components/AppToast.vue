<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { message } = useToast();
</script>

<template>
  <div v-if="message" class="toast" role="status" data-test="toast">{{ message }}</div>
</template>
