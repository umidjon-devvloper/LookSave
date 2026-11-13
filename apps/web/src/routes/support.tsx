import type { JSX, ReactNode } from 'react';
import { Link } from 'react-router';

import { rich } from '@/components/RichText';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale';
import {
  STORE_PANEL_LABEL,
  STORE_PANEL_URL,
  SUPPORT_COPY,
  SUPPORT_EMAIL,
  TELEGRAM_HANDLE,
  TELEGRAM_URL,
} from '@/i18n/support';

import type { Route } from './+types/support';

/**
 * Yordam markazi — App Store Connect uchun MAJBURIY sahifa (Support URL).
 *
 * ⚠️ NEGA KERAK. App Store submission'da har ilova qat'iyan
 * «Support URL» so'raydi: ochilganda foydalanuvchi kim bilan bog'lanish
 * va qanday muammoni qanday hal qilishni ko'ra oladigan sahifa. Uning
 * yo'qligi tekshirish (App Review) da rad javob (Guideline 1.5) beradi.
 *
 * ⚠️ HISOB O'CHIRISH BANDI ALOHIDA. Bu ham App Store shartida
 * (Guideline 5.1.1(v), 2022-yildan majburiy): agar ilova hisob yaratsa,
 * uni bevosita ilovaning o'zidan o'chirish yo'li KO'RSATILISHI kerak.
 * Foydalanuvchi ilovada, biz esa shu yerda uning qadamlarini takrorlab
 * beramiz — Review guruhi ekranni ochib topa oladi.
 *
 * ⚠️ MATN BU FAYLDA EMAS — `i18n/support.ts` da, to'rt tilda. Ilgari u
 * shu yerda o'zbekcha qattiq yozilgan edi (`/en/support` ham o'zbekcha
 * chiqardi) va kodga zid da'volari bor edi — ro'yxati o'sha faylning
 * boshida. Bu fayl faqat chizadi.
 */

/**
 * ⚠️ QAYTISH TURI ANIQ YOZILGAN. `isLocale(x) ? x : 'en'` ni obyekt
 * ichiga to'g'ridan-to'g'ri qo'ysak, TypeScript `'en'` ni `string` ga
 * kengaytiradi va `SUPPORT_COPY[locale]` indekslanmay qoladi.
 */
function localeOf(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function meta({ params }: Route.MetaArgs): Route.MetaDescriptors {
  const { title, description } = SUPPORT_COPY[localeOf(params.locale)].meta;
  return [{ title }, { name: 'description', content: description }];
}

export function loader({ params }: Route.LoaderArgs) {
  return { locale: localeOf(params.locale) };
}

/*
 * ⚠️ RANGLAR: `text-foreground` / `text-muted-foreground` EMAS.
 *
 * Sayt oq fonga o'tgan (`index.css`: body `#fff`), `--foreground` tokeni
 * esa hali OQ. Ilgari bu sahifada sarlavhalar, savollar va BARCHA
 * HAVOLALAR (pochta, Telegram, sotuvchi kabineti) aynan shu sinfda edi va
 * oq fonda UMUMAN KO'RINMASDI — ya'ni «yordam» sahifasida bog'lanish
 * manzilining o'zi yo'q edi.
 *
 * `routes/privacy.tsx` dagi juftlik: `#171323` — sarlavha, urg'u va
 * havola, `#6b5f79` — asosiy matn (kontrast ~5.9:1).
 */
const HEADING = 'text-h2 font-semibold text-[#171323]';
const LINK = 'text-[#171323] underline underline-offset-4 hover:text-brand';

/**
 * Pochta havolasi.
 *
 * `dir="ltr"` — arabcha matn ichida manzil teskari chizilmasin
 * (Telegram nomi va sayt manzili uchun ham shu).
 */
function mailLink(subject?: string): JSX.Element {
  const href =
    subject === undefined
      ? `mailto:${SUPPORT_EMAIL}`
      : `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

  return (
    <a href={href} dir="ltr" className={LINK}>
      {SUPPORT_EMAIL}
    </a>
  );
}

export default function Support({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale } = loaderData;
  const copy = SUPPORT_COPY[locale];

  const telegramLink = (
    <a href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener" dir="ltr" className={LINK}>
      {TELEGRAM_HANDLE}
    </a>
  );

  const storeLink = (
    <a href={STORE_PANEL_URL} target="_blank" rel="noreferrer noopener" dir="ltr" className={LINK}>
      {STORE_PANEL_LABEL}
    </a>
  );

  /*
   * ⚠️ TO'LIQ YO'L, `href="privacy"` EMAS. Nisbiy havola `/uz/support/`
   * (oxirida chiziq bilan) ochilganda `/uz/support/privacy` ga — ya'ni
   * 404 ga — olib borardi.
   */
  const privacyLink: ReactNode = (
    <Link to={`/${locale}/privacy`} className={LINK}>
      {copy.privacyLink}
    </Link>
  );

  return (
    <article className="shell max-w-3xl py-12">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="mt-4 text-h1 font-bold text-[#171323]">{copy.title}</h1>
      <p className="mt-3 text-small text-dim">{copy.lead}</p>

      <div className="mt-10 flex flex-col gap-8 text-body leading-[1.7] text-[#6b5f79]">
        <section>
          <h2 className={HEADING}>{copy.contact.title}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li>{rich(copy.contact.email, { email: mailLink() })}</li>
            <li>{rich(copy.contact.telegram, { telegram: telegramLink })}</li>
            <li>{copy.contact.hours}</li>
          </ul>
        </section>

        <section>
          <h2 className={HEADING}>{copy.faq.title}</h2>

          <div className="mt-4 flex flex-col gap-6">
            {copy.faq.items.map((item) => (
              <div key={item.question}>
                <h3 className="text-body font-semibold text-[#171323]">{item.question}</h3>
                <p className="mt-1.5">{rich(item.answer, { privacy: privacyLink })}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className={HEADING}>{copy.deletion.title}</h2>
          <p className="mt-3">{copy.deletion.intro}</p>
          {/* `ps-6` — mantiqiy chekinish: arabchada raqam o'ng tomonda turadi */}
          <ol className="mt-4 flex list-decimal flex-col gap-2 ps-6">
            {copy.deletion.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {copy.deletion.after.map((paragraph, index) => (
            <p key={index} className="mt-4">
              {rich(paragraph)}
            </p>
          ))}
          <p className="mt-4">
            {rich(copy.deletion.noAccess, { email: mailLink(copy.deletion.mailSubject) })}
          </p>
        </section>

        <section>
          <h2 className={HEADING}>{copy.stores.title}</h2>
          <p className="mt-3">
            {rich(copy.stores.text, {
              store: storeLink,
              email: mailLink(copy.stores.mailSubject),
            })}
          </p>
        </section>
      </div>
    </article>
  );
}
