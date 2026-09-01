import { Link } from 'react-router';

import { Icon } from '@looksave/ui-web';

import { Reveal } from '@/components/Reveal';
import type { Locale } from '@/i18n/locale';

/**
 * Kategoriya kartalari — deckning 07-slaydi, docs/15-sayt-dizayn.md §4.1.
 *
 * ⚠️ NOM KATTA HARFDA, LEKIN `text-transform` BILAN EMAS. Bu yerda
 * matn inglizcha yorliq sifatida yozilgan (`MEN`, `WOMEN`, `LIMITED`) —
 * deckdagidek. O'zbekcha nomlar katta harfda chiroyli chiqmaydi
 * (06-dizayn.md §3), shuning uchun tagida oddiy yozuvda tarjimasi turadi.
 *
 * ⚠️ `LIMITED` kartasi OLTIN urg'uda: oltin faqat cheklangan seriyada
 * ishlatiladi va shu sababli qadrini yo'qotmaydi (06-dizayn.md §2).
 */

interface Lane {
  key: string;
  label: string;
  caption: string;
  image: string;
  to: (locale: Locale) => string;
  limited?: boolean;
}

const LANES: Lane[] = [
  {
    key: 'men',
    label: 'MEN',
    caption: 'Erkaklar kolleksiyasi',
    image: '/img/collection-men.webp',
    to: (locale) => `/${locale}/catalog?gender=male`,
  },
  {
    key: 'women',
    label: 'WOMEN',
    caption: 'Ayollar kolleksiyasi',
    image: '/img/collection-women.webp',
    to: (locale) => `/${locale}/catalog?gender=female`,
  },
  {
    key: 'limited',
    label: 'LIMITED',
    caption: 'Cheklangan seriya',
    image: '/img/collection-limited.webp',
    to: (locale) => `/${locale}/catalog?limited=1`,
    limited: true,
  },
];

export function Categories({ locale }: { locale: Locale }): JSX.Element {
  return (
    <section className="shell-wide section-y">
      <Reveal>
        <div className="grid gap-4 md:grid-cols-3 xl:gap-6">
          {LANES.map((lane) => (
            <Link
              key={lane.key}
              to={lane.to(locale)}
              className="group relative isolate block overflow-hidden rounded-card border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="aspect-[4/5] md:aspect-[3/4]">
                <img
                  src={lane.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover transition-transform duration-300 ease-spring group-hover:scale-105"
                />
              </div>

              {/* Pastdan qorong'ilashuv — nom har qanday fotoda o'qiladi */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"
              />

              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                <span>
                  <span
                    className={
                      lane.limited
                        ? 'block text-h1 font-bold tracking-tight text-limited'
                        : 'block text-h1 font-bold tracking-tight text-foreground'
                    }
                  >
                    {lane.label}
                  </span>
                  <span className="mt-1 block text-small text-muted-foreground">
                    {lane.caption}
                  </span>
                </span>

                <span
                  className={
                    lane.limited
                      ? 'flex size-10 shrink-0 items-center justify-center rounded-full border border-limited/50 bg-limited/15 text-limited transition-transform duration-150 ease-spring group-hover:translate-x-0.5'
                      : 'flex size-10 shrink-0 items-center justify-center rounded-full border border-borderStrong bg-surface/80 text-foreground transition-transform duration-150 ease-spring group-hover:translate-x-0.5'
                  }
                >
                  <Icon name="next" size={18} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
