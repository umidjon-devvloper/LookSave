import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { Button, Icon, type IconName } from '@looksave/ui-web';

import type { AuthUser } from '@/api/endpoints';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LOCALES, LOCALE_LABEL, swapLocale, type Locale } from '@/i18n/locale';
import { cn } from '@/lib/utils';

/**
 * Shapka — sahifa ustida suzuvchi panel (docs/15-sayt-dizayn.md §3.1).
 *
 * Ilovada navigatsiya pastdagi tab bar; saytda u yuqoriga ko'chadi va
 * ichiga savat, til va hisob qo'shiladi. Bu ko'chirilmaydigan farq
 * (15-sayt-dizayn.md §2).
 *
 * ⚠️ PANEL ENDI CHETGA YOPISHMAYDI. Ilgari u butun kenglikdagi chiziq
 * edi va hero ustida ikkiga bo'lib turardi. Suzuvchi panel esa
 * sahifaning bir qismi bo'lib ko'rinadi, chegara emas.
 */

interface NavProps {
  locale: Locale;
  user: AuthUser | null;
  cartCount: number;
}

export function Nav({ locale, user, cartCount }: NavProps): JSX.Element {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    /*
     * ⚠️ TEPADA YENGIL, PASTDA QOTADI. Suzuvchi panel doim ko'rinib
     * turadi, ya'ni eski «shaffof → fonli» qoidasi endi ishlamaydi:
     * hero ustida to'q panel uni ikkiga bo'lardi. Buning o'rniga
     * tepada fon yarim shaffof va nur yo'q, pastga tushganda esa
     * panel qotadi va nur yonadi — kontent ostidan o'tayotgani
     * ko'rinsin.
     */
    const onScroll = (): void => setSolid(window.scrollY > 24);
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /*
   * ⚠️ KATEGORIYALAR SHAPKADA EMAS. Ilgari ular tekis ro'yxatga
   * qo'shilardi va oltita havola chiqib, shapka o'ng chekkadagi
   * tugmalarga tiqilib qolardi (ekran torayganda esa ustma-ust
   * tushardi).
   *
   * Kategoriyalarning o'z joyi — «Katalog» ustidagi mega-menyu
   * (15-sayt-dizayn.md §3.1). U alohida ish; hozircha ular katalog
   * sahifasidagi filtrda to'liq turibdi.
   */
  const links: Array<{ to: string; label: string; icon: IconName }> = [
    { to: `/${locale}/catalog`, label: 'Katalog', icon: 'grid' },
    { to: `/${locale}/stores`, label: "Do'konlar", icon: 'shop' },
    // { to: `/${locale}/try-on`, label: 'Kiyintirish', icon: 'hanger' }, // hozircha o'chirilgan
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="shell-wide">
        <nav
          className={cn(
            'mt-3 flex h-16 items-center rounded-[22px] border px-2.5 backdrop-blur-xl sm:h-20 sm:rounded-[26px] sm:px-3.5 transition-[background-color,border-color,box-shadow] duration-300',
            solid
              ? 'border-primary/30 bg-panel/85 shadow-[0_0_34px_hsl(var(--primary)/0.28),inset_0_1px_0_rgba(255,255,255,0.05)]'
              : 'border-border bg-panel/45',
          )}
        >
          {/*
            Logotip — ilovadagi belgi (`assets/logo-mark.png`) va so'z birga.
            Belgida mayda tafsilotlar bor (galstuk, krossovka), shuning
            uchun u 52px lik kafel ichida turadi: kichikroqda ular
            bir-biriga qo'shilib ketadi.
          */}
          <Link
            to={`/${locale}`}
            className="flex shrink-0 items-center gap-2.5 pe-3 focus-visible:outline-none sm:gap-3.5 sm:pe-5"
          >
            <span className="flex size-11 items-center justify-center rounded-xl border border-primary/30 sm:size-[52px] sm:rounded-[15px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.16),hsl(var(--background)/0.9))]">
              <img
                src="/img/logo-mark.png"
                alt=""
                width={34}
                height={24}
                className="w-7 sm:w-[34px]"
              />
            </span>

            {/*
              ⚠️ SO'Z BELGISI IKKI RANGDA va `text-wordmark` DAN KATTAROQ.
              Token 14px / 0.32em — u 72px lik chiziqda to'g'ri edi,
              80px lik panelda esa yo'qolib ketadi.
            */}
            <span className="text-[0.9375rem] font-bold leading-none tracking-[0.06em] sm:text-[1.125rem]">
              Look<span className="text-brand">Save</span>
            </span>
          </Link>

          <Divider className="hidden lg:block" />

          <div className="hidden items-center gap-1.5 px-5 lg:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center gap-2.5 whitespace-nowrap rounded-full border px-[18px] text-body font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? /*
                         ⚠️ FAOL HOLATNI HALQA KO'RSATADI, FON EMAS.
                         Fon bor, lekin u atigi 14% — halqa va yengil
                         nur ustun turadi. To'q to'ldirilgan pill
                         qo'shni yozuvlardan ko'proq e'tibor tortib,
                         tugmaga o'xshab qolardi: odam uni «bosiladigan
                         amal» deb o'qiydi, «shu yerdasiz» deb emas.
                        */
                        'border-primary/55 bg-primarySoft text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.3),inset_0_0_14px_hsl(var(--primary)/0.1)]'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon name={link.icon} size={18} />
                {link.label}
              </NavLink>
            ))}
          </div>

          <span className="flex-1" />

          <Divider className="hidden sm:block" />

          <div className="flex items-center gap-2.5 ps-3 sm:ps-5">
            <LocaleSwitch current={locale} pathname={location.pathname} search={location.search} />

            <IconLink to={`/${locale}/cart`} label="Savat" icon="cart" badge={cartCount} />

            {user ? (
              <Link
                to={`/${locale}/profile`}
                className="hidden h-[52px] items-center gap-2.5 rounded-full border border-borderStrong ps-1.5 pe-4 transition-colors duration-150 hover:border-borderAccent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
              >
                <span className="flex size-[38px] items-center justify-center rounded-full bg-primarySoft text-small font-bold text-brand">
                  {initials(user.fullName)}
                </span>
                <span className="max-w-28 truncate text-small font-medium">
                  {user.fullName ?? 'Profil'}
                </span>
              </Link>
            ) : (
              <Button asChild className="hidden shadow-glow sm:inline-flex">
                <Link to={`/${locale}/sign-in`}>
                  <Icon name="signIn" size={18} />
                  Kirish
                </Link>
              </Button>
            )}

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                {/*
                  Oddiy `<button>`, kitning `Button` i emas: bu 52px lik amal
                  tugmasi emas, navigatsiya ikonkasi (WEB-01, P-03).
                */}
                <button
                  type="button"
                  aria-label="Menyu"
                  className="inline-flex size-11 items-center justify-center rounded-full border border-primary/30 bg-primarySoft text-foreground transition-colors duration-150 hover:border-primary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>

              <SheetContent side="right" className="w-80 border-border bg-surface">
                <SheetTitle className="text-[1.125rem] font-bold tracking-[0.06em]">
                  Look<span className="text-brand">Save</span>
                </SheetTitle>
                <Separator className="my-5" />

                <div className="flex flex-col gap-1">
                  {links.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-md px-3 py-3 text-body transition-colors',
                          isActive
                            ? 'bg-primarySoft text-brand'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )
                      }
                    >
                      <Icon name={link.icon} size={18} />
                      {link.label}
                    </NavLink>
                  ))}

                  <Separator className="my-3" />

                  <Link
                    to={user ? `/${locale}/profile` : `/${locale}/sign-in`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-3 text-body text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Icon name={user ? 'profile' : 'signIn'} size={18} />
                    {user ? (user.fullName ?? 'Profil') : 'Kirish'}
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </header>
  );
}

