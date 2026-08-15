import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

/**
 * Har so'rovga id beriladi va javob meta'sida qaytadi.
 * Foydalanuvchi "buyurtmam ketmadi" desa, log'dan aynan shu so'rov topiladi.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('X-Request-Id');
  const id = incoming && incoming.length <= 64 ? incoming : `req_${randomUUID()}`;

  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
