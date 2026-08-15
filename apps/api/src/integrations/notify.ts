import { env } from '../config/env';
import { pool } from '../db/pool';
import { logger } from '../logger';
import { publishStoreEvent } from './events';
import { notifyCustomer } from './push';
import {
  editMessageText,
  escapeHtml,
  formatMoney,
  isTelegramEnabled,
  sendMessage,
  type InlineButton,
} from './telegram';

/**
 * Buyurtma haqida xabar berish: Telegram + do'kon panelidagi SSE.
 *
 * ⚠️ Bu funksiyalar hech qachon XATO TASHLAMAYDI. Bildirishnoma
 * yuborilmagani buyurtmani bekor qilish sababi emas (09-integrations §2.6).
 */

interface OrderNotification {
  id: string;
  orderNumber: string;
  storeId: string;
  contactName: string;
  contactPhone: string;
  total: string;
  currency: string;
  deliveryType: string;
  address: { text?: string; lat?: number; lng?: number } | null;
  note: string | null;
  items: Array<{ title: string; size: string; qty: number }>;
  completedOrders: number;
}

async function loadNotification(orderId: string): Promise<OrderNotification | null> {
  const { rows } = await pool.query<OrderNotification>(
    `SELECT o.id, o.order_number AS "orderNumber", o.store_id AS "storeId",
            o.contact_name AS "contactName", o.contact_phone AS "contactPhone",
            o.total, o.currency, o.delivery_type AS "deliveryType",
            o.address, o.note,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'title', oi.snapshot->>'title',
                       'size', oi.size, 'qty', oi.qty) ORDER BY oi.id)
                FROM order_items oi WHERE oi.order_id = o.id
            ), '[]'::json) AS items,
            COALESCE(t.orders_completed, 0) AS "completedOrders"
       FROM orders o
       LEFT JOIN user_trust t ON t.user_id = o.user_id
      WHERE o.id = $1`,
    [orderId],
  );
  return rows[0] ?? null;
}

async function storeChatId(storeId: string): Promise<number | null> {
  const { rows } = await pool.query<{ telegram_chat_id: string | null }>(
    `SELECT telegram_chat_id FROM stores WHERE id = $1`,
    [storeId],
  );
  const raw = rows[0]?.telegram_chat_id;
  // BIGINT `pg` da string bo'lib keladi — Telegram chat_id manfiy ham bo'lishi mumkin (guruh)
  return raw === null || raw === undefined ? null : Number(raw);
}

/** Do'kon botni bloklagan bo'lsa aloqani uzamiz (§2.6). */
async function unlinkStore(storeId: string): Promise<void> {
  await pool.query(
    `UPDATE stores SET telegram_chat_id = NULL, telegram_linked_at = NULL WHERE id = $1`,
    [storeId],
  );
  logger.warn({ storeId }, 'telegram ulanishi uzildi — do`kon botni bloklagan bo`lishi mumkin');
}

function orderButtons(orderId: string, address: OrderNotification['address']): InlineButton[][] {
  // callback_data 64 baytdan oshmasin — `o:c:<uuid>` = 40 bayt (§2.4)
  const buttons: InlineButton[][] = [
    [
      { text: '✅ Tasdiqlash', callback_data: `o:c:${orderId}` },
      { text: '❌ Rad etish', callback_data: `o:r:${orderId}` },
    ],
    [{ text: '📋 Panel', url: `${env().STORE_PANEL_URL}/orders/${orderId}` }],
  ];

  if (address?.lat !== undefined && address.lng !== undefined) {
    buttons.push([
      {
        text: '🗺 Xaritada',
        url: `https://maps.google.com/?q=${address.lat},${address.lng}`,
      },
    ]);
  }

  return buttons;
}

