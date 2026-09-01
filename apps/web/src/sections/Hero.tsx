import { Link } from 'react-router';

import { Button, Icon, type IconName } from '@looksave/ui-web';

import { Reveal } from '@/components/Reveal';
import type { Locale } from '@/i18n/locale';

/**
 * Bosh sahifa hero — docs/15-sayt-dizayn.md §4.1.
 *
 * ⚠️ RASM QUTI EMAS. U sahifaning o'ng chetigacha boradi va chap
 * tomoni niqob bilan so'nadi — ya'ni fonga qo'shilib ketadi. Ilgari u
 * konteyner ichida turardi va o'zining qora fonli to'rtburchagi
 * ko'rinib, «yopishtirilgan rasm» bo'lib qolardi.
 *
 * ⚠️ RASM MANBADAN KESILGAN: tashqi ramka, pastdagi «100% Xavfsiz va
 * ishonchli» chipi va generator qoldirgan «ulashish» ikonkasi olib
 * tashlangan. Birinchisi qutini yasardi, ikkinchisi pastdagi panelda
 * takrorlanardi.
 */

const STATS: Array<{ value: string; label: string; icon: IconName }> = [
  { value: '1 000+', label: 'Premium mahsulotlar', icon: 'premium' },
  { value: '360°', label: "3D ko'rish va aylantirish", icon: 'rotate' },
  { value: '100%', label: 'Xavfsiz va ishonchli', icon: 'authentic' },
];

export function Hero({ locale }: { locale: Locale }): JSX.Element {
  return (
    <section id="top" className="relative isolate overflow-hidden">
      {/* ── Kompozitsiya: sahifa chetigacha ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-0 -z-10 flex w-full items-center pb-32 lg:w-[66%] xl:w-[62%]"
      >
        <div className="relative w-full">
          <img
            src="/img/hero-visual.webp"
            alt=""
            width={1340}
            height={857}
            loading="eager"
            decoding="async"
            // React 18 `fetchPriority` ni tanimaydi — DOM atributi kichik harfda
            {...{ fetchpriority: 'high' }}
            /*
              ⚠️ `object-contain`, `cover` EMAS.
              Manba 1.56:1, slot esa deyarli kvadrat. `cover` uni yon
              tomonlaridan qattiq kesib, kartani ekranga sig'maydigan
              darajada kattalashtirardi. Bu tayyor kompozitsiya — u
              to'liq ko'rinishi kerak.
            */
            className="h-auto w-full select-none object-contain"
          />

          {/*
            ⚠️ CHETLARNI FON RANGIDA SO'NDIRISH.

            Rasm sof qora fonda chizilgan, sahifa foni esa `#0A0A0F` —
            binafsha tusli. Farq kichik, lekin rasmning to'rtburchagi
            aynan shundan ko'rinib turadi: tepa, past va chapda tik
            chiziq paydo bo'ladi.

            Sinalgan va ishlamagan yo'llar:
              `mask-composite` bilan ikki qatlam — brauzer prefiksli va
              prefiksiz kalit so'zlarni aralashtirganda ikkalasini ham
              e'tiborsiz qoldiradi;
              bitta radial niqob — `object-contain` rasmni o'rtaga
              joylashtirgani uchun niqob chegarasi rasm chetiga to'g'ri
              kelmaydi (konteyner balandroq).

            Bu yerda esa gradientlar RASMNING O'ZI ustida turadi va
            markazi shaffof — karta xiralashmaydi, faqat chetlar fonga
            singib ketadi.
          */}
          <div
            className="absolute inset-0"
            style={{
              background: [
                'linear-gradient(to right, hsl(var(--background)) 0%, transparent 24%)',
                'linear-gradient(to bottom, hsl(var(--background)) 0%, transparent 14%)',
                'linear-gradient(to top, hsl(var(--background)) 0%, transparent 14%)',
              ].join(','),
            }}
          />
        </div>
      </div>

      <div className="shell-wide flex min-h-[min(94vh,56rem)] flex-col justify-center py-28">
        <div className="max-w-3xl">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primarySoft px-3 py-1 text-tiny font-medium text-brand">
              <Icon name="logo" size={13} />
              AI fashion marketplace · Dubay va Toshkent
            </p>
          </Reveal>

          <Reveal delay={80}>
            {/*
              ⚠️ «Oling.» URG'U BILAN — `.headline-accent` (§1.8).
              Har bo'lim sarlavhasi fe'l bilan tugaydi va urg'u aynan
              shu so'zga tushadi; bu yerda u butun sahifaning maqsadi.
            */}
            <h1 className="mt-7 text-balance text-display font-bold">
              Ko'ring.
              <br />
              Kiying. <span className="headline-accent">Oling.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-[44ch] text-lead leading-relaxed text-muted-foreground">
              Bitta surat — shaxsiy avataringiz. Kiyimni unda 3D da kiyib ko'ring, aylantiring, o'z
              o'lchovingizga solishtiring. Keyin yaqin atrofdagi do'kondan buyurtma bering.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild className="shadow-glow">
                <Link to={`/${locale}/catalog`}>
                  Katalogni ochish
                  {/* O'q doira ichida — harakat yo'nalishini bildiradi */}
                  <span className="ms-1 flex size-6 items-center justify-center rounded-full bg-background/25">
                    <Icon name="next" size={14} />
                  </span>
                </Link>
              </Button>

              <Button asChild variant="ghost">
                <Link to={`/${locale}/try-on`}>
                  <Icon name="profile" size={18} />
                  Kiyib ko'rish
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={320}>
            {/*
              ⚠️ `backdrop-blur` RASM USTIDA ishlaydi: panel hero
              kompozitsiyasiga tushadi va uni xiralashtiradi, shuning
              uchun raqamlar har qanday kadrda o'qiladi. Alohida to'q
              fon qo'yilsa panel «yopishtirilgan» bo'lib ko'rinardi.
            */}
            <dl className="mt-16 flex max-w-3xl flex-col gap-px overflow-hidden rounded-card border border-borderStrong bg-border/60 backdrop-blur-xl sm:flex-row">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-1 items-center gap-3.5 bg-panel/80 px-5 py-4"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-borderAccent/40 bg-primarySoft text-brand">
                    <Icon name={stat.icon} size={20} />
                  </span>

                  <span className="min-w-0">
                    <dt className="text-h3 font-bold tabular-nums leading-tight">{stat.value}</dt>
                    <dd className="mt-0.5 text-small leading-snug text-dim">{stat.label}</dd>
                  </span>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
