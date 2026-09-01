import { Link } from 'react-router';

import { Icon, SocialLogo, type IconName } from '@looksave/ui-web';

import { FooterMesh } from '@/components/FooterMesh';
import type { Locale } from '@/i18n/locale';

/**
 * Futer — docs/15-sayt-dizayn.md §3.2.
 *
 * ⚠️ CHIZIQ EMAS, PANEL. Ilgari u butun kenglikdagi `bg-panel` bo'lagi
 * edi va sahifadan «kesib olingan» tasma bo'lib turardi. Yumaloq panel
 * esa yuqoridagi bo'limlar bilan bir tilda gapiradi (shapka ham
 * shunday).
 *
 * ⚠️ Oq futer — 06-dizayn.md §2 bo'yicha taqiqlangan.
 */

/*
 * ⚠️ IJTIMOIY MANZILLAR TEKSHIRILMAGAN. Ular TAXMIN qilingan —
 * haqiqiy hisoblar tasdiqlanmagan. Sayt hali joylashtirilmagan
 * (13-sayt.md, deploy ochiq), shuning uchun hozircha hech kimga
 * zarari yo'q; LEKIN e'lon qilishdan oldin har biri ochib
 * tekshirilishi shart. Noto'g'ri manzil odamni begona hisobga olib
 * boradi — bu havolasizlikdan yomonroq.
 */
const SOCIAL: Array<{ name: string; label: string; href: string }> = [
  { name: 'instagram', label: 'Instagram', href: 'https://instagram.com/looksave' },
  { name: 'telegram', label: 'Telegram', href: 'https://t.me/looksave' },
  { name: 'tiktok', label: 'TikTok', href: 'https://tiktok.com/@looksave' },
  { name: 'youtube', label: 'YouTube', href: 'https://youtube.com/@looksave' },
];