export function buildOrderText(order: OrderNotification): string {
  const items = order.items
    .map((item) => `• ${escapeHtml(item.title)} — ${escapeHtml(item.size)} × ${item.qty}`)
    .join('\n');

  const trust =
    order.completedOrders > 0
      ? `✅ ${order.completedOrders} ta yakunlangan buyurtma`
      : '🆕 Birinchi buyurtma';

  const lines = [
    '🔔 <b>Yangi buyurtma</b>',
    `<code>${escapeHtml(order.orderNumber)}</code>`,
    '',
    `👤 ${escapeHtml(order.contactName)}`,
    `📞 ${escapeHtml(order.contactPhone)}`,
    trust,
    '',
    items,
    '',
    `💰 <b>${formatMoney(order.total, order.currency)}</b>`,
    order.deliveryType === 'delivery' ? '🚚 Yetkazib berish' : '🏪 Do`kondan olib ketadi',
  ];

  if (order.address?.text) lines.push(`📍 ${escapeHtml(order.address.text)}`);
  if (order.note) lines.push('', `💬 <i>${escapeHtml(order.note)}</i>`);
  lines.push('', `⏱ Javob berish uchun ${env().ORDER_EXPIRY_HOURS} soat`);

  return lines.join('\n');
}

/** Yangi buyurtma: Telegramga xabar + panelga SSE. */
export async function notifyNewOrder(orderId: string): Promise<void> {
  try {
    const order = await loadNotification(orderId);
    if (!order) return;

    publishStoreEvent(order.storeId, 'order.new', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
    });

    if (!isTelegramEnabled()) return;

    const chatId = await storeChatId(order.storeId);
    if (chatId === null) return; // ulanmagan — jim o'tkaziladi

    const sent = await sendMessage(
      chatId,
      buildOrderText(order),
      orderButtons(order.id, order.address),
    );

    // Faqat do'kon botni bloklaganda ulanish uziladi. Tarmoq xatosida
    // ulanish saqlanadi — keyingi buyurtma yetib boradi.
    if (sent.status === 'failed') {
      if (sent.fatal) await unlinkStore(order.storeId);
      return;
    }
    if (sent.status !== 'ok' || !sent.result) return;

    // Xabar id — panelda status o'zgarsa Telegramdagi xabar ham yangilanadi
    await pool.query(
      `UPDATE orders SET telegram_message_id = $2, telegram_chat_id = $3 WHERE id = $1`,
      [order.id, sent.result.message_id, chatId],
    );
  } catch (err) {
    logger.error({ err, orderId }, 'yangi buyurtma haqida xabar berilmadi');
  }
}

const STATUS_SUFFIX: Record<string, string> = {
  seen: '👀 <b>Ko`rildi</b>',
  confirmed: '✅ <b>Tasdiqlandi</b>',
  rejected: '❌ <b>Rad etildi</b>',
  ready: '📦 <b>Tayyor</b>',
  completed: '🎉 <b>Yakunlandi</b>',
  cancelled: '🚫 <b>Bekor qilindi</b>',
  expired: '⏰ <b>Muddat tugadi</b>',
};

function nextButtons(orderId: string, status: string): InlineButton[][] {
  if (status === 'confirmed') {
    return [[{ text: '📦 Tayyor', callback_data: `o:d:${orderId}` }]];
  }
  if (status === 'ready') {
    return [[{ text: '🎉 Yakunlandi', callback_data: `o:k:${orderId}` }]];
  }
  return [];
}

/**
 * Status o'zgardi: Telegramdagi xabarni tahrirlash + panelga SSE.
 * Panelda bosilsa ham, Telegramda bosilsa ham shu funksiya chaqiriladi —
 * shunda ikki kanal bir-biriga mos qoladi.
 */
export async function notifyStatusChange(orderId: string, status: string): Promise<void> {
  try {
    const { rows } = await pool.query<{
      store_id: string;
      order_number: string;
      telegram_message_id: string | null;
      telegram_chat_id: string | null;
    }>(
      `SELECT store_id, order_number, telegram_message_id, telegram_chat_id
         FROM orders WHERE id = $1`,
      [orderId],
    );

    const order = rows[0];
    if (!order) return;

    publishStoreEvent(order.store_id, 'order.updated', { orderId, status });

    // Mijozga push — ilovani ochib turmasa ham xabar topadi
    void notifyCustomer(orderId, status);

    if (!order.telegram_message_id || !order.telegram_chat_id) return;

    const notification = await loadNotification(orderId);
    if (!notification) return;

    const suffix = STATUS_SUFFIX[status] ?? status;
    await editMessageText(
      Number(order.telegram_chat_id),
      Number(order.telegram_message_id),
      `${buildOrderText(notification)}\n\n${suffix}`,
      nextButtons(orderId, status),
    );
  } catch (err) {
    logger.error({ err, orderId, status }, 'status o`zgarishi haqida xabar berilmadi');
  }
}
