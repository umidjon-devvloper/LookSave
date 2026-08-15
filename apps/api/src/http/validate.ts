import type { FieldError, FieldErrorCode } from '@looksave/shared-types';
import type { Request, RequestHandler, Response } from 'express';
import { type ZodError, type ZodTypeAny, type z } from 'zod';

import { ApiError } from './api-error';

/**
 * Zod issue → 03-api-spec §3 dagi maydon xatosi.
 * `phoneSchemaFor` kabi maxsus sxemalar `params.fieldCode` orqali
 * o'z kodini beradi (masalan `NOT_MOBILE`).
 */
function toFieldErrorCode(issue: z.ZodIssue): FieldErrorCode {
  if (issue.code === 'custom') {
    const params = issue.params;
    if (params && typeof params['fieldCode'] === 'string') {
      return params['fieldCode'] as FieldErrorCode;
    }
    return 'INVALID_FORMAT';
  }

  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' ? 'REQUIRED' : 'INVALID_FORMAT';
    case 'too_small':
      return issue.type === 'string' ? 'TOO_SHORT' : 'OUT_OF_RANGE';
    case 'too_big':
      return issue.type === 'string' ? 'TOO_LONG' : 'OUT_OF_RANGE';
    case 'invalid_string':
    case 'invalid_enum_value':
    case 'invalid_literal':
    case 'invalid_union':
      return 'INVALID_FORMAT';
    default:
      return 'INVALID_FORMAT';
  }
}

export function toFieldErrors(error: ZodError, prefix?: string): FieldError[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    const field = prefix && path ? `${prefix}.${path}` : path || (prefix ?? '(root)');
    return { field, code: toFieldErrorCode(issue), message: issue.message };
  });
}

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

type Parsed<S extends Schemas> = {
  [K in keyof S]: S[K] extends ZodTypeAny ? z.output<S[K]> : undefined;
};

/**
 * Validatsiyalangan so'rovni tipli ko'rinishda handler'ga uzatadi.
 *
 * Express 5 da `req.query` faqat o'qish uchun — shuning uchun natija
 * `req` ustiga yozilmaydi, handler'ga argument sifatida beriladi.
 * Express 5 async xatolarni o'zi ushlaydi, `try/catch` shart emas.
 */
export function route<S extends Schemas>(
  schemas: S,
  handler: (input: Parsed<S>, req: Request, res: Response) => void | Promise<void>,
): RequestHandler {
  return async (req, res, next) => {
    const fields: FieldError[] = [];
    const parsed: Record<string, unknown> = {};

    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (result.success) {
        parsed[key] = result.data;
      } else {
        fields.push(...toFieldErrors(result.error, key === 'body' ? undefined : key));
      }
    }

    if (fields.length > 0) {
      next(ApiError.validation(fields));
      return;
    }

    await handler(parsed as Parsed<S>, req, res);
  };
}
