import {
  addMemberSchema,
  analyticsQuerySchema,
  blocklistAddSchema,
  completeOrderSchema,
  createProductSchema,
  idParamSchema,
  noShowSchema,
  presignSchema,
  rejectOrderSchema,
  stockUpdateSchema,
  storeOrdersQuerySchema,
  storeProductsQuerySchema,
  updateMemberSchema,
  updateProductSchema,
  updateStoreSchema,
  variantInputSchema,
  supportsAiTryon,
} from '@looksave/validation';
import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';

import { decodeCursor, paginate } from '../catalog/cursor';
import { env } from '../config/env';
import { openStoreStream } from '../integrations/events';
import { getAnalytics, getInvoices, type Period } from '../store/analytics';
import { prepareGarmentImage } from '../store/garment-image';
import { getStoreProfile, updateStoreProfile } from '../store/profile';
import {
  addMember,
  ensureOwnerMembership,
  listMembers,
  removeMember,
  updateMemberRole,
} from '../store/members';
import { presignUpload } from '../integrations/r2';
import {
  addVariant,
  archiveProduct,
  createProduct,
  findStoreProducts,
  updateProduct,
  updateStock,
  type StoreProductRow,
  findStoreProduct,
} from '../store/products';
import { notifyStatusChange } from '../integrations/notify';
import { getAuth, requireAuth, requireRole } from '../http/auth-middleware';
import { rateLimit } from '../http/rate-limit';
import { localeOf, pickName } from '../catalog/locale';
import { sendData, sendList, sendNoContent } from '../http/respond';
import { route } from '../http/validate';
import {
  addToBlocklist,
  findStoreOrders,
  getDashboard,
  getTelegramLink,
  listBlocklist,
  removeFromBlocklist,
  resolveStoreId,
  toStoreOrderDto,
  transitionOrder,
  type StoreAction,
} from '../store/store';

export const storePanelRouter: Router = Router();

storePanelRouter.use('/store', requireAuth, requireRole('store_owner', 'admin'));

function storeOf(req: Request, res: Response): string {
  const header = req.get('X-Store-Id');
  const query = typeof req.query['storeId'] === 'string' ? req.query['storeId'] : undefined;
  return resolveStoreId(res, header ?? query);
}

/** GET /v1/store/dashboard */
storePanelRouter.get('/store/dashboard', async (req, res) => {
  sendData(res, await getDashboard(storeOf(req, res)));
});

/** GET /v1/store/orders?status=new */
storePanelRouter.get(
  '/store/orders',
  route({ query: storeOrdersQuerySchema }, async (input, req, res) => {
    const cursor = input.query.cursor ? decodeCursor(input.query.cursor) : null;
    const rows = await findStoreOrders(
      storeOf(req, res),
      input.query.status,
      input.query.limit,
      cursor,
    );

    const page = paginate(rows, input.query.limit, (row) => ({
      k: row.created_at_key,
      id: row.id,
    }));

    sendList(res, page.items.map(toStoreOrderDto), page);
  }),
);

/**
 * Status o'zgartirish. Barcha amallar bitta yo'ldan o'tadi —
 * qoidalar `store/store.ts` da, panel va Telegram uchun bir xil.
 */
async function applyAction(
  req: Request,
  res: Response,
  orderId: string,
  action: StoreAction,
  extra: Omit<
    Parameters<typeof transitionOrder>[0],
    'storeId' | 'orderId' | 'action' | 'actorId' | 'channel'
  > = {},
): Promise<void> {
  const result = await transitionOrder({
    storeId: storeOf(req, res),
    orderId,
    action,
    actorId: getAuth(res).sub,
    channel: 'panel',
    ...extra,
  });

  // Telegramdagi xabar ham yangilanadi — sotuvchi bir amalni ikki marta qilmasin
  void notifyStatusChange(result.id, result.status);

  sendData(res, {
    id: result.id,
    orderNumber: result.orderNumber,
    status: result.status,
  });
}

