import {
  createLookSchema,
  favoriteQuerySchema,
  idParamSchema,
  slotSchema,
  tryonEventSchema,
  tryonSlotQuerySchema,
} from '@looksave/validation';
import { Router } from 'express';
import { z } from 'zod';

import { paginate } from '../catalog/cursor';
import { localeOf } from '../catalog/locale';
import { getAuth, getAuthOptional, requireAuth } from '../http/auth-middleware';
import { sendData, sendList, sendNoContent } from '../http/respond';
import { route } from '../http/validate';
import { logger } from '../logger';
import {
  addFavorite,
  createLook,
  deleteLook,
  getSlotItems,
  getSlots,
  listFavorites,
  listLooks,
  recordTryonEvent,
  removeFavorite,
  toTryonDto,
} from '../tryon/tryon';

export const tryonRouter: Router = Router();

/** GET /v1/tryon/slots — har slotda nechta model bor */
tryonRouter.get(
  '/tryon/slots',
  route(
    { query: z.object({ gender: z.enum(['male', 'female', 'unisex']).optional() }) },
    async (input, req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=300');
      sendData(res, await getSlots(localeOf(req), input.query.gender));
    },
  ),
);

/**
 * GET /v1/tryon/slot/:slot ⭐
 * Ilova bu ro'yxatni xotirada saqlaydi va svaypda tarmoqqa chiqmaydi.
 */
tryonRouter.get(
  '/tryon/slot/:slot',
  route(
    { params: z.object({ slot: slotSchema }), query: tryonSlotQuerySchema },
    async (input, req, res) => {
      const rows = await getSlotItems(input.params.slot, input.query);
      const locale = localeOf(req);

      const page = paginate(rows, input.query.limit, (row) => ({
        k: String(row.tryon_count),
        id: row.variant_id,
      }));

      sendList(
        res,
        page.items.map((row) => toTryonDto(row, locale)),
        page,
      );
    },
  ),
);

/**
 * POST /v1/tryon/event — analitika.
 * Mehmon ham yubora oladi: `user_id` NULL bo'ladi.
 */
tryonRouter.post(
  '/tryon/event',
  route({ body: tryonEventSchema }, async (input, _req, res) => {
    const auth = getAuthOptional(res);

    try {
      await recordTryonEvent(
        auth?.sub ?? null,
        input.body.variantId,
        input.body.durationMs ?? null,
      );
    } catch (err) {
      // Analitika yozilmagani foydalanuvchiga ko'rinmasligi kerak
      logger.warn({ err, variantId: input.body.variantId }, 'tryon event yozilmadi');
    }

    sendNoContent(res);
  }),
);

// ── Sevimlilar ──

tryonRouter.get(
  '/favorites',
  requireAuth,
  route({ query: favoriteQuerySchema }, async (input, _req, res) => {
    sendData(res, await listFavorites(getAuth(res).sub, input.query.limit));
  }),
);

tryonRouter.put(
  '/favorites/:id',
  requireAuth,
  route({ params: idParamSchema }, async (input, _req, res) => {
    await addFavorite(getAuth(res).sub, input.params.id);
    sendData(res, { isFavorite: true });
  }),
);

tryonRouter.delete(
  '/favorites/:id',
  requireAuth,
  route({ params: idParamSchema }, async (input, _req, res) => {
    await removeFavorite(getAuth(res).sub, input.params.id);
    sendData(res, { isFavorite: false });
  }),
);

// ── Komplektlar ──

tryonRouter.get(
  '/looks',
  requireAuth,
  route({ query: favoriteQuerySchema }, async (input, req, res) => {
    sendData(res, await listLooks(getAuth(res).sub, localeOf(req), input.query.limit));
  }),
);

tryonRouter.post(
  '/looks',
  requireAuth,
  route({ body: createLookSchema }, async (input, _req, res) => {
    sendData(res, await createLook(getAuth(res).sub, input.body), 201);
  }),
);

tryonRouter.delete(
  '/looks/:id',
  requireAuth,
  route({ params: idParamSchema }, async (input, _req, res) => {
    await deleteLook(getAuth(res).sub, input.params.id);
    sendNoContent(res);
  }),
);
