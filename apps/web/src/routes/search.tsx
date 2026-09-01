import { redirect } from 'react-router';

import { isLocale } from '@/i18n/locale';

import type { Route } from './+types/search';

/** `/search?q=` — katalog o'sha qidiruvni o'zi bajaradi. */
export function loader({ params, request }: Route.LoaderArgs): Response {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return redirect(`/${locale}/catalog${q ? `?q=${encodeURIComponent(q)}` : ''}`);
}
