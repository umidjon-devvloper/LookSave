import {
  idParamSchema,
  nearbyQuerySchema,
  storeApplicationSchema,
  storeMapQuerySchema,
} from '@looksave/validation';
import { Router } from 'express';

import { localeOf, pickName } from '../catalog/locale';
import {
  findNearbyStores,
  findStoreById,
  findStoreCategories,
  findStoresInBounds,
  toNearbyDto,
  toStoreDetailDto,
} from '../catalog/stores';
import { ApiError } from '../http/api-error';
import { getAuth, requireAuth } from '../http/auth-middleware';
import { rateLimit } from '../http/rate-limit';
import { sendData } from '../http/respond';
import { route } from '../http/validate';
import { currentApplication, submitApplication } from '../store/apply';
import { logger } from '../logger';

export const storesRouter: Router = Router();

/**
 * GET /v1/stores/nearby ⭐
 * Ilovaning birinchi ekrani. Eng tez-tez chaqiriladigan so'rov.
 */
storesRouter.get(
  '/stores/nearby',
  route({ query: nearbyQuerySchema }, async (input, _req, res) => {
    const rows = await findNearbyStores(input.query);
    let stores = rows.map(toNearbyDto);

    // `openNow` SQL'da emas, bu yerda filtrlanadi: ish vaqti do'konning
    // vaqt zonasida hisoblanadi va JSONB ichida — SQL'da qilish murakkab
    // va index bermaydi. Ro'yxat kichik (maks 50 ta), narxi sezilmaydi.
    if (input.query.openNow) {
      stores = stores.filter((store) => store.isOpen);
    }

    res.setHeader('Cache-Control', 'private, max-age=60');
    sendData(res, stores);
  }),
);

/** GET /v1/stores/map — klaster yoki marker (zoom'ga qarab) */
storesRouter.get(
  '/stores/map',
  route({ query: storeMapQuerySchema }, async (input, _req, res) => {
    const result = await findStoresInBounds(input.query);
    res.setHeader('Cache-Control', 'public, max-age=120');
    sendData(res, {
      clusters: result.clusters,
      markers: result.markers.map((marker) => ({
        id: marker.id,
        name: marker.name,
        logoUrl: marker.logo_url,
        lat: marker.lat,
        lng: marker.lng,
      })),
    });
  }),
);

/**
 * GET /v1/stores/my-application — ariza holati (panel shu bilan boshlanadi).
 *
 * ⚠️ TARTIB MUHIM: bu marshrut `/stores/:id` dan OLDIN turishi shart.
 * Express birinchi mos kelganini oladi, aks holda `my-application`
 * `:id` sifatida o'qilib UUID validatsiyasida rad etilardi.
 */
storesRouter.get('/stores/my-application', requireAuth, async (_req, res) => {
  const store = await currentApplication(getAuth(res).sub);

  sendData(
    res,
    store === null
      ? { exists: false }
      : {
          exists: true,
          id: store.id,
          name: store.name,
          slug: store.slug,
          status: store.status,
          rejectReason: store.reject_reason,
          createdAt: store.created_at.toISOString(),
        },
  );
});

/** GET /v1/stores/:id */
storesRouter.get(
  '/stores/:id',
  route({ params: idParamSchema }, async (input, req, res) => {
    const store = await findStoreById(input.params.id);
    if (!store) throw ApiError.notFound('Do`kon topilmadi');

    const categories = await findStoreCategories(store.id);
    const locale = localeOf(req);

    sendData(
      res,
      toStoreDetailDto(store, categories, (name) => pickName(name, locale)),
    );
  }),
);

/**
 * POST /v1/stores/apply — do'kon arizasi.
 *
 * ⚠️ Bu endpoint 03-api-spec da yo'q edi — `pending` status va admin
 * tasdiqlash bor, lekin arizani yaratadigan yo'l yo'q edi (do'konlar
 * SQL bilan qo'lda qo'shilgan). Hujjatga qo'shildi.
 *
 * Tasdiqlashni kutmasdan `store_owner` roli beriladi: do'kon egasi
 * panelga kirib mahsulot tayyorlaydi. Do'kon `pending` bo'lgani uchun
 * katalogda ko'rinmaydi.
 */
storesRouter.post(
  '/stores/apply',
  requireAuth,
  // Soxta arizalar navbatni to'ldirmasin
  rateLimit({ windowSec: 86_400, max: 3, prefix: 'store:apply' }),
  route({ body: storeApplicationSchema }, async (input, _req, res) => {
    const userId = getAuth(res).sub;
    const store = await submitApplication(userId, input.body);

    logger.info({ userId, storeId: store.id }, 'do`kon arizasi yuborildi');

    sendData(
      res,
      {
        id: store.id,
        name: store.name,
        slug: store.slug,
        status: store.status,
        createdAt: store.created_at.toISOString(),
      },
      201,
    );
  }),
);
