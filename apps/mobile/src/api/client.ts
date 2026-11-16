import type { ApiFailure, ApiSuccess, ErrorCode } from '@looksave/shared-types';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';

/**
 * API mijozi.
 *
 * Token `expo-secure-store` da saqlanadi — iOS'da Keychain, Android'da
 * EncryptedSharedPreferences. `AsyncStorage` ishlatilmaydi: u oddiy fayl,
 * root qilingan qurilmada o'qib bo'ladi.
 */

const REFRESH_KEY = 'looksave.refresh';

/**
 * API manzili build profilidan keladi (`eas.json` dagi `EXPO_PUBLIC_API_URL`).
 *
 * ⚠️ Android emulyatorida `localhost` — emulyatorning o'zi. Kompyuterdagi
 * serverga `10.0.2.2` orqali murojaat qilinadi. iOS simulyatorida
 * `localhost` ishlaydi. Haqiqiy quridmada kompyuterning LAN IP'si kerak.
 */
/**
 * Metro serverining xostini topadi.
 *
 * ⚠️ IKKI MANBA KERAK, VA TARTIB MUHIM:
 *
 *   `Constants.expoConfig.hostUri` — Expo Go'da ishlaydi, chunki u yerda
 *   konfiguratsiya dev-serverdan manifest bilan keladi va `hostUri` shu
 *   manifestda bo'ladi.
 *
 *   `SourceCode.scriptURL` — dev-client (bizniki) uchun. Bu yerda
 *   `expoConfig` build paytida ilovaga singdirilgan `app.json` dan olinadi
 *   va unda `hostUri` UMUMAN YO'Q. Faqat `hostUri` ga tayangan tekshiruv
 *   jimgina `null` qaytaradi va eskirgan `.env` manzili ishlatiladi —
 *   natijada har bir so'rov javobsiz qoladi.
 *
 * `scriptURL` — bundle olingan haqiqiy manzil
 * (`http://192.168.1.10:8081/index.bundle?...`). Ilova ishlayotgan bo'lsa
 * u har doim to'g'ri: JS aynan o'sha yerdan kelgan.
 */
function metroHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }

  const scriptURL = (NativeModules['SourceCode'] as { scriptURL?: string } | undefined)?.scriptURL;
  if (typeof scriptURL === 'string' && scriptURL.length > 0) {
    try {
      return new URL(scriptURL).hostname;
    } catch {
      /* noto'g'ri manzil — pastda `null` qaytadi */
    }
  }

  return null;
}

/**
 * Ishlab chiqishda API xosti METRO XOSTIDAN olinadi.
 *
 * ⚠️ NEGA: Wi-Fi almashganda kompyuterning IP'si o'zgaradi va `.env` dagi
 * manzil eskiradi. Buni sezish qiyin — ilova ochiladi, ekranlar chiziladi,
 * faqat har bir so'rov javobsiz qoladi. Bu bir necha marta takrorlandi.
 *
 * Ishlab chiqarishda bunday qilinmaydi: u yerda `EXPO_PUBLIC_API_URL`
 * haqiqiy domenni ko'rsatadi va Metro umuman yo'q.
 */
function devHostFromMetro(configured: string): string | null {
  if (!__DEV__) return null;

  const host = metroHost();
  if (!host) return null;

  try {
    const url = new URL(configured);
    // Faqat lokal manzillar almashtiriladi — haqiqiy domenga tegilmaydi
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) && url.hostname !== 'localhost') {
      return null;
    }
    if (url.hostname === host) return null;

    url.hostname = host;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function apiUrl(): string {
  const fromEnv = process.env['EXPO_PUBLIC_API_URL'];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return devHostFromMetro(fromEnv) ?? fromEnv;
  }

  // ⚠️ Zaxira domen `.uz` — jonli backend shu (health 200). `.app` DNS'da
  // yo'q (o'lik): eas.json va bu fallback ilgari o'shanga qarab turardi va
  // ishlab chiqarish build'ida backend UMUMAN ulanmasdi.
  const fromConfig = Constants.expoConfig?.extra?.['apiUrl'];
  return typeof fromConfig === 'string' ? fromConfig : 'https://api.looksave.uz';
}

let accessToken: string | null = null;

/**
 * Til `Accept-Language` sarlavhasida yuboriladi — server kategoriya
 * nomlari va status matnlarini shu tilda qaytaradi. Sikl bo'lmasligi
 * uchun i18n moduli import qilinmaydi, u o'zi shu funksiyani chaqiradi.
 */
let language = 'uz';

