import type { Request, RequestHandler, Response } from 'express';

import { redis } from '../db/redis';
import { logger } from '../logger';
import { ApiError } from './api-error';
import { getAuthOptional } from './auth-middleware';

/**
 * Sobit oyna (fixed window) cheklovi. Redis: INCR + EXPIRE.
 *
 * Sliding window aniqroq, lekin bu yerda ortiqcha: chegara oshib ketishi
 * eng yomon holatda ikki barobar bo'ladi, bu MVP uchun maqbul.
 *
 * ⚠️ Redis o'chsa cheklov ISHLAMAYDI — so'rov o'tkaziladi (fail-open).
 * Sabab: Redis tushib qolganda butun ilovani to'xtatib qo'yish
 * DoS'ning o'zi bo'ladi. Buning o'rniga xato log'ga yoziladi.
 */
export interface RateLimitOptions {
  /** Oyna davomiyligi, soniya */
  windowSec: number;
  /** Oynadagi maksimal so'rov */
  max: number;
  /** Redis kalit prefiksi */
  prefix: string;
  /** Kim bo'yicha hisoblanadi. Standart: foydalanuvchi id yoki IP */
  key?: (req: Request, res: Response) => string;
  /** Chegara oshganda qaytadigan kod */
  code?: 'RATE_LIMITED' | 'LIMIT_REACHED' | 'OTP_TOO_SOON';
  message?: string;
}

function defaultKey(req: Request, res: Response): string {
  const auth = getAuthOptional(res);
  return auth?.sub ?? req.ip ?? 'unknown';
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const { windowSec, max, prefix, code = 'RATE_LIMITED' } = options;
  const keyOf = options.key ?? defaultKey;

  return async (req, res, next) => {
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    const redisKey = `rl:${prefix}:${keyOf(req, res)}:${bucket}`;

    let count: number;
    try {
      const result = await redis.multi().incr(redisKey).expire(redisKey, windowSec).exec();
      const incrResult = result?.[0]?.[1];
      count = typeof incrResult === 'number' ? incrResult : 1;
    } catch (err) {
      // fail-open — yuqoridagi izohga qarang
      logger.warn({ err, prefix }, 'rate limit tekshirilmadi (redis)');
      next();
      return;
    }

    const remaining = Math.max(0, max - count);
    const resetAt = (bucket + 1) * windowSec;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetAt));

    if (count > max) {
      const retryAfter = Math.max(1, resetAt - Math.floor(Date.now() / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      next(new ApiError(code, options.message ?? 'Juda ko`p so`rov, biroz kuting'));
      return;
    }

    next();
  };
}

/** 03-api-spec §4: umumiy chegaralar. Auth qilingan foydalanuvchiga kengroq. */
export const globalLimiter: RequestHandler = (req, res, next) => {
  const authed = getAuthOptional(res) !== null;
  const limiter = rateLimit({
    windowSec: 60,
    max: authed ? 120 : 30,
    prefix: authed ? 'g:auth' : 'g:anon',
  });
  limiter(req, res, next);
};
