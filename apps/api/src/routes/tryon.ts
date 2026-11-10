import {
  AI_TRYON_SLOTS,
  bodyPhotoSchema,
  createLookSchema,
  garmentQuerySchema,
  suggestLookSchema,
  favoriteQuerySchema,
  idParamSchema,
  renderBatchSchema,
  renderRequestSchema,
  renderStatusQuerySchema,
  slotSchema,
  tryonEventSchema,
  tryonSlotQuerySchema,
  tryonStoresQuerySchema,
} from '@looksave/validation';
import { Router } from 'express';
import { z } from 'zod';

import { paginate } from '../catalog/cursor';
import { pool } from '../db/pool';
import { attachRenderCutout } from '../developer-ai/tasks';
import { localeOf } from '../catalog/locale';
import { ApiError } from '../http/api-error';
import { getAuth, getAuthOptional, requireAuth } from '../http/auth-middleware';
import { sendData, sendList, sendNoContent } from '../http/respond';
import { route } from '../http/validate';
import { isOwnCdnUrl } from '../integrations/r2';
import { logger } from '../logger';
import { setBodyPhoto } from '../profile/profile';
import { ensureAvatarCutout, getAvatar, requestAngle, requestAvatar } from '../tryon/avatar';
import {
  listGarments,
  listRenders,
  listTryonStores,
  pollRender,
  requestRender,
  requestRenderBatch,
  requestBundleRender,
} from '../tryon/render';
import { suggestLooks } from '../tryon/suggest';
import {
  addFavorite,
  createLook,
  deleteLook,
  getSharedLook,
  setLookShared,
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
tryonRouter.post(
  '/tryon/avatar',
  requireAuth,
  route(
    { body: z.object({ storeId: z.string().uuid().nullish() }).partial() },
    async (input, _req, res) => {
      sendData(res, await requestAvatar(getAuth(res).sub, input.body.storeId ?? null));
    },
  ),
);

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

/** POST /v1/tryon/avatar/cutout — eski avatar fonini qayta ajratish. */
tryonRouter.post('/tryon/avatar/cutout', requireAuth, async (_req, res) => {
  sendData(res, await ensureAvatarCutout(getAuth(res).sub));
});

/**
 * POST /v1/tryon/renders/reprocess-cutouts — foydalanuvchining `cutout_url`
 * null bo'lgan renderlariga qayta cutout yasash (fly.io orqali). Fon bilan
 * kelayotgan eski renderlarni tozalash uchun.
 *
 * ⚠️ FONDA ISHLAYDI. Javob darhol qaytadi — `queued: N` soni bilan. Natija
 * mobile client avtomatik polling bilan ko'rinadi.
 */
tryonRouter.post('/tryon/renders/reprocess-cutouts', requireAuth, async (_req, res) => {
  const userId = getAuth(res).sub;
  const { rows } = await pool.query<{ id: string; result_url: string }>(
    `SELECT id, result_url FROM tryon_renders
      WHERE user_id = $1
        AND status = 'ready'
        AND result_url IS NOT NULL
        AND cutout_url IS NULL
      LIMIT 100`,
    [userId],
  );
  for (const row of rows) {
    void attachRenderCutout(row.id, row.result_url);
  }
  sendData(res, { queued: rows.length });
});

/** GET /v1/tryon/avatar — holat. Ilova tayyor bo'lguncha takrorlaydi. */
tryonRouter.get('/tryon/avatar', requireAuth, async (_req, res) => {
  sendData(res, await getAvatar(getAuth(res).sub));
});

/**
 * GET /v1/tryon/garments — AI kiyintirish uchun kiyimlar.
 *
 * Kirish talab qilinmaydi: foydalanuvchi ro'yxatni ko'rib, keyin kirishga
 * qaror qilishi mumkin. Kiyintirishning o'zi esa akkauntga bog'liq.
 *
 * ⚠️ FILTRLAR ENDI `garmentQuerySchema` DA (`@looksave/validation`).
 * Ilgari ular shu yerda, marshrut ichida yozilgan edi va ilova bilan
 * server bir-biridan ajralib ketishi mumkin edi.
 */
tryonRouter.get(
  '/tryon/garments',
  route({ query: garmentQuerySchema }, async (input, _req, res) => {
    const query = input.query;
    sendData(
      res,
      await listGarments({
        /*
         * ⚠️ SUKUT RO'YXATI `AI_TRYON_SLOTS` DAN OLINADI.
         *
         * Ilgari bu yerda uchta slot QOTIRIB yozilgan edi va oyoq kiyim
         * qo'shilganda ro'yxat ikki joyda ayri tushib qolardi: `feet`
         * ruxsat etilgan, lekin sukut so'rovga tushmasdi.
         */
        slots: query.slot ? [query.slot] : [...AI_TRYON_SLOTS],
        gender: query.gender ?? null,
        category: query.category ?? null,
        style: query.style ?? null,
        storeId: query.storeId ?? null,
        size: query.size ?? null,
        variantIds: query.variantIds ?? null,
        limit: query.limit,
      }),
    );
  }),
);

/**
 * GET /v1/tryon/stores — AI kiyintirishga mos do'konlar.
 *
 * ⚠️ `/stores/nearby` DAN BOSHQA RO'YXAT. U do'konlarni 3D modellari
 * bo'yicha sanaydi; bu yerda esa AI kiyintira oladigan kiyimlar
 * sanaladi — ikkalasi butunlay boshqa to'plam. Ekranning pastidagi
 * «boshqa do'kon» tanlagichi aynan shuni ko'rsatadi.
 */
tryonRouter.get(
  '/tryon/stores',
  route({ query: tryonStoresQuerySchema }, async (input, _req, res) => {
    res.setHeader('Cache-Control', 'private, max-age=60');
    sendData(res, await listTryonStores(input.query));
  }),
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
    sendData(
      res,
      await requestRender(
        getAuth(res).sub,
        input.body.variantId,
        input.body.angle,
        input.body.baseRenderId ?? null,
      ),
    );
  }),
);

