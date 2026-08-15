import type { Locale } from '@looksave/shared-types';
import {
  cancelOrderSchema,
  createOrderSchema,
  idParamSchema,
  ordersQuerySchema,
} from '@looksave/validation';
import { Router } from 'express';

import { decodeCursor, paginate } from '../catalog/cursor';
import { notifyNewOrder, notifyStatusChange } from '../integrations/notify';
import { localeOf } from '../catalog/locale';
import { ApiError } from '../http/api-error';
import { getAuth, requireAuth } from '../http/auth-middleware';
import { idempotent } from '../http/idempotency';
import { rateLimit } from '../http/rate-limit';
import { sendData, sendList } from '../http/respond';
import { route } from '../http/validate';
import {
  cancelOrder,
  createOrder,
  findOrderById,
  findOrderEvents,
  findOrders,
  type OrderListRow,
} from '../orders/orders';

export const ordersRouter: Router = Router();

ordersRouter.use('/orders', requireAuth);

/**
 * Status yorliqlari — ilova o'zi tarjima qilmasin, chunki status
 * ro'yxati serverda o'zgarishi mumkin.
 */
const STATUS_LABELS: Record<string, Record<Locale, string>> = {
  new: { uz: 'Yuborildi', ru: 'Отправлен', en: 'Sent', ar: 'أُرسل' },
  seen: { uz: 'Do`kon ko`rdi', ru: 'Магазин увидел', en: 'Seen by store', ar: 'شوهد' },
  confirmed: { uz: 'Do`kon tasdiqladi', ru: 'Подтверждён', en: 'Confirmed', ar: 'مؤكد' },
  ready: { uz: 'Tayyor', ru: 'Готов', en: 'Ready', ar: 'جاهز' },
  completed: { uz: 'Yakunlandi', ru: 'Завершён', en: 'Completed', ar: 'مكتمل' },
  rejected: { uz: 'Do`kon rad etdi', ru: 'Отклонён', en: 'Rejected', ar: 'مرفوض' },
  cancelled: { uz: 'Bekor qilindi', ru: 'Отменён', en: 'Cancelled', ar: 'ملغى' },
  expired: { uz: 'Javob kelmadi', ru: 'Нет ответа', en: 'No response', ar: 'لا رد' },
};

function statusLabel(status: string, locale: Locale): string {
  return STATUS_LABELS[status]?.[locale] ?? status;
}

const CANCELLABLE = ['new', 'seen', 'confirmed'];

/**
 * POST /v1/orders ⭐
 * `Idempotency-Key` majburiy — tarmoq uzilsa ikkinchi buyurtma yaratilmaydi.
 */
ordersRouter.post(
  '/orders',
  rateLimit({
    windowSec: 3600,
    max: 10,
    prefix: 'orders:create',
    code: 'LIMIT_REACHED',
    message: 'Soatiga 10 tadan ko`p buyurtma berib bo`lmaydi',
  }),
  idempotent('POST /orders'),
  route({ body: createOrderSchema }, async (input, req, res) => {
    const order = await createOrder(getAuth(res).sub, input.body, localeOf(req));

    // Telegram + panel SSE. Javobni kechiktirmaydi va xato tashlamaydi.
    void notifyNewOrder(order.id);

    sendData(res, { ...order, statusLabel: statusLabel(order.status, localeOf(req)) }, 201);
  }),
);

function toListDto(row: OrderListRow, locale: Locale) {
  const snapshot = (row.first_snapshot ?? {}) as Record<string, unknown>;

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    statusLabel: statusLabel(row.status, locale),
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    deliveryType: row.delivery_type,
    total: row.total,
    currency: row.currency,
    itemCount: Number(row.item_count),
    preview: {
      title: typeof snapshot['title'] === 'string' ? snapshot['title'] : null,
      image: typeof snapshot['image'] === 'string' ? snapshot['image'] : null,
    },
    store: { id: row.store_id, name: row.store_name, logoUrl: row.store_logo },
    canCancel: CANCELLABLE.includes(row.status),
  };
}

/** GET /v1/orders?status=active */
ordersRouter.get(
  '/orders',
  route({ query: ordersQuerySchema }, async (input, req, res) => {
    const cursor = input.query.cursor ? decodeCursor(input.query.cursor) : null;
    const rows = await findOrders(getAuth(res).sub, input.query, cursor);
    const locale = localeOf(req);

    const page = paginate(rows, input.query.limit, (row) => ({
      k: row.created_at_key,
      id: row.id,
    }));

    sendList(
      res,
      page.items.map((row) => toListDto(row, locale)),
      page,
    );
  }),
);

/** GET /v1/orders/:id */
ordersRouter.get(
  '/orders/:id',
  route({ params: idParamSchema }, async (input, req, res) => {
    const order = await findOrderById(getAuth(res).sub, input.params.id);
    if (!order) throw ApiError.notFound('Buyurtma topilmadi');

    const locale = localeOf(req);

    sendData(res, {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      statusLabel: statusLabel(order.status, locale),
      createdAt: order.created_at.toISOString(),
      expiresAt: order.expires_at.toISOString(),
      deliveryType: order.delivery_type,
      contactName: order.contact_name,
      contactPhone: order.contact_phone,
      address: order.address,
      note: order.note,
      store: {
        id: order.store_id,
        name: order.store_name,
        logoUrl: order.store_logo,
        phone: order.store_phone,
        location: { lat: order.store_lat, lng: order.store_lng },
      },
      // `snapshot` dan — mahsulot keyin o'zgarsa ham tarix buzilmaydi
      items: order.items.map((item) => ({
        title: item.snapshot['title'] ?? null,
        image: item.snapshot['image'] ?? null,
        brand: item.snapshot['brand'] ?? null,
        colorName: item.snapshot['colorName'] ?? null,
        size: item.size,
        qty: item.qty,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
      })),
      subtotal: order.subtotal,
      deliveryFee: order.delivery_fee,
      total: order.total,
      currency: order.currency,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      rejectReason: order.reject_reason,
      cancelReason: order.cancel_reason,
      canCancel: CANCELLABLE.includes(order.status),
    });
  }),
);

/** GET /v1/orders/:id/events — status tarixi (nizolarni hal qilish uchun) */
ordersRouter.get(
  '/orders/:id/events',
  route({ params: idParamSchema }, async (input, _req, res) => {
    const events = await findOrderEvents(getAuth(res).sub, input.params.id);

    sendData(
      res,
      events.map((event) => ({
        fromStatus: event.from_status,
        toStatus: event.to_status,
        actorType: event.actor_type,
        channel: event.channel,
        comment: event.comment,
        createdAt: event.created_at.toISOString(),
      })),
    );
  }),
);

/** POST /v1/orders/:id/cancel */
ordersRouter.post(
  '/orders/:id/cancel',
  route({ params: idParamSchema, body: cancelOrderSchema }, async (input, req, res) => {
    const result = await cancelOrder(getAuth(res).sub, input.params.id, input.body.reason ?? null);

    // Do'kon paneli va Telegramdagi xabar ham yangilanadi
    void notifyStatusChange(result.id, result.status);

    sendData(res, {
      id: result.id,
      status: result.status,
      statusLabel: statusLabel(result.status, localeOf(req)),
    });
  }),
);
