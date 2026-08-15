import type { Locale } from '@looksave/shared-types';
import type { CreateOrderInput, OrdersQuery } from '@looksave/validation';
import type { PoolClient } from 'pg';

import { pickName } from '../catalog/locale';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';

/**
 * Buyurtma yaratish — tizimning eng muhim amali (03-api-spec §12).
 *
 * Tekshiruvlar hujjatdagi TARTIBDA bajariladi. Tartib muhim: qora ro'yxatdagi
 * odam ombor holatidan xabar topmasligi kerak.
 */

interface StoreRow {
  id: string;
  name: string;
  phone: string;
  currency: string;
  status: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_radius_m: number;
  delivery_fee: string;
  free_delivery_from: string | null;
  avg_response_min: number | null;
  in_radius: boolean | null;
}

interface StockRow {
  variant_id: string;
  size: string;
  available: number;
  title: string;
  base_price: string;
  price_delta: string;
  color_name: Record<string, string> | null;
  product_images: unknown;
  variant_images: unknown;
  sku: string | null;
  brand_name: string | null;
  store_id: string;
}

function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function firstImage(...sources: unknown[]): string | null {
  for (const source of sources) {
    if (Array.isArray(source) && typeof source[0] === 'string') return source[0];
  }
  return null;
}

/** 3-tekshiruv: raqam `verified_phones` da bo'lishi SHART (K-15). */
async function assertPhoneVerified(
  client: PoolClient,
  userId: string,
  phone: string,
): Promise<void> {
  const { rowCount } = await client.query(
    `SELECT 1 FROM verified_phones WHERE user_id = $1 AND phone = $2`,
    [userId, phone],
  );
  if ((rowCount ?? 0) === 0) {
    throw new ApiError('PHONE_NOT_VERIFIED', 'Bu raqam sizning akkauntingizga bog`lanmagan');
  }
}

/** 4-tekshiruv: do'kon qora ro'yxati va global blok. */
async function assertNotBlocked(client: PoolClient, phone: string, storeId: string): Promise<void> {
  const { rowCount } = await client.query(
    `SELECT 1 FROM order_blocklist
      WHERE phone = $1 AND (store_id IS NULL OR store_id = $2)`,
    [phone, storeId],
  );
  if ((rowCount ?? 0) > 0) {
    throw new ApiError('BLOCKED', 'Bu raqam bilan buyurtma berib bo`lmaydi');
  }
}

/** 5-tekshiruv: ishonch balli bo'yicha cheklov. */
async function assertNotRestricted(client: PoolClient, userId: string): Promise<void> {
  const { rows } = await client.query<{ restricted_until: Date | null }>(
    `SELECT restricted_until FROM user_trust
      WHERE user_id = $1 AND is_restricted
        AND (restricted_until IS NULL OR restricted_until > now())`,
    [userId],
  );

  const restriction = rows[0];
  if (restriction) {
    throw new ApiError('RESTRICTED', 'Akkauntingizda vaqtinchalik cheklov bor', {
      until: restriction.restricted_until?.toISOString() ?? null,
    });
  }
}

/** 6-tekshiruv: ochiq buyurtmalar va kunlik limit. */
async function assertWithinLimits(client: PoolClient, userId: string): Promise<void> {
  const { rows } = await client.query<{ open_count: string; daily_count: string }>(
    `SELECT COUNT(*) FILTER (WHERE status IN ('new','seen','confirmed','ready')) AS open_count,
            COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')     AS daily_count
       FROM orders WHERE user_id = $1`,
    [userId],
  );

  const counts = rows[0];
  if (!counts) return;

  if (Number(counts.open_count) >= env().MAX_OPEN_ORDERS) {
    throw new ApiError('LIMIT_REACHED', 'Ochiq buyurtmalaringiz juda ko`p', {
      limit: env().MAX_OPEN_ORDERS,
    });
  }
  if (Number(counts.daily_count) >= env().MAX_DAILY_ORDERS) {
    throw new ApiError('LIMIT_REACHED', 'Kunlik buyurtma limiti tugadi', {
      limit: env().MAX_DAILY_ORDERS,
    });
  }
}

