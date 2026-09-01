import {
  bodyPhotoSchema,
  createLookSchema,
  suggestLookSchema,
  favoriteQuerySchema,
  idParamSchema,
  renderRequestSchema,
  renderStatusQuerySchema,
  slotSchema,
  tryonEventSchema,
  tryonSlotQuerySchema,
} from '@looksave/validation';
import { Router } from 'express';
import { z } from 'zod';

import { paginate } from '../catalog/cursor';
import { localeOf } from '../catalog/locale';
import { ApiError } from '../http/api-error';
import { getAuth, getAuthOptional, requireAuth } from '../http/auth-middleware';
import { sendData, sendList, sendNoContent } from '../http/respond';
import { route } from '../http/validate';
import { isOwnCdnUrl } from '../integrations/r2';
import { logger } from '../logger';
import { setBodyPhoto } from '../profile/profile';
import { getAvatar, requestAngle, requestAvatar } from '../tryon/avatar';
import { listGarments, listRenders, pollRender, requestRender } from '../tryon/render';
import { suggestLooks } from '../tryon/suggest';
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

// ── AI kiyintirish ──

/**
 * PUT /v1/tryon/body-photo — to'liq bo'yli suratni saqlash.
 *
 * Suratning o'zi R2 ga to'g'ridan-to'g'ri yuboriladi (`/uploads/presign`),
 * bu yerga faqat manzil keladi.
 */
tryonRouter.put(
  '/tryon/body-photo',
  requireAuth,
  route({ body: bodyPhotoSchema }, async (input, _req, res) => {
    /*
     * ⚠️ FAQAT O'Z CDN'IMIZ. Bu manzil keyinchalik AI provayderiga bizning
     * nomimizdan yuboriladi. Tekshirilmasa, istalgan odam istalgan saytdagi
     * rasmni ko'rsatib, bizning hisobimizdan uni qayta ishlatishi mumkin.
     */
    if (!isOwnCdnUrl(input.body.url)) {
      throw new ApiError('VALIDATION_ERROR', 'Surat manzili noto`g`ri');
    }

    await setBodyPhoto(getAuth(res).sub, input.body.url);
    sendData(res, { bodyPhotoUrl: input.body.url });
  }),
);

/**
 * POST /v1/tryon/avatar — to'liq bo'yli avatarni yasashni boshlaydi.
 *
 * Manba: yuz skaneri (`profiles.face_texture_url`) va o'lchovlar.
 * Javob darhol qaytadi, natija fonda tayyorlanadi.
 */
tryonRouter.post('/tryon/avatar', requireAuth, async (_req, res) => {
  sendData(res, await requestAvatar(getAuth(res).sub));
});

/**
 * POST /v1/tryon/avatar/angle — aylantirish uchun burchak yasaydi.
 *
 * ⚠️ HAR BURCHAK ALOHIDA KREDIT, shuning uchun u faqat SO'RALGANDA
 * yasaladi. Yasalgani profilda saqlanadi va keyingi safar bepul keladi.
 */
tryonRouter.post(
  '/tryon/avatar/angle',
  requireAuth,
  route(
    { body: z.object({ angle: z.enum(['front', 'side', 'back']) }) },
    async (input, _req, res) => {
      sendData(res, await requestAngle(getAuth(res).sub, input.body.angle));
    },
  ),
);

/** GET /v1/tryon/avatar — holat. Ilova tayyor bo'lguncha takrorlaydi. */
tryonRouter.get('/tryon/avatar', requireAuth, async (_req, res) => {
  sendData(res, await getAvatar(getAuth(res).sub));
});

/**
 * GET /v1/tryon/garments — AI kiyintirish uchun kiyimlar.
 *
 * Kirish talab qilinmaydi: foydalanuvchi ro'yxatni ko'rib, keyin kirishga
 * qaror qilishi mumkin. Kiyintirishning o'zi esa akkauntga bog'liq.
 */
tryonRouter.get(
  '/tryon/garments',
  route(
    {
      query: z.object({
        /*
         * ⚠️ FAQAT KIYIM SLOTLARI. Model oyoq kiyim, soat va sumka uchun
         * o'qitilmagan — ularni ro'yxatga qo'shsak, foydalanuvchi bosadi,
         * pul sarflanadi va natija yaroqsiz chiqadi.
         */
        slot: z.enum(['top', 'outer', 'bottom']).optional(),
        /*
         * Kategoriya — slotdan ANIQROQ filtr. Futbolka, xudi va ko'ylak
         * uchalasi `top` slotida, lekin foydalanuvchi uchun uch xil
         * narsa. Ilovadagi tablar shu bo'yicha ishlaydi.
         */
        category: z.string().trim().min(1).max(64).optional(),
        gender: z.enum(['male', 'female', 'unisex']).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(30),
      }),
    },
    async (input, _req, res) => {
      const slots = input.query.slot ? [input.query.slot] : ['top', 'outer', 'bottom'];
      sendData(
        res,
        await listGarments(
          slots,
          input.query.gender ?? null,
          input.query.limit,
          input.query.category ?? null,
        ),
      );
    },
  ),
);

/**
 * POST /v1/tryon/render ⭐ — kiyintirishni so'rash.
 *
 * Javob DARHOL qaytadi: natija 5–17 soniyada tayyorlanadi va uni kutib
 * turish so'rovni osib qo'yardi. Kesh bo'lsa `ready` bo'lib darrov keladi.
 */
tryonRouter.post(
  '/tryon/render',
  requireAuth,
  route({ body: renderRequestSchema }, async (input, _req, res) => {
    sendData(res, await requestRender(getAuth(res).sub, input.body.variantId, input.body.angle));
  }),
);

/** GET /v1/tryon/render/:id — holatni so'rash (ilova shu manzilni takrorlaydi). */
tryonRouter.get(
  '/tryon/render/:id',
  requireAuth,
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await pollRender(getAuth(res).sub, input.params.id));
  }),
);

/**
 * GET /v1/tryon/renders?variantIds=a,b,c — gallereya uchun to'plam holati.
 *
 * Svayp paytida har rasm uchun alohida so'rov yuborilsa tarmoq bo'g'iladi.
 */
tryonRouter.get(
  '/tryon/renders',
  requireAuth,
  route({ query: renderStatusQuerySchema }, async (input, _req, res) => {
    sendData(res, await listRenders(getAuth(res).sub, input.query.variantIds, input.query.angle));
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

/**
 * GET /v1/looks/suggest — AI Designer: tadbir va uslubga qarab komplekt.
 *
 * ⚠️ `/looks/:id` DAN OLDIN TURISHI SHART. Express marshrutlarni tartib
 * bo'yicha solishtiradi va `:id` «suggest» ni ham o'ziga oladi — u payt
 * so'rov UUID kutgan validatorga tushib xato beradi.
 *
 * ⚠️ TAKLIF SAQLANMAYDI. U har so'rovda qaytadan yig'iladi va PUL
 * TURMAYDI: bu katalog ustidagi tanlov, AI chaqiruvi emas. Foydalanuvchi
 * yoqqanini tanlagandagina `POST /looks` bilan saqlanadi.
 */
tryonRouter.get(
  '/looks/suggest',
  requireAuth,
  route({ query: suggestLookSchema }, async (input, _req, res) => {
    sendData(
      res,
      await suggestLooks({
        occasion: input.query.occasion,
        style: input.query.style,
        gender: input.query.gender ?? null,
        budget: input.query.budget ?? null,
        count: input.query.count,
      }),
    );
  }),
);

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
