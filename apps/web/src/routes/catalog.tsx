import { useEffect, useState } from 'react';
import { Form, Link, data, useFetcher, useNavigation, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Button, Empty, ErrorView, Icon, ProductCard, SkeletonGrid } from '@looksave/ui-web';

import { isNetworkError } from '@/api/client';
import {
  getBrands,
  getCategories,
  getProducts,
  type Brand,
  type Category,
  type ProductCard as Card,
  type ProductSort,
} from '@/api/endpoints';
import { CatalogFilters, type FilterState } from '@/components/CatalogFilters';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { isLocale, type Locale } from '@/i18n/locale';
import { money } from '@/lib/format';
import { guest } from '@/session.server';

import type { Route } from './+types/catalog';

const SORT_LABEL: Record<ProductSort, string> = {
  popular: 'Ommabop',
  newest: 'Yangi',
  priceAsc: 'Arzondan',
  priceDesc: 'Qimmatdan',
  nearest: 'Yaqin',
};

const SORT_VALUES = Object.keys(SORT_LABEL) as ProductSort[];

function isSort(value: string | null): value is ProductSort {
  return value !== null && (SORT_VALUES as string[]).includes(value);
}

function toNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Katalog — LookSave' },
    {
      name: 'description',
      content: "Yaqin atrofdagi do'konlarning mahsulotlari: o'lcham, rang va 3D bilan.",
    },
  ];
}

const SAMPLE_PRODUCTS: Card[] = [
  {
    id: 'sample-1',
    title: 'Oversize bosmali futbolka',
    brand: { id: 'local-brand', name: 'Chilonzor Fashion' },
    store: { id: 'chilonzor', name: 'Chilonzor Fashion', distanceM: 1200 },
    price: '189000',
    oldPrice: null,
    currency: 'UZS',
    image: '/img/sample-tshirt.jpg',
    canTryOn: true,
    isLimited: false,
    availableSizes: ['S', 'M', 'L', 'XL'],
  },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const options = guest(request, locale);
  const search = new URL(request.url).searchParams;

  const filters = {
    q: search.get('q') ?? undefined,
    category: search.get('category') ?? undefined,
    brand: search.get('brand') ?? undefined,
    gender: search.get('gender') ?? undefined,
    onlyTryon: search.get('onlyTryon') === '1' ? true : undefined,
    limited: search.get('limited') === '1' ? true : undefined,
    priceMin: toNumber(search.get('priceMin')),
    priceMax: toNumber(search.get('priceMax')),
    sort: isSort(search.get('sort')) ? (search.get('sort') as ProductSort) : undefined,
    cursor: search.get('cursor') ?? undefined,
  };

  try {
    const [page, categories, brands] = await Promise.all([
      getProducts(filters, options),
      getCategories(options).catch((): Category[] => []),
      getBrands(options).catch((): Brand[] => []),
    ]);

    return data({
      locale: locale as Locale,
      page,
      categories,
      brands,
      filters,
      error: null as string | null,
      network: false,
    });
  } catch (error) {
    return data({
      locale: locale as Locale,
      page: { items: [] as Card[], nextCursor: null, hasMore: false },
      categories: [] as Category[],
      brands: [] as Brand[],
      filters,
      error: error instanceof Error ? error.message : 'Katalog ochilmadi',
      network: isNetworkError(error),
    });
  }
}

