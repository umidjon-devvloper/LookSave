import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, data, useSearchParams } from 'react-router';

import { Button, Card, Empty, ErrorView, Icon, ImageFrame } from '@looksave/ui-web';

import { isNetworkError } from '@/api/client';
import { DEFAULT_CENTER, getNearbyStores, type StoreCard } from '@/api/endpoints';
import storesStyles from '@/components/stores/stores.css?url';
import { isLocale, type Locale } from '@/i18n/locale';
import { distance } from '@/lib/format';
import { mapsApiKey } from '@/lib/maps';
import { cn } from '@/lib/utils';
// `Reveal` olib tashlandi — yangi hero'da scroll animatsiyasi yo'q
import { guest } from '@/session.server';

import type { Route } from './+types/stores';

export function links() {
  return [{ rel: 'stylesheet', href: storesStyles }];
}

/**
 * Do'konlar — docs/15-sayt-dizayn.md §4.5.
 *
 * Sahifa ikki qavat: tepada hero (sarlavha + neon xarita kompozitsiyasi),
 * ostida natijalar. Xarita kaliti bo'lsa natijalar ikki ustunga bo'linadi
 * — chapda ro'yxat (400px), o'ngda yopishqoq xarita; marker bosilganda
 * ro'yxatdagi karta yorishadi va scroll unga keladi. Mobil: ro'yxat/xarita
 * almashtirgichi.
 *
 * ⚠️ HERO DEKORATSIYA EMAS. Aynan shu yerda sahifaning va'dasi aytiladi
 * («mahsulot yaqin atrofdagi haqiqiy do'kondan keladi») va joylashuvga
 * ruxsat so'raladi. Ilgari ikkalasi ham to'r ustidagi kulrang qatorda
 * turardi va hech kim o'qimasdi.
 *
 * ⚠️ XARITA IXTIYORIY QATLAM. `VITE_GOOGLE_MAPS_KEY` berilmasa ro'yxat
 * to'liq kenglikda ochiladi va hech qanday xato ko'rinmaydi — sahifa
 * xarita kalitiga bog'liq bo'lib qolmasligi kerak (store-panel'dagi
 * `LocationPicker` bilan bir xil qoida). Herodagi kompozitsiya esa
 * xaritaning O'RNINI BOSMAYDI: u vektor, ma'lumotsiz va har doim bir xil.
 */

/*
 * Google Maps — brauzer kutubxonasi, SSR bundle'ga tushmasligi kerak.
 * `lazy` uni alohida bo'lakka chiqaradi; pastdagi `mounted` esa faqat
 * brauzerda chizilishini kafolatlaydi.
 */
const StoreMap = lazy(() => import('@/components/StoreMap'));

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Do'konlar — LookSave" },
    { name: 'description', content: "Yaqin atrofdagi kiyim do'konlari — katalog va manzil bilan." },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const search = new URL(request.url).searchParams;

  /*
   * ⚠️ `lat`/`lng` MAJBURIY (endpoint ularsiz 422 qaytaradi). Serverda
   * brauzer joylashuvi yo'q, shuning uchun birinchi chizishda bozor
   * markazi ishlatiladi. Foydalanuvchi ruxsat bergach sahifa o'zini
   * `?lat=&lng=` bilan qayta so'raydi va masofa aniqlashadi.
   */
  const lat = Number(search.get('lat'));
  const lng = Number(search.get('lng'));
  const located = Number.isFinite(lat) && Number.isFinite(lng) && search.has('lat');

  const center = located ? { lat, lng } : DEFAULT_CENTER;

  try {
    const page = await getNearbyStores({ ...center, limit: 30 }, guest(request, locale));
    return data({
      locale: locale as Locale,
      stores: page.items,
      center,
      located,
      error: null as string | null,
      network: false,
    });
  } catch (error) {
    /*
     * ⚠️ XATO JIMGINA YUTILMAYDI: server xatosi «do'kon topilmadi»
     * bo'lib ko'rinmasligi kerak — bo'sh ro'yxat va yiqilgan so'rov
     * ikki BOSHQA holat (15-sayt-dizayn.md §1.7).
     */
    return data({
      locale: locale as Locale,
      stores: [] as StoreCard[],
      center,
      located,
      error: error instanceof Error ? error.message : "Do'konlar ro'yxati ochilmadi",
      network: isNetworkError(error),
    });
  }
}