storePanelRouter.post(
  '/store/orders/:id/seen',
  route({ params: idParamSchema }, async (input, req, res) => {
    await applyAction(req, res, input.params.id, 'seen');
  }),
);

storePanelRouter.post(
  '/store/orders/:id/confirm',
  route({ params: idParamSchema }, async (input, req, res) => {
    await applyAction(req, res, input.params.id, 'confirm');
  }),
);

storePanelRouter.post(
  '/store/orders/:id/reject',
  route({ params: idParamSchema, body: rejectOrderSchema }, async (input, req, res) => {
    await applyAction(req, res, input.params.id, 'reject', {
      reason: input.body.reason,
      comment: input.body.comment,
      // Soxta buyurtma → raqam avtomatik bloklanadi (09-integrations §2.5)
      blockPhone: input.body.blockPhone || input.body.reason === 'fake_order',
    });
  }),
);

storePanelRouter.post(
  '/store/orders/:id/ready',
  route({ params: idParamSchema }, async (input, req, res) => {
    await applyAction(req, res, input.params.id, 'ready');
  }),
);

storePanelRouter.post(
  '/store/orders/:id/complete',
  route({ params: idParamSchema, body: completeOrderSchema }, async (input, req, res) => {
    await applyAction(req, res, input.params.id, 'complete', {
      paymentMethod: input.body.paymentMethod,
    });
  }),
);

storePanelRouter.post(
  '/store/orders/:id/report-noshow',
  route({ params: idParamSchema, body: noShowSchema }, async (input, req, res) => {
    await applyAction(req, res, input.params.id, 'noshow', {
      blockPhone: input.body.blockPhone,
      reason: 'noshow',
    });
  }),
);

/** GET /v1/store/analytics?days=30 */
storePanelRouter.get(
  '/store/analytics',
  route({ query: analyticsQuerySchema }, async (input, req, res) => {
    sendData(res, await getAnalytics(storeOf(req, res), input.query.days as Period));
  }),
);

/** GET /v1/store/invoices — komissiya hisoblari (Faza 1-2 da 0, K-12) */
storePanelRouter.get('/store/invoices', async (req, res) => {
  sendData(res, await getInvoices(storeOf(req, res)));
});

/**
 * GET · PATCH /v1/store/profile — do'kon sozlamalari.
 *
 * Ish vaqti `isOpen` ni belgilaydi (katalogda ko'rinadi), joylashuv esa
 * yetkazish radiusini. Ikkalasi ham noto'g'ri bo'lsa mijoz yo yopiq
 * do'konga buyurtma beradi, yo `OUT_OF_RANGE` oladi.
 */
storePanelRouter.get('/store/profile', async (req, res) => {
  sendData(res, await getStoreProfile(storeOf(req, res)));
});

storePanelRouter.patch(
  '/store/profile',
  route({ body: updateStoreSchema }, async (input, req, res) => {
    sendData(res, await updateStoreProfile(storeOf(req, res), input.body));
  }),
);

/**
 * GET · POST · PATCH · DELETE /v1/store/members — jamoa.
 * Xodim avval ilovada ro'yxatdan o'tishi kerak: parol va raqam
 * tasdiqlash uning o'zida qolishi kerak.
 */
storePanelRouter.get('/store/members', async (req, res) => {
  const storeId = storeOf(req, res);
  await ensureOwnerMembership(storeId);
  sendData(res, await listMembers(storeId));
});

storePanelRouter.post(
  '/store/members',
  route({ body: addMemberSchema }, async (input, req, res) => {
    const storeId = storeOf(req, res);
    await addMember(storeId, input.body.phone, input.body.role);
    sendData(res, await listMembers(storeId), 201);
  }),
);

storePanelRouter.patch(
  '/store/members/:id',
  route({ params: idParamSchema, body: updateMemberSchema }, async (input, req, res) => {
    const storeId = storeOf(req, res);
    await updateMemberRole(storeId, input.params.id, input.body.role);
    sendData(res, await listMembers(storeId));
  }),
);

