import { Link, data } from 'react-router';

import {
  BrandLogo,
  Button,
  ErrorView,
  hasBrandLogo,
  Icon,
  ProductCard,
  SectionHeader,
} from '@looksave/ui-web';

import { isNetworkError } from '@/api/client';
import {
  getBrands,
  getProduct,
  getProducts,
  type Brand,
  type ProductCard as Card,
} from '@/api/endpoints';
import { Reveal } from '@/components/Reveal';
import { guest } from '@/session.server';
import { Categories } from '@/sections/Categories';
import { Hero } from '@/sections/Hero';
import {
  Spotlight,
  spotlightColors,
  type SpotlightDetail,
  type SpotlightItem,
} from '@/sections/Spotlight';
import { HowItWorks } from '@/sections/HowItWorks';
import { Stores } from '@/sections/Stores';
import { TrustBar } from '@/sections/TrustBar';
import { Waitlist } from '@/sections/Waitlist';
import { isLocale, type Locale } from '@/i18n/locale';
import { money } from '@/lib/format';

import type { Route } from './+types/home';

/**
 * Bosh sahifa — docs/15-sayt-dizayn.md §4.1.
 *
 * Marketing bloklari (hero, muammo, qanday ishlaydi, kiyintirish) joyida
 * qoladi, lekin ular orasiga HAQIQIY ma'lumot qo'shildi: brendlar qatori
 * va «TRENDING NOW» to'ri API dan keladi.
 *
 * ⚠️ Bo'sh ro"yxatda 'Empty' KO"RSATILMAYDI — blok butunlay chizilmaydi.
 * Bosh sahifada «hech narsa topilmadi» degan quti sayt buzuqdek
 * ko'rsatadi (15-sayt-dizayn.md §4.1).
 *
 * ⚠️ LEKIN BO'SH ≠ YIQILGAN (§1.7). Ilgari ikkala holat ham
 * `.catch(() => [])` bilan bir xil ko'rinardi: API `RATE_LIMITED`
 * qaytarsa sahifa «brend yo'q» deb ochilardi va nosozlik hech qayerda
 * ko'rinmasdi — aynan shu jimlik S-4 ni topishni kechiktirdi. Endi
 * loader XATO va BO'SHLIKNI ajratadi: xatoda bo'lim sarlavhasi bilan
 * «qayta urinish» chiziladi, bo'shlikda esa avvalgidek hech narsa.
 */
export function meta(): Route.MetaDescriptors {
  return [
    { title: "LookSave — o'zingizda ko'ring, keyin oling" },
    {
      name: 'description',
      content:
        "AI fashion marketplace: bitta surat bilan shaxsiy avatar, 3D da kiyib ko'rish va o'lchamiga ishonch bilan xarid.",
    },
  ];
}

/**
 * Bo'lim natijasi: kelgan ma'lumot YOKI nosozlik sababi.
 *
 * ⚠️ `items: []` O'ZI YETARLI EMAS. Bo'sh ro'yxat va yiqilgan so'rov
 * bir xil ko'rinsa, sayt nosozlikni «hali mahsulot yo'q» deb
 * ko'rsatadi va xato hech qayerda qayd etilmaydi (§1.7).
 */
type Section<T> =
  { items: T[]; error: null; network: false } | { items: T[]; error: string; network: boolean };

function loaded<T>(items: T[]): Section<T> {
  return { items, error: null, network: false };
}