export function Footer({ locale }: { locale: Locale }): JSX.Element {
  const groups: Array<{
    title: string;
    icon: IconName;
    links: Array<{ to: string; label: string; external?: boolean }>;
  }> = [
    {
      title: 'Xaridorlar uchun',
      icon: 'orders',
      links: [
        { to: `/${locale}/catalog`, label: 'Katalog' },
        { to: `/${locale}/stores`, label: "Do'konlar" },
        { to: `/${locale}/try-on`, label: 'Kiyintirish' },
        { to: `/${locale}/orders`, label: 'Buyurtmalarim' },
      ],
    },
    {
      title: "Do'konlar uchun",
      icon: 'cart',
      links: [
        { to: 'https://store.looksave.app', label: 'Sotuvchi kabineti', external: true },
        { to: 'https://store.looksave.app/apply', label: "Do'kon ochish", external: true },
      ],
    },
    {
      title: 'Huquqiy',
      icon: 'authentic',
      links: [
        { to: `/${locale}/privacy`, label: 'Maxfiylik siyosati' },
        { to: `/${locale}/terms`, label: 'Foydalanish shartlari' },
      ],
    },
  ];

  return (
    <footer className="shell-wide mb-6 mt-24">
      <div className="relative overflow-hidden rounded-[24px] border border-primary/20 bg-[linear-gradient(180deg,hsl(var(--surface)/0.9),hsl(var(--panel)/0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <FooterMesh className="pointer-events-none absolute bottom-0 start-0 h-[200px] w-full opacity-20 sm:h-[260px] sm:w-[560px] sm:opacity-[0.28]" />

        <div className="relative flex flex-col gap-9 p-7 sm:p-9 lg:flex-row lg:items-stretch lg:gap-0 lg:p-[52px_56px_48px]">
          {/* ── Brend ── */}
          <div className="flex flex-col items-start gap-6 lg:shrink-0 lg:grow-[1.35] lg:basis-0 lg:pe-14">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-4 sm:gap-[18px]">
                <img
                  src="/img/logo-mark.png"
                  alt=""
                  width={62}
                  height={43}
                  className="w-11 sm:w-[62px]"
                />
                <span className="text-[1.375rem] font-bold leading-none tracking-[0.06em] sm:text-[1.875rem]">
                  Look<span className="text-brand">Save</span>
                </span>
              </div>

              {/* Qisqa chiziq — so'z belgisini matndan ajratadi */}
              <span
                aria-hidden="true"
                className="block h-0.5 w-[136px] rounded-full bg-gradient-to-r from-primary to-transparent"
              />
            </div>

            <p className="max-w-[30ch] text-body leading-relaxed text-muted-foreground">
              AI fashion marketplace — shaxsiy 3D avatar bilan. Dubay va Toshkent.
            </p>

            <div className="flex items-center gap-3 sm:gap-3.5">
              {SOCIAL.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={item.label}
                  className="flex size-12 items-center justify-center rounded-full border border-primary/30 text-muted-foreground transition-colors duration-150 hover:border-primary/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-[52px]"
                >
                  <SocialLogo name={item.name} size={21} />
                </a>
              ))}
            </div>
          </div>

          {/* ── Havola ustunlari ── */}
          {groups.map((group) => (
            <div
              key={group.title}
              className="relative flex flex-col gap-5 lg:grow lg:basis-0 lg:px-10"
            >
              {/*
                ⚠️ AJRATGICH USTUN ICHIDA, YONIDA EMAS. Alohida element
                bo'lsa u mobil ustunda ham qatorga qo'shilib, bo'sh
                chiziq bo'lib qolardi.
              */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 start-0 hidden w-px lg:block"
                style={{
                  background:
                    'linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.34) 18%, hsl(var(--primary) / 0.34) 82%, transparent)',
                }}
              />

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Icon name={group.icon} size={20} className="shrink-0 text-brand" />
                  <h2 className="text-small font-semibold uppercase tracking-[0.14em] text-foreground">
                    {group.title}
                  </h2>
                </div>
                <span
                  aria-hidden="true"
                  className="block h-0.5 w-[76px] rounded-full bg-gradient-to-r from-primary to-transparent"
                />
              </div>

              <nav aria-label={group.title} className="flex flex-col gap-1 lg:gap-4">
                {group.links.map((link) => {
                  const inner = (
                    <>
                      {/*
                        ⚠️ O'Q HAVOLANING BIR QISMI. `::before` bilan
                        qo'yilsa u nusxa olishda matnga qo'shilib
                        ketardi va ekran o'quvchi uni o'qib berardi.
                      */}
                      <Icon
                        name="next"
                        size={15}
                        className="shrink-0 text-dim transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-brand"
                      />
                      {link.label}
                    </>
                  );

                  const className =
                    'group flex min-h-11 items-center gap-2.5 text-body text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-6';

                  return link.external ? (
                    <a
                      key={link.to}
                      href={link.to}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={className}
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link key={link.to} to={link.to} className={className}>
                      {inner}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <span
          aria-hidden="true"
          className="block h-px"
          style={{
            background:
              'linear-gradient(to right, transparent, hsl(var(--primary) / 0.2) 8%, hsl(var(--primary) / 0.2) 92%, transparent)',
          }}
        />

        {/* ── Pastki qator ── */}
        <div className="relative flex flex-col-reverse items-start gap-3.5 p-7 sm:flex-row sm:items-center sm:justify-between sm:px-9 sm:py-6 lg:px-14">
          <p className="text-small text-muted-foreground">
            © {new Date().getFullYear()} LookSave. Barcha huquqlar himoyalangan.
          </p>

          {/*
            ⚠️ BU DEKORATIV BELGI EMAS, DALIL. To'lov xavfsizligi —
            xaridor savatga o'tishdan oldin so'raydigan yagona savol;
            futerda unga javob bo'lishi kerak. Bezak sifatida qo'yilsa,
            aksincha, shubha uyg'otadi.
          */}
          <span className="flex h-10 items-center gap-2.5 rounded-full border border-primary/30 bg-primarySoft px-4 text-small text-foreground sm:px-[18px]">
            <Icon name="authentic" size={17} className="text-brand" />
            Xavfsiz to'lovlar
          </span>
        </div>
      </div>
    </footer>
  );
}
