import { redirect } from 'react-router';

import { pickLocale } from '@/i18n/locale';

import type { Route } from './+types/legal-redirect';

/**
 * `/privacy`, `/terms`, `/support` — til bo'lagisiz manzillar. Hech narsa
 * chizmaydi: `Accept-Language` ga qarab `/{til}/…` ga yo'naltiradi
 * (`routes/entry.tsx` bilan bir xil qoida).
 *
 * ⚠️ NEGA KERAK. Mobil ilova aynan shu manzillarni ochadi: Profil →
 * «Maxfiylik siyosati» / «Foydalanish shartlari»
 * (`apps/mobile/app/(tabs)/profile.tsx` → `https://looksave.uz/privacy`,
 * `/terms`). Ular 404 berardi — `:locale` o'rniga «privacy» tushib,
 * qobiq «bunday til yo'q» deb javob qaytarardi. App Store'ga yuborilgan
 * build'larda ham shu havolalar turibdi, ularni endi o'zgartirib
 * bo'lmaydi — shuning uchun tuzatish SAYT tomonda.
 *
 * ⚠️ BU MARSHRUTLAR `:locale` DAN OLDIN TANLANADI: React Router statik
 * bo'lakni dinamik bo'lakdan yuqori baholaydi, `routes.ts` dagi tartib
 * bunga ta'sir qilmaydi. Tilli manzillar (`/en/privacy`) o'zgarmaydi.
 *
 * ⚠️ `Cache-Control: no-store` MAJBURIY. Yo'naltirish `Accept-Language`
 * ga bog'liq, ya'ni har foydalanuvchida boshqa. Keshlansa (CDN yoki
 * brauzer) arabcha so'ragan odam ruscha sahifaga tushib qoladi.
 *
 * ⚠️ MANZIL SO'ROVDAN YIG'ILMAYDI. Sahifa nomi ruxsat etilgan ro'yxatdan
 * olinadi — yo'naltirish manziliga foydalanuvchi yozgan matn tushmaydi.
 */
const PAGES = ['privacy', 'terms', 'support'] as const;

export function loader({ request }: Route.LoaderArgs): Response {
  const url = new URL(request.url);

  // `/Privacy/` ham shu marshrutga tushadi: solishtirish registrga bog'liq emas
  const segment = (url.pathname.split('/')[1] ?? '').toLowerCase();
  const page = PAGES.find((name) => name === segment);

  if (!page) {
    throw new Response('Not found', { status: 404 });
  }

  const locale = pickLocale(request.headers.get('Accept-Language'));

  return redirect(`/${locale}/${page}${url.search}`, {
    headers: { 'Cache-Control': 'no-store', Vary: 'Accept-Language' },
  });
}