/**
 * POST /v1/tryon/render/batch — bir yo'la ko'p kiyimni navbatga qo'yish.
 *
 * ⚠️ `/render` NI TAKRORLAMAYDI, UNI YIG'ADI. Ilova tasmadagi hamma
 * kiyimni oldindan kiyintiradi; har biri uchun alohida `POST` yuborilsa
 * 30 ta parallel so'rov ketardi va chegaraga urilganlari xato bilan
 * qaytardi. Bu yerda chegara XATO EMAS: qolganlari navbatga tushmaydi
 * va `limitReached` bilan aytiladi.
 *
 * ⚠️ POST BO'LGANI UCHUN `GET /render/:id` bilan to'qnashmaydi. Agar
 * kelajakda `POST /render/:id` qo'shilsa — bu marshrut undan OLDIN
 * turishi shart, aks holda `:id` «batch» ni ham o'ziga oladi.
 */
tryonRouter.post(
  '/tryon/render/batch',
  requireAuth,
  route({ body: renderBatchSchema }, async (input, _req, res) => {
    sendData(
      res,
      await requestRenderBatch(
        getAuth(res).sub,
        input.body.variantIds,
        input.body.angle,
        input.body.baseRenderId ?? null,
      ),
    );
  }),
);

/**
 * POST /v1/tryon/render/bundle — komplekt kiyintirish.
 *
 * ⚠️ FARQI batch'DAN: batch har kiyim uchun alohida render (3 ta GPT
 * chaqiruv). bundle esa BITTA GPT chaqiruvida 2+ kiyimni bitta mannequinda
 * birlashtiradi va natija har bir variant uchun yaxlit ready qatorga
 * yoziladi. Chegara 1 ta sanaladi, GPT'ga ham 1 marta to'laymiz.
 */
tryonRouter.post(
  '/tryon/render/bundle',
  requireAuth,
  route({ body: renderBatchSchema }, async (input, _req, res) => {
    sendData(
      res,
      await requestBundleRender(
        getAuth(res).sub,
        input.body.variantIds,
        input.body.angle,
      ),
    );
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
    sendData(
      res,
      await listRenders(
        getAuth(res).sub,
        input.query.variantIds,
        input.query.angle,
        input.query.baseRenderId ?? null,
        input.query.scope,
      ),
    );
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

/*
 * ⚠️ `/looks/shared/:id` `/looks/:id` DAN OLDIN TURISHI SHART.
 *
 * Express marshrutlarni tartib bo'yicha sinaydi. Pastdagi `/looks/:id`
 * «shared» so'zini ham `id` deb qabul qilardi va ochiq o'qish hech qachon
 * ishlamasdi (fayl ichida `/looks/suggest` bilan xuddi shu muammo bor —
 * u ham shu sababdan tepada turibdi).
 */
tryonRouter.get(
  '/looks/shared/:id',
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await getSharedLook(input.params.id));
  }),
);

/** Ulashishni yoqish — faqat egasi, va istalgan payt qaytarib olinadi. */
tryonRouter.post(
  '/looks/:id/share',
  requireAuth,
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await setLookShared(getAuth(res).sub, input.params.id, true));
  }),
);

tryonRouter.delete(
  '/looks/:id/share',
  requireAuth,
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await setLookShared(getAuth(res).sub, input.params.id, false));
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
