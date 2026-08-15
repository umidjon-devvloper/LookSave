import type { Locale } from '@looksave/shared-types';
import { localeSchema } from '@looksave/validation';
import type { Request } from 'express';

/**
 * Til `Accept-Language` sarlavhasidan olinadi.
 * `uz-UZ`, `ru-RU;q=0.9` kabi qiymatlarning birinchi ikki harfi yetarli —
 * bizda faqat to'rt til bor, murakkab muzokara (negotiation) ortiqcha.
 */
export function localeOf(req: Request, explicit?: Locale): Locale {
  if (explicit) return explicit;
  const parsed = localeSchema.safeParse(req.get('Accept-Language')?.slice(0, 2).toLowerCase());
  return parsed.success ? parsed.data : 'uz';
}

/** Tanlangan til bo'lmasa `en`, u ham bo'lmasa birinchi mavjud qiymat. */
export function pickName(name: Record<string, string> | null, locale: Locale): string {
  if (!name) return '';
  return name[locale] ?? name['en'] ?? Object.values(name)[0] ?? '';
}