storePanelRouter.delete(
  '/store/members/:id',
  route({ params: idParamSchema }, async (input, req, res) => {
    await removeMember(storeOf(req, res), input.params.id);
    sendNoContent(res);
  }),
);

/** GET · POST · DELETE /v1/store/blocklist */
storePanelRouter.get('/store/blocklist', async (req, res) => {
  sendData(res, await listBlocklist(storeOf(req, res)));
});

storePanelRouter.post(
  '/store/blocklist',
  route({ body: blocklistAddSchema }, async (input, req, res) => {
    await addToBlocklist(storeOf(req, res), input.body.phone, input.body.reason);
    sendData(res, await listBlocklist(storeOf(req, res)), 201);
  }),
);

storePanelRouter.delete(
  '/store/blocklist/:id',
  route({ params: idParamSchema }, async (input, req, res) => {
    await removeFromBlocklist(storeOf(req, res), input.params.id);
    sendNoContent(res);
  }),
);

/** GET /v1/store/telegram/link */
storePanelRouter.get('/store/telegram/link', async (req, res) => {
  sendData(res, await getTelegramLink(storeOf(req, res), env().TELEGRAM_BOT_USERNAME));
});

/**
 * GET /v1/store/events/stream — SSE (03-api-spec §14).
 *
 * ⚠️ Caddy'da `flush_interval -1` bo'lishi shart, aks holda hodisalar
 * buferlanadi va panel yangi buyurtmani ko'rmaydi.
 */
storePanelRouter.get('/store/events/stream', (req, res) => {
  openStoreStream(res, storeOf(req, res));
});

// ============================================================
// Mahsulotlar (03-api-spec §13)
// ============================================================

function toStoreProductDto(row: StoreProductRow, locale: Parameters<typeof pickName>[1]) {
  const images = Array.isArray(row.images) ? row.images : [];
  const total = Number(row.total_stock);
  const reserved = Number(row.reserved_stock);

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    image: typeof images[0] === 'string' ? images[0] : null,
    category: { slug: row.category_slug, name: pickName(row.category_name, locale) },
    // Pul — string
    price: row.base_price,
    oldPrice: row.old_price,
    currency: row.currency,
    stock: { total, reserved, available: Math.max(0, total - reserved) },
    /*
     * ⚠️ `has3d` VA `assetStatus` OLIB TASHLANDI. Sotuvchi endi 3D model
     * so'ramaydi — u kiyimning suratini va o'lchamlarini kiritadi, xolos.
     * Kiyib ko'rish AI orqali suratdan bo'ladi.
     *
     * Panelda «3D» ustuni turgani sotuvchini chalg'itardi: u tayyor
     * bo'lishini kutardi, holbuki mahsulot allaqachon kiyib ko'rishga
     * yaroqli edi.
     */
    canTryOn: supportsAiTryon(row.slot),
    viewCount: row.view_count,
    tryonCount: row.tryon_count,
    createdAt: row.created_at.toISOString(),
  };
}

/** GET /v1/store/products */
storePanelRouter.get(
  '/store/products',
  route({ query: storeProductsQuerySchema }, async (input, req, res) => {
    const cursor = input.query.cursor ? decodeCursor(input.query.cursor) : null;
    const rows = await findStoreProducts(storeOf(req, res), input.query, cursor);
    const locale = localeOf(req);

    const page = paginate(rows, input.query.limit, (row) => ({
      k: row.created_at_key,
      id: row.id,
    }));

    sendList(
      res,
      page.items.map((row) => toStoreProductDto(row, locale)),
      page,
    );
  }),
);

