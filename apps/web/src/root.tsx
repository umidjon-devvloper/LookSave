import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useParams,
  useRouteError,
} from 'react-router';

import { Button } from '@looksave/ui-web';

import { DEFAULT_LOCALE, dirOf, isLocale } from '@/i18n/locale';

import './index.css';

/**
 * Hujjat qobig'i. Ilgari bu `index.html` edi; framework rejimida sahifa
 * serverda chizilgani uchun `<html>` ham React ichida bo'lishi kerak —
 * faqat shunda `lang` va `dir` har javobda to'g'ri chiqadi.
 *
 * ⚠️ `dir` SERVERDA QO'YILADI, brauzerda JS bilan emas. Aks holda arabcha
 * sahifa bir zum chapdan o'ngga chizilib, keyin sakrab o'ngdan chapga
 * o'tadi — bu eng ko'zga tashlanadigan nosozliklardan biri.
 */
export function Layout({ children }: { children: React.ReactNode }): JSX.Element {
  const params = useParams();
  const locale = isLocale(params['locale']) ? params['locale'] : DEFAULT_LOCALE;

  return (
    <html lang={locale} dir={dirOf(locale)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0A0A0F" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root(): JSX.Element {
  return <Outlet />;
}

/**
 * Xato chegarasi.
 *
 * ⚠️ SHAPKA VA FUTER YO'Q — bu ataylab. Ildiz darajasidagi xatoda
 * `Outlet` chizilmaydi, ya'ni qobiq ham yo'q. Marshrut darajasidagi
 * xatolar `layouts/shell.tsx` da ushlanadi va u yerda navigatsiya
 * saqlanib qoladi (13-sayt.md §4.14).
 */
export function ErrorBoundary(): JSX.Element {
  const error = useRouteError();
  const params = useParams();
  const locale = isLocale(params['locale']) ? params['locale'] : DEFAULT_LOCALE;

  const notFound = isRouteErrorResponse(error) && error.status === 404;

  const title = notFound ? "Bunday sahifa yo'q" : "Nimadir noto'g'ri ketdi";
  const hint = notFound
    ? "Havola eskirgan yoki noto'g'ri yozilgan bo'lishi mumkin."
    : "Sahifani yangilab ko'ring. Takrorlansa — biroz keyinroq urinib ko'ring.";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-8 text-center">
      <p className="text-label font-semibold uppercase tracking-label text-brand">
        {isRouteErrorResponse(error) ? error.status : 'Xato'}
      </p>
      <h1 className="mt-2 text-h1 font-bold">{title}</h1>
      <p className="max-w-[42ch] text-body text-muted-foreground">{hint}</p>

      <div className="mt-6">
        <Button asChild>
          <a href={`/${locale}`}>Bosh sahifaga</a>
        </Button>
      </div>
    </main>
  );
}
