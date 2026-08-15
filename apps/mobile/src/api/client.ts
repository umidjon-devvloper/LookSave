import type { ApiFailure, ApiSuccess, ErrorCode } from '@looksave/shared-types';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

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
function apiUrl(): string {
  const fromEnv = process.env['EXPO_PUBLIC_API_URL'];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;

  const fromConfig = Constants.expoConfig?.extra?.['apiUrl'];
  return typeof fromConfig === 'string' ? fromConfig : 'https://api.looksave.app';
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
    const response = await fetch(`${apiUrl()}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

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

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** `POST /orders` uchun majburiy */
  idempotencyKey?: string;
  retried?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const headers: Record<string, string> = { 'Accept-Language': language };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}/v1${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
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

  const response = await fetch(`${apiUrl()}/v1${path}`, { headers });
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
