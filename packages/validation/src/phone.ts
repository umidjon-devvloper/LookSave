import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { z } from 'zod';
import type { CountryCode } from '@looksave/shared-types';

/**
 * Telefon validatsiyasi — qo'lda regex EMAS (01-arxitektura, soxta buyurtmadan himoya, 1-qatlam).
 *
 * `libphonenumber-js/max` ishlatiladi, chunki `getType()` faqat to'liq metadata bilan ishlaydi.
 * Narxi: bundle'ga ~140 KB qo'shiladi. Mobil start vaqti sezilarli oshsa,
 * mijoz tomonida `/min` (faqat format) + serverda `/max` (tur tekshiruvi) ga bo'lish mumkin.
 */

export type PhoneValidationError = 'INVALID_FORMAT' | 'NOT_MOBILE';

export type PhoneValidationResult =
  { ok: true; e164: string; country: CountryCode } | { ok: false; code: PhoneValidationError };

const SUPPORTED_COUNTRIES: readonly CountryCode[] = ['UZ', 'AE'];

export function validatePhone(input: string, country: CountryCode): PhoneValidationResult {
  const parsed = parsePhoneNumberFromString(input, country);

  if (!parsed || !parsed.isValid()) {
    return { ok: false, code: 'INVALID_FORMAT' };
  }

  const type = parsed.getType();
  if (type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') {
    return { ok: false, code: 'NOT_MOBILE' };
  }

  const resolved = parsed.country;
  if (resolved === undefined || !SUPPORTED_COUNTRIES.includes(resolved as CountryCode)) {
    return { ok: false, code: 'INVALID_FORMAT' };
  }

  return { ok: true, e164: parsed.number, country: resolved as CountryCode };
}

/**
 * Mamlakat ko'rsatilmagan holat: raqam E.164 bo'lgani uchun mamlakat
 * kod prefiksidan aniqlanadi. Ro'yxatdan o'tishda ishlatiladi —
 * foydalanuvchidan alohida "mamlakat" so'ralmaydi.
 */
export function validateE164Phone(input: string): PhoneValidationResult {
  const parsed = parsePhoneNumberFromString(input);

  if (!parsed || !parsed.isValid()) {
    return { ok: false, code: 'INVALID_FORMAT' };
  }

  const type = parsed.getType();
  if (type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') {
    return { ok: false, code: 'NOT_MOBILE' };
  }

  const resolved = parsed.country;
  if (resolved === undefined || !SUPPORTED_COUNTRIES.includes(resolved as CountryCode)) {
    return { ok: false, code: 'INVALID_FORMAT' };
  }

  return { ok: true, e164: parsed.number, country: resolved as CountryCode };
}

/**
 * E.164 formatidagi raqam sxemasi. DB'da telefon shu ko'rinishda saqlanadi: `+998901234567`.
 * Faqat shakl tekshiriladi — operator/tur tekshiruvi `validatePhone` da.
 */
export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Telefon raqami noto`g`ri');

/** To'liq tekshiruv: shakl + haqiqiylik + MOBILE turi. Country'siz E.164 dan aniqlanadi. */
export function phoneSchemaFor(country: CountryCode): z.ZodEffects<z.ZodString, string, string> {
  return z.string().transform((value, ctx) => {
    const result = validatePhone(value, country);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { fieldCode: result.code },
        message:
          result.code === 'NOT_MOBILE'
            ? 'Faqat mobil raqam qabul qilinadi'
            : 'Telefon raqami noto`g`ri',
      });
      return z.NEVER;
    }
    return result.e164;
  });
}
