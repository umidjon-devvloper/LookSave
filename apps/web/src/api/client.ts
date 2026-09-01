import type { ApiFailure, ApiSuccess, ErrorCode } from '@looksave/shared-types';

import type { Locale } from '@/i18n/locale';

/**
 * API mijozi.
 *
 * ⚠️ IKKI MUHITDA ISHLAYDI, LEKIN BIR XIL EMAS:
 *
 *   `loader`/`action` ichida (Node) — API ga TO'G'RIDAN-TO'G'RI boradi
 *   (`API_URL`), va tokenni sessiyadan olib `Authorization` ga qo'yadi.
 *   Brauzer bu so'rovni umuman ko'rmaydi.
 *
 *   Brauzerda — nisbiy `/v1` yo'li orqali (dev'da Vite proksisi). Token
 *   BERILMAYDI: u sessiya cookie'sida va JS uni o'qiy olmaydi. Ya'ni
 *   brauzerdan faqat ochiq endpointlarga murojaat qilinadi.
 *
 * Shu sababli har qanday shaxsiy so'rov `loader`/`action` orqali o'tadi
 * (13-sayt.md §9, BFF).
 */

export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK';
  readonly status: number;

  constructor(code: ErrorCode | 'NETWORK', message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Tarmoq nosozligi alohida — «qayta urinish» tugmasi faqat shunda ma'noli */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NETWORK';
}

const SERVER_ORIGIN =
  typeof process !== 'undefined' && process.env['API_URL']
    ? process.env['API_URL']
    : 'http://127.0.0.1:3000';

function onServer(): boolean {
  return typeof document === 'undefined';
}

function baseUrl(): string {
  return onServer() ? `${SERVER_ORIGIN}/v1` : '/v1';
}

/**
 * ── Mehmon cheklovi (15-sayt-dizayn.md S-4) ──
 *
 * SSR'da API ga so'rov mehmondan emas, veb-serverdan boradi va API
 * anonim cheklovni IP bo'yicha hisoblaydi — BARCHA mehmon bitta
 * chelakni bo'lishadi. Shu sababli BFF mehmon IP'sini o'zi aytadi.
 *
 * ⚠️ NEGA `X-Forwarded-For` EMAS. API Caddy orqasida `trust proxy 1`
 * bilan turadi va XFF ning OXIRGI qiymatini oladi, Caddy esa o'zi
 * ko'rgan IP'ni oxiriga qo'shadi — ya'ni bizning qiymatimiz ustiga
 * veb-serverning IP'si yozilib, o'zgarish behuda bo'lardi. Hop sonini
 * oshirish esa mobil ilova boradigan TO'G'RIDAN-TO'G'RI yo'lda
 * cheklovni soxtalashtirishga yo'l ochadi (`apps/api/src/app.ts`).
 *
 * Shuning uchun alohida sarlavha va uni XIZMAT KALITI qo'riqlaydi.
 *
 * ⚠️ KALIT FAQAT SERVERDA o'qiladi. Brauzerda `process` umuman yo'q va
 * qiymat to'plamga tushmaydi (Vite faqat `import.meta.env.VITE_*` ni
 * inline qiladi).
 */
const SERVICE_KEY_HEADER = 'X-LookSave-Service-Key';
const CLIENT_IP_HEADER = 'X-LookSave-Client-Ip';

function serviceKey(): string {
  if (!onServer() || typeof process === 'undefined') return '';
  return process.env['INTERNAL_SERVICE_KEY'] ?? '';
}

/** So'rov 12 soniyadan uzoq cho'zilsa uziladi — sahifa muzlab qolmaydi */
const TIMEOUT_MS = 12_000;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  locale?: Locale;
  /** Faqat serverda: sessiyadan olingan access token */
  accessToken?: string | null;
  /**
   * Buyurtma yaratishda MAJBURIY. Tarmoq uzilib so'rov qayta yuborilsa,
   * ikkinchi buyurtma yaratilmaydi (03-api-spec §12).
   */
  idempotencyKey?: string;
  /**
   * Faqat serverda: SAHIFANI SO'RAGAN MEHMONNING IP'si.
   *
   * `loader`/`action` ga kelgan `Request` dan olinadi
   * (`lib/client-ip.server.ts`) va shu yerdan API ga uzatiladi —
   * global o'zgaruvchi orqali EMAS, chunki bir vaqtda bir necha so'rov
   * ishlanadi va global qiymat ular orasida aralashib ketardi.
   */
  clientIp?: string | null;
  signal?: AbortSignal;
}

async function request(path: string, options: ApiOptions): Promise<Response> {
  const { method = 'GET', body, locale, accessToken, idempotencyKey, clientIp } = options;

  const headers: Record<string, string> = {};
  if (locale) headers['Accept-Language'] = locale;
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  /*
   * Ikkalasi BIRGA yuboriladi yoki umuman yuborilmaydi: kalitsiz
   * sarlavhani API e'tiborga olmaydi.
   *
   * ⚠️ Bu yerda `headers` HAR SO'ROVGA yangi obyekt va qiymat
   * `options` dan keladi — mehmonlar IP'si bir-biriga o'tib ketmaydi.
   */
  const key = serviceKey();
  if (key && clientIp) {
    headers[SERVICE_KEY_HEADER] = key;
    headers[CLIENT_IP_HEADER] = clientIp;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Chaqiruvchining bekor qilishi ham ishlashi kerak (RR marshrutni tashlaganda)
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    return await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError('NETWORK', 'Tarmoqqa ulanib bo`lmadi', 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await request(path, options);

  // 204 — tana yo'q (masalan `DELETE /cart`)
  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (payload === null) {
    throw new ApiError('INTERNAL_ERROR', `HTTP ${response.status}`, response.status);
  }

  if ('error' in payload) {
    throw new ApiError(payload.error.code, payload.error.message, response.status);
  }

  return payload.data;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Ro'yxat javoblari — `meta.nextCursor` kerak bo'lganda. */
export async function apiList<T>(path: string, options: ApiOptions = {}): Promise<Page<T>> {
  const response = await request(path, options);
  const payload = (await response.json().catch(() => null)) as ApiSuccess<T[]> | ApiFailure | null;

  if (payload === null) {
    throw new ApiError('INTERNAL_ERROR', `HTTP ${response.status}`, response.status);
  }

  if ('error' in payload) {
    throw new ApiError(payload.error.code, payload.error.message, response.status);
  }

  return {
    items: payload.data,
    nextCursor: payload.meta.nextCursor ?? null,
    hasMore: payload.meta.hasMore ?? false,
  };
}

/** `?a=1&b=2` — `undefined`, `null` va bo'sh qiymatlar tushib qoladi. */
export function query(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
