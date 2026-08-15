import { pino, type Logger } from 'pino';

import { env } from './config/env';

/**
 * Strukturalangan loglar. Docker json-file drayveri bilan yaxshi ishlaydi.
 *
 * ⚠️ Telefon, manzil, token — logga TUSHMAYDI (docs/08-deployment.md §12).
 * Shuning uchun `redact` ro'yxati kengaytirilgan.
 */
export const logger: Logger = pino({
  level: env().LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-telegram-bot-api-secret-token"]',
      'req.body.phone',
      'req.body.code',
      'req.body.refreshToken',
      'req.body.contactPhone',
      'req.body.address',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
  base: { version: env().API_TAG },
  timestamp: pino.stdTimeFunctions.isoTime,
});
