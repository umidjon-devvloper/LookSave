import { redirect } from 'react-router';

import { isLocale } from '@/i18n/locale';
import { endSession } from '@/session.server';

import type { Route } from './+types/sign-out';

/**
 * Chiqish — faqat `POST`.
 *
 * ⚠️ `GET` BILAN CHIQARILMAYDI. Sahifadagi istalgan rasm yoki prefetch
 * `/sign-out` ga tegib ketsa, odam o'zi bilmagan holda chiqib qolardi.
 */
export function loader({ params }: Route.LoaderArgs): Response {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  return redirect(`/${locale}`);
}

export async function action({ params, request }: Route.ActionArgs): Promise<Response> {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const cookie = await endSession(request);
  return redirect(`/${locale}`, { headers: { 'Set-Cookie': cookie } });
}
