import { useState } from 'react';
import { Link, data, redirect, useFetcher, useSearchParams } from 'react-router';

import { Button, Card, Chip, ErrorView, Icon, ImageFrame, ProductCard } from '@looksave/ui-web';

import { ApiError, isNetworkError } from '@/api/client';
import {
  addToCart,
  getProduct,
  getStoreProducts,
  type ProductCard as Card2,
  type ProductDetail,
} from '@/api/endpoints';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { isLocale, type Locale } from '@/i18n/locale';
import { discount, distance, money } from '@/lib/format';
import { auth, requireAuth } from '@/session.server';

import type { Route } from './+types/product';

/**
 * Mahsulot sahifasi — docs/15-sayt-dizayn.md §4.3.
 *
 * ⚠️ BU SAHIFA SSR UCHUN ENG MUHIMI. Marketplace qidiruvdan aynan shu
 * yerga tushadi; SPA bo'lsa Google JS ni kutadi va ko'pincha
 * indekslamaydi (13-sayt.md S-02).
 */

/** Variant narxi = asosiy narx + `priceDelta` (rangga qarab o'zgaradi) */
function variantPrice(base: string, delta: string | undefined): string {
  const sum = Number(base) + Number(delta ?? 0);
  return Number.isFinite(sum) ? sum.toFixed(2) : base;
}

export function meta({ data: loaded }: Route.MetaArgs): Route.MetaDescriptors {
  if (!loaded?.product) return [{ title: 'Mahsulot — LookSave' }];

  const { product } = loaded;
  const brand = product.brand?.name ? `${product.brand.name} · ` : '';

  return [
    { title: `${product.title} — ${brand}LookSave` },
    {
      name: 'description',
      content:
        product.description?.slice(0, 160) ??
        `${product.title} — ${product.store.name} do'konida. 3D da kiyib ko'ring.`,
    },
    { property: 'og:title', content: product.title },
    { property: 'og:type', content: 'product' },
    ...(product.images[0] ? [{ property: 'og:image', content: product.images[0] }] : []),
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await auth(request, locale);

  let product: ProductDetail;
  try {
    product = await getProduct(params.id, context.options);
  } catch (error) {
    // Mahsulot yo'q → 404, qobiq (shapka/futer) joyida qoladi
    if (error instanceof ApiError && error.status === 404) {
      throw new Response('Not found', { status: 404 });
    }

    /*
     * ⚠️ QOLGAN XATOLAR HAM 500 BO'LMAYDI. Server band bo'lsa
     * (`RATE_LIMITED`) yoki tarmoq uzilsa, odam yalang'och xato sahifasini
     * emas, «qayta urinish» tugmasini ko'rishi kerak — shapka va
     * navigatsiya joyida qolgan holda (15-sayt-dizayn.md §1.7).
     *
     * Katalog va do'konlar sahifalari allaqachon shunday ishlaydi;
     * bu sahifa ulardan orqada qolgan edi.
     */
    return data({
      locale: locale as Locale,
      product: null,
      related: [] as Card2[],
      signedIn: context.user !== null,
      origin: new URL(request.url).origin,
      error: error instanceof Error ? error.message : 'Mahsulot ochilmadi',
      network: isNetworkError(error),
    });
  }

  /*
   * «Shu do'kondan yana» — sahifa ochilishini kechiktirmasligi kerak,
   * shuning uchun xatosi yutiladi: mahsulot o'zi muhimroq.
   */
  const related = await getStoreProducts(product.store.id, context.options)
    .then((page) => page.items.filter((item) => item.id !== product.id).slice(0, 4))
    .catch((): Card2[] => []);

  return data(
    {
      locale: locale as Locale,
      product,
      related,
      signedIn: context.user !== null,
      origin: new URL(request.url).origin,
      error: null as string | null,
      network: false,
    },
    context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
  );
}

/** «Savatga» — server tomonida bajariladi, token brauzerga chiqmaydi. */
export async function action({ params, request }: Route.ActionArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const form = await request.formData();
  const variantId = String(form.get('variantId') ?? '');
  const size = String(form.get('size') ?? '');

  if (!variantId || !size) {
    return data({ error: "O'lchamni tanlang" }, { status: 400 });
  }

  try {
    await addToCart({ variantId, size }, context.options);
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Savatga qo'shib bo'lmadi" },
      { status: 400 },
    );
  }

  return redirect(`/${locale}/cart`, {
    headers: context.setCookie ? { 'Set-Cookie': context.setCookie } : undefined,
  });
}

