import { Link, data } from 'react-router';

import { Card, Icon, ImageFrame, ProductCard } from '@looksave/ui-web';

import { ApiError } from '@/api/client';
import { getStore, getStoreProducts, type ProductCard as Card2 } from '@/api/endpoints';
import { isLocale, type Locale } from '@/i18n/locale';
import { distance, money, phone as formatPhone } from '@/lib/format';
import { guest } from '@/session.server';

import type { Route } from './+types/store';

export function meta({ data: loaded }: Route.MetaArgs): Route.MetaDescriptors {
  if (!loaded?.store) return [{ title: "Do'kon — LookSave" }];

  return [
    { title: `${loaded.store.name} — LookSave` },
    {
      name: 'description',
      content:
        loaded.store.description ?? `${loaded.store.name} do'koni: katalog, manzil va ish vaqti.`,
    },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const options = guest(request, locale);

  try {
    const [store, products] = await Promise.all([
      getStore(params.id, options),
      getStoreProducts(params.id, options)
        .then((page) => page.items)
        .catch((): Card2[] => []),
    ]);

    return data({ locale: locale as Locale, store, products });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Response('Not found', { status: 404 });
    }
    throw error;
  }
}

export default function Store({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, store, products } = loaderData;
  const away = distance(store.distanceM ?? null);

  return (
    <div className="shell-wide section-y">
      <ImageFrame src={store.logoUrl} alt={store.name} ratio="16/9" className="max-h-80" />

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold">{store.name}</h1>
          <p className="mt-2 flex items-center gap-2 text-small">
            <span className={store.isOpen ? 'text-success' : 'text-dim'}>
              {store.isOpen ? 'Ochiq' : 'Yopiq'}
            </span>
            {away ? <span className="text-dim">· {away}</span> : null}
          </p>
        </div>

        {store.phone ? (
          <Card className="flex items-center gap-2 px-4 py-3">
            <Icon name="chat" size={16} className="text-brand" />
            <a href={`tel:${store.phone}`} className="text-body hover:text-brand">
              {formatPhone(store.phone)}
            </a>
          </Card>
        ) : null}
      </header>

      {store.description ? (
        <p className="mt-4 max-w-[68ch] text-body leading-relaxed text-muted-foreground">
          {store.description}
        </p>
      ) : null}

      {store.address ? (
        <p className="mt-3 flex items-start gap-2 text-small text-dim">
          <Icon name="stores" size={15} className="mt-0.5" />
          {store.address}
        </p>
      ) : null}

      {products.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-label font-semibold uppercase text-foreground">Mahsulotlar</h2>

          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                price={money(product.price, product.currency)}
                oldPrice={product.oldPrice ? money(product.oldPrice, product.currency) : null}
                image={product.image}
                canTryOn={product.canTryOn}
                isLimited={product.isLimited}
                link={(children) => (
                  <Link to={`/${locale}/p/${product.id}`} className="block">
                    {children}
                  </Link>
                )}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
