import { randomBytes } from 'node:crypto';

import type { AccessTokenPayload } from '@looksave/shared-types';
import type { Response } from 'express';
import type { PoolClient } from 'pg';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { getAuth } from '../http/auth-middleware';

/**
 * Do'kon paneli xizmatlari (03-api-spec §13).
 *
 * Barcha endpointlar `store_owner` yoki `staff` rolini VA JWT dagi
 * `storeIds` mosligini talab qiladi.
 */

/**
 * Qaysi do'kon bilan ishlayapmiz.
 *
 * Bitta do'koni bo'lsa — avtomatik. Bir nechta bo'lsa `X-Store-Id`
 * sarlavhasi yoki `?storeId=` kerak. Do'kon id JWT dan tekshiriladi,
 * so'rovga ishonilmaydi.
 */
export function resolveStoreId(res: Response, requested?: string): string {
  const auth: AccessTokenPayload = getAuth(res);

  if (auth.role === 'admin') {
    if (!requested) throw new ApiError('BAD_REQUEST', 'storeId ko`rsatilishi kerak');
    return requested;
  }

  if (auth.storeIds.length === 0) {
    throw ApiError.forbidden('Sizga do`kon biriktirilmagan');
  }

  if (requested) {
    if (!auth.storeIds.includes(requested)) {
      throw ApiError.forbidden('Bu do`konga ruxsatingiz yo`q');
    }
    return requested;
  }

  if (auth.storeIds.length > 1) {
    throw new ApiError('BAD_REQUEST', 'X-Store-Id sarlavhasi kerak', {
      storeIds: auth.storeIds,
    });
  }

  const storeId = auth.storeIds[0];
  if (!storeId) throw ApiError.forbidden('Sizga do`kon biriktirilmagan');
  return storeId;
}

// ============================================================
// Dashboard
// ============================================================

export async function getDashboard(storeId: string) {
  const { rows } = await pool.query<{
    new_orders: string;
    in_progress: string;
    completed_month: string;
    revenue_month: string;
    avg_response_min: string | null;
    confirm_rate: string | null;
    currency: string;
    product_count: string;
    product_3d_count: string;
    pending_3d: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM orders WHERE store_id = $1 AND status = 'new') AS new_orders,
       (SELECT COUNT(*) FROM orders WHERE store_id = $1
          AND status IN ('seen','confirmed','ready'))                       AS in_progress,
       (SELECT COUNT(*) FROM orders WHERE store_id = $1 AND status = 'completed'
          AND completed_at > date_trunc('month', now()))                    AS completed_month,
       -- Pul: NUMERIC → text, aniqlik yo'qolmasin
       (SELECT COALESCE(SUM(total), 0)::text FROM orders WHERE store_id = $1
          AND status = 'completed' AND completed_at > date_trunc('month', now()))
                                                                            AS revenue_month,
       (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (seen_at - created_at)) / 60))::text
          FROM orders WHERE store_id = $1 AND seen_at IS NOT NULL
           AND created_at > now() - interval '30 days')                     AS avg_response_min,
       (SELECT ROUND(
                 COUNT(*) FILTER (WHERE status IN ('confirmed','ready','completed'))::numeric
                 / NULLIF(COUNT(*) FILTER (WHERE status <> 'new'), 0), 3)::text
          FROM orders WHERE store_id = $1
           AND created_at > now() - interval '30 days')                     AS confirm_rate,
       (SELECT currency FROM stores WHERE id = $1)                          AS currency,
       (SELECT COUNT(*) FROM products WHERE store_id = $1 AND status = 'active')
                                                                            AS product_count,
       (SELECT COUNT(*) FROM products WHERE store_id = $1 AND status = 'active' AND has_3d)
                                                                            AS product_3d_count,
       (SELECT COUNT(*) FROM assets_3d a
          JOIN product_variants v ON v.id = a.variant_id
          JOIN products p ON p.id = v.product_id
         WHERE p.store_id = $1 AND a.status IN ('queued','processing'))      AS pending_3d`,
    [storeId],
  );

  const stats = rows[0];
  if (!stats) throw ApiError.notFound('Do`kon topilmadi');

  const { rows: top } = await pool.query<{
    id: string;
    title: string;
    orders: string;
    tryons: number;
  }>(
    `SELECT p.id, p.title, p.tryon_count AS tryons,
            COUNT(oi.id) AS orders
       FROM products p
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN order_items oi ON oi.variant_id = v.id
      WHERE p.store_id = $1 AND p.status = 'active'
      GROUP BY p.id, p.title, p.tryon_count
      ORDER BY COUNT(oi.id) DESC, p.tryon_count DESC
      LIMIT 5`,
    [storeId],
  );

  return {
    newOrders: Number(stats.new_orders),
    inProgress: Number(stats.in_progress),
    completedMonth: Number(stats.completed_month),
    revenueMonth: stats.revenue_month,
    currency: stats.currency,
    avgResponseMin: stats.avg_response_min === null ? null : Number(stats.avg_response_min),
    confirmRate: stats.confirm_rate === null ? null : Number(stats.confirm_rate),
    productCount: Number(stats.product_count),
    product3dCount: Number(stats.product_3d_count),
    pending3d: Number(stats.pending_3d),
    topProducts: top.map((row) => ({
      id: row.id,
      title: row.title,
      orders: Number(row.orders),
      tryons: row.tryons,
    })),
  };
}

