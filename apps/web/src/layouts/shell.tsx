import { Outlet, data, isRouteErrorResponse, useRouteError } from 'react-router';

import { Button, Empty } from '@looksave/ui-web';

import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getCart } from '@/api/endpoints';
import { isLocale, type Locale } from '@/i18n/locale';
import { auth } from '@/session.server';

import type { Route } from './+types/shell';

/**
 * Sahifa qobig'i: shapka + kontent + futer.
 *
 * Bu yerda yuklanadigan narsa har sahifada kerak bo'ladigan narsa —
 * boshqa hech nima: foydalanuvchi, savatdagi soni va kategoriya daraxti
 * (menyu uchun). Sahifaga xos ma'lumot o'z `loader` ida qoladi.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = params.locale;

  // Noma"lum til — '/xx/...' 404 bo"lishi kerak, `en` ga jimgina tushmasligi
  if (!isLocale(locale)) {
    throw new Response('Not found', { status: 404 });
  }

  const context = await auth(request, locale);

  /*
   * ⚠️ SAVAT SO'ROVI YIQILMAYDI. Xato bersa butun sahifa 500 bo'lib
   * qolishi mumkin emas — mahsulot sahifasi savatsiz ham o'qiladi.
   *
   * ⚠️ Kategoriyalar bu yerda YUKLANMAYDI. Ilgari ular shapkadagi tekis
   * havolalar uchun kerak edi; endi shapkada faqat uchta asosiy bo'lim
   * bor va kategoriyalar katalog filtrida. Mega-menyu qo'shilganda
   * (15-sayt-dizayn.md §3.1) so'rov qaytadi — o'shanda ular haqiqatan
   * ishlatiladi.
   */
  const cartCount = context.user
    ? await getCart(context.options)
        .then((cart) => cart.itemCount)
        .catch(() => 0)
    : 0;

  return data(
    { locale: locale as Locale, user: context.user, cartCount },
    context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
  );
}

export default function Shell({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, user, cartCount } = loaderData;

  /*
   * ⚠️ `TooltipProvider` VA `Toaster` SHU YERDA. Ilgari ular o'chirilgan
   * `App.tsx` da edi va qobiqqa ko'chirilmadi — natijada `Tooltip`
   * ishlatgan har qanday bo'lim «must be used within TooltipProvider»
   * bilan yiqilardi.
   *
   * ⚠️ Xato HTTP 200 ostida yashiringan edi: React uni render paytida
   * ushlaydi va marshrut xato chegarasini chizadi, javob esa baribir
   * 200 bo'lib qoladi. Ya'ni status kodi sahifa chizilganini ISBOTLAMAYDI
   * — mazmunni ham tekshirish kerak.
   */
  return (
    <TooltipProvider delayDuration={200}>
      <Nav locale={locale} user={user} cartCount={cartCount} />
      <main id="content" className="pt-[5.5rem] sm:pt-[6.5rem]">
        <Outlet />
      </main>
      <Footer locale={locale} />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}

/**
 * Marshrut xatosi — shapka va futer JOYIDA qoladi.
 *
 * ⚠️ Yalang'och xato sahifasi saytdan chiqib ketgandek tuyuladi va odam
 * orqaga tugmasini bosadi. Navigatsiya qolsa — u boshqa sahifaga o'tadi
 * (13-sayt.md §4.14).
 */
export function ErrorBoundary(): JSX.Element {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="pt-[5.5rem] sm:pt-[6.5rem]">
      <div className="shell py-24">
        <Empty
          icon={notFound ? 'search' : 'close'}
          title={notFound ? "Bunday sahifa yo'q" : "Nimadir noto'g'ri ketdi"}
          hint={
            notFound
              ? "Havola eskirgan bo'lishi mumkin. Katalogdan qidirib ko'ring."
              : "Sahifani yangilab ko'ring."
          }
          action={
            <Button asChild>
              <a href="/">Bosh sahifaga</a>
            </Button>
          }
        />
      </div>
    </main>
  );
}
