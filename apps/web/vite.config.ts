import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // shadcn/ui `@/...` bilan import qiladi — bitta manbadan barcha ilovalarda bir xil.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // 5173 — store-panel, 5174 — admin-panel. Uchalasi birga ishlashi kerak.
    port: 5175,
    proxy: {
      '/v1': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
