import { useState } from 'react';
import { Link, data, redirect, useFetcher, useSearchParams } from 'react-router';

import { Button, ErrorView, Icon, ProductCard } from '@looksave/ui-web';

import { ApiError, isNetworkError } from '@/api/client';
import {
  addToCart,
  getProduct,
  getStoreProducts,
  type ProductCard as Card2,
  type ProductDetail,
} from '@/api/endpoints';
import productStyles from '@/components/product/product.css?url';
import { isLocale, type Locale } from '@/i18n/locale';
import { discount, money } from '@/lib/format';
import { auth, requireAuth } from '@/session.server';

import type { Route } from './+types/product';

export function links() {
  return [{ rel: 'stylesheet', href: productStyles }];
}

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
  const [qty, setQty] = useState(1);

  const images = variant?.images.length ? variant.images : product.images;
  const price = variantPrice(product.price, variant?.priceDelta);
  const cut = discount(price, product.oldPrice);
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

  const prevImage = (): void => {
    if (images.length === 0) return;
    setImageIndex((i) => (i - 1 + images.length) % images.length);
  };
  const nextImage = (): void => {
    if (images.length === 0) return;
    setImageIndex((i) => (i + 1) % images.length);
  };

  return (
    <div className="product-page shell-wide section-y pb-28 lg:pb-[clamp(4rem,8vw,7rem)]">
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

      <nav aria-label="Yo'l" className="product-breadcrumb mb-6">
        <Link to={`/${locale}`} className="product-breadcrumb-home" aria-label="Bosh sahifa">
          <Icon name="home" size={14} />
        </Link>
        <Link to={`/${locale}`}>Bosh sahifa</Link>
        <Icon name="next" size={12} />
        <Link to={`/${locale}/catalog`}>Katalog</Link>
        {product.category ? (
          <>
            <Icon name="next" size={12} />
            <Link to={`/${locale}/catalog?category=${product.category.slug}`}>
              {product.category.name}
            </Link>
          </>
        ) : null}
        <Icon name="next" size={12} />
        <span className="is-current">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        {/* ── Gallereya ── */}
        <div className="flex flex-col-reverse gap-4 sm:flex-row">
          {images.length > 1 ? (
            <div className="product-thumb-rail">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Rasm ${index + 1}`}
                  aria-current={index === imageIndex}
                  className={`product-thumb ${index === imageIndex ? 'is-on' : ''}`}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="product-gallery-main flex-1">
            {images[imageIndex] ? (
              <img
                src={images[imageIndex]}
                alt={product.title}
                loading="eager"
                {...{ fetchpriority: 'high' }}
              />
            ) : null}

            {product.canTryOn ? <span className="product-gallery-chip">Try-On</span> : null}

            <button
              type="button"
              className="product-gallery-fav"
              aria-label="Sevimlilarga qo'shish"
            >
              <Icon name="favorite" size={20} />
            </button>

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  aria-label="Oldingi rasm"
                  className="product-gallery-nav -prev"
                >
                  <Icon name="back" size={20} />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  aria-label="Keyingi rasm"
                  className="product-gallery-nav -next"
                >
                  <Icon name="next" size={20} />
                </button>

                <div className="product-gallery-dots">
                  {images.map((src, index) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setImageIndex(index)}
                      aria-label={`Rasm ${index + 1}`}
                      className={index === imageIndex ? 'is-on' : ''}
                    />
                  ))}
                </div>
              </>
            ) : null}

            <button
              type="button"
              className="product-gallery-expand"
              aria-label="Kattalashtirish"
            >
              <Icon name="zoom" size={18} />
            </button>
          </div>
        </div>

        {/* ── Ma'lumot ── */}
        <div className="lg:sticky lg:top-[6.5rem] lg:self-start">
          <h1 className="product-title">{product.title}</h1>

          <p className="product-price">
            {money(price, product.currency)}
            {product.oldPrice ? (
              <span className="product-old-price">{money(product.oldPrice, product.currency)}</span>
            ) : null}
            {cut ? (
              <span className="product-old-price" style={{ color: '#ef4444' }}>
                {cut}
              </span>
            ) : null}
          </p>

          {/* Sotuvchi kartasi */}
          <Link to={`/${locale}/store/${product.store.id}`} className="product-seller">
            <span className="product-seller-avatar">
              <Icon name="shop" size={22} />
            </span>
            <span className="product-seller-info">
              <span className="product-seller-name">
                {product.store.name}
                <span className="product-seller-check" aria-label="Rasmiy do'kon">
                  ✓
                </span>
              </span>
              <span className="product-seller-sub">
                {product.store.isOpen ? "Ochiq · Rasmiy do'kon" : "Rasmiy do'kon"}
              </span>
            </span>
            <Icon name="next" size={18} className="text-[#6b5f79]" />
          </Link>

          {/* O'lcham */}
          {sizes.length > 0 ? (
            <div className="mt-6">
              <div className="product-section-title">
                <span>
                  O'lcham
                  {product.sizeChart?.system ? (
                    <span className="ms-2 text-[#6b5f79] font-normal">
                      ({product.sizeChart.system})
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="product-size-row">
                {sizes.map((item) => (
                  <button
                    key={item.size}
                    type="button"
                    disabled={!item.available || item.stock <= 0}
                    onClick={() => setSize(item.size)}
                    className={`product-size ${size === item.size ? 'is-on' : ''}`}
                  >
                    {item.size}
                  </button>
                ))}
              </div>
              {sizes.some((item) => item.available && item.stock <= 3) ? (
                <p className="mt-3 text-sm text-[#f59e0b]">Ba'zi o'lchamlar tugab bormoqda</p>
              ) : null}
            </div>
          ) : null}

          {/* Rang */}
          {product.variants.length > 1 ? (
            <div className="mt-6">
              <div className="product-section-title">
                <span>
                  Rangi
                  {variant?.colorName ? (
                    <span className="ms-2 text-[#6b5f79] font-normal">· {variant.colorName}</span>
                  ) : null}
                </span>
              </div>
              <div className="product-color-row">
                {product.variants.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pickColor(item.id)}
                    aria-label={item.colorName ?? `Variant ${index + 1}`}
                    className={`product-color ${index === variantIndex ? 'is-on' : ''}`}
                  >
                    <span
                      className="product-color-inner"
                      style={{ backgroundColor: item.colorHex ?? '#d9cae8' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Amallar: miqdor + savat + hozir sotib olish */}
          <fetcher.Form method="post" className="product-actions">
            <input type="hidden" name="variantId" value={variant?.id ?? ''} />
            <input type="hidden" name="size" value={size ?? ''} />

            <div className="product-qty">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Kamaytirish"
              >
                −
              </button>
              <span className="product-qty-val">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                aria-label="Ko'paytirish"
              >
                +
              </button>
            </div>

            <button
              type="submit"
              disabled={size === null || !variant || submitting}
              className="product-btn -primary"
            >
              <Icon name="cart" size={18} />
              {submitting ? 'Qo‘shilmoqda…' : signedIn ? "Savatga qo'shish" : 'Kirish va savatga'}
            </button>

            {product.canTryOn ? (
              <Link to={`/${locale}/try-on`} className="product-btn -secondary">
                <Icon name="hanger" size={18} />
                Hozir sotib olish
              </Link>
            ) : null}
          </fetcher.Form>

          {error ? (
            <p className="mt-3 text-sm text-[#ef4444]">{error}</p>
          ) : null}

          {/* Ishonch kartasi — uchta ustun */}
          <div className="product-trust">
            <div className="product-trust-item">
              <span className="product-trust-icon">
                <Icon name="authentic" size={18} />
              </span>
              <span className="product-trust-text">
                <strong>Original</strong>
                mahsulot
              </span>
            </div>
            <div className="product-trust-item">
              <span className="product-trust-icon">
                <Icon name="delivery" size={18} />
              </span>
              <span className="product-trust-text">
                <strong>Tez yetkazib berish</strong>
                1–3 kun
              </span>
            </div>
            <div className="product-trust-item">
              <span className="product-trust-icon">
                <Icon name="reset" size={18} />
              </span>
              <span className="product-trust-text">
                <strong>Qaytarish imkoniyati</strong>
                14 kun ichida
              </span>
            </div>
          </div>

          {/* Yoyma bo'limlar */}
          <div className="product-accordions">
            {product.description ? (
              <details className="product-accordion">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-[18px] text-base font-semibold text-[#171020] hover:bg-[#faf6fe]">
                  <span className="product-accordion-label">
                    <Icon name="authentic" size={18} className="product-accordion-icon" />
                    Tavsif
                  </span>
                  <Icon name="next" size={16} className="rotate-90 text-[#6b5f79]" />
                </summary>
                <div className="product-accordion-body">{product.description}</div>
              </details>
            ) : null}

            <details className="product-accordion">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-[18px] text-base font-semibold text-[#171020] hover:bg-[#faf6fe]">
                <span className="product-accordion-label">
                  <Icon name="delivery" size={18} className="product-accordion-icon" />
                  Yetkazish va qaytarish
                </span>
                <Icon name="next" size={16} className="rotate-90 text-[#6b5f79]" />
              </summary>
              <div className="product-accordion-body">
                Buyurtma to'g'ridan-to'g'ri {product.store.name} do'koniga boradi. To'lov do'konda
                yoki yetkazib berilganda. Qaytarish shartlari do'kon siyosatiga bo'ysunadi.
              </div>
            </details>

            {product.tags.length > 0 ? (
              <details className="product-accordion">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-[18px] text-base font-semibold text-[#171020] hover:bg-[#faf6fe]">
                  <span className="product-accordion-label">
                    <Icon name="hanger" size={18} className="product-accordion-icon" />
                    Teglar
                  </span>
                  <Icon name="next" size={16} className="rotate-90 text-[#6b5f79]" />
                </summary>
                <div className="product-accordion-body">
                  <span className="flex flex-wrap gap-2">
                    {product.tags.map((tag) => (
                      <Link
                        key={tag}
                        to={`/${locale}/catalog?q=${encodeURIComponent(tag)}`}
                        className="rounded-full border border-[#e9dcf2] bg-white px-3 py-1 text-sm text-[#6b5f79] transition-colors hover:bg-[#f7edff] hover:text-[#171020]"
                      >
                        {tag}
                      </Link>
                    ))}
                  </span>
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Shu do'kondan yana ── */}
      {related.length > 0 ? (
        <section className="product-related mt-20">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#171020]">
            Shu do'kondan yana
          </h2>

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
      <div className="product-sticky-mobile fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="shell flex items-center gap-4 py-3">
          <span className="flex-1">
            <span className="block text-base font-bold tabular-nums text-[#8617ef]">
              {money(price, product.currency)}
            </span>
            <span className="block text-xs text-[#6b5f79]">
              {size ? `O'lcham ${size}` : "o'lchamni tanlang"}
            </span>
          </span>

          <fetcher.Form method="post">
            <input type="hidden" name="variantId" value={variant?.id ?? ''} />
            <input type="hidden" name="size" value={size ?? ''} />
            <button
              type="submit"
              disabled={size === null || !variant || submitting}
              className="product-btn -primary"
              style={{ height: 46, padding: '0 22px', minWidth: 'auto' }}
            >
              Savatga
            </button>
          </fetcher.Form>
        </div>
      </div>
    </div>
  );
}
