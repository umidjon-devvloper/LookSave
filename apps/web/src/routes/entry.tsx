import { redirect } from 'react-router';

import { pickLocale } from '@/i18n/locale';

import type { Route } from './+types/entry';

/**
 * `/` — hech narsa chizmaydi, tilga yo'naltiradi.
 *
 * ⚠️ `Cache-Control: no-store` MAJBURIY. Yo'naltirish `Accept-Language`
 * ga bog'liq, ya'ni har foydalanuvchida boshqa. Keshlansa (CDN yoki
 * brauzer) arabcha so'ragan odam ruscha sahifaga tushib qoladi va sabab
 * hech qayerda ko'rinmaydi.
 */
export function loader({ request }: Route.LoaderArgs): Response {
  const locale = pickLocale(request.headers.get('Accept-Language'));
  const url = new URL(request.url);

  return redirect(`/${locale}${url.search}`, {
    headers: { 'Cache-Control': 'no-store', Vary: 'Accept-Language' },
  });
}