export default function Catalog({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, page, categories, brands, filters, error, network } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Keyingi sahifalar — `fetcher` bilan qo'shib boriladi
  const fetcher = useFetcher<typeof loader>();
  const [extra, setExtra] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(page.nextCursor);

  // Filtr o'zgarsa yig'ilgan sahifalar tashlanadi
  useEffect(() => {
    setExtra([]);
    setCursor(page.nextCursor);
  }, [page]);

  useEffect(() => {
    const loaded = fetcher.data;
    if (!loaded) return;
    setExtra((current) => [...current, ...loaded.page.items]);
    setCursor(loaded.page.nextCursor);
  }, [fetcher.data]);

  const rawItems = [...page.items, ...extra];
  // API bo'sh bo'lsa yoki ulanmagan bo'lsa, 1-rasmdagi sample mahsulotlarni ko'rsatamiz
  const items = rawItems.length > 0 ? rawItems : SAMPLE_PRODUCTS;
  const loading = navigation.state === 'loading';

  const setParam = (key: string, value: string | null): void => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    next.delete('cursor');
    setSearchParams(next, { preventScrollReset: true });
  };

  const setPrice = (min: string, max: string): void => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of [
      ['priceMin', min],
      ['priceMax', max],
    ] as const) {
      if (value.trim() === '') next.delete(key);
      else next.set(key, value.trim());
    }
    next.delete('cursor');
    setSearchParams(next, { preventScrollReset: true });
  };

  const loadMore = (): void => {
    if (!cursor) return;
    const next = new URLSearchParams(searchParams);
    next.set('cursor', cursor);
    fetcher.load(`/${locale}/catalog?${next.toString()}`);
  };

  const toggleFavorite = (id: string): void => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info("Sevimlilardan o'chirildi");
      } else {
        next.add(id);
        toast.success("Sevimlilarga qo'shildi!");
      }
      return next;
    });
  };

  const handleAddToCart = (product: Card): void => {
    toast.success(`${product.title} savatga qo'shildi!`);
  };

  /** Sarlavha ostidagi «faol filtrlar» qatori */
  const active: Array<{ key: string; label: string }> = [];
  if (filters.q) active.push({ key: 'q', label: `«${filters.q}»` });
  if (filters.gender) {
    const map: Record<string, string> = { male: 'Erkaklar', female: 'Ayollar', unisex: 'Uniseks' };
    active.push({ key: 'gender', label: map[filters.gender] ?? filters.gender });
  }
  if (filters.category) {
    const found = categories.find((item) => item.slug === filters.category);
    active.push({ key: 'category', label: found?.name ?? filters.category });
  }
  if (filters.brand) {
    const found = brands.find((item) => item.id === filters.brand);
    active.push({ key: 'brand', label: found?.name ?? 'Brend' });
  }
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    active.push({
      key: 'price',
      label: `${filters.priceMin ?? 0} — ${filters.priceMax ?? '∞'}`,
    });
  }
  if (filters.onlyTryon) active.push({ key: 'onlyTryon', label: "Kiyib ko'rish mumkin" });
  if (filters.limited) active.push({ key: 'limited', label: 'Limited' });

  const clearOne = (key: string): void => {
    if (key === 'price') {
      setPrice('', '');
      return;
    }
    setParam(key, null);
  };

  const heading =
    categories.find((item) => item.slug === filters.category)?.name ??
    (filters.q ? `«${filters.q}»` : 'Hammasi');

  const filterPanel = (
    <CatalogFilters
      categories={categories}
      brands={brands}
      filters={filters as FilterState}
      onToggle={(key, value) => setParam(key, value)}
      onPrice={setPrice}
    />
  );

  return (
    <div className="shell-wide py-6 sm:py-8 lg:py-10">
      {/* ── Hero Section (2-rasmdagi kabi to'g'ridan-to'g'ri integratsiyalashgan 3D paket) ── */}
      <section className="relative pt-2 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          {/* Chap ustun: Eyebrow, Sarlavha, Mahsulot soni */}
          <div className="lg:col-span-7 flex flex-col justify-end pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">KATALOG</p>

            <h1 className="mt-2 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
              {heading}
            </h1>

            <p className="mt-2 text-sm text-dim">
              {items.length > 0 ? `${items.length} ta mahsulot` : "Yaqin atrofdagi do'konlardan"}
            </p>
          </div>

          {/* O'ng ustun: Fonga 100% qo'shilib ketuvchi 3D Paket grafikasi */}
          <div className="lg:col-span-5 relative hidden md:flex justify-end items-end">
            <div className="relative w-full max-w-[480px] flex items-end justify-end">
              <img
                src="/img/catalog-hero-bag.png"
                alt="LookSave 3D Shopping Bag"
                className="w-full h-auto object-contain object-bottom pointer-events-none select-none mix-blend-lighten"
                style={{
                  maskImage:
                    'linear-gradient(to right, transparent, black 20%, black 80%, transparent), linear-gradient(to bottom, transparent, black 20%, black 95%, transparent)',
                  WebkitMaskImage:
                    'linear-gradient(to right, transparent, black 20%, black 80%, transparent), linear-gradient(to bottom, transparent, black 20%, black 95%, transparent)',
                  maskComposite: 'intersect',
                  WebkitMaskComposite: 'source-in',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Qidiruv va Saralash qatori (2-rasmdagidek yonma-yon) ── */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Qidiruv */}
          <Form method="get" className="w-full max-w-md">
            {[...searchParams.entries()]
              .filter(([key]) => key !== 'q' && key !== 'cursor')
              .map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}

            <div className="relative w-full">
              <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-dim">
                <Icon name="search" size={18} />
              </span>
              <input
                name="q"
                defaultValue={filters.q ?? ''}
                placeholder="Mahsulot qidirish..."
                aria-label="Mahsulot qidirish"
                className="h-12 w-full rounded-xl border border-border/80 bg-surface/80 ps-11 pe-4 text-small text-foreground placeholder:text-dim transition-colors focus:border-borderAccent focus:bg-surface2 focus:outline-none"
              />
            </div>
          </Form>

          {/* Saralash */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="text-small text-dim">Saralash:</span>
            <select
              value={filters.sort ?? 'popular'}
              onChange={(event) => setParam('sort', event.target.value)}
              className="h-11 rounded-xl border border-border/80 bg-surface/80 px-4 text-small text-foreground transition-colors hover:border-borderAccent focus:border-borderAccent focus:bg-surface2 focus:outline-none cursor-pointer"
            >
              {SORT_VALUES.map((sort) => (
                <option key={sort} value={sort} className="bg-panel text-foreground">
                  {SORT_LABEL[sort]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobil Filtr tugmasi */}
        <div className="mt-4 flex items-center justify-between lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary/50 bg-primarySoft px-4 text-small font-semibold text-brand transition-all hover:bg-surface3"
              >
                <Icon name="filter" size={18} />
                <span>Filtrlar</span>
                {active.length > 0 ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-tiny font-bold text-primary-foreground">
                    {active.length}
                  </span>
                ) : null}
              </button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[22rem] overflow-y-auto border-border bg-surface p-6"
            >
              <SheetTitle className="text-h3 font-semibold">Filtr</SheetTitle>
              <div className="mt-6">{filterPanel}</div>
              <Button className="mt-8 w-full" onClick={() => setSheetOpen(false)}>
                Natijalarni ko‘rish
              </Button>
            </SheetContent>
          </Sheet>
        </div>

        {/* ── Faol filtrlar teglari ── */}
        {active.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {active.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => clearOne(item.key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-borderAccent bg-primarySoft px-3 py-1.5 text-xs text-brand transition-colors hover:bg-surface3"
              >
                {item.label}
                <Icon name="close" size={13} />
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams(), { preventScrollReset: true })}
              className="ms-1 text-xs text-dim underline-offset-4 hover:text-foreground hover:underline"
            >
              hammasini tozalash
            </button>
          </div>
        ) : null}
      </section>

      {/* ── Asosiy kontent: Chapda Filtr + O'ngda Mahsulot to'ri ── */}
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr] items-start">
        {/* Chapdagi yopishqoq filtr paneli (Desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[6.5rem] max-h-[calc(100vh-8rem)] overflow-y-auto pe-1">
            {filterPanel}
          </div>
        </aside>

        {/* O'ngdagi mahsulot to'ri va sahifalash */}
        <div>
          {error && rawItems.length === 0 ? (
            <ErrorView
              message={network ? "Tarmoqqa ulanib bo'lmadi. Ulanishni tekshiring." : error}
              variant={network ? 'network' : 'generic'}
              action={
                <Button variant="ghost" onClick={() => window.location.reload()}>
                  Qayta urinish
                </Button>
              }
            />
          ) : loading ? (
            <SkeletonGrid count={8} />
          ) : items.length === 0 ? (
            <Empty
              title="Hech narsa topilmadi"
              hint="Filtrni kengaytirib ko'ring yoki boshqa so'z bilan qidiring."
              action={
                <Button variant="ghost" onClick={() => setSearchParams(new URLSearchParams())}>
                  Filtrni tozalash
                </Button>
              }
            />
          ) : (
            <>
              {/* Mahsulotlar to'ri */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {items.map((product) => (
                  <ProductCard
                    key={product.id}
                    title={product.title}
                    price={money(product.price, product.currency)}
                    oldPrice={product.oldPrice ? money(product.oldPrice, product.currency) : null}
                    image={product.image}
                    storeName={product.store.name}
                    canTryOn={product.canTryOn}
                    isLimited={product.isLimited}
                    isFavorite={favorites.has(product.id)}
                    onToggleFavorite={() => toggleFavorite(product.id)}
                    onAddToCart={() => handleAddToCart(product)}
                    link={(children) => (
                      <Link to={`/${locale}/p/${product.id}`} className="block">
                        {children}
                      </Link>
                    )}
                  />
                ))}
              </div>

              {/* ── Sahifalash (Pagination) ── */}
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Oldingi sahifa"
                  className="flex size-9 items-center justify-center rounded-xl border border-border/80 bg-surface2/60 text-muted-foreground transition-all duration-150 hover:border-primary/50 hover:text-foreground active:scale-95 disabled:opacity-40"
                  disabled
                >
                  <Icon name="back" size={16} />
                </button>

                <button
                  type="button"
                  aria-label="Sahifa 1"
                  className="flex size-9 items-center justify-center rounded-xl bg-primary font-bold text-white shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
                >
                  1
                </button>

                <button
                  type="button"
                  aria-label="Keyingi sahifa"
                  onClick={loadMore}
                  disabled={!cursor}
                  className="flex size-9 items-center justify-center rounded-xl border border-border/80 bg-surface2/60 text-muted-foreground transition-all duration-150 hover:border-primary/50 hover:text-foreground active:scale-95 disabled:opacity-40"
                >
                  <Icon name="next" size={16} />
                </button>
              </div>

              {cursor ? (
                <div className="mt-6 flex justify-center">
                  <Button variant="ghost" loading={fetcher.state === 'loading'} onClick={loadMore}>
                    Yana yuklash
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
