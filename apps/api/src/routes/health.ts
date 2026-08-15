import { Router } from 'express';

import { env } from '../config/env';
import { pingDb } from '../db/pool';
import { pingRedis } from '../db/redis';

export const healthRouter: Router = Router();

/**
 * GET /health
 *
 * ⚠️ Bu endpoint atayin `{ data, meta }` qobig'idan tashqarida —
 * docs/08-deployment.md §10 dagi format Docker healthcheck va
 * UptimeRobot uchun shu ko'rinishda kelishilgan.
 *
 * db yoki redis javob bermasa → 503, Docker konteynerni unhealthy deb belgilaydi.
 */
healthRouter.get('/health', async (_req, res) => {
  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
  const checks = { db, redis };
  const ok = db && redis;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    checks,
    uptime: process.uptime(),
    version: env().API_TAG,
  });
});
