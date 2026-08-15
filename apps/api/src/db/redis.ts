import { Redis } from 'ioredis';

import { env } from '../config/env';
import { logger } from '../logger';

/**
 * Redis: OTP rate limiting, sessiya, SSE pub/sub uchun.
 * `maxRetriesPerRequest: 1` — Redis o'chsa so'rov osilib qolmaydi,
 * tez xato beradi va /health `degraded` ko'rsatadi.
 */
export const redis = new Redis(env().REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: false,
  connectTimeout: 5_000,
  retryStrategy: (times) => Math.min(times * 200, 5_000),
});

redis.on('error', (err: Error) => {
  logger.warn({ err: err.message }, 'redis ulanish xatosi');
});

export async function pingRedis(): Promise<boolean> {
  try {
    const reply = await redis.ping();
    return reply === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
