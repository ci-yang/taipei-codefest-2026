/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // .env 放在 repo 根目錄（前後端共用一份）
  const envDir = fileURLToPath(new URL('../..', import.meta.url));
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };
  // 在 docker compose 裡 API 主機名是 api；本機是 localhost
  const apiTarget = env.VITE_PROXY_TARGET || `http://localhost:${env.API_PORT || 8787}`;

  return {
    envDir,
    plugins: [vue()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: '0.0.0.0', // 手機同網段可用 http://<開發機IP>:5173 連
      port: 5173,
      strictPort: true,
      // Docker on macOS 的 bind mount 收不到檔案事件，compose 會設 VITE_USE_POLLING=true
      watch: env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
      proxy: {
        '/api': apiTarget,
        '/healthz': apiTarget,
        '/config': apiTarget,
      },
    },
    // maplibre-gl 本身約 1MB（已 lazy load 在 /map），不用為它警告
    build: { chunkSizeWarningLimit: 1200 },
    test: {
      environment: 'jsdom',
      include: ['test/**/*.test.ts'],
    },
  };
});
