import { defineConfig } from 'vitest/config';

/**
 * Faqat sof mantiq testlanadi (`src/lib/*`). React komponentlari uchun
 * brauzer muhiti (`jsdom`) va uni sozlash kerak — panel uchun bu
 * hozircha ortiqcha, ekranlar qo'lda tekshiriladi.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