// ============================================================
// Buyurtmalar ro'yxati
// ============================================================

const STATUS_FILTER: Record<string, string[] | null> = {
  new: ['new'],
  active: ['new', 'seen', 'confirmed', 'ready'],
  completed: ['completed'],
  cancelled: ['cancelled', 'rejected', 'expired'],
  all: null,
};

export interface StoreOrderRow {
  id: string;
  order_number: string;
  status: string;
  created_at: Date;
  created_at_key: string;
  expires_at: Date;
  delivery_type: string;
  contact_name: string;
  contact_phone: string;
  address: unknown;
  note: string | null;
  subtotal: string;
  delivery_fee: string;
  total: string;
  currency: string;
  payment_method: string;
  payment_status: string;
  items: Array<{ title: string; size: string; qty: number; unit_price: string }>;
  completed_orders: number;
  cancelled_orders: number;
}

export async function findStoreOrders(
  storeId: string,
  status: string,
  limit: number,
  cursor: { k: string; id: string } | null,
) {
  const params: unknown[] = [storeId];
  const conditions = ['o.store_id = $1'];

  const statuses = STATUS_FILTER[status] ?? null;
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

  params.push(limit + 1);

  const { rows } = await pool.query<StoreOrderRow>(
    `SELECT o.id, o.order_number, o.status, o.created_at, o.expires_at, o.delivery_type,
            o.contact_name, o.contact_phone, o.address, o.note,
            o.subtotal, o.delivery_fee, o.total, o.currency,
            o.payment_method, o.payment_status,
            to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'
              AS created_at_key,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'title', oi.snapshot->>'title',
                       'size', oi.size, 'qty', oi.qty,
                       'unit_price', oi.unit_price::text) ORDER BY oi.id)
                FROM order_items oi WHERE oi.order_id = o.id
            ), '[]'::json) AS items,
            COALESCE(t.orders_completed, 0) AS completed_orders,
            COALESCE(t.orders_cancelled, 0) AS cancelled_orders
       FROM orders o
       LEFT JOIN user_trust t ON t.user_id = o.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $${params.length}`,
    params,
  );

  return rows;
}

