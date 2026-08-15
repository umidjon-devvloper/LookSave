import type { ApiSuccess, Cursor, ResponseMeta } from '@looksave/shared-types';
import type { Response } from 'express';

/**
 * Barcha muvaffaqiyatli javoblar shu ikki funksiyadan chiqadi.
 * `res.json(...)` to'g'ridan-to'g'ri chaqirilmaydi — aks holda qobiq
 * ba'zi endpointlarda unutiladi va ilova kodidagi yagona handler buziladi.
 *
 * Istisno: `GET /health` — u UptimeRobot va Docker healthcheck uchun
 * yassi formatda qaytadi (docs/08-deployment.md §10).
 */

function metaFor(res: Response, extra?: Omit<ResponseMeta, 'requestId'>): ResponseMeta {
  return { requestId: res.locals.requestId as string, ...extra };
}

export function sendData<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { data, meta: metaFor(res) };
  res.status(status).json(body);
}

export function sendList<T>(
  res: Response,
  items: T[],
  page: { nextCursor: Cursor | null; hasMore: boolean },
): void {
  const body: ApiSuccess<T[]> = {
    data: items,
    meta: metaFor(res, { nextCursor: page.nextCursor, hasMore: page.hasMore }),
  };
  res.status(200).json(body);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
