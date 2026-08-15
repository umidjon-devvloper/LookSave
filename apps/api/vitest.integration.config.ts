import { defineConfig } from 'vitest/config';

/**
 * Integratsion testlar — HAQIQIY PostgreSQL + PostGIS + Redis kerak.
 *
 *   cd infra && docker compose -f docker-compose.dev.yml up -d
 *   npm run test:integration --workspace=apps/api
 *
 * Baza har ishga tushirishda noldan quriladi (tests/global-setup.ts),
 * shuning uchun `looksave_it` nomi ishlatiladi — ishchi bazangizga
 * tegmaydi.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.integration.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Bir baza — parallel fayllar bir-birining ma'lumotini buzadi
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL:
        process.env['TEST_DATABASE_URL'] ??
        'postgres://looksave:looksave@localhost:5432/looksave_it',
      REDIS_URL: process.env['TEST_REDIS_URL'] ?? 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'integration-access-secret-000000000000',
      JWT_REFRESH_SECRET: 'integration-refresh-secret-11111111111',
      MAX_OPEN_ORDERS: '20',
      MAX_DAILY_ORDERS: '50',
      // Telegram webhook testlari uchun. Bot tokeni YO'Q — xabar
      // yuborilmaydi, faqat webhook mantig'i tekshiriladi.
      TELEGRAM_WEBHOOK_SECRET: 'integration-webhook-secret',
    },
  },
});