function failed<T>(error: unknown, fallback: string): Section<T> {
  return {
    items: [],
    /*
     * ⚠️ XABAR API DAN OLINADI. `RATE_LIMITED` da server «Juda ko'p
     * so'rov, biroz kuting» deydi — bu «nimadir noto'g'ri» dan
     * foydaliroq: odam kutish kerakligini biladi.
     */
    error: error instanceof Error ? error.message : fallback,
    network: isNetworkError(error),
  };
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const options = guest(request, locale);

  /*
   * Ikkalasi ham yiqilmaydi: brendlar kelmasa ham bosh sahifa
   * to'liq ishlaydi. Lekin endi yiqilgani BILINADI —
   * `.catch(() => [])` xatoni bo'sh ro'yxatga aylantirib yubordi.
   */
  const [trending, brands] = await Promise.all([
    getProducts({ sort: 'popular', limit: 8 }, options)
      .then((page) => loaded(page.items))
      .catch((error): Section<Card> => failed(error, 'Mahsulotlar yuklanmadi')),
    getBrands(options)
      .then(loaded)
      .catch((error): Section<Brand> => failed(error, 'Brendlar yuklanmadi')),
  ]);

  const spotlight: SpotlightItem[] = trending.items.slice(0, 3).map((product) => ({
    id: product.id,
    title: product.title,
    storeName: product.store.name,
    price: money(product.price, product.currency),
    oldPrice: product.oldPrice ? money(product.oldPrice, product.currency) : null,
    image: product.image,
    canTryOn: product.canTryOn,
    isLimited: product.isLimited,
  }));

  /*
   * ⚠️ FAQAT BIRINCHI KARTA SERVERDA BOYITILADI.
   *
   * Kategoriya va ranglar ro'yxat endpointida yo'q. Uchtasini ham
   * serverda so'rasak, bosh sahifa 2 emas, 5 so'rov qiladi — anonim
   * chegara esa daqiqasiga 30 (03-api-spec §4) va SSR'da u BARCHA
   * mehmonga bitta. Qolgan kartalar foydalanuvchi ularga o'tganda
   * brauzerda yuklanadi (`Spotlight` ichida).
   */
  const first = spotlight[0];
  const firstDetail = first ? await getProduct(first.id, options).catch(() => null) : null;
  const details: Record<string, SpotlightDetail> =
    first && firstDetail
      ? {
          [first.id]: {
            category: firstDetail.category?.name ?? null,
            colors: spotlightColors(firstDetail.variants),
          },
        }
      : {};

  return data({ locale: locale as Locale, trending, brands, spotlight, details });
}

/**
 * Bo'lim yuklanmaganda — sarlavha ostidagi ixcham xato.
 *
 * ⚠️ SAHIFA YIQILMAYDI. Bosh sahifaning ko'p qismi marketing va u
 * API'ga bog'liq emas; bitta bo'lim kelmagani uchun butun sahifani
 * xato bilan almashtirish odamni saytdan quvadi (§1.7). Shuning uchun
 * xato faqat O'SHA bo'lim o'rnida turadi.
 *
 * ⚠️ TARMOQ XATOSI AJRATILADI: internet yo'q bo'lsa «qayta urinish»
 * hech qachon ishlamaydi va uni ko'rsatish aldash bo'ladi
 * (`packages/ui-web/src/states.tsx`).
 */
function SectionError({ section }: { section: Section<unknown> }): JSX.Element {
  return (
    <ErrorView
      className="py-10"
      message={
        section.network
          ? "Tarmoqqa ulanib bo'lmadi. Ulanishni tekshiring."
          : (section.error ?? 'Yuklanmadi')
      }
      variant={section.network ? 'network' : 'generic'}
      action={
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Qayta urinish
        </Button>
      }
    />
  );
}

