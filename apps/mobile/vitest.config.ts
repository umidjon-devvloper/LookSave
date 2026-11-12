import { defineConfig } from 'vitest/config';

/**
 * Faqat SOF mantiq testlanadi (`src/three/core.ts` kabi) — React Native
 * komponentlari uchun qurilma yoki og'ir mock kerak, ular `eas build`
 * dan keyin qo'lda sinaladi.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // `plugins/` — prebuild paytida native loyihani o'zgartiradigan config pluginlar
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
  },
});
