import type { Cursor } from '@looksave/shared-types';

import { ApiError } from '../http/api-error';

/**
 * Keyset cursor — `OFFSET` ishlatilmaydi (03-api-spec §1).
 * 10 000-sahifada OFFSET juda sekinlashadi, keyset esa doim bir xil tez.
 *
 * Ichida: `k` — saralash kaliti qiymati (ISO sana, narx yoki masofa satri),
 * `id` — teng qiymatlarni ajratish uchun (tiebreak).
 *
 * ⚠️ Cursor imzolanmagan. Foydalanuvchi uni o'zgartira oladi, lekin eng
 * yomoni — boshqa sahifani ko'radi. Maxfiy ma'lumot ichida yo'q.
 */
export interface CursorValue {
  k: string;
  id: string;
}

export function encodeCursor(value: CursorValue): Cursor {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: Cursor): CursorValue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new ApiError('BAD_REQUEST', 'Cursor noto`g`ri');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as CursorValue).k !== 'string' ||
    typeof (parsed as CursorValue).id !== 'string'
  ) {
    throw new ApiError('BAD_REQUEST', 'Cursor noto`g`ri');
  }

  return parsed as CursorValue;
}

/**
 * Ro'yxatni sahifaga bo'lish: `limit + 1` ta olib, ortiqchasi bo'lsa
 * `hasMore = true` deb belgilanadi. Alohida `COUNT(*)` so'rovi kerak emas.
 */
export function paginate<T>(
  rows: T[],
  limit: number,
  keyOf: (row: T) => CursorValue,
): { items: T[]; nextCursor: Cursor | null; hasMore: boolean } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];

  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(keyOf(last)) : null,
  };
}
