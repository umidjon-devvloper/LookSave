import { ERROR_CODES, type ErrorCode, type FieldError } from '@looksave/shared-types';

/**
 * Ilova xatolari. HTTP status kod jadvalidan olinadi — qo'lda yozilmaydi,
 * shunda `NOT_FOUND` bir joyda 404, boshqa joyda 400 bo'lib qolmaydi.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }

  static notFound(message = 'Topilmadi'): ApiError {
    return new ApiError('NOT_FOUND', message);
  }

  static unauthorized(message = 'Avtorizatsiya talab qilinadi'): ApiError {
    return new ApiError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'Ruxsat yo`q'): ApiError {
    return new ApiError('FORBIDDEN', message);
  }

  static validation(fields: FieldError[], message = 'Ma`lumotlar to`liq emas'): ApiError {
    return new ApiError('VALIDATION_ERROR', message, { fields });
  }

  static internal(message = 'Server xatosi'): ApiError {
    return new ApiError('INTERNAL_ERROR', message);
  }
}
