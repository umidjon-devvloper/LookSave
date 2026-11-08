import { Link, data } from 'react-router';

import { Icon, ProductCard } from '@looksave/ui-web';

import { ApiError } from '@/api/client';
import { getStore, getStoreProducts, type ProductCard as Card2 } from '@/api/endpoints';
import storesStyles from '@/components/stores/stores.css?url';
import { isLocale, type Locale } from '@/i18n/locale';
import { distance, money, phone as formatPhone } from '@/lib/format';
import { guest } from '@/session.server';

import type { Route } from './+types/store';

export function links() {
  return [{ rel: 'stylesheet', href: storesStyles }];
}

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

const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

export default function Store({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, store, products } = loaderData;
  const away = distance(store.distanceM ?? null);
  const letter = store.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="store-detail shell-wide pb-[clamp(4rem,8vw,7rem)]">
      {/* ── Muqova ── */}
      <div className="store-detail-cover">
        {store.coverUrl ? (
          <img src={store.coverUrl} alt="" />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background:
                'linear-gradient(135deg, #a926ff 0%, #7516e7 40%, #4b176c 100%)',
            }}
            aria-hidden="true"
          />
        )}
        <div className="store-detail-cover-overlay" />

        {store.isOpen ? (
          <span className="store-detail-cover-chip" style={{ color: '#22c55e' }}>
            Ochiq
          </span>
        ) : (
          <span className="store-detail-cover-chip" style={{ color: '#ef4444' }}>
            Yopiq
          </span>
        )}

        <button type="button" className="store-detail-cover-fav" aria-label="Sevimlilarga qo'shish">
          <Icon name="favorite" size={20} />
        </button>
      </div>

      {/* ── Shapka: logo + nom + amallar ── */}
      <div className="store-detail-header">
        <div className={`store-detail-logo${store.logoUrl ? '' : ' -letter'}`}>
          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : letter}
        </div>

        <div className="store-detail-head-info">
          <h1 className="store-detail-name">
            {store.name}
            <span className="store-detail-check" aria-label="Rasmiy do'kon">
              ✓
            </span>
          </h1>

          <div className="store-detail-metarow">
            <span className={store.isOpen ? 'pill -open' : 'pill -closed'}>
              <Icon name="clock" size={14} />
              {store.isOpen
                ? store.closesAt
                  ? `${store.closesAt} gacha`
                  : 'Ochiq'
                : store.opensAt
                  ? `${store.opensAt} da ochiladi`
                  : 'Yopiq'}
            </span>
            {away ? (
              <span className="pill">
                <Icon name="location" size={14} />
                {away}
              </span>
            ) : null}
            {store.productCount > 0 ? (
              <span className="pill">
                <Icon name="hanger" size={14} />
                {store.productCount} mahsulot
              </span>
            ) : null}
          </div>
        </div>

        <div className="store-detail-head-actions">
          {store.phone ? (
            <a href={`tel:${store.phone}`} className="-primary">
              <Icon name="chat" size={16} />
              Bog'lanish
            </a>
          ) : null}
          <button type="button">
            <Icon name="favorite" size={16} />
            Sevimli
          </button>
        </div>
      </div>

      {/* ── Asosiy tanasi: tavsif + yon ustun ── */}
      <div className="store-detail-body">
        <div className="flex flex-col gap-6">
          {store.description ? (
            <div className="store-detail-card">
              <h2>
                <span className="ico">
                  <Icon name="authentic" size={14} />
                </span>
                Do'kon haqida
              </h2>
              <p className="store-detail-text">{store.description}</p>
            </div>
          ) : null}

          {store.hours && store.hours.length > 0 ? (
            <div className="store-detail-card">
              <h2>
                <span className="ico">
                  <Icon name="clock" size={14} />
                </span>
                Ish vaqti
              </h2>
              <div>
                {store.hours.map((h) => (
                  <div key={h.day} className="store-detail-info-row">
                    <span className="label">{DAYS[h.day] ?? `Kun ${h.day}`}</span>
                    <span className="value">
                      {h.open && h.close ? `${h.open} — ${h.close}` : 'Yopiq'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <div className="store-detail-card">
            <h2>
              <span className="ico">
                <Icon name="location" size={14} />
              </span>
              Aloqa
            </h2>
            {store.address ? (
              <div className="store-detail-info-row">
                <span className="label">Manzil</span>
                <span className="value">{store.address}</span>
              </div>
            ) : null}
            {store.phone ? (
              <div className="store-detail-info-row">
                <span className="label">Telefon</span>
                <a href={`tel:${store.phone}`} className="value text-[#9d12ec]">
                  {formatPhone(store.phone)}
                </a>
              </div>
            ) : null}
            {!store.address && !store.phone ? (
              <p className="store-detail-text">Aloqa ma'lumotlari ko'rsatilmagan.</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Mahsulotlar ── */}
      {products.length > 0 ? (
        <section className="store-detail-products">
          <h2>Mahsulotlar</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:gap-6">
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