export function toStoreOrderDto(row: StoreOrderRow) {
  const minutesLeft = Math.max(0, Math.round((row.expires_at.getTime() - Date.now()) / 60_000));

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    minutesLeft: row.status === 'new' ? minutesLeft : null,
    customer: { name: row.contact_name, phone: row.contact_phone },
    deliveryType: row.delivery_type,
    address: row.address,
    note: row.note,
    items: row.items.map((item) => ({
      title: item.title,
      size: item.size,
      qty: item.qty,
      unitPrice: item.unit_price,
    })),
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    currency: row.currency,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    // Sotuvchiga qaror qabul qilishga yordam beradi (§13)
    customerTrust: {
      completedOrders: row.completed_orders,
      cancelledOrders: row.cancelled_orders,
    },
  };
}

// ============================================================
// Status o'zgartirish
// ============================================================

export type StoreAction = 'seen' | 'confirm' | 'reject' | 'ready' | 'complete' | 'noshow';

interface Transition {
  from: string[];
  to: string;
}

const TRANSITIONS: Record<StoreAction, Transition> = {
  seen: { from: ['new'], to: 'seen' },
  confirm: { from: ['new', 'seen'], to: 'confirmed' },
  reject: { from: ['new', 'seen'], to: 'rejected' },
  ready: { from: ['confirmed'], to: 'ready' },
  complete: { from: ['ready'], to: 'completed' },
  noshow: { from: ['ready'], to: 'cancelled' },
};

export interface TransitionInput {
  storeId: string;
  orderId: string;
  action: StoreAction;
  actorId: string | null;
  channel: 'panel' | 'telegram';
  reason?: string | undefined;
  comment?: string | undefined;
  blockPhone?: boolean | undefined;
  paymentMethod?: 'cash' | 'card_offline' | 'transfer' | undefined;
}

export interface TransitionResult {
  id: string;
  orderNumber: string;
  status: string;
  previousStatus: string;
}

/**
 * Status o'zgartirish — panel va Telegram uchun YAGONA yo'l.
 * Ikki joyda alohida yozilsa qoidalar ajralib ketadi.
 */
export async function transitionOrder(input: TransitionInput): Promise<TransitionResult> {
  const rule = TRANSITIONS[input.action];
  const client: PoolClient = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.actor_type', 'store', true)`);
    await client.query(`SELECT set_config('app.channel', $1, true)`, [input.channel]);
    if (input.actorId) {
      await client.query(`SELECT set_config('app.actor_id', $1, true)`, [input.actorId]);
    }

    const { rows } = await client.query<{
      id: string;
      status: string;
      order_number: string;
      contact_phone: string;
      user_id: string;
    }>(
      `SELECT id, status, order_number, contact_phone, user_id
         FROM orders WHERE id = $1 AND store_id = $2 FOR UPDATE`,
      [input.orderId, input.storeId],
    );

    const order = rows[0];
    if (!order) throw ApiError.notFound('Buyurtma topilmadi');

    if (!rule.from.includes(order.status)) {
      throw new ApiError('INVALID_STATE', 'Bu amalni bajarib bo`lmaydi', {
        currentStatus: order.status,
        allowedFrom: rule.from,
      });
    }

    if (input.action === 'reject' && !input.reason) {
      throw new ApiError('VALIDATION_ERROR', 'Rad etish sababi majburiy');
    }

    const fields: string[] = ['status = $3'];
    const params: unknown[] = [input.orderId, input.storeId, rule.to];

    if (input.action === 'reject') {
      params.push([input.reason, input.comment].filter(Boolean).join(': '));
      fields.push(`reject_reason = $${params.length}`);
    }

    if (input.action === 'noshow') {
      params.push('noshow');
      fields.push(`cancel_reason = $${params.length}`);
    }

    if (input.action === 'complete' && input.paymentMethod) {
      params.push(input.paymentMethod);
      fields.push(`payment_method = $${params.length}`, `payment_status = 'paid'`);
    }

    await client.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $1 AND store_id = $2`,
      params,
    );

    // "Kelmadi" alohida hisoblanadi — bu bekor qilishdan boshqa signal
    if (input.action === 'noshow') {
      await client.query(
        `UPDATE user_trust SET orders_noshow = orders_noshow + 1, updated_at = now()
          WHERE user_id = $1`,
        [order.user_id],
      );
    }

    // Qora ro'yxat: 3 do'kon bloklasa global blok (trigger avtomatik)
    if (input.blockPhone === true) {
      await client.query(
        `INSERT INTO order_blocklist (store_id, phone, user_id, reason, created_by)
         VALUES ($1, $2, $3, $4, 'store')
         ON CONFLICT DO NOTHING`,
        [input.storeId, order.contact_phone, order.user_id, input.reason ?? 'store_block'],
      );
    }

    await client.query('COMMIT');

    return {
      id: order.id,
      orderNumber: order.order_number,
      status: rule.to,
      previousStatus: order.status,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// Qora ro'yxat
// ============================================================

export async function listBlocklist(storeId: string) {
  const { rows } = await pool.query<{
    id: string;
    phone: string;
    reason: string;
    created_by: string;
    created_at: Date;
    is_global: boolean;
  }>(
    `SELECT id, phone, reason, created_by, created_at, store_id IS NULL AS is_global
       FROM order_blocklist
      WHERE store_id = $1 OR store_id IS NULL
      ORDER BY created_at DESC
      LIMIT 200`,
    [storeId],
  );

  return rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    // Global blokni do'kon o'chira olmaydi
    isGlobal: row.is_global,
  }));
}

export async function addToBlocklist(
  storeId: string,
  phone: string,
  reason: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO order_blocklist (store_id, phone, reason, created_by)
     VALUES ($1, $2, $3, 'store')
     ON CONFLICT DO NOTHING`,
    [storeId, phone, reason],
  );
}

