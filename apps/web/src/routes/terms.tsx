import type { JSX } from 'react';

import { rich } from '@/components/RichText';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale';
import { TERMS_COPY } from '@/i18n/terms';

import type { Route } from './+types/terms';

/**
 * Foydalanish shartlari.
 *
 * ⚠️ ASOSIY BAND: LookSave sotuvchi EMAS (00-README K-10). Buyurtma —
 * do'konga yuborilgan so'rov, shartnoma esa xaridor bilan do'kon
 * o'rtasida tuziladi. Bu yozilmasa mas'uliyat chegarasi noaniq qoladi.
 *
 * ⚠️ MATN BU FAYLDA EMAS — `i18n/terms.ts` da, to'rt tilda. Ilgari u shu
 * yerda o'zbekcha qattiq yozilgan edi va `/en/terms` ham o'zbekcha
 * chiqardi; ilova esa aynan shu sahifani ochadi (Profil → «Foydalanish
 * shartlari»). Bu fayl faqat chizadi.
 *
 * ⚠️ YURIDIK KO'RIB CHIQISHDAN O'TMAGAN.
 */

/**
 * ⚠️ QAYTISH TURI ANIQ YOZILGAN. `isLocale(x) ? x : 'en'` ni obyekt
 * ichiga to'g'ridan-to'g'ri qo'ysak, TypeScript `'en'` ni `string` ga
 * kengaytiradi va `TERMS_COPY[locale]` indekslanmay qoladi.
 */
function localeOf(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function meta({ params }: Route.MetaArgs): Route.MetaDescriptors {
  const { title, description } = TERMS_COPY[localeOf(params.locale)].meta;
  return [{ title }, { name: 'description', content: description }];
}

export function loader({ params }: Route.LoaderArgs) {
  return { locale: localeOf(params.locale) };
}

/*
 * ⚠️ RANGLAR: `text-foreground` / `text-muted-foreground` EMAS.
 *
 * Sayt oq fonga o'tgan (`index.css`: body `#fff`), `--foreground` tokeni
 * esa hali OQ. Ilgari bu sahifada bo'lim sarlavhalari va qalin matn aynan
 * shu sinfda edi va oq fonda UMUMAN KO'RINMASDI; asosiy matn esa
 * `#9B96AE` edi (kontrast ~2.8:1).
 *
 * `routes/privacy.tsx` dagi juftlik: `#171323` — sarlavha va urg'u,
 * `#6b5f79` — asosiy matn (kontrast ~5.9:1).
 */
export default function Terms({ loaderData }: Route.ComponentProps): JSX.Element {
  const copy = TERMS_COPY[loaderData.locale];

  return (
    <article className="shell max-w-3xl py-12">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="mt-4 text-h1 font-bold text-[#171323]">{copy.title}</h1>
      <p className="mt-3 text-small text-dim">{copy.updated}</p>

      <div className="mt-10 flex flex-col gap-8 text-body leading-[1.7] text-[#6b5f79]">
        <p>{copy.lead}</p>

        {copy.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-h2 font-semibold text-[#171323]">{section.title}</h2>
            {section.blocks.map((block, index) => (
              <p key={index} className="mt-3">
                {rich(block)}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
