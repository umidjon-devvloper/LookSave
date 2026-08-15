import type { AccessTokenPayload } from '@looksave/shared-types';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { verifyAccessToken } from '../auth/tokens';
import { ApiError } from './api-error';

const AUTH_KEY = 'auth';

/**
 * Autentifikatsiya konteksti `res.locals` da saqlanadi va faqat shu ikki
 * funksiya orqali o'qiladi — shunda tip yo'qolmaydi va `any` kerak bo'lmaydi.
 */
export function getAuth(res: Response): AccessTokenPayload {
  const auth: unknown = res.locals[AUTH_KEY];
  if (auth === undefined) {
    // Dasturchi xatosi: himoyalanmagan marshrutda getAuth chaqirilgan
    throw ApiError.internal('Auth konteksti yo`q');
  }
  return auth as AccessTokenPayload;
}

export function getAuthOptional(res: Response): AccessTokenPayload | null {
  const auth: unknown = res.locals[AUTH_KEY];
  return auth === undefined ? null : (auth as AccessTokenPayload);
}

function bearerToken(req: Request): string | null {
  const header = req.get('Authorization');
  if (!header) return null;

  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

/** Token majburiy. Yo'q bo'lsa 401 UNAUTHORIZED, muddati tugagan bo'lsa 401 TOKEN_EXPIRED. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = bearerToken(req);
  if (token === null) {
    next(ApiError.unauthorized('Token yuborilmagan'));
    return;
  }

  try {
    res.locals[AUTH_KEY] = await verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

/** Token bo'lsa o'qiydi, bo'lmasa o'tkazib yuboradi (mehmon ham ko'ra oladigan sahifalar). */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = bearerToken(req);
  if (token === null) {
    next();
    return;
  }

  verifyAccessToken(token)
    .then((payload) => {
      res.locals[AUTH_KEY] = payload;
      next();
    })
    .catch(() => next());
}

/** Rol tekshiruvi. `requireAuth` dan KEYIN qo'yiladi. */
export function requireRole(...roles: AccessTokenPayload['role'][]): RequestHandler {
  return (_req, res, next) => {
    const auth = getAuth(res);
    if (!roles.includes(auth.role)) {
      next(ApiError.forbidden('Bu amal uchun ruxsat yo`q'));
      return;
    }
    next();
  };
}
