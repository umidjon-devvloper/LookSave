import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
    // logger va config modullari import paytida env() ni o'qiydi
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgres://looksave@localhost:5432/looksave_test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-access-secret-0000000000000000000000',
      JWT_REFRESH_SECRET: 'test-refresh-secret-111111111111111111111',
    },
  },
});
