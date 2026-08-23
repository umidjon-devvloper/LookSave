import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../db/pool';
import { sendData } from '../http/respond';
import { route } from '../http/validate';

export const waitlistRouter: Router = Router();

const waitlistBodySchema = z.object({
  email: z.string().trim().email().max(254),
  // Ism ixtiyoriy: manzilsiz odamga yozib bo'lmaydi, ismsiz bo'ladi
  name: z.string().trim().min(1).max(120).nullable().optional(),
  role: z.enum(['shopper', 'store']),
  source: z.string().trim().max(60).nullable().optional(),
});

/**
 * POST /v1/waitlist — saytdagi "erta kirish" formasi.
 *
 * ⚠️ TAKROR YUBORISH XATO EMAS. Odam formani ikki marta to'ldirishi juda
 * oddiy holat (sahifani yangiladi, ikkinchi qurilmadan kirdi). Bunga xato
 * qaytarish uni "meni qabul qilishmadimi?" degan o'yga soladi. Shuning
 * uchun takroriy manzil jimgina yutiladi va javob bir xil bo'ladi.
 *
 * ⚠️ AUTENTIFIKATSIYA YO'Q. Bu ochiq forma — token talab qilinmaydi.
 * Suiiste'moldan `globalLimiter` himoya qiladi (`app.ts` da `/v1` ga
 * o'rnatilgan).
 */
waitlistRouter.post(
  '/waitlist',
  route({ body: waitlistBodySchema }, async ({ body }, _req, res) => {
    await pool.query(
      `INSERT INTO waitlist (email, name, role, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(email)) DO NOTHING`,
      [body.email, body.name ?? null, body.role, body.source ?? null],
    );

    sendData(res, { ok: true }, 201);
  }),
);
