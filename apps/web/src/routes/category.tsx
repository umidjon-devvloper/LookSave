import { redirect } from 'react-router';

import { isLocale } from '@/i18n/locale';

import type { Route } from './+types/category';

/**
 * `/c/:slug` — hozircha katalogga yo'naltiradi.
 *
 * ⚠️ VAQTINCHA. Reja bo'yicha (13-sayt.md §5) bu alohida SSR sahifa
 * bo'lishi kerak: o'z `<title>` i, tavsifi va `BreadcrumbList` belgisi
 * bilan — aynan shu narsa kategoriyani Google'da topiladigan qiladi.
 * Yo'naltirish esa chiroyli URL'ni foydasiz qiladi.
 *
 * WEB-05 da katalog ko'rinishi alohida komponentga chiqariladi va ikkala
 * marshrut uni ulaydi.
 */
export function loader({ params }: Route.LoaderArgs): Response {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  return redirect(`/${locale}/catalog?category=${encodeURIComponent(params.slug)}`);
}