/** «Ochiq · 21:00 gacha» / «Yopiq · 10:00 da ochiladi» */
function openState(store: StoreCard): { text: string; open: boolean } {
  if (store.isOpen) {
    return { text: store.closesAt ? `Ochiq · ${store.closesAt} gacha` : 'Ochiq', open: true };
  }
  return { text: store.opensAt ? `Yopiq · ${store.opensAt} da ochiladi` : 'Yopiq', open: false };
}

export default function Stores({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, stores, center, located, error, network } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const [denied, setDenied] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  /*
   * Xarita faqat brauzerda: kalit `import.meta.env` dan keladi va
   * Google skripti `window` ga tegadi. Serverda `mounted` doim `false`.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const apiKey = mapsApiKey();
  const withMap = mounted && apiKey !== null && stores.some((store) => store.location);

  /* Marker bosilganda ro'yxatdagi kartaga scroll (§4.5) */
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (!selectedId) return;
    rowRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const useMyLocation = (): void => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDenied(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = new URLSearchParams(searchParams);
        next.set('lat', position.coords.latitude.toFixed(5));
        next.set('lng', position.coords.longitude.toFixed(5));
        setSearchParams(next, { preventScrollReset: true });
      },
      // Rad etilsa xato ko'rsatilmaydi — ro'yxat baribir ishlaydi
      () => setDenied(true),
      { timeout: 8000 },
    );
  };

  const list = (
    <ul className={withMap ? 'flex flex-col gap-3' : 'stores-grid'}>
      {stores.map((store) => (
        <li
          key={store.id}
          ref={(node) => {
            if (node) rowRefs.current.set(store.id, node);
            else rowRefs.current.delete(store.id);
          }}
        >
          <StoreRow
            store={store}
            locale={locale}
            compact={withMap}
            selected={store.id === selectedId}
            onHover={() => setSelectedId(store.id)}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="stores-page pb-[clamp(4rem,8vw,7rem)]">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative pt-8 pb-10 lg:pt-16 lg:pb-14">
        <div className="shell-wide grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col items-start">
            <span className="stores-eyebrow">
              <Icon name="location" size={14} />
              Yaqin atrofdagi do'konlar
            </span>

            <h1 className="stores-title">Do'konlar</h1>

            <p className="stores-lead">
              Mahsulot yaqin atrofdagi haqiqiy do'kondan keladi — buyurtma to'g'ridan-to'g'ri unga
              boradi.
            </p>

            <div className="stores-trust-row">
              <span className="stores-trust-item">
                <span className="stores-trust-ico">
                  <Icon name="authentic" size={14} />
                </span>
                Ishonchli do'konlar
              </span>
              <span className="stores-trust-item">
                <span className="stores-trust-ico">
                  <Icon name="delivery" size={14} />
                </span>
                Tez yetkazib berish
              </span>
            </div>

            {!located && !denied ? (
              <button type="button" onClick={useMyLocation} className="stores-cta">
                <Icon name="locate" size={18} />
                Joylashuvimni ishlatish
                <Icon name="next" size={16} />
              </button>
            ) : null}
            {denied ? (
              <p className="mt-6 text-sm text-[#6b5f79]">
                Joylashuv berilmadi — masofa taxminiy markazdan hisoblangan.
              </p>
            ) : null}
          </div>

          <div className="stores-hero-art">
            <span className="stores-cta-chip">Try-On</span>
            <img src="/img/stores-hero-pin.jpg" alt="" />
          </div>
        </div>

        {/* Qidiruv + filtrlar qatori */}
        <div className="shell-wide">
          <div className="stores-controls">
            <label className="stores-input">
              <Icon name="search" size={18} />
              <input type="search" placeholder="Do'kon nomini qidirish..." aria-label="Qidirish" />
            </label>
            <div className="stores-select">
              <span className="stores-select-left">
                <Icon name="location" size={16} />
                Toshkent
              </span>
              <Icon name="next" size={14} className="rotate-90 text-[#6b5f79]" />
            </div>
            <div className="stores-select">
              <span className="stores-select-left">
                <Icon name="stores" size={16} />
                Masofa: 10 km
              </span>
              <Icon name="next" size={14} className="rotate-90 text-[#6b5f79]" />
            </div>
            <div className="stores-select">
              <span className="stores-select-left">
                <Icon name="filter" size={16} />
                Mashhurligi bo'yicha
              </span>
              <Icon name="next" size={14} className="rotate-90 text-[#6b5f79]" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Natijalar ────────────────────────────────────────── */}
      <div className="shell-wide">
        {/* Mobil: ro'yxat/xarita almashtirgichi */}
        {/* `withMap` o'zi ro'yxat bo'sh emasligini talab qiladi — xato holatida u `false` */}
        {withMap ? (
          <div className="mb-5 flex justify-end lg:hidden">
            <div className="flex gap-1 rounded-md border border-border bg-surface p-1">
              {(
                [
                  { value: 'list', label: "Ro'yxat", icon: 'list' },
                  { value: 'map', label: 'Xarita', icon: 'stores' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={view === option.value}
                  onClick={() => setView(option.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-small transition-colors',
                    view === option.value
                      ? 'bg-primarySoft text-brand'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon name={option.icon} size={14} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <ErrorView
            message={network ? "Tarmoqqa ulanib bo'lmadi. Ulanishni tekshiring." : error}
            variant={network ? 'network' : 'generic'}
            action={
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Qayta urinish
              </Button>
            }
          />
        ) : stores.length === 0 ? (
          <Empty
            icon="stores"
            title="Yaqin atrofda do'kon yo'q"
            hint="Boshqa joydan qidirib ko'ring yoki butun katalogni ochib ko'ring."
            action={
              <Button asChild>
                <Link to={`/${locale}/catalog`}>Katalogga o'tish</Link>
              </Button>
            }
          />
        ) : withMap ? (
          <div className="grid gap-6 lg:grid-cols-[25rem_1fr]">
            {/* Ro'yxat — mobilda almashtirgichga bo'ysunadi */}
            <div
              className={cn(
                'lg:block lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pe-2',
                view === 'map' && 'hidden',
              )}
            >
              {list}
            </div>

            {/* Xarita — desktopda yopishqoq, to'liq balandlik */}
            <div
              className={cn(
                'overflow-hidden rounded-card border border-border lg:sticky lg:top-[6.5rem] lg:block lg:h-[calc(100vh-9rem)]',
                view === 'map' ? 'h-[70vh]' : 'hidden lg:block',
              )}
            >
              <Suspense
                fallback={<div className="size-full animate-pulse-soft bg-surface2" aria-hidden />}
              >
                <StoreMap
                  apiKey={apiKey ?? ''}
                  stores={stores}
                  center={center}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Suspense>
            </div>
          </div>
        ) : (
          list
        )}
      </div>
    </div>
  );
}

function StoreRow({
  store,
  locale,
  compact,
  selected,
  onHover,
}: {
  store: StoreCard;
  locale: Locale;
  /** Xarita yonidagi tor ro'yxat — rasm kichik, gorizontal maket */
  compact: boolean;
  selected: boolean;
  onHover: () => void;
}): JSX.Element {
  const away = distance(store.distanceM);
  const state = openState(store);

  /*
   * ⚠️ IKKI O'LCHAM. Xarita yonidagi tor ro'yxatda karta 25rem ga
   * siqiladi va matn kichik bo'lishi kerak; to'rda esa karta ikki
   * barobar keng — o'sha o'lchamlar u yerda «izoh» bo'lib qoladi.
   *
   * ⚠️ TO'RDA `text-dim` YO'Q: tekshiruv ro'yxati uni faqat 15px+ da
   * ruxsat etadi (kontrast ≥ 4.5:1), bu yerdagi qatorlar esa 13px.
   */
  const meta = (
    <>
      <p
        className={cn('flex items-center gap-2', compact ? 'mt-1 text-small' : 'mt-2.5 text-body')}
      >
        <Icon
          name="clock"
          size={compact ? 14 : 16}
          className={state.open ? 'text-success' : 'text-muted-foreground'}
        />
        <span className={state.open ? 'text-success' : 'text-muted-foreground'}>{state.text}</span>
        {away ? (
          <span className={compact ? 'text-dim' : 'text-muted-foreground'}>· {away}</span>
        ) : null}
      </p>

      {store.productCount > 0 ? (
        <p
          className={
            compact ? 'mt-1 text-tiny text-dim' : 'mt-1.5 text-small text-muted-foreground'
          }
        >
          {store.productCount} mahsulot
          {store.product3dCount > 0 ? ` · ${store.product3dCount} tasi 3D` : ''}
        </p>
      ) : null}

      {store.address ? (
        <p
          className={cn(
            'flex items-start gap-1.5',
            compact ? 'mt-1.5 text-tiny text-dim' : 'mt-2 text-small text-muted-foreground',
          )}
        >
          <Icon name="stores" size={compact ? 13 : 15} className="mt-px shrink-0" />
          <span className="line-clamp-2">{store.address}</span>
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <Link
        to={`/${locale}/store/${store.id}`}
        className="block focus-visible:outline-none"
        onMouseEnter={onHover}
        onFocus={onHover}
      >
        <Card
          interactive
          className={cn('flex items-center gap-3 p-3', selected && 'border-borderAccent')}
        >
          <ImageFrame
            src={store.logoUrl}
            alt=""
            ratio="1/1"
            rounded="md"
            className="w-14 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium">{store.name}</p>
            {meta}
          </div>
        </Card>
      </Link>
    );
  }

  /*
   * To'rdagi karta — yorug' atelier dizayn. Muqova rasmi, masofa chipi
   * va sevimli yurak tepada; pastda logo doirasi, nomi, status, manzil
   * va "Batafsil" tugmasi.
   */
  const letter = store.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <Link
      to={`/${locale}/store/${store.id}`}
      className="store-card focus-visible:outline-none"
    >
      <div className="store-card-img">
        {store.coverUrl ? (
          <img src={store.coverUrl} alt="" />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(145deg, #171020, #332b4a)',
            }}
            aria-hidden="true"
          />
        )}
        <span className="store-card-distance">{away ?? '— km'}</span>
        <button
          type="button"
          className="store-card-fav"
          aria-label="Sevimlilarga qo'shish"
          onClick={(e) => {
            e.preventDefault();
          }}
        >
          <Icon name="favorite" size={18} />
        </button>
      </div>

      <div className="store-card-body">
        <div className={`store-card-logo${store.logoUrl ? '' : ' -letter'}`}>
          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : letter}
        </div>

        <h2 className="store-card-name">
          {store.name}
          <span className="store-card-check" aria-label="Rasmiy do'kon">
            ✓
          </span>
        </h2>

        <div className="store-card-meta">
          <span className={state.open ? 'store-card-status -open' : 'store-card-status -closed'}>
            {state.open ? 'Ochiq' : 'Yopiq'}
          </span>
          {away ? (
            <>
              <span className="store-card-dot" />
              <span className="text-[#6b5f79]">{away}</span>
            </>
          ) : null}
          {store.productCount > 0 ? (
            <>
              <span className="store-card-dot" />
              <span className="text-[#6b5f79]">{store.productCount} mahsulot</span>
            </>
          ) : null}
        </div>

        {store.address ? (
          <p className="store-card-address">
            <Icon name="location" size={14} className="shrink-0 text-[#9d12ec]" />
            <span className="line-clamp-1">{store.address}</span>
          </p>
        ) : null}

        <div className="store-card-cta">
          <span>Batafsil</span>
          <Icon name="next" size={16} />
        </div>
      </div>
    </Link>
  );
}