export interface CreatedOrder {
  id: string;
  orderNumber: string;
  status: string;
  expiresAt: string;
  store: { id: string; name: string; phone: string; avgResponseMin: number | null };
  subtotal: string;
  deliveryFee: string;
  total: string;
  currency: string;
  paymentMethod: string;
  paymentNote: string;
}

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
  locale: Locale,
): Promise<CreatedOrder> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Jurnalga kim yozayotgani (007_functions.sql: log_order_status)
    await client.query(`SELECT set_config('app.actor_type', 'customer', true)`);
    await client.query(`SELECT set_config('app.actor_id', $1, true)`, [userId]);
    await client.query(`SELECT set_config('app.channel', 'app', true)`);

    await assertPhoneVerified(client, userId, input.contactPhone);
    await assertNotBlocked(client, input.contactPhone, input.storeId);
    await assertNotRestricted(client, userId);
    await assertWithinLimits(client, userId);

    // 7-tekshiruv: do'kon va yetkazish radiusi
    const point = input.address ? [input.address.lng, input.address.lat] : [null, null];
    const { rows: storeRows } = await client.query<StoreRow>(
      `SELECT s.id, s.name, s.phone, s.currency, s.status, s.delivery_enabled,
              s.pickup_enabled, s.delivery_radius_m, s.delivery_fee, s.free_delivery_from,
              s.avg_response_min,
              CASE WHEN $2::float8 IS NULL THEN NULL
                   ELSE ST_DWithin(s.location, ST_MakePoint($2, $3)::geography,
                                   s.delivery_radius_m)
              END AS in_radius
         FROM stores s WHERE s.id = $1`,
      [input.storeId, point[0], point[1]],
    );

    const store = storeRows[0];
    if (!store || store.status !== 'active') {
      throw ApiError.notFound('Do`kon topilmadi yoki faol emas');
    }

    if (input.deliveryType === 'delivery') {
      if (!store.delivery_enabled) {
        throw new ApiError('INVALID_STATE', 'Bu do`kon yetkazib bermaydi');
      }
      if (store.in_radius !== true) {
        throw new ApiError('OUT_OF_RANGE', 'Manzil yetkazib berish hududidan tashqarida', {
          radiusM: store.delivery_radius_m,
        });
      }
    } else if (!store.pickup_enabled) {
      throw new ApiError('INVALID_STATE', 'Bu do`konda olib ketish mumkin emas');
    }

    // 8-tekshiruv: ombor. `FOR UPDATE` — parallel buyurtmalardan himoya
    // (02-database §10.5). Bu bo'lmasa ikki mijoz oxirgi tovarni bir vaqtda
    // buyurtma qilib qo'yadi.
    const variantIds = input.items.map((item) => item.variantId);
    const sizes = input.items.map((item) => item.size);

    const { rows: stockRows } = await client.query<StockRow>(
      `SELECT vs.variant_id, vs.size, vs.sku,
              GREATEST(0, vs.stock - vs.reserved) AS available,
              p.title, p.base_price, p.images AS product_images, p.store_id,
              v.color_name, v.images AS variant_images, v.price_delta,
              b.name AS brand_name
         FROM variant_stock vs
         JOIN product_variants v ON v.id = vs.variant_id AND v.is_active
         JOIN products p ON p.id = v.product_id AND p.status = 'active'
         LEFT JOIN brands b ON b.id = p.brand_id
        WHERE (vs.variant_id, vs.size) IN (
                SELECT unnest($1::uuid[]), unnest($2::text[])
              )
        FOR UPDATE OF vs`,
      [variantIds, sizes],
    );

    const stockByKey = new Map(stockRows.map((row) => [`${row.variant_id}:${row.size}`, row]));

    let subtotal = 0;
    const lines: Array<{ item: (typeof input.items)[number]; stock: StockRow; unitPrice: number }> =
      [];

    for (const item of input.items) {
      const stock = stockByKey.get(`${item.variantId}:${item.size}`);

      if (!stock) {
        throw new ApiError('OUT_OF_STOCK', 'Mahsulot endi mavjud emas', {
          variantId: item.variantId,
          size: item.size,
        });
      }
      if (stock.store_id !== input.storeId) {
        // Savat do'konlar bo'yicha bo'linadi — aralashib ketmasin
        throw new ApiError('BAD_REQUEST', 'Mahsulot boshqa do`konga tegishli');
      }
      if (stock.available < item.qty) {
        throw new ApiError('OUT_OF_STOCK', `"${stock.title}" — omborda yetarli emas`, {
          variantId: item.variantId,
          size: item.size,
          available: stock.available,
        });
      }

      const unitPrice = Number(stock.base_price) + Number(stock.price_delta);
      subtotal += unitPrice * item.qty;
      lines.push({ item, stock, unitPrice });
    }

    const freeFrom = store.free_delivery_from;
    const deliveryFee =
      input.deliveryType === 'pickup'
        ? 0
        : freeFrom !== null && subtotal >= Number(freeFrom)
          ? 0
          : Number(store.delivery_fee);

    const total = subtotal + deliveryFee;
    const commissionRate = env().DEFAULT_COMMISSION_RATE;

    const { rows: orderRows } = await client.query<{
      id: string;
      order_number: string;
      status: string;
      expires_at: Date;
    }>(
      `INSERT INTO orders (user_id, store_id, delivery_type, contact_name, contact_phone,
                           address, note, subtotal, delivery_fee, total, currency,
                           commission_rate, commission_due, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               now() + ($14 || ' hours')::interval)
       RETURNING id, order_number, status, expires_at`,
      [
        userId,
        store.id,
        input.deliveryType,
        input.contactName,
        input.contactPhone,
        input.address ? JSON.stringify(input.address) : null,
        input.note ?? null,
        money(subtotal),
        money(deliveryFee),
        money(total),
        store.currency,
        commissionRate,
        money(total * commissionRate),
        String(env().ORDER_EXPIRY_HOURS),
      ],
    );

    const order = orderRows[0];
    if (!order) throw ApiError.internal('Buyurtma yaratilmadi');

    for (const line of lines) {
      // Snapshot — mahsulot keyin o'zgarsa ham buyurtma tarixi buzilmaydi
      const snapshot = {
        title: line.stock.title,
        image: firstImage(line.stock.variant_images, line.stock.product_images),
        brand: line.stock.brand_name,
        colorName: pickName(line.stock.color_name, locale),
        sku: line.stock.sku,
      };

      await client.query(
        `INSERT INTO order_items (order_id, variant_id, size, qty, unit_price,
                                  total_price, snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          line.item.variantId,
          line.item.size,
          line.item.qty,
          money(line.unitPrice),
          money(line.unitPrice * line.item.qty),
          JSON.stringify(snapshot),
        ],
      );

      await client.query(
        `UPDATE variant_stock SET reserved = reserved + $3
          WHERE variant_id = $1 AND size = $2`,
        [line.item.variantId, line.item.size, line.item.qty],
      );
    }

    // Faqat SHU do'kon qatorlari — boshqa do'konlar savatda qoladi
    await client.query(
      `DELETE FROM cart_items ci
        USING carts c, product_variants v, products p
        WHERE ci.cart_id = c.id AND c.user_id = $1
          AND v.id = ci.variant_id AND p.id = v.product_id AND p.store_id = $2`,
      [userId, store.id],
    );

    await client.query('COMMIT');

    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      expiresAt: order.expires_at.toISOString(),
      store: {
        id: store.id,
        name: store.name,
        phone: store.phone,
        avgResponseMin: store.avg_response_min,
      },
      subtotal: money(subtotal),
      deliveryFee: money(deliveryFee),
      total: money(total),
      currency: store.currency,
      paymentMethod: 'cash',
      // K-10: onlayn to'lov yo'q. Ilovada "To'lash" so'zi ishlatilmaydi.
      paymentNote: 'To`lov do`konda yoki yetkazib berilganda',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const STATUS_GROUPS: Record<OrdersQuery['status'], string[] | null> = {
  active: ['new', 'seen', 'confirmed', 'ready'],
  completed: ['completed'],
  cancelled: ['cancelled', 'rejected', 'expired'],
  all: null,
};

export interface OrderListRow {
  id: string;
  order_number: string;
  status: string;
  created_at: Date;
  created_at_key: string;
  expires_at: Date;
  delivery_type: string;
  total: string;
  currency: string;
  store_id: string;
  store_name: string;
  store_logo: string | null;
  item_count: string;
  first_snapshot: unknown;
}

export async function findOrders(
  userId: string,
  query: OrdersQuery,
  cursor: { k: string; id: string } | null,
) {
  const params: unknown[] = [userId];
  const conditions = ['o.user_id = $1'];

  const statuses = STATUS_GROUPS[query.status];
  if (statuses) {
    params.push(statuses);
    conditions.push(`o.status = ANY($${params.length})`);
  }

  if (cursor) {
    params.push(cursor.k, cursor.id);
    conditions.push(
      `(o.created_at, o.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(query.limit + 1);

  const { rows } = await pool.query<OrderListRow>(
    `SELECT o.id, o.order_number, o.status, o.created_at, o.expires_at, o.delivery_type,
            o.total, o.currency,
            to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'
              AS created_at_key,
            s.id AS store_id, s.name AS store_name, s.logo_url AS store_logo,
            items.item_count, items.first_snapshot
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       CROSS JOIN LATERAL (
         SELECT COUNT(*) AS item_count,
                (SELECT snapshot FROM order_items WHERE order_id = o.id LIMIT 1) AS first_snapshot
           FROM order_items WHERE order_id = o.id
       ) items
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $${params.length}`,
    params,
  );

  return rows;
}

export interface OrderDetailRow extends OrderListRow {
  contact_name: string;
  contact_phone: string;
  address: unknown;
  note: string | null;
  subtotal: string;
  delivery_fee: string;
  payment_method: string;
  payment_status: string;
  reject_reason: string | null;
  cancel_reason: string | null;
  store_phone: string;
  store_lat: number;
  store_lng: number;
  items: Array<{
    size: string;
    qty: number;
    unit_price: string;
    total_price: string;
    snapshot: Record<string, unknown>;
  }>;
}

export async function findOrderById(
  userId: string,
  orderId: string,
): Promise<OrderDetailRow | null> {
  const { rows } = await pool.query<OrderDetailRow>(
    `SELECT o.id, o.order_number, o.status, o.created_at, o.expires_at, o.delivery_type,
            o.total, o.currency, o.contact_name, o.contact_phone, o.address, o.note,
            o.subtotal, o.delivery_fee, o.payment_method, o.payment_status,
            o.reject_reason, o.cancel_reason,
            to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'
              AS created_at_key,
            s.id AS store_id, s.name AS store_name, s.logo_url AS store_logo,
            s.phone AS store_phone,
            ST_Y(s.location::geometry) AS store_lat,
            ST_X(s.location::geometry) AS store_lng,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count,
            NULL::jsonb AS first_snapshot,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'size', oi.size, 'qty', oi.qty,
                       -- ::text MAJBURIY: json_build_object ichida NUMERIC
                       -- JSON soniga aylanadi va pul aniqligi yo'qoladi
                       'unit_price', oi.unit_price::text,
                       'total_price', oi.total_price::text,
                       'snapshot', oi.snapshot) ORDER BY oi.id)
                FROM order_items oi WHERE oi.order_id = o.id
            ), '[]'::json) AS items
       FROM orders o
       JOIN stores s ON s.id = o.store_id
      WHERE o.id = $1 AND o.user_id = $2`,
    [orderId, userId],
  );

  return rows[0] ?? null;
}

export async function findOrderEvents(userId: string, orderId: string) {
  const { rows } = await pool.query<{
    from_status: string | null;
    to_status: string;
    actor_type: string;
    channel: string | null;
    comment: string | null;
    created_at: Date;
  }>(
    `SELECT e.from_status, e.to_status, e.actor_type, e.channel, e.comment, e.created_at
       FROM order_events e
       JOIN orders o ON o.id = e.order_id AND o.user_id = $2
      WHERE e.order_id = $1
      ORDER BY e.created_at`,
    [orderId, userId],
  );
  return rows;
}

const CANCELLABLE = ['new', 'seen', 'confirmed'];

/**
 * Mijoz bekor qilishi. `ready` dan keyin mumkin emas — do'kon tovarni
 * allaqachon ajratib qo'ygan (03-api-spec §12).
 */
export async function cancelOrder(
  userId: string,
  orderId: string,
  reason: string | null,
): Promise<{ id: string; status: string }> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.actor_type', 'customer', true)`);
    await client.query(`SELECT set_config('app.actor_id', $1, true)`, [userId]);
    await client.query(`SELECT set_config('app.channel', 'app', true)`);

    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [orderId, userId],
    );

    const order = rows[0];
    if (!order) throw ApiError.notFound('Buyurtma topilmadi');

    if (!CANCELLABLE.includes(order.status)) {
      throw new ApiError(
        'INVALID_STATE',
        order.status === 'ready'
          ? 'Buyurtma tayyor — bekor qilish uchun do`kon bilan bog`laning'
          : 'Bu buyurtmani bekor qilib bo`lmaydi',
        { status: order.status },
      );
    }

    // Rezerv 010_orders_flow.sql dagi trigger orqali qaytariladi
    const { rows: updated } = await client.query<{ id: string; status: string }>(
      `UPDATE orders SET status = 'cancelled', cancel_reason = $3
        WHERE id = $1 AND user_id = $2
        RETURNING id, status`,
      [orderId, userId, reason],
    );

    await client.query('COMMIT');

    const result = updated[0];
    if (!result) throw ApiError.internal('Bekor qilinmadi');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
