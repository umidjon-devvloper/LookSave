import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';

import type { Request, RequestHandler, Response } from 'express';

import { env } from '../config/env';
import { logger } from '../logger';

/**
 * Mehmonning HAQIQIY IP'si — cheklov shuning bo'yicha hisoblanadi.
 *
 * ⚠️ MUAMMO. Sayt SSR bilan ishlaydi: mehmon sahifani so'raganda API ga
 * so'rov MEHMONDAN emas, VEB-SERVERDAN keladi. Ya'ni `req.ip` barcha
 * mehmon uchun bitta — butun sayt daqiqasiga 30 ta so'rovlik BITTA
 * chelakni bo'lishadi (`rate-limit.ts`, 03-api-spec §4). Bir necha kishi
 * bir vaqtda kirsa sahifalar bo'sh ochiladi (15-sayt-dizayn.md S-4).
 *
 * ⚠️ NEGA `X-Forwarded-For` YETMAYDI. Express `trust proxy = 1` bilan
 * XFF ning ENG OXIRGI qiymatini oladi, Caddy esa o'zi ko'rgan IP'ni
 * ro'yxat OXIRIGA qo'shadi. Demak BFF `XFF: <mehmon>` yuborsa, API ga
 * `<mehmon>, <veb-server>` bo'lib yetadi va `req.ip` yana veb-server
 * bo'lib qoladi — o'zgarish umuman ishlamaydi. Hop sonini 2 ga
 * ko'tarish esa teshik ochadi: mobil ilova API ga TO'G'RIDAN-TO'G'RI
 * boradi, ya'ni Caddy'gacha yetadigan har qanday mijoz o'zining
 * XFF'ini yozib cheklovni chetlab o'tardi.
 *
 * ⚠️ YECHIM. BFF o'zini XIZMAT KALITI bilan tanishtiradi va mehmon
 * IP'sini ALOHIDA sarlavhada beradi. Kalit to'g'ri bo'lmasa sarlavha
 * butunlay e'tiborsiz qoladi. Brauzer bu kalitni bilmaydi (u faqat
 * serverda, bundle'ga tushmaydi), demak o'z chegarasini o'zgartira
 * olmaydi. Caddy sarlavhaga tegmaydi — u faqat XFF ni boshqaradi.
 */

/** Xizmat kaliti — faqat server-server. Brauzerga hech qachon berilmaydi. */
export const SERVICE_KEY_HEADER = 'x-looksave-service-key';
/** Mehmon IP'si. Faqat kalit to'g'ri bo'lganda o'qiladi. */
export const CLIENT_IP_HEADER = 'x-looksave-client-ip';

const CLIENT_IP_KEY = 'clientIp';

/**
 * Doimiy vaqtda solishtirish — kalitni belgima-belgi topib bo'lmasin.
 * Uzunlik farq qilsa `timingSafeEqual` xato tashlaydi, shuning uchun
 * oldin uzunlik tekshiriladi.
 */
function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * BFF dan kelgan mehmon IP'sini `res.locals` ga yozadi.
 *
 * Kalit sozlanmagan bo'lsa (dev) yoki mos kelmasa — hech narsa
 * qilinmaydi va cheklov eskicha `req.ip` bo'yicha hisoblanadi.
 */
export const trustedClientIp: RequestHandler = (req, res, next) => {
  const expected = env().INTERNAL_SERVICE_KEY;
  if (!expected) {
    next();
    return;
  }

  const given = req.get(SERVICE_KEY_HEADER);
  if (!given) {
    next();
    return;
  }

  if (!keyMatches(given, expected)) {
    // Kalit bor, lekin noto'g'ri — bu oddiy mehmon emas, sozlama xatosi
    // yoki urinish. Ko'rinib tursin.
    logger.warn({ path: req.path }, 'xizmat kaliti noto`g`ri');
    next();
    return;
  }

  const forwarded = req.get(CLIENT_IP_HEADER);
  // Redis kalitiga tekshirilmagan matn tushmasin: faqat haqiqiy IP.
  if (forwarded && isIP(forwarded) !== 0) {
    res.locals[CLIENT_IP_KEY] = forwarded;
  }

  next();
};

/**
 * Cheklov va audit uchun mijoz IP'si.
 *
 * Tartib: BFF ishonchli aytgan mehmon IP'si → `req.ip` (Caddy XFF'dan).
 */
export function getClientIp(req: Request, res: Response): string | null {
  const trusted: unknown = res.locals[CLIENT_IP_KEY];
  if (typeof trusted === 'string') return trusted;
  return req.ip ?? null;
}