export function setApiLanguage(locale: string): void {
  language = locale;
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  accessToken = access;
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK';
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode | 'NETWORK', message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Bir vaqtda bir nechta so'rov 401 olsa, yangilash faqat bir marta bajariladi. */
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
    // Ilova ochilishida chaqiriladi — muddatsiz qolsa splash abadiy kutadi
    const response = await withTimeout((signal) =>
      fetch(`${apiUrl()}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal,
      }),
    );

    if (!response.ok) {
      await clearTokens();
      return false;
    }

    const body = (await response.json()) as ApiSuccess<{
      accessToken: string;
      refreshToken: string;
    }>;
    await saveTokens(body.data.accessToken, body.data.refreshToken);
    return true;
  } catch {
    // Tarmoq xatosi — sessiya o'chirilmaydi, keyinroq qayta urinamiz
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Access tokenni MAJBURAN yangilaydi.
 *
 * ⚠️ NEGA KERAK: rol va do'kon ro'yxati (`storeIds`) TOKEN ICHIDA yozilgan
 * va u o'zgarmaydi. Foydalanuvchi do'kon arizasini yuborganda bazada
 * `store_owner` bo'ladi, lekin qo'lidagi token hali `customer` deb turadi —
 * natijada panelga kirganda 403 chiqadi va sabab umuman tushunarsiz
 * bo'ladi ("ariza qabul qilindi, lekin panel ochilmayapti").
 *
 * Odatda yangilash 401 dan keyin o'zi ishlaydi. Bu yerda esa 401 kutilmaydi:
 * huquq allaqachon berilgan, faqat token eskirgan.
 */
export const refreshSession = refreshOnce;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** `POST /orders` uchun majburiy */
  idempotencyKey?: string;
  retried?: boolean;
  /** Maxsus timeout (ms). Odatiy 25s; komplekt/batch uchun 60s+ oshiriladi. */
  timeoutMs?: number;
}

/**
 * Har bir so'rovga muddat.
 *
 * NEGA KERAK: `fetch` o'zi hech qachon to'xtamaydi. Server javob bermasa
 * (masalan Wi-Fi almashgan va eski IP hali "bor"dek ko'rinsa), so'rov
 * cheksiz osilib qoladi. Ilova ochilishida bu ayniqsa yomon: `restore()`
 * tugamaydi, `status` `loading` da qoladi va SPLASH ABADIY KUTADI —
 * tashqaridan "ilova qotib qoldi" bo'lib ko'rinadi, sababi esa hech qayerda
 * yozilmaydi.
 *
 * 25 soniya — 3G/sekin uyali tarmoqda haqiqiy uzilishni ajratish uchun.
 * Oldin 15s edi: mobil operatorlarda birinchi so'rov (DNS + TLS qo'l
 * siqish) 15s dan oshib ketgandi va "Internet ulanmadi" chiqib qolardi.
 */
const REQUEST_TIMEOUT_MS = 25_000;

async function withTimeout(
  run: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Birinchi so'rov tarmoq xatosi bilan tushib qolsa (DNS hali tayyor emas,
 * uyali ulanish uyg'ongan, Wi-Fi almashgan) — jim bir marta qayta urinib
 * ko'ramiz. Mutatsiyalar (POST/PUT/DELETE) bu yerga tushmaydi: ularni
 * ikki marta yuborish xavfli.
 */
const RETRY_BACKOFF_MS = 600;

function isIdempotent(method: string): boolean {
  return method === 'GET';
}

async function fetchWithRetry(
  input: string,
  init: RequestInit,
  retryable: boolean,
  timeoutMs?: number,
): Promise<Response> {
  try {
    return await withTimeout((signal) => fetch(input, { ...init, signal }), timeoutMs);
  } catch (err) {
    if (!retryable) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    return withTimeout((signal) => fetch(input, { ...init, signal }), timeoutMs);
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const headers: Record<string, string> = { 'Accept-Language': language };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetchWithRetry(
      `${apiUrl()}/v1${path}`,
      {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      isIdempotent(method) && !options.idempotencyKey,
      options.timeoutMs,
    );
  } catch {
    throw new ApiError('NETWORK', 'Internetga ulanib bo`lmadi', 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if ('error' in payload) {
    const { code, message, details } = payload.error;

    if ((code === 'TOKEN_EXPIRED' || code === 'UNAUTHORIZED') && !options.retried) {
      if (await refreshOnce()) {
        return api<T>(path, { ...options, retried: true });
      }
    }

    throw new ApiError(code, message, response.status, details);
  }

  return payload.data;
}

/** Ro'yxat javoblari uchun — `meta.nextCursor` kerak bo'lganda. */
export async function apiList<T>(
  path: string,
): Promise<{ items: T[]; nextCursor: string | null; hasMore: boolean }> {
  const headers: Record<string, string> = { 'Accept-Language': language };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetchWithRetry(`${apiUrl()}/v1${path}`, { headers }, true);
  } catch {
    throw new ApiError('NETWORK', 'Internetga ulanib bo`lmadi', 0);
  }
  const payload = (await response.json()) as ApiSuccess<T[]> | ApiFailure;

  if ('error' in payload) {
    throw new ApiError(payload.error.code, payload.error.message, response.status);
  }

  return {
    items: payload.data,
    nextCursor: payload.meta.nextCursor ?? null,
    hasMore: payload.meta.hasMore ?? false,
  };
}
