/**
 * Xato kodlari — 03-api-spec.md §3 bilan bir xil.
 * `code` hech qachon o'zgarmaydi: ilova kodi shunga qarab qaror qabul qiladi.
 * Yangi kod qo'shilsa — bu fayl VA 03-api-spec.md birga yangilanadi.
 */
export const ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  FORBIDDEN: 403,
  PHONE_NOT_VERIFIED: 403,
  BLOCKED: 403,
  RESTRICTED: 403,
  NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  ALREADY_EXISTS: 409,
  INVALID_STATE: 409,
  VALIDATION_ERROR: 422,
  OUT_OF_RANGE: 422,
  INVALID_PHONE: 422,
  RATE_LIMITED: 429,
  LIMIT_REACHED: 429,
  OTP_TOO_SOON: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Kodga mos HTTP status. Handler shu jadvaldan oladi, qo'lda yozilmaydi. */
export type ErrorHttpStatus = (typeof ERROR_CODES)[ErrorCode];

/**
 * VALIDATION_ERROR ichidagi maydon xatolari (03-api-spec §3).
 * Ilova shu ro'yxatni olib har bir input ostiga qizil matn chiqaradi.
 */
export type FieldErrorCode =
  | 'REQUIRED'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'INVALID_FORMAT'
  | 'INVALID_CHARS'
  | 'OUT_OF_RANGE'
  | 'NOT_MOBILE';

export interface FieldError {
  /** Nuqtali yo'l: `address.lat`, `items.0.quantity` */
  field: string;
  code: FieldErrorCode;
  message: string;
}

export interface ValidationErrorDetails {
  fields: FieldError[];
}
