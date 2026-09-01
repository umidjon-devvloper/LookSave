import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Button, Icon } from '@looksave/ui-web';

import { getProduct } from '@/api/endpoints';
import type { Locale } from '@/i18n/locale';

/**
 * TRENDING NOW — bitta mahsulotni katta qilib ko'rsatuvchi karusel
 * (maket: bosh sahifa, «TRENDING NOW» bloki).
 *
 * ⚠️ NEGA TO'RTTALIK TO'R EMAS. To'rda hamma mahsulot bir xil vaznda
 * turadi va ko'z hech qayerga tushmaydi. Maketda esa bitta kiyim butun
 * blokni egallaydi: rang, narx, do'kon — hammasi bir qarashda o'qiladi.
 * To'r pastda qoladi, bu blok esa boshlang'ich nuqta.
 *
 * ⚠️ KARUSEL O'ZI AYLANMAYDI. Avtomatik almashinuv o'qiyotgan odamni
 * uzadi va harakatni kamaytirish sozlamasini buzadi (WCAG 2.2.2).
 * Almashtirishni foydalanuvchi boshqaradi.
 */

export interface SpotlightItem {
  id: string;
  title: string;
  storeName: string;
  price: string;
  oldPrice: string | null;
  image: string | null;
  canTryOn: boolean;
  isLimited: boolean;
}

/**
 * Ro'yxat endpointida yo'q, faqat `/products/:id` da bor ma'lumot.
 * `null` — so'rov yiqilgan yoki hali kelmagan.
 */
export interface SpotlightDetail {
  category: string | null;
  colors: Array<{ hex: string; name: string | null }>;
}

/** Bir xil rangdagi variantlar bitta nuqta bo'lib qoladi */
export function spotlightColors(
  variants: Array<{ colorHex: string | null; colorName: string | null }>,
): SpotlightDetail['colors'] {
  const seen = new Set<string>();
  return variants.flatMap((variant) => {
    const hex = variant.colorHex;
    if (!hex || seen.has(hex.toUpperCase())) return [];
    seen.add(hex.toUpperCase());
    return [{ hex, name: variant.colorName || null }];
  });
}

