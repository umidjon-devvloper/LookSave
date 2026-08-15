import type { ErrorCode } from './errors';

/** UUID v4 — 00-README §7 */
export type Uuid = string;

/** ISO 8601, doim UTC: `2026-08-12T14:30:00.000Z` */
export type IsoDateTime = string;

/**
 * Pul — DB'da NUMERIC(12,2), API'da **string**.
 * `number` katta summalarda aniqlikni yo'qotadi (03-api-spec §1).
 */
export type MoneyAmount = string;

export type CurrencyCode = 'UZS' | 'AED';

export interface Money {
  amount: MoneyAmount;
  currency: CurrencyCode;
}

export type CountryCode = 'UZ' | 'AE';

export type Locale = 'uz' | 'ru' | 'en' | 'ar';

/** Keyset cursor — base64({ at, id }). OFFSET ishlatilmaydi. */
export type Cursor = string;

export interface ResponseMeta {
  requestId: string;
  nextCursor?: Cursor | null;
  hasMore?: boolean;
}

export interface ApiSuccess<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ApiErrorBody {
  code: ErrorCode;
  /** Foydalanuvchiga ko'rsatiladi, `Accept-Language` bo'yicha tarjima qilinadi. */
  message: string;
  details?: unknown;
}

export interface ApiFailure {
  error: ApiErrorBody;
  meta: ResponseMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Ro'yxat javobi — data massiv, meta'da kursor. */
export type ApiListResponse<T> = ApiResponse<T[]>;

/** Type guard: ilovada bitta handler shu orqali ajratadi. */
export function isApiFailure<T>(res: ApiResponse<T>): res is ApiFailure {
  return 'error' in res;
}

/** Ro'yxat so'rovi uchun umumiy query parametrlari. limit: standart 20, maks 50. */
export interface PaginationQuery {
  limit?: number;
  cursor?: Cursor;
}

/** Geo nuqta — WGS84. PostGIS'da `geography(Point,4326)`. */
export interface GeoPoint {
  lat: number;
  lng: number;
}
