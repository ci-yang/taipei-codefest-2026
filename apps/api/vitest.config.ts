import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // places 測試打真 DB，序列跑避免互相干擾
    fileParallelism: false,
  },
});
