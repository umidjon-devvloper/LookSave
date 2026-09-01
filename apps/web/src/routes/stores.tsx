import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, data, useSearchParams } from 'react-router';

import { Button, Card, Empty, ErrorView, Icon, ImageFrame } from '@looksave/ui-web';

import { isNetworkError } from '@/api/client';
import { DEFAULT_CENTER, getNearbyStores, type StoreCard } from '@/api/endpoints';
import { Reveal } from '@/components/Reveal';
import { StoresArt } from '@/components/StoresArt';
import { isLocale, type Locale } from '@/i18n/locale';
import { distance } from '@/lib/format';
import { mapsApiKey } from '@/lib/maps';
import { cn } from '@/lib/utils';
import { guest } from '@/session.server';

import type { Route } from './+types/stores';

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
    <ul className={withMap ? 'flex flex-col gap-3' : 'grid gap-5 md:grid-cols-2 2xl:grid-cols-3'}>
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
    <div className="pb-[clamp(4rem,8vw,7rem)]">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-12 lg:pt-16 lg:pb-20">
        <div className="shell-wide grid items-center gap-10 lg:grid-cols-2">
          {/* Chap ustun: Eyebrow, Sarlavha, Matn */}
          <div className="relative z-10 flex flex-col items-start">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full bg-surface2/50 px-4 py-1.5 text-xs font-semibold text-brand ring-1 ring-primary/30 backdrop-blur-md">
                <Icon name="stores" size={14} />
                <span>Yaqin atrofdagi do'konlar</span>
              </div>
            </Reveal>

            <Reveal delay={40}>
              <h1 className="mt-6 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                Do'<span className="text-brand">konlar</span>
              </h1>
            </Reveal>

            <Reveal delay={80}>
              <p className="mt-6 max-w-lg text-body text-muted-foreground leading-relaxed">
                Mahsulot yaqin atrofdagi haqiqiy do'kondan keladi — buyurtma to'g'ridan-to'g'ri unga
                boradi.
              </p>
            </Reveal>

            {/* Joylashuv so'rovi */}
            {!located ? (
              <Reveal delay={120}>
                <div className="mt-10 flex flex-col gap-4">
                  <p className="flex max-w-sm items-start gap-3 text-small text-muted-foreground">
                    <Icon name="locate" size={18} className="mt-0.5 shrink-0 text-brand" />
                    <span>
                      {denied
                        ? 'Joylashuv berilmadi — masofa taxminiy markazdan hisoblangan.'
                        : "Masofani aniq ko'rsatish uchun joylashuvga ruxsat bering."}
                    </span>
                  </p>

                  {!denied ? (
                    <button
                      type="button"
                      onClick={useMyLocation}
                      className="group inline-flex w-fit items-center gap-3 rounded-2xl border border-primary/40 bg-surface/80 px-6 py-3.5 text-small font-semibold text-brand transition-all hover:bg-surface2 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Icon
                        name="locate"
                        size={18}
                        className="transition-transform group-hover:scale-110"
                      />
                      Joylashuvimni ishlatish
                      <Icon
                        name="next"
                        size={16}
                        className="ms-2 opacity-70 transition-transform group-hover:translate-x-1"
                      />
                    </button>
                  ) : null}
                </div>
              </Reveal>
            ) : null}
          </div>

          {/* O'ng ustun: Premium 3D Grafik */}
          <div className="relative flex items-center justify-end">
            {/* Orqa fon nur effekti */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[100px]"
            />
            <img
              src="/img/stores-hero-pin.jpg"
              alt="Stores Map Pin"
              className="relative z-10 w-full max-w-[640px] select-none object-contain mix-blend-lighten pointer-events-none"
              style={{
                maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 70%)',
              }}
            />
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

