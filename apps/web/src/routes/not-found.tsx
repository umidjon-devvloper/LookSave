import { Link } from 'react-router';

import { Button, Empty } from '@looksave/ui-web';

import { isLocale } from '@/i18n/locale';

import type { Route } from './+types/not-found';

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Sahifa topilmadi — LookSave' }, { name: 'robots', content: 'noindex' }];
}

export function loader({ params }: Route.LoaderArgs) {
  return { locale: isLocale(params.locale) ? params.locale : 'en' };
}

export default function NotFound({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale } = loaderData;

  return (
    <div className="shell py-24">
      <Empty
        title="Bunday sahifa yo'q"
        hint="Havola eskirgan bo'lishi mumkin. Katalogdan qidirib ko'ring."
        action={
          <Button asChild>
            <Link to={`/${locale}/catalog`}>Katalogga o'tish</Link>
          </Button>
        }
      />
    </div>
  );
}
