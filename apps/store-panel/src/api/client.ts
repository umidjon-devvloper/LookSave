import type { ApiFailure, ApiSuccess, AuthUser, ErrorCode } from '@looksave/shared-types';

/**
 * API mijozi.
 *
 * ⚠️ HUJJATDAN CHEKINISH (07-web-panels §3):
 * Hujjatda token `httpOnly` cookie'da bo'lishi aytilgan. Lekin API cookie
 * o'rnatmaydi — u mobil ilova uchun qurilgan va tokenlarni javob tanasida
 * qaytaradi. Shuning uchun:
 *   • access token — faqat XOTIRADA (sahifa yangilansa yo'qoladi)
 *   • refresh token — `localStorage` da
 *
 * Bu XSS oldida to'liq himoya emas. To'g'ri yechim — API'ga cookie
 * o'rnatuvchi sessiya endpointi qo'shish. Shu paytgacha panelga uchinchi
 * tomon skriptlari qo'shilmasligi kerak.
 */

const REFRESH_KEY = 'looksave.refresh';

let accessToken: string | null = null;
let storeId: string | null = null;

export function setStoreId(id: string | null): void {
  storeId = id;
}

export function getStoreId(): string | null {
  return storeId;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}

export function hasSession(): boolean {
  return localStorage.getItem(REFRESH_KEY) !== null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiClientError extends Error {
  readonly code: ErrorCode | 'NETWORK';
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode | 'NETWORK', message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;

  const response = await fetch('/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    return false;
  }

  const body = (await response.json()) as ApiSuccess<{
    accessToken: string;
    refreshToken: string;
  }>;
  setTokens(body.data.accessToken, body.data.refreshToken);
  return true;
}

/** Bir vaqtda bir nechta so'rov 401 olsa, refresh faqat bir marta bajariladi. */
let refreshing: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  refreshing ??= refreshAccessToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (storeId) headers['X-Store-Id'] = storeId;
  return headers;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Ichki: takroriy urinishni cheklash */
  retried?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  let response: Response;
  try {
    response = await fetch(`/v1${path}`, {
      method,
      headers: {
        ...authHeaders(),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiClientError('NETWORK', 'Internetga ulanib bo`lmadi', 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if ('error' in payload) {
    const { code, message, details } = payload.error;

    // Token muddati tugagan — bir marta yangilab, qayta urinamiz
    if ((code === 'TOKEN_EXPIRED' || code === 'UNAUTHORIZED') && !options.retried) {
      if (await refreshOnce()) {
        return api<T>(path, { ...options, retried: true });
      }
    }

    throw new ApiClientError(code, message, response.status, details);
  }

  return payload.data;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function login(phoneNumber: string, password: string): Promise<AuthUser> {
  const response = await fetch('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneNumber, password, platform: 'web' }),
  });

  const payload = (await response.json()) as ApiSuccess<LoginResult> | ApiFailure;

  if ('error' in payload) {
    throw new ApiClientError(payload.error.code, payload.error.message, response.status);
  }

  setTokens(payload.data.accessToken, payload.data.refreshToken);
  return payload.data.user;
}

export async function restoreSession(): Promise<AuthUser | null> {
  if (!hasSession()) return null;
  if (!(await refreshOnce())) return null;

  try {
    return await api<AuthUser>('/profile');
  } catch {
    clearTokens();
    return null;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  clearTokens();
  if (!refreshToken) return;

  await fetch('/v1/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => undefined);
}