export async function removeFromBlocklist(storeId: string, id: string): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM order_blocklist WHERE id = $1 AND store_id = $2`,
    [id, storeId],
  );
  if ((rowCount ?? 0) === 0) {
    throw ApiError.notFound('Qora ro`yxatda bunday yozuv yo`q yoki u global');
  }
}

// ============================================================
// Telegram ulash
// ============================================================

/** `LS-A3F8K2` — chalkashadigan belgilar (0/O, 1/I) chiqarib tashlangan. */
function generateLinkCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `LS-${code}`;
}

export async function getTelegramLink(storeId: string, botUsername: string) {
  const { rows } = await pool.query<{
    telegram_chat_id: string | null;
    telegram_link_code: string | null;
    telegram_linked_at: Date | null;
  }>(
    `SELECT telegram_chat_id, telegram_link_code, telegram_linked_at
       FROM stores WHERE id = $1`,
    [storeId],
  );

  const store = rows[0];
  if (!store) throw ApiError.notFound('Do`kon topilmadi');

  if (store.telegram_chat_id !== null) {
    return {
      isLinked: true,
      linkCode: null,
      botUrl: `https://t.me/${botUsername}`,
      linkedAt: store.telegram_linked_at?.toISOString() ?? null,
    };
  }

  let code = store.telegram_link_code;
  if (!code) {
    code = generateLinkCode();
    await pool.query(`UPDATE stores SET telegram_link_code = $2 WHERE id = $1`, [storeId, code]);
  }

  return {
    isLinked: false,
    linkCode: code,
    botUrl: `https://t.me/${botUsername}?start=${code}`,
    linkedAt: null,
  };
}

/** Bot `/start LS-XXXX` olganda chaqiriladi. Kod bir martalik. */
export async function linkTelegramChat(
  code: string,
  chatId: number,
): Promise<{ id: string; name: string } | null> {
  const { rows } = await pool.query<{ id: string; name: string }>(
    `UPDATE stores
        SET telegram_chat_id = $1, telegram_link_code = NULL, telegram_linked_at = now()
      WHERE telegram_link_code = $2
      RETURNING id, name`,
    [chatId, code],
  );
  return rows[0] ?? null;
}

export async function findStoreByChatId(chatId: number): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM stores WHERE telegram_chat_id = $1`,
    [chatId],
  );
  return rows[0]?.id ?? null;
}