/** GET /v1/store/products/:id — tahrirlash sahifasi uchun */
storePanelRouter.get(
  '/store/products/:id',
  route({ params: idParamSchema }, async (input, req, res) => {
    const row = await findStoreProduct(storeOf(req, res), input.params.id);
    const locale = localeOf(req);

    sendData(res, {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      price: row.base_price,
      oldPrice: row.old_price,
      currency: row.currency,
      images: Array.isArray(row.images) ? row.images : [],
      tags: row.tags,
      isLimited: row.is_limited,
      gender: row.gender,
      categoryId: row.category_id,
      categorySlug: row.category_slug,
      brandId: row.brand_id,
      createdAt: row.created_at.toISOString(),
      variants: (row.variants ?? []).map((variant) => ({
        id: variant.id,
        colorHex: variant.color_hex,
        colorName: pickName(variant.color_name, locale),
        priceDelta: variant.price_delta,
        images: Array.isArray(variant.images) ? variant.images : [],
        assetStatus: variant.asset_status,
        sizes: variant.sizes ?? [],
      })),
    });
  }),
);

/** POST /v1/store/products */
storePanelRouter.post(
  '/store/products',
  route({ body: createProductSchema }, async (input, req, res) => {
    sendData(res, await createProduct(storeOf(req, res), input.body), 201);
  }),
);

/** PATCH /v1/store/products/:id */
storePanelRouter.patch(
  '/store/products/:id',
  route({ params: idParamSchema, body: updateProductSchema }, async (input, req, res) => {
    sendData(res, await updateProduct(storeOf(req, res), input.params.id, input.body));
  }),
);

/** DELETE /v1/store/products/:id → `archived` (o'chirilmaydi: eski buyurtmalar) */
storePanelRouter.delete(
  '/store/products/:id',
  route({ params: idParamSchema }, async (input, req, res) => {
    await archiveProduct(storeOf(req, res), input.params.id);
    sendNoContent(res);
  }),
);

/** POST /v1/store/products/:id/variants */
storePanelRouter.post(
  '/store/products/:id/variants',
  route({ params: idParamSchema, body: variantInputSchema }, async (input, req, res) => {
    sendData(res, await addVariant(storeOf(req, res), input.params.id, input.body), 201);
  }),
);

/** PATCH /v1/store/variants/:id/stock */
storePanelRouter.patch(
  '/store/variants/:id/stock',
  route({ params: idParamSchema, body: stockUpdateSchema }, async (input, req, res) => {
    sendData(res, await updateStock(storeOf(req, res), input.params.id, input.body.sizes));
  }),
);

/**
 * POST /v1/store/uploads/presign
 * Fayl to'g'ridan-to'g'ri R2 ga yuklanadi, serverdan o'tmaydi.
 */
storePanelRouter.post(
  '/store/uploads/presign',
  rateLimit({ windowSec: 60, max: 60, prefix: 'store:presign' }),
  route({ body: presignSchema }, async (input, req, res) => {
    storeOf(req, res);
    sendData(res, await presignUpload(input.body));
  }),
);

/**
 * POST /v1/store/uploads/prepare — kiyim suratini kiyintirish uchun tayyorlash.
 *
 * ⚠️ NEGA ALOHIDA QADAM: surat R2 ga TO'G'RIDAN-TO'G'RI yuklanadi va server
 * uning baytlarini ko'rmaydi. Ishlov berish uchun uni qaytarib olish kerak,
 * shuning uchun bu yuklashdan keyingi alohida chaqiruv.
 *
 * ⚠️ CHEGARA QAT'IY: fon olib tashlash protsessorni band qiladi (bir necha
 * soniya). Chegarasiz bir do'kon ko'p rasm yuborib butun API'ni sekinlashtira
 * olardi.
 */
storePanelRouter.post(
  '/store/uploads/prepare',
  rateLimit({ windowSec: 60, max: 15, prefix: 'store:prepare' }),
  route({ body: z.object({ url: z.string().url().max(500) }) }, async (input, req, res) => {
    storeOf(req, res);
    sendData(res, await prepareGarmentImage(input.body.url));
  }),
);
