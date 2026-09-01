/**
 * Til — yo'lning birinchi bo'lagida (`/uz/...`), cookie'da emas
 * (docs/13-sayt.md S-05).
 *
 * ⚠️ NEGA YO'LDA: `hreflang` faqat alohida URL bilan ishlaydi. Til
 * cookie'da bo'lsa Google to'rt tilni ham bitta sahifa deb ko'radi va
 * uchtasi qidiruvdan yo'qoladi.
 *
 * ⚠️ Bu fayl VAQTINCHA `apps/web` ichida. WEB-02 da u
 * `packages/i18n` ga ko'chadi va mobil ilova bilan bitta manba bo'ladi
 * (bugun lug'atlar `apps/mobile/src/i18n/dictionaries.ts` da).
 */

export const LOCALES = ['uz', 'ru', 'en', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

/** Dubay bozori birinchi — shuning uchun `en`, `uz` emas. */
export const DEFAULT_LOCALE: Locale = 'en';

/** O'ngdan chapga yoziladigan tillar. */
const RTL: ReadonlySet<Locale> = new Set<Locale>(['ar']);

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

export function isRTL(locale: Locale): boolean {
  return RTL.has(locale);
}

/** `<html dir>` — serverda qo'yiladi, brauzerda JS bilan emas. */
export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

/**
 * `Accept-Language` dan eng mos tilni tanlaydi.
 *
 * Sifat koeffitsiyenti (`;q=0.8`) hisobga olinadi, aks holda
 * `ru;q=0.2, en;q=0.9` da birinchi turgani — ya'ni noto'g'risi — tanlanardi.
 */
export function pickLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const weight = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      // Faqat asosiy bo'lak: `en-GB` → `en`
      return { tag: (tag.split('-')[0] ?? '').toLowerCase(), weight };
    })
    .filter((item) => item.tag.length > 0 && Number.isFinite(item.weight))
    .sort((a, b) => b.weight - a.weight);

  for (const item of ranked) {
    if (isLocale(item.tag)) return item.tag;
  }

  return DEFAULT_LOCALE;
}

/**
 * Til almashtirilganda O'SHA sahifada qolish uchun.
 *
 * `/en/p/denim-42` → `/ar/p/denim-42`. Bosh sahifaga tashlash — eng ko'p
 * uchraydigan va eng bezovta qiladigan xato.
 */
export function swapLocale(pathname: string, next: Locale): string {
  const segments = pathname.split('/');
  // segments[0] doim bo'sh (`/` dan oldin), segments[1] — til
  if (isLocale(segments[1])) {
    segments[1] = next;
    return segments.join('/');
  }
  return `/${next}${pathname === '/' ? '' : pathname}`;
}

export const LOCALE_LABEL: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
  ar: 'العربية',
};