export default function Product({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, product, related, signedIn, origin, error: loadError, network } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!product) {
    return (
      <div className="shell py-24">
        <ErrorView
          message={
            network
              ? "Tarmoqqa ulanib bo'lmadi. Ulanishni tekshiring."
              : (loadError ?? 'Mahsulot ochilmadi')
          }
          variant={network ? 'network' : 'generic'}
          action={
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Qayta urinish
            </Button>
          }
        />
      </div>
    );
  }

  /*
   * ⚠️ TANLANGAN RANG URL'DA. Havola ulashilganda o'sha rang ochilishi
   * kerak — «qarang, mana bu ko'k» deb yuborilgan havola bej rangni
   * ochsa, havola ma'nosini yo'qotadi (15-sayt-dizayn.md §4.3).
   */
  const colorParam = searchParams.get('rang');
  const variantIndex = Math.max(
    0,
    product.variants.findIndex((item) => item.id === colorParam),
  );
  const variant = product.variants[variantIndex];

  const [size, setSize] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const images = variant?.images.length ? variant.images : product.images;
  const price = variantPrice(product.price, variant?.priceDelta);
  const cut = discount(price, product.oldPrice);
  const away = distance(product.store.distanceM);
  const sizes = variant?.sizes ?? [];

  const submitting = fetcher.state !== 'idle';
  const error = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : null;

  const pickColor = (id: string): void => {
    const next = new URLSearchParams(searchParams);
    next.set('rang', id);
    setSearchParams(next, { preventScrollReset: true, replace: true });
    setImageIndex(0);
    setSize(null);
  };

  /*
   * `Product` belgisi — 13-sayt.md §11. Qidiruv natijasida narx,
   * valyuta va mavjudlik ko'rinadi; usiz mahsulot oddiy havola bo'lib
   * qoladi.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    ...(product.description ? { description: product.description } : {}),
    ...(product.images.length > 0 ? { image: product.images } : {}),
    ...(product.brand?.name ? { brand: { '@type': 'Brand', name: product.brand.name } } : {}),
    offers: {
      '@type': 'Offer',
      price: Number(price).toFixed(2),
      priceCurrency: product.currency,
      availability: sizes.some((item) => item.available)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${origin}/${locale}/p/${product.id}`,
      seller: { '@type': 'Organization', name: product.store.name },
    },
  };

  return (
    <div className="shell-wide section-y pb-28 lg:pb-[clamp(4rem,8vw,7rem)]">
      {/*
        ⚠️ `<` EKRANLANADI. Mahsulot nomi va tavsifi do'kondan keladi,
        ya'ni ular bizning matnimiz emas. Ichida `</script>` bo'lsa u
        belgini erta yopib, qolganini HTML sifatida sahifaga qo'yardi —
        bu do'kon paneli orqali ochiladigan XSS yo'li.
        `JSON.stringify` bunday himoyani BERMAYDI.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <nav aria-label="Yo'l" className="mb-6 flex flex-wrap items-center gap-2 text-small text-dim">
        <Link to={`/${locale}`} className="hover:text-foreground">
          Bosh
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={`/${locale}/catalog`} className="hover:text-foreground">
          Katalog
        </Link>
        {product.category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              to={`/${locale}/catalog?category=${product.category.slug}`}
              className="hover:text-foreground"
            >
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        {/* ── Gallereya ── */}
        <div className="flex flex-col-reverse gap-4 sm:flex-row">
          {images.length > 1 ? (
            <div className="flex gap-3 overflow-x-auto sm:w-20 sm:flex-col sm:overflow-visible">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Rasm ${index + 1}`}
                  aria-current={index === imageIndex}
                  className={
                    index === imageIndex
                      ? 'w-16 shrink-0 rounded-md ring-2 ring-borderAccent sm:w-full'
                      : 'w-16 shrink-0 rounded-md ring-1 ring-border transition hover:ring-borderStrong sm:w-full'
                  }
                >
                  <ImageFrame src={src} alt="" ratio="3/4" rounded="md" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="relative flex-1">
            <ImageFrame
              src={images[imageIndex] ?? null}
              alt={product.title}
              ratio="3/4"
              loading="eager"
              // React 18 `fetchPriority` ni tanimaydi — DOM atributi kichik harfda
              {...{ fetchpriority: 'high' }}
            />

            <div className="pointer-events-none absolute start-3 top-3 flex gap-2">
              {product.canTryOn ? (
                <span className="rounded-sm border border-borderAccent bg-primarySoft px-2 py-0.5 text-tiny font-medium text-brand">
                  3D
                </span>
              ) : null}
              {product.isLimited ? (
                <span className="rounded-sm border border-limited/50 bg-limited/15 px-2 py-0.5 text-tiny font-medium text-limited">
                  LIMITED
                </span>
              ) : null}
              {cut ? (
                <span className="rounded-sm border border-danger/50 bg-danger/15 px-2 py-0.5 text-tiny font-medium text-danger">
                  {cut}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Ma'lumot ── */}
        <div className="lg:sticky lg:top-[6.5rem] lg:self-start">
          {product.brand ? (
            <p className="text-label font-semibold uppercase text-dim">{product.brand.name}</p>
          ) : null}

          <h1 className="mt-2 text-balance text-hero font-bold leading-[1.05]">{product.title}</h1>

          {/*
            ⚠️ NARX SARLAVHADAN KEYINGI ENG KATTA ELEMENT. Ilgari u
            `text-h2` (22px) edi va tavsif bilan bir og'irlikda turardi —
            xarid sahifasida esa narx ikkinchi o'rinda bo'lishi kerak.
            Chegirma foizi yonida turadi, eski narx esa kichik va
            chizilgan: uchtasi bitta qatorda o'qiladi.
          */}
          <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-h1 font-bold tabular-nums leading-none">
              {money(price, product.currency)}
            </span>

            {product.oldPrice ? (
              <span className="text-body tabular-nums text-dim line-through">
                {money(product.oldPrice, product.currency)}
              </span>
            ) : null}

            {cut ? (
              <span className="rounded-sm bg-danger/15 px-2 py-0.5 text-small font-medium text-danger">
                {cut}
              </span>
            ) : null}
          </p>

          {/* ── Do'kon ── */}
          <Card className="mt-6 p-4">
            <Link
              to={`/${locale}/store/${product.store.id}`}
              className="flex items-center gap-3 focus-visible:outline-none"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface2 text-brand">
                <Icon name="shop" size={20} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-foreground">
                  {product.store.name}
                </span>
                <span className="block text-small text-dim">
                  {product.store.isOpen ? 'Ochiq' : 'Yopiq'}
                  {away ? ` · ${away}` : ''}
                </span>
              </span>

              <Icon name="next" size={16} className="text-dim" />
            </Link>
          </Card>

          {/* ── Rang ── */}
          {product.variants.length > 1 ? (
            <div className="mt-6">
              <p className="text-label font-semibold uppercase text-dim">
                Rang
                {variant?.colorName ? (
                  <span className="ms-2 normal-case tracking-normal text-muted-foreground">
                    {variant.colorName}
                  </span>
                ) : null}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((item, index) => (
                  <Chip
                    key={item.id}
                    selected={index === variantIndex}
                    onClick={() => pickColor(item.id)}
                  >
                    {item.colorHex ? (
                      <span
                        className="size-3 rounded-full border border-borderStrong"
                        style={{ backgroundColor: item.colorHex }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {item.colorName ?? `Variant ${index + 1}`}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── O'lcham ── */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-label font-semibold uppercase text-dim">
                O'lcham
                {product.sizeChart?.system ? (
                  <span className="ms-2 normal-case tracking-normal text-dim">
                    {product.sizeChart.system}
                  </span>
                ) : null}
              </p>
              {size === null ? <p className="text-small text-brand">o'lchamni tanlang</p> : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.length === 0 ? (
                <p className="text-small text-dim">Omborda yo'q</p>
              ) : (
                sizes.map((item) => (
                  <Chip
                    key={item.size}
                    selected={size === item.size}
                    disabled={!item.available || item.stock <= 0}
                    onClick={() => setSize(item.size)}
                  >
                    {item.size}
                  </Chip>
                ))
              )}
            </div>

            {/*
              ⚠️ «Sizga M to'g'ri keladi» YOZILMAYDI. API o'lcham jadvalini
              bermaydi (`sizeChart` faqat `{type, system}`), ya'ni bunday
              maslahat taxmin bo'lardi — noto'g'ri o'lcham esa aynan biz
              yechmoqchi bo'lgan muammoni qaytaradi.
            */}
            {sizes.some((item) => item.available && item.stock <= 3) ? (
              <p className="mt-3 text-small text-warning">Ba'zi o'lchamlar tugab bormoqda</p>
            ) : null}
          </div>

          {/* ── Amallar ── */}
          <fetcher.Form method="post" className="mt-8 flex flex-col gap-3">
            <input type="hidden" name="variantId" value={variant?.id ?? ''} />
            <input type="hidden" name="size" value={size ?? ''} />

            <Button
              type="submit"
              className="w-full shadow-glow"
              loading={submitting}
              disabled={size === null || !variant}
            >
              {signedIn ? 'Savatga' : 'Kirish va savatga'}
            </Button>

            {product.canTryOn ? (
              <Button asChild variant="ghost" className="w-full">
                <Link to={`/${locale}/try-on`}>3D da kiyib ko'rish</Link>
              </Button>
            ) : null}

            {error ? <p className="text-small text-danger">{error}</p> : null}
          </fetcher.Form>

          {/* ── Ishonch ── */}
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-border pt-6">
            {[
              { icon: 'authentic' as const, label: 'Original' },
              { icon: 'delivery' as const, label: 'Yetkazish' },
              { icon: 'premium' as const, label: 'Tanlangan' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2 text-center">
                <Icon name={item.icon} size={18} className="text-brand" />
                <span className="text-tiny text-dim">{item.label}</span>
              </div>
            ))}
          </div>

          {/* ── Tafsilotlar ── */}
          <Accordion type="single" collapsible className="mt-6 border-t border-border">
            {product.description ? (
              <AccordionItem value="description">
                <AccordionTrigger className="text-body">Tavsif</AccordionTrigger>
                <AccordionContent className="text-body leading-relaxed text-muted-foreground">
                  {product.description}
                </AccordionContent>
              </AccordionItem>
            ) : null}

            <AccordionItem value="delivery">
              <AccordionTrigger className="text-body">Yetkazish va qaytarish</AccordionTrigger>
              <AccordionContent className="text-body leading-relaxed text-muted-foreground">
                Buyurtma to'g'ridan-to'g'ri {product.store.name} do'koniga boradi. To'lov do'konda
                yoki yetkazib berilganda. Qaytarish shartlari do'kon siyosatiga bo'ysunadi.
              </AccordionContent>
            </AccordionItem>

            {product.tags.length > 0 ? (
              <AccordionItem value="tags">
                <AccordionTrigger className="text-body">Teglar</AccordionTrigger>
                <AccordionContent>
                  <span className="flex flex-wrap gap-2">
                    {product.tags.map((tag) => (
                      <Link
                        key={tag}
                        to={`/${locale}/catalog?q=${encodeURIComponent(tag)}`}
                        className="rounded-full border border-border bg-surface2 px-3 py-1 text-small text-muted-foreground transition-colors hover:bg-surface3 hover:text-foreground"
                      >
                        {tag}
                      </Link>
                    ))}
                  </span>
                </AccordionContent>
              </AccordionItem>
            ) : null}
          </Accordion>
        </div>
      </div>

      {/* ── Shu do'kondan yana ── */}
      {related.length > 0 ? (
        <section className="mt-20">
          <h2 className="text-label font-semibold uppercase text-foreground">Shu do'kondan yana</h2>

          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 xl:gap-6">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                title={item.title}
                price={money(item.price, item.currency)}
                oldPrice={item.oldPrice ? money(item.oldPrice, item.currency) : null}
                image={item.image}
                canTryOn={item.canTryOn}
                isLimited={item.isLimited}
                link={(children) => (
                  <Link to={`/${locale}/p/${item.id}`} className="block">
                    {children}
                  </Link>
                )}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/*
        ── Mobil yopishqoq panel ──
        ⚠️ Telefonda o'ng ustun pastga tushib ketadi va uzun tavsifdan
        keyin «savatga» tugmasi ko'rinmay qoladi. Shuning uchun narx va
        amal doim ekran pastida turadi (15-sayt-dizayn.md §4.3).
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
        <div className="shell flex items-center gap-4 py-3">
          <span className="flex-1">
            <span className="block text-body font-bold tabular-nums">
              {money(price, product.currency)}
            </span>
            <span className="block text-tiny text-dim">
              {size ? `O'lcham ${size}` : "o'lchamni tanlang"}
            </span>
          </span>

          <fetcher.Form method="post">
            <input type="hidden" name="variantId" value={variant?.id ?? ''} />
            <input type="hidden" name="size" value={size ?? ''} />
            <Button type="submit" loading={submitting} disabled={size === null || !variant}>
              Savatga
            </Button>
          </fetcher.Form>
        </div>
      </div>
    </div>
  );
}