export default function Home({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, trending, brands, spotlight, details } = loaderData;

  return (
    <>
      <Hero locale={locale} />

      {/* Ishonch qatori — hero ostida, TOP BRANDS ustida (maketdagi tartib) */}
      <div className="-mt-4 pb-4">
        <TrustBar />
      </div>

      {brands.error ? (
        <section className="shell-wide pb-[clamp(4rem,8vw,7rem)] pt-10">
          <SectionHeader title="TOP BRANDS" />
          <SectionError section={brands} />
        </section>
      ) : brands.items.length > 0 ? (
        /*
          ⚠️ `shell-wide`, `shell` EMAS. Ishonch qatori `shell-wide`
          (1440px) da, bu blok esa `shell` (1152px) da edi — ikki panel
          maketda tekislangan bo'lsa ham saytda chetlari mos kelmasdi.
        */
        <section className="shell-wide pb-[clamp(4rem,8vw,7rem)] pt-10">
          <Reveal>
            {/*
              ⚠️ BLOK O'Z PANELIDA TURADI (maket). Ilgari kafellar
              to'g'ridan-to'g'ri sahifa fonida edi va bo'lim qayerda
              boshlanib qayerda tugashi bilinmasdi — yettita quti
              havoda osilib turardi. Panel ularni bitta narsaga
              bog'laydi.
            */}
            <div className="edge-beam edge-beam-2 rounded-card border border-border bg-panel/75 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:p-9">
              <SectionHeader
                title="TOP BRANDS"
                action={{ label: 'hammasi', href: `/${locale}/catalog` }}
              />

              {/*
                ⚠️ KAFEL ICHIDA FAQAT LOGOTIP VA NOM — MONOGRAMMA YO'Q.
                Ilgari monogramma logotip ustida turardi va ikkalasi
                bir-birini bosardi: brend belgisi kichrayib, kafel esa
                tipografik blokka o'xshab qolardi. Endi logotip butun
                e'tiborni oladi, nom esa uni tasdiqlaydi.

                Tartib: `logoUrl` (do'kon panelidan) → `BrandLogo`
                (mahalliy zaxira) → neytral yorliq belgisi. Bosh
                harflar kerak emas — nom kafel ichida turibdi.
              */}
              <ul className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7 xl:gap-4">
                {brands.items.map((brand) => (
                  <li key={brand.id}>
                    <Link
                      to={`/${locale}/catalog?brand=${brand.id}`}
                      className="group relative flex h-[9.875rem] flex-col items-center justify-center gap-5 overflow-hidden rounded-card border border-primary/25 bg-[linear-gradient(180deg,hsl(var(--primary)/0.09),hsl(var(--panel)/0.9))] px-3 py-5 transition-colors duration-200 hover:border-primary/45 hover:bg-[linear-gradient(180deg,hsl(var(--primary)/0.17),hsl(var(--panel)/0.92))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt=""
                          className="h-[46px] max-w-[78%] object-contain"
                        />
                      ) : hasBrandLogo(brand.slug) ? (
                        <BrandLogo
                          slug={brand.slug}
                          size={46}
                          className="max-w-[78%] text-foreground"
                        />
                      ) : (
                        <Icon name="tag" size={40} className="text-foreground" />
                      )}

                      {/*
                        ⚠️ BU YERDA `uppercase` MUMKIN, sarlavhalarda esa
                        yo'q (06-dizayn.md §3). Farqi: brend nomi — atoqli
                        ot va deyarli doim lotin yozuvida, ya'ni katta
                        harf uni buzmaydi. O'zbekcha sarlavhada esa
                        `Ko'ylak` → `KO'YLAK` bo'lib xunuklashadi.
                      */}
                      <span className="text-center text-small font-medium uppercase tracking-wide text-foreground">
                        {brand.name}
                      </span>

                      {/*
                        ⚠️ PASTDAGI NUR — KAFELNING IMZOSI (maket).
                        Ikki qatlam: keng xira dog' issiqlik beradi,
                        ustidagi 1px chiziq esa unga aniqlik qo'shadi.
                        Bittasi yolg'iz qolsa effekt yo goh loyqa, yo
                        goh quruq chiqadi.
                      */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-[22%] -bottom-[7px] h-3 rounded-full bg-primary opacity-85 blur-[7px] transition-opacity duration-200 group-hover:opacity-100"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-[30%] bottom-0 h-px bg-primary opacity-85 transition-opacity duration-200 group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>
      ) : null}

      {trending.error ? (
        <section className="shell-wide pb-[clamp(4rem,8vw,7rem)] pt-10">
          <SectionHeader title="TRENDING NOW" />
          <SectionError section={trending} />
        </section>
      ) : trending.items.length > 0 ? (
        <section className="shell-wide pb-[clamp(4rem,8vw,7rem)] pt-10">
          <Reveal>
            <SectionHeader
              title="TRENDING NOW"
              action={{ label: 'hammasi', href: `/${locale}/catalog?sort=popular` }}
            />

            {/*
              ⚠️ SPOTLIGHT TO'RNI ALMASHTIRMAYDI, USTIGA QO'SHILADI.
              Katta karta ko'zni tortadi, to'r esa «yana bor» degan
              ma'noni beradi. Faqat spotlight qolsa blok ikkita
              mahsulotdan iborat bo'lib ko'rinardi.
            */}
            <div className="mt-6">
              <Spotlight items={spotlight} details={details} locale={locale} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:gap-6">
              {trending.items.map((product) => (
                <ProductCard
                  key={product.id}
                  title={product.title}
                  price={money(product.price, product.currency)}
                  oldPrice={product.oldPrice ? money(product.oldPrice, product.currency) : null}
                  image={product.image}
                  storeName={product.store.name}
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
          </Reveal>
        </section>
      ) : null}

      <Categories locale={locale} />
      <HowItWorks />
      <Stores />
      <Waitlist />
    </>
  );
}
