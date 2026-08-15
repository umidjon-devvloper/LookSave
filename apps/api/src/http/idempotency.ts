import { createHash } from 'node:crypto';

import type { RequestHandler } from 'express';

import { pool } from '../db/pool';
import { ApiError } from './api-error';
import { getAuth } from './auth-middleware';

/**
 * `Idempotency-Key` (03-api-spec §12).
 *
 * Tarmoq uzilib ilova so'rovni qayta yuborsa, ikkinchi buyurtma
 * YARATILMAYDI — birinchi javob qaytariladi.
 *
 * Ish tartibi:
 *  1. Kalit `idempotency_keys` ga yoziladi (UNIQUE user_id + key).
 *  2. Konflikt bo'lsa: so'rov hashi solishtiriladi.
 *     – hash bir xil va javob bor  → o'sha javob qaytariladi
 *     – hash bir xil, javob yo'q   → birinchi so'rov hali ketyapti → 409
 *     – hash boshqa                → 422, kalit noto'g'ri ishlatilgan
 *  3. Handler tugagach javob saqlanadi.
 */
export function idempotent(endpoint: string): RequestHandler {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key');
    if (!key || key.length < 8 || key.length > 128) {
      next(new ApiError('BAD_REQUEST', 'Idempotency-Key sarlavhasi kerak (8-128 belgi)'));
      return;
    }

    const userId = getAuth(res).sub;
    const hash = createHash('sha256')
      .update(JSON.stringify(req.body ?? {}))
      .digest('hex');

    const { rows } = await pool.query<{
      request_hash: string;
      status_code: number | null;
      response_body: unknown;
      inserted: boolean;
    }>(
      `WITH ins AS (
         INSERT INTO idempotency_keys (user_id, key, endpoint, request_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, key) DO NOTHING
         RETURNING request_hash, status_code, response_body, true AS inserted
       )
       SELECT * FROM ins
       UNION ALL
       SELECT request_hash, status_code, response_body, false AS inserted
         FROM idempotency_keys WHERE user_id = $1 AND key = $2
       LIMIT 1`,
      [userId, key, endpoint, hash],
    );

    const record = rows[0];
    if (!record) {
      next(ApiError.internal('Idempotentlik kaliti saqlanmadi'));
      return;
    }

    if (!record.inserted) {
      if (record.request_hash !== hash) {
        next(
          new ApiError('VALIDATION_ERROR', 'Bu Idempotency-Key boshqa so`rov uchun ishlatilgan'),
        );
        return;
      }

      if (record.status_code === null) {
        next(new ApiError('INVALID_STATE', 'Oldingi so`rov hali bajarilmoqda'));
        return;
      }

      res.status(record.status_code).json(record.response_body);
      return;
    }

    // Javobni ushlab qolib saqlaymiz
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      void pool
        .query(
          `UPDATE idempotency_keys SET status_code = $3, response_body = $4
            WHERE user_id = $1 AND key = $2`,
          [userId, key, res.statusCode, JSON.stringify(body)],
        )
        .catch(() => {
          // Saqlanmasa — eng yomoni takroriy so'rov ikkinchi buyurtma yaratadi.
          // Buyurtmani bekor qilishdan ko'ra bu kamroq zarar.
        });
      return originalJson(body);
    };

    next();
  };
}
