import {
  adminOrdersQuerySchema,
  adminProductsQuerySchema,
  adminStoresQuerySchema,
  adminUsersQuerySchema,
  assetQueueQuerySchema,
  assetUpdateSchema,
  brandCreateSchema,
  brandUpdateSchema,
  idParamSchema,
  rejectReasonSchema,
} from '@looksave/validation';
import { Router } from 'express';

import {
  findAllOrders,
  findAssetQueue,
  findOrderEvents,
  toAdminOrderDto,
  findGlobalBlocks,
  findProductsForModeration,
  findStores,
  findUsers,
  getOverview,
  removeBlock,
  setProductStatus,
  setStoreStatus,
  toAdminStoreDto,
  toAssetDto,
  toModerationDto,
  unrestrictUser,
  updateAsset,
} from '../admin/admin';
import { createBrand, deleteBrand, findBrands, toBrandDto, updateBrand } from '../admin/brands';
import { decodeCursor, paginate } from '../catalog/cursor';
import { requireAuth, requireRole } from '../http/auth-middleware';
import { sendData, sendList, sendNoContent } from '../http/respond';
import { route } from '../http/validate';

export const adminRouter: Router = Router();

// Faqat admin. Rol JWT dan olinadi, so'rovga ishonilmaydi.
adminRouter.use('/admin', requireAuth, requireRole('admin'));

/** GET /v1/admin/overview — bosh sahifa sanoqlari */
adminRouter.get('/admin/overview', async (_req, res) => {
  sendData(res, await getOverview());
});

/** GET /v1/admin/stores?status=pending */
adminRouter.get(
  '/admin/stores',
  route({ query: adminStoresQuerySchema }, async (input, _req, res) => {
    const cursor = input.query.cursor ? decodeCursor(input.query.cursor) : null;
    const rows = await findStores(input.query, cursor);

    const page = paginate(rows, input.query.limit, (row) => ({
      k: row.created_at_key,
      id: row.id,
    }));

    sendList(res, page.items.map(toAdminStoreDto), page);
  }),
);

adminRouter.post(
  '/admin/stores/:id/approve',
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await setStoreStatus(input.params.id, 'approve', null));
  }),
);

adminRouter.post(
  '/admin/stores/:id/reject',
  route({ params: idParamSchema, body: rejectReasonSchema }, async (input, _req, res) => {
    sendData(res, await setStoreStatus(input.params.id, 'reject', input.body.reason));
  }),
);

adminRouter.post(
  '/admin/stores/:id/suspend',
  route({ params: idParamSchema, body: rejectReasonSchema }, async (input, _req, res) => {
    sendData(res, await setStoreStatus(input.params.id, 'suspend', input.body.reason));
  }),
);

/** GET /v1/admin/products/moderation */
adminRouter.get(
  '/admin/products/moderation',
  route({ query: adminProductsQuerySchema }, async (input, _req, res) => {
    const cursor = input.query.cursor ? decodeCursor(input.query.cursor) : null;
    const rows = await findProductsForModeration(input.query, cursor);

    const page = paginate(rows, input.query.limit, (row) => ({
      k: row.created_at_key,
      id: row.id,
    }));

    sendList(res, page.items.map(toModerationDto), page);
  }),
);

adminRouter.post(
  '/admin/products/:id/approve',
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await setProductStatus(input.params.id, 'active'));
  }),
);

/**
 * Hujjatda faqat `approve` bor, lekin `products.status` da `rejected` mavjud
 * va do'konga sabab ko'rsatish kerak — shuning uchun `reject` ham qo'shildi.
 */
adminRouter.post(
  '/admin/products/:id/reject',
  route({ params: idParamSchema, body: rejectReasonSchema }, async (input, _req, res) => {
    sendData(res, await setProductStatus(input.params.id, 'rejected'));
  }),
);

/** GET /v1/admin/3d-queue?status=queued */
adminRouter.get(
  '/admin/3d-queue',
  route({ query: assetQueueQuerySchema }, async (input, _req, res) => {
    const rows = await findAssetQueue(input.query);
    sendData(res, rows.map(toAssetDto));
  }),
);

/**
 * PATCH /v1/admin/3d-queue/:id
 * `ready` ga o'tkazish uchun GLB va QA natijasi majburiy (07-web-panels §5.3).
 */
adminRouter.patch(
  '/admin/3d-queue/:id',
  route({ params: idParamSchema, body: assetUpdateSchema }, async (input, _req, res) => {
    sendData(res, await updateAsset(input.params.id, input.body));
  }),
);

/** GET /v1/admin/orders — barcha buyurtmalar, nizolar uchun */
adminRouter.get(
  '/admin/orders',
  route({ query: adminOrdersQuerySchema }, async (input, _req, res) => {
    const cursor = input.query.cursor ? decodeCursor(input.query.cursor) : null;
    const rows = await findAllOrders(input.query, cursor);

    const page = paginate(rows, input.query.limit, (row) => ({
      k: row.created_at_key,
      id: row.id,
    }));

    sendList(res, page.items.map(toAdminOrderDto), page);
  }),
);

/** GET /v1/admin/orders/:id/events — to'liq status tarixi */
adminRouter.get(
  '/admin/orders/:id/events',
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await findOrderEvents(input.params.id));
  }),
);

/** GET · DELETE /v1/admin/blocklist — global bloklar */
adminRouter.get('/admin/blocklist', async (_req, res) => {
  sendData(res, await findGlobalBlocks());
});

adminRouter.delete(
  '/admin/blocklist/:id',
  route({ params: idParamSchema }, async (input, _req, res) => {
    await removeBlock(input.params.id);
    sendNoContent(res);
  }),
);

/** GET /v1/admin/users?restricted=true */
adminRouter.get(
  '/admin/users',
  route({ query: adminUsersQuerySchema }, async (input, _req, res) => {
    sendData(res, await findUsers(input.query));
  }),
);

adminRouter.post(
  '/admin/users/:id/unrestrict',
  route({ params: idParamSchema }, async (input, _req, res) => {
    await unrestrictUser(input.params.id);
    sendNoContent(res);
  }),
);

// ── Brendlar (07-web-panels) ──
//
// Ommaviy `GET /v1/brands` faqat ro'yxatni beradi; bu yerdagilar esa
// yaratish/tahrirlash uchun va faqat admin roliga ochiq.

/** GET /v1/admin/brands */
adminRouter.get('/admin/brands', async (_req, res) => {
  const rows = await findBrands();
  sendData(res, rows.map(toBrandDto));
});

/** POST /v1/admin/brands */
adminRouter.post(
  '/admin/brands',
  route({ body: brandCreateSchema }, async (input, _req, res) => {
    sendData(res, await createBrand(input.body), 201);
  }),
);

/** PATCH /v1/admin/brands/:id */
adminRouter.patch(
  '/admin/brands/:id',
  route({ params: idParamSchema, body: brandUpdateSchema }, async (input, _req, res) => {
    sendData(res, await updateBrand(input.params.id, input.body));
  }),
);

/** DELETE /v1/admin/brands/:id — mahsuloti bor brend o'chirilmaydi */
adminRouter.delete(
  '/admin/brands/:id',
  route({ params: idParamSchema }, async (input, _req, res) => {
    await deleteBrand(input.params.id);
    sendNoContent(res);
  }),
);
