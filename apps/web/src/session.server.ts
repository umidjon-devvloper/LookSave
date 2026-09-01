import { createCookieSessionStorage, redirect } from 'react-router';

import type { ApiOptions } from '@/api/client';
import { refreshSession, type AuthUser } from '@/api/endpoints';
import type { Locale } from '@/i18n/locale';
import { clientIp } from '@/lib/client-ip.server';

/**
 * Sessiya — BFF namunasi (docs/13-sayt.md §9, S-04).
 *
 * ```
 * brauzer ──(httpOnly cookie)──▶ SSR server ──(Bearer JWT)──▶ api.looksave.app
 * ```
 *
 * ⚠️ NEGA `localStorage` EMAS: panellarda token `localStorage` da
 * (`store-panel/src/api/client.ts:33`) va uni har qanday XSS o'g'irlaydi.
 * Saytda mijozning manzili va buyurtmasi bor — takrorlanmaydi. `httpOnly`
 * cookie'ni JavaScript umuman ko'rmaydi.
 *
 * ⚠️ CHEKLOV: cookie IMZOLANGAN, shifrlangan emas. Ya'ni token cookie
 * faylini o'qiy oladigan odamga ko'rinadi (masalan qurilmaga jismoniy
 * kirish). XSS dan himoya to'liq, o'g'irlangan qurilmadan emas. To'liq
 * yechim — sessiyani serverda (Redis/KV) saqlash; u WEB-08 da, chunki
 * infratuzilma qarori kerak.
 *
 * ⚠️ `.server.ts` qo'shimchasi MAJBURIY: React Router bu faylni brauzer
 * to'plamiga umuman qo'shmaydi. Bo'lmasa `SESSION_SECRET` mijozga chiqib
 * ketardi.
 */

const SECRET = process.env['SESSION_SECRET'];

if (!SECRET && process.env['NODE_ENV'] === 'production') {
  throw new Error('SESSION_SECRET yo`q — ishlab chiqarishda sessiya imzolanmaydi');
}

interface SessionData {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const storage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: 'looksave_session',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env['NODE_ENV'] === 'production',
    secrets: [SECRET ?? 'dev-only-secret-almashtiring'],
    maxAge: 60 * 60 * 24 * 30,
  },
});

export const { getSession, commitSession, destroySession } = storage;

/**
 * JWT ning `exp` maydonini o'qiydi.
 *
 * Imzo TEKSHIRILMAYDI va bu to'g'ri: tokenni biz bermayapmiz, faqat
 * muddati tugaganini bilmoqchimiz. Haqiqiy tekshiruv API tomonida.
 */
function expiresAt(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;

  try {
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Muddati tugashiga 60 soniyadan kam qolsa — oldindan yangilanadi. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Kirmagan mehmon uchun `api()` sozlamasi.
 *
 * ⚠️ `{ locale }` ni QO'LDA yozmang — `clientIp` tushib qoladi va o'sha
 * sahifa yana barcha mehmon bilan bitta cheklov chelagini bo'lishadi
 * (15-sayt-dizayn.md S-4).
 */
export function guest(request: Request, locale: Locale): ApiOptions {
  return { locale, clientIp: clientIp(request) };
}

export interface AuthContext {
  user: AuthUser | null;
  /** `api()` ga uzatiladigan sozlama: til + token */
  options: ApiOptions;
  /**
   * Token yangilangan bo'lsa `Set-Cookie` qaytaradi, aks holda `null`.
   * Loader uni javob sarlavhasiga qo'shishi kerak, aks holda keyingi
   * so'rov yana eski token bilan keladi.
   */
  setCookie: string | null;
}

/**
 * Sessiyani o'qiydi va kerak bo'lsa tokenni yangilaydi.
 *
 * ⚠️ YANGILASH OLDINDAN, 401 dan KEYIN emas. 401 ni ushlab qayta urinish
 * har bir chaqiruvni ikki barobar qiladi va `POST` da xavfli (so'rov
 * ikki marta bajarilishi mumkin). `exp` ni o'qish esa bepul.
 */
export async function auth(request: Request, locale: Locale): Promise<AuthContext> {
  const session = await getSession(request.headers.get('Cookie'));
  const accessToken = session.get('accessToken');
  const refreshToken = session.get('refreshToken');
  const user = session.get('user') ?? null;

  /*
   * Mehmon IP'si HAR BIR sozlamaga qo'shiladi, kirgan foydalanuvchiga
   * ham: API kirgan odam uchun cheklovni `sub` bo'yicha hisoblaydi,
   * lekin `/auth/*` marshrutlari hali tokensiz va ular IP bo'yicha
   * cheklanadi (`routes/auth.ts`).
   */
  const ip = clientIp(request);

  if (!accessToken || !refreshToken || !user) {
    return { user: null, options: { locale, clientIp: ip }, setCookie: null };
  }

  const exp = expiresAt(accessToken);
  const fresh = exp === null || exp - Date.now() > REFRESH_MARGIN_MS;

  if (fresh) {
    return { user, options: { locale, accessToken, clientIp: ip }, setCookie: null };
  }

  try {
    const next = await refreshSession(refreshToken, { locale, clientIp: ip });
    session.set('accessToken', next.accessToken);
    session.set('refreshToken', next.refreshToken);

    return {
      user,
      options: { locale, accessToken: next.accessToken, clientIp: ip },
      setCookie: await commitSession(session),
    };
  } catch {
    /*
     * Yangilash ishlamadi — sessiya haqiqatan tugagan. Foydalanuvchini
     * chiqaramiz, lekin XATO KO'RSATMAYMIZ: u shunchaki mehmon bo'lib
     * qoladi va kerak bo'lganda kirish so'raladi.
     */
    return {
      user: null,
      options: { locale, clientIp: ip },
      setCookie: await destroySession(session),
    };
  }
}

/** Shaxsiy sahifalar uchun: kirmagan bo'lsa kirish sahifasiga yuboradi. */
export async function requireAuth(
  request: Request,
  locale: Locale,
): Promise<AuthContext & { user: AuthUser }> {
  const context = await auth(request, locale);

  if (!context.user) {
    const url = new URL(request.url);
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(`/${locale}/sign-in?next=${next}`, {
      headers: context.setCookie ? { 'Set-Cookie': context.setCookie } : undefined,
    });
  }

  return context as AuthContext & { user: AuthUser };
}

/** Kirish/ro'yxatdan keyin sessiyani yozadi. */
export async function startSession(
  request: Request,
  result: { user: AuthUser; accessToken: string; refreshToken: string },
): Promise<string> {
  const session = await getSession(request.headers.get('Cookie'));
  session.set('user', result.user);
  session.set('accessToken', result.accessToken);
  session.set('refreshToken', result.refreshToken);
  return commitSession(session);
}

export async function endSession(request: Request): Promise<string> {
  const session = await getSession(request.headers.get('Cookie'));
  return destroySession(session);
}
