import { z } from 'zod';
import type { CountryCode, CurrencyCode, Locale } from '@looksave/shared-types';

/** UUID v4 — barcha ID'lar (00-README §7) */
export const uuidSchema = z.string().uuid();

/**
 * Pul — NUMERIC(12,2) ning string ko'rinishi.
 * Nuqtadan oldin maks 10 raqam, keyin aniq 0 yoki 2 raqam.
 * Float hech qayerda ishlatilmaydi.
 */
export const moneyAmountSchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{2})?$/, 'Summa formati: 1250000.00');

export const currencySchema = z.enum(['UZS', 'AED']);
export const countrySchema = z.enum(['UZ', 'AE']);
export const localeSchema = z.enum(['uz', 'ru', 'en', 'ar']);

// Zod enum'lari shared-types bilan ajralib ketmasligi uchun kompilyatsiya paytida tekshiriladi
type _CurrencyMatches = z.infer<typeof currencySchema> extends CurrencyCode ? true : never;
type _CountryMatches = z.infer<typeof countrySchema> extends CountryCode ? true : never;
type _LocaleMatches = z.infer<typeof localeSchema> extends Locale ? true : never;
const _assertEnums: [_CurrencyMatches, _CountryMatches, _LocaleMatches] = [true, true, true];
void _assertEnums;

export const moneySchema = z.object({
  amount: moneyAmountSchema,
  currency: currencySchema,
});

/** ISO 8601 UTC. Ilova ham, server ham shu formatda yuboradi. */
export const isoDateTimeSchema = z.string().datetime({ offset: false });

/** WGS84 nuqta. lat/lng chegaradan tashqarida bo'lsa PostGIS jim xato beradi — shu yerda to'xtatiladi. */
export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Keyset cursor — base64({ at, id }). Bu yerda faqat shakli tekshiriladi, dekod serverda. */
export const cursorSchema = z
  .string()
  .min(4)
  .max(512)
  .regex(/^[A-Za-z0-9+/=_-]+$/, 'Cursor noto`g`ri');

/** limit: standart 20, maksimum 50 (03-api-spec §1). Query string kelgani uchun coerce. */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

export type PaginationQueryInput = z.input<typeof paginationQuerySchema>;
export type PaginationQueryOutput = z.output<typeof paginationQuerySchema>;

/** Ism: ≥2 harf, raqam yo'q, faqat harf, probel, apostrof va defis (01-arxitektura, 1-qatlam). */
export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Ism kamida 2 harf bo`lishi kerak')
  .max(64)
  .regex(/^[\p{L}][\p{L}\s'’-]*$/u, 'Ismda faqat harflar bo`lishi mumkin');
