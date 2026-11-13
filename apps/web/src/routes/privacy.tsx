import type { JSX, ReactNode } from 'react';

import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale';
import { PRIVACY_COPY, PRIVACY_EMAIL, type PrivacyBlock } from '@/i18n/privacy';

import type { Route } from './+types/privacy';

/**
 * Maxfiylik siyosati — docs/13-sayt.md §14, 10-roadmap §4 bo'yicha
 * 18-haftaga MAJBURIY (App Store talabi).
 *
 * ⚠️ YUZ SURATI BANDI ENG MUHIMI (K-08a, 12-tz.md D-42): surat
 * qurilmadan chiqadi va tashqi provayderga ketadi. Buni yashirish —
 * ham huquqiy xavf, ham ishonchni yo'qotish.
 *
 * ⚠️ MATN BU FAYLDA EMAS — `i18n/privacy.ts` da, to'rt tilda. Ilgari u
 * shu yerda o'zbekcha qattiq yozilgan edi va `/en/privacy` ham o'zbekcha
 * chiqardi; bu esa App Store Connect'dagi «Privacy Policy URL» — Apple
 * ko'rib chiquvchisi aynan shu manzilni ochadi. Bu fayl faqat chizadi.
 *
 * ⚠️ BU MATN YURIDIK KO'RIB CHIQISHDAN O'TMAGAN. Ishga tushirishdan
 * oldin yurist tekshirishi shart — u yerda faqat texnik haqiqat
 * yozilgan.
 */

/**
 * ⚠️ QAYTISH TURI ANIQ YOZILGAN. `isLocale(x) ? x : 'en'` ni obyekt
 * ichiga to'g'ridan-to'g'ri qo'ysak, TypeScript `'en'` ni `string` ga
 * kengaytiradi va `PRIVACY_COPY[locale]` indekslanmay qoladi.
 */
function localeOf(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function meta({ params }: Route.MetaArgs): Route.MetaDescriptors {
  const { title, description } = PRIVACY_COPY[localeOf(params.locale)].meta;
  return [{ title }, { name: 'description', content: description }];
}

export function loader({ params }: Route.LoaderArgs) {
  return { locale: localeOf(params.locale) };
}

/*
 * ⚠️ RANGLAR: `text-foreground` / `text-muted-foreground` EMAS.
 *
 * Sayt oq fonga o'tgan (`index.css`: body `#fff`, matn `#171323`),
 * `--foreground` tokeni esa hali OQ. Ilgari bu sahifada sarlavhalar va
 * qalin matn aynan shu sinfda edi va oq fonda UMUMAN KO'RINMASDI — shu
 * jumladan «surat tashqi AI xizmatiga ketadi» degan eng muhim jumla ham
 * (jonli saytda 2026-11-12 da tekshirilgan). Asosiy matn esa `#9B96AE`
 * edi: oq fonda kontrast ~2.8:1, o'qish qiyin.
 *
 * Bu yerda yangi oq sahifalardagi juftlik ishlatiladi (`routes/stores.tsx`):
 * `#171323` — sarlavha va urg'u, `#6b5f79` — asosiy matn (kontrast ~5.9:1).
 */

/**
 * `**…**` → `<strong>`. Toq o'rindagi bo'laklar ajratib ko'rsatiladi.
 *
 * ⚠️ HTML EMAS, ATAYIN. Tarjima satrlarini `dangerouslySetInnerHTML`
 * bilan chizish har tarjimani XSS manbaiga aylantirardi; bu yerda esa
 * matn doim matn bo'lib qoladi.
 */
function rich(text: string): ReactNode[] {
  return text.split('**').map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="text-[#171323]">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function Block({ block }: { block: PrivacyBlock }): JSX.Element {
  if (typeof block === 'string') {
    return <p className="mt-3">{rich(block)}</p>;
  }

  /* `ps-6` — mantiqiy chekinish: arabchada belgi o'ng tomonda turadi. */
  return (
    <ul className="mt-3 flex list-disc flex-col gap-2 ps-6">
      {block.list.map((item) => (
        <li key={item}>{rich(item)}</li>
      ))}
    </ul>
  );
}

export default function Privacy({ loaderData }: Route.ComponentProps): JSX.Element {
  const copy = PRIVACY_COPY[loaderData.locale];

  return (
    <article className="shell max-w-3xl py-12">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="mt-4 text-h1 font-bold">{copy.title}</h1>
      <p className="mt-3 text-small text-dim">{copy.updated}</p>

      <div className="mt-10 flex flex-col gap-8 text-body leading-[1.7] text-[#6b5f79]">
        <p>{copy.lead}</p>

        {copy.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-h2 font-semibold text-[#171323]">{section.title}</h2>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </section>
        ))}

        <section>
          <h2 className="text-h2 font-semibold text-[#171323]">{copy.contact.title}</h2>
          {/* `dir="ltr"` — arabcha matn ichida manzil teskari chizilmasin */}
          <p className="mt-3">
            {copy.contact.text}{' '}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              dir="ltr"
              className="text-[#171323] underline underline-offset-4 hover:text-brand"
            >
              {PRIVACY_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