export function Spotlight({
  items,
  details: initialDetails,
  locale,
}: {
  items: SpotlightItem[];
  /** Serverda olingan batafsillar — odatda faqat birinchisi */
  details: Record<string, SpotlightDetail>;
  locale: Locale;
}): JSX.Element | null {
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState<Record<string, SpotlightDetail | null>>(initialDetails);

  const item = items[Math.min(index, Math.max(items.length - 1, 0))];
  const detail = item ? details[item.id] : undefined;

  /*
   * ⚠️ BATAFSIL MA'LUMOT KO'RSATILGANDA OLINADI, OLDINDAN EMAS.
   *
   * Kategoriya va ranglar faqat `/products/:id` da bor, ya'ni uchta
   * mahsulot uchun uchta qo'shimcha so'rov kerak bo'lardi. API anonim
   * foydalanuvchiga daqiqasiga 30 so'rov beradi (03-api-spec §4) va
   * SSR'da BARCHA mehmon bitta IP ostida hisoblanadi — bosh sahifa
   * 2 o'rniga 5 so'rov qilsa, chegara sezilarli darajada tezroq
   * tugaydi va sahifa «brend yo'q» bo'lib ochiladi.
   *
   * Shuning uchun server faqat BIRINCHI kartani boyitadi, qolganlari
   * foydalanuvchi o'sha kartaga o'tganda yuklanadi. Ko'rilmagan karta
   * uchun hech narsa to'lanmaydi.
   */
  const currentId = item?.id;
  useEffect(() => {
    if (!currentId || details[currentId] !== undefined) return;

    let cancelled = false;
    getProduct(currentId)
      .then((product) => {
        if (cancelled) return;
        setDetails((previous) => ({
          ...previous,
          [currentId]: {
            category: product.category?.name ?? null,
            colors: spotlightColors(product.variants),
          },
        }));
      })
      // Yiqilsa karta baribir chiziladi — kategoriya va ranglarsiz
      .catch(() => {
        if (!cancelled) setDetails((previous) => ({ ...previous, [currentId]: null }));
      });

    return () => {
      cancelled = true;
    };
  }, [currentId, details]);

  if (!item) return null;

  const move = (step: number): void =>
    setIndex((current) => (current + step + items.length) % items.length);

  return (
    <div className="relative" aria-roledescription="karusel" aria-label="Ommabop mahsulotlar">
      <article className="grid overflow-hidden rounded-card border border-border bg-surface md:grid-cols-[1.05fr_1fr]">
        {/* ── Chap: neon ramkadagi surat ── */}
        <div className="relative isolate flex min-h-[24rem] items-center justify-center p-8">
          {/*
            Fon — neon portal surati.

            ⚠️ ILGARI BU CSS EDI (ramka + nur) va tutunni `feTurbulence`
            bilan chizishga urinildi: kichik `viewBox` da hisoblangan
            shovqin karta kengligiga cho'zilganda mayda tuzilmasini
            yo'qotib, loyqa dog' bo'lib chiqdi. Haqiqiy tutun uchun
            rasm kerak — u shu sababdan bu yerda.

            ⚠️ PNG EMAS, WebP. Manba 1.75 MB edi; 1200px WebP 35 KB —
            ellik barobar kichik. PNG saqlanmaydi.

            ⚠️ `object-center`: manba 4:3, katak esa ~1.67:1. `cover`
            balandlikdan ~10% ni yuqoridan va pastdan kesadi, portal
            esa 12%–81% oralig'ida turadi — ya'ni tepa chizig'i ham,
            poldagi aks etish ham saqlanadi. Kesish nuqtasi
            o'zgartirilsa buni qayta tekshirish kerak.
          */}
          <img
            src="/img/portal-bg.webp"
            alt=""
            aria-hidden="true"
            /*
              ⚠️ `eager`, `lazy` EMAS. Fonsiz karta bo'm-bo'sh qora
              to'rtburchak bo'lib turadi — u bezak emas, bo'limning
              butun muhiti. 35 KB buni kutishga arzimaydi.
            */
            loading="eager"
            decoding="async"
            className="pointer-events-none absolute inset-0 size-full object-cover object-center"
          />

          {/*
            ⚠️ O'NG CHET SO'NADI. Rasm matn yarmiga tik chiziq bilan
            urilib, kartani ikkiga bo'lib tashlardi. Gradient uni
            kartaning foniga olib kiradi.
          */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(to right, transparent 78%, hsl(var(--surface)) 100%)',
            }}
          />

          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              loading="lazy"
              decoding="async"
              /*
                ⚠️ RASM PORTAL OG'ZIDAN CHIQMAYDI. Suratlar oq studiya
                fonida keladi (§4.2): kattalashtirilgan oq
                to'rtburchak portalni butunlay yopib qo'yadi va neon
                umuman ko'rinmay qoladi. `max-h` shuning uchun 74% —
                portal ichida, chetlarida nafas bilan.

                ⚠️ `brightness/contrast` — `ImageFrame` ning `calmWhite`
                rejimi bilan bir xil sabab: oq fon qorong'i sahifada
                ko'zni uradi.
              */
              className="relative z-10 max-h-[74%] w-auto max-w-[62%] rounded-sm object-contain brightness-[0.94] contrast-[0.97] drop-shadow-[0_18px_44px_rgba(0,0,0,0.7)]"
            />
          ) : (
            <span className="relative z-10 flex size-32 items-center justify-center rounded-full border border-borderStrong bg-surface2 text-dim">
              <Icon name="cart" size={34} />
            </span>
          )}

          {/* 3D belgisi — faqat kiyib ko'rish mumkin bo'lsa */}
          {item.canTryOn ? (
            <span className="absolute start-5 top-5 z-10 inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primarySoft px-3 py-1 text-tiny font-semibold text-brand backdrop-blur-md">
              <Icon name="tryon" size={12} />
              3D
            </span>
          ) : null}

          {item.isLimited ? (
            <span className="absolute end-5 top-5 z-10 inline-flex items-center gap-1.5 rounded-full border border-limited/50 bg-limited/15 px-3 py-1 text-tiny font-semibold text-limited backdrop-blur-md">
              <Icon name="limited" size={12} />
              Cheklangan
            </span>
          ) : null}
        </div>

        {/* ── O'ng: matn ── */}
        <div className="flex flex-col justify-center gap-5 p-8 sm:p-10">
          {detail?.category ? (
            <p className="text-small font-medium text-brand">{detail.category}</p>
          ) : null}

          <h3 className="text-h1 font-bold leading-tight">{item.title}</h3>

          <p className="flex items-center gap-2 text-body text-muted-foreground">
            {item.storeName}
            {/* Tasdiqlangan do'kon belgisi — matnning bir qismi emas, alohida ma'no */}
            <Icon name="premium" size={16} className="text-brand" />
          </p>

          <p className="flex items-baseline gap-3">
            <span className="text-h1 font-bold tabular-nums">{item.price}</span>
            {item.oldPrice ? (
              <span className="text-body tabular-nums text-dim line-through">{item.oldPrice}</span>
            ) : null}
          </p>

          {/*
            ⚠️ RANGLAR FAQAT IKKITADAN BOSHLAB. Bitta nuqta tanlov emas —
            u shunchaki shovqin bo'lib qoladi va «tanlash mumkin» degan
            noto'g'ri va'da beradi.
          */}
          {detail && detail.colors.length > 1 ? (
            <ul className="flex items-center gap-2.5">
              {detail.colors.map((color) => (
                <li key={color.hex}>
                  <span
                    className="block size-5 rounded-full border border-borderStrong"
                    style={{ backgroundColor: color.hex }}
                    title={color.name ?? undefined}
                  />
                  <span className="sr-only">{color.name ?? color.hex}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="pt-1">
            <Button asChild className="shadow-glow">
              <Link to={`/${locale}/p/${item.id}`}>
                Batafsil ko‘rish
                <span className="ms-1 flex size-6 items-center justify-center rounded-full bg-background/25">
                  <Icon name="openOut" size={14} />
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </article>

      {/* ── Almashtirgich ── */}
      {items.length > 1 ? (
        <div className="mt-5 flex items-center justify-end gap-3">
          <p className="me-1 text-small tabular-nums text-dim" aria-hidden="true">
            {index + 1} / {items.length}
          </p>
          {(
            [
              { step: -1, icon: 'back', label: 'Oldingi mahsulot' },
              { step: 1, icon: 'next', label: 'Keyingi mahsulot' },
            ] as const
          ).map((control) => (
            <button
              key={control.label}
              type="button"
              onClick={() => move(control.step)}
              aria-label={control.label}
              className="flex size-11 items-center justify-center rounded-full border border-borderStrong text-muted-foreground transition-colors duration-150 hover:border-borderAccent hover:bg-surface2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Icon name={control.icon} size={18} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
