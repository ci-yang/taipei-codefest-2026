import { defineConfig } from 'tsup';

// 把 @app/shared（TS 原始碼）一起打包進 dist，production image 就不需要 shared 的原始碼
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  noExternal: ['@app/shared'],
});