/**
 * Do'kon surati yo'q bo'lsa — brendlangan bo'shliq.
 *
 * ⚠️ BO'SH RAMKA YARAMAYDI. `ImageFrame` rasmsiz holatda chegarali quti
 * chizadi; to'rda yonma-yon turgan uchta shunday quti sahifani
 * «yuklanmagan» qilib ko'rsatadi. Do'kon suratini biz nazorat qilmaymiz
 * (u do'konniki), lekin bo'shliqni ATAYIN qilib ko'rsata olamiz.
 */
function StoreCover({ store }: { store: StoreCard }): JSX.Element {
  /*
   * ⚠️ AVVAL MUQOVA, KEYIN LOGO. Karta 16:9 — logo esa kvadrat
   * (do'kon panelidagi maslahat ham «kvadrat rasm yaxshi ko'rinadi»
   * deydi). Uni bu slotga qo'ysak `object-cover` yon tomonlarini
   * qirqib tashlaydi va do'kon belgisi yarim ko'rinadi. Muqova esa
   * aynan shu nisbat uchun yuklanadi.
   */
  const cover = store.coverUrl ?? store.logoUrl;

  if (cover) {
    return (
      <ImageFrame src={cover} alt={store.name} ratio="16/9" rounded="none" zoomOnHover calmWhite />
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden bg-surface2">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_120%,hsl(var(--primary)/0.28),transparent_62%)]"
      />
      <Icon
        name="shop"
        size={44}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-brand/45"
      />
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
   * To'rdagi karta — Premium dizayn: qorong'i fon, markazda porlovchi doira.
   */
  return (
    <Link
      to={`/${locale}/store/${store.id}`}
      className="group block h-full focus-visible:outline-none"
    >
      <Card
        interactive
        className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-primary/20 bg-gradient-to-b from-[#161226] to-[#0e0a1b] p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]"
      >
        {/* Orqa fon nur (glow) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 size-40 -translate-x-1/2 rounded-full bg-primary/20 blur-[60px]"
        />

        {/* Yuqori qator: Masofa (chapda) va Sevimlilar (o'ngda) */}
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-brand">
            <span>{away || '? km'}</span>
            <Icon name="location" size={12} className="opacity-80" />
          </div>

          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full border border-border/60 bg-surface/50 text-muted-foreground transition-colors hover:border-primary/50 hover:text-brand"
            onClick={(e) => {
              e.preventDefault();
              // Heart icon toggled
            }}
          >
            <Icon name="favorite" size={16} />
          </button>
        </div>

        {/* Markazdagi do'kon belgisi */}
        <div className="relative z-10 mt-2 mb-6 flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/40 shadow-[0_0_30px_rgba(139,92,246,0.4)]">
            <Icon name="shop" size={32} className="text-brand drop-shadow-md" />
          </div>
        </div>

        {/* Ma'lumotlar qismi */}
        <div className="relative z-10 flex flex-1 flex-col">
          <h2 className="truncate text-xl font-bold text-foreground">{store.name}</h2>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <Icon
              name="clock"
              size={16}
              className={state.open ? 'text-success' : 'text-destructive'}
            />
            <span className={state.open ? 'text-success' : 'text-destructive font-medium'}>
              {state.text}
            </span>
            {away && (
              <>
                <span className="text-dim">·</span>
                <span className="text-muted-foreground">{away}</span>
              </>
            )}
          </div>

          {store.productCount > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{store.productCount} mahsulot</p>
          ) : null}

          {store.address ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
              <Icon name="location" size={16} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2">{store.address}</span>
            </p>
          ) : null}
        </div>

        {/* Batafsil tugmasi */}
        <div className="relative z-10 mt-6 pt-4">
          <div className="flex w-full items-center justify-between rounded-xl border border-primary/20 bg-surface/50 px-5 py-3.5 text-sm font-semibold transition-colors group-hover:bg-primary/10 group-hover:border-primary/40">
            <span>Batafsil</span>
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-brand">
              <Icon name="next" size={14} />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