/** Bosh harflar: «Umidjon G'afforov» → «UG», «Umidjon» → «UM» */
function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Guruhlarni ajratuvchi tik chiziq.
 *
 * ⚠️ UCHLARI SO'NADI. To'liq balandlikdagi chiziq panelni uchta alohida
 * qutiga bo'lib tashlardi; kalta va so'nuvchi chiziq esa panelni yaxlit
 * qoldiradi.
 */
function Divider({ className }: { className?: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn('my-3.5 w-px self-stretch sm:my-[18px]', className)}
      style={{
        background:
          'linear-gradient(to bottom, transparent, hsl(var(--border-strong)) 30%, hsl(var(--border-strong)) 70%, transparent)',
      }}
    />
  );
}

function IconLink({
  to,
  label,
  icon,
  badge = 0,
}: {
  to: string;
  label: string;
  icon: 'cart' | 'profile';
  badge?: number;
}): JSX.Element {
  return (
    <Link
      to={to}
      /*
        ⚠️ SON YORLIQNING ICHIDA. `aria-label` elementning BUTUN
        ichkarisini almashtiradi, ya'ni pastdagi belgi ekran o'quvchiga
        umuman yetib bormasdi — foydalanuvchi savatda mahsulot borligini
        bilmasdi.
      */
      aria-label={badge > 0 ? `${label} — ${badge} ta mahsulot` : label}
      className="relative inline-flex size-11 items-center justify-center rounded-full border border-borderStrong text-muted-foreground transition-colors duration-150 hover:border-borderAccent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon name={icon} size={20} />

      {/*
        ⚠️ SON DOIRA TASHQARISIGA CHIQADI. Ichida tursa 21px lik belgi
        44px lik doiraning yarmini egallab, ikonkani bosib qo'yardi.
        Panel foni bilan bir xil ramka uni doiradan ajratib turadi.
      */}
      {badge > 0 ? (
        <span className="absolute -end-1 -top-1 inline-flex h-[21px] min-w-[21px] items-center justify-center rounded-full border-2 border-panel bg-primary px-1.5 text-tiny font-bold leading-none text-primary-foreground">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Til almashtirgich.
 *
 * ⚠️ O'SHA SAHIFADA QOLADI (`swapLocale`). Bosh sahifaga tashlash — eng
 * ko'p uchraydigan va eng bezovta qiladigan xato (13-sayt.md §7.2).
 *
 * `<a>`, `<Link>` emas: til o'zgarishi butun hujjatning `lang` va `dir`
 * atributlarini almashtiradi, ya'ni to'liq yangilanish eng ishonchli yo'l.
 */
function LocaleSwitch({
  current,
  pathname,
  search,
}: {
  current: Locale;
  pathname: string;
  search: string;
}): JSX.Element {
  return (
    <div className="group relative hidden sm:block">
      <button
        type="button"
        aria-label="Til"
        className="inline-flex size-11 items-center justify-center rounded-full border border-borderStrong text-muted-foreground transition-colors duration-150 hover:border-borderAccent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon name="language" size={20} />
      </button>

      <div className="invisible absolute end-0 top-full z-50 mt-2 min-w-40 rounded-card border border-border bg-popover p-1 opacity-0 shadow-card transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {LOCALES.map((locale) => (
          <a
            key={locale}
            href={swapLocale(pathname, locale) + search}
            lang={locale}
            className={cn(
              'block rounded-sm px-3 py-2 text-body transition-colors hover:bg-accent',
              locale === current ? 'text-brand' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {LOCALE_LABEL[locale]}
          </a>
        ))}
      </div>
    </div>
  );
}
