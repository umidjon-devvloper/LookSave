import type { ApiFailure, ResponseMeta } from '@looksave/shared-types';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../logger';
import { ApiError } from './api-error';
import { toFieldErrors } from './validate';

/** Marshrut topilmadi — qobiq baribir bir xil bo'lishi uchun ApiError orqali. */
export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound('Bunday manzil yo`q'));
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return ApiError.validation(toFieldErrors(err));
  }

  // express.json() buzuq JSON uchun SyntaxError tashlaydi
  if (err instanceof SyntaxError && 'body' in err) {
    return new ApiError('BAD_REQUEST', 'JSON formati noto`g`ri');
  }

  return ApiError.internal();
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  // Javob allaqachon yuborilgan bo'lsa — Express o'zi ulanishni yopadi
  if (res.headersSent) {
    next(err);
    return;
  }

  const apiError = toApiError(err);
  const requestId = (res.locals.requestId as string | undefined) ?? 'unknown';

  if (apiError.status >= 500) {
    logger.error({ err, requestId, code: apiError.code }, 'so`rov xatosi');
  } else {
    logger.warn({ requestId, code: apiError.code, status: apiError.status }, 'so`rov rad etildi');
  }

  const meta: ResponseMeta = { requestId };
  const body: ApiFailure = {
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
    meta,
  };

  res.status(apiError.status).json(body);
}
