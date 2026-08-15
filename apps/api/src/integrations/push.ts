import type { Locale } from '@looksave/shared-types';

import { env } from '../config/env';
import { pool } from '../db/pool';
import { logger } from '../logger';

/**
 * Expo Push (09-integrations §6).
 *
 * Buyurtma statusi o'zgarganda mijozga xabar boradi. Bu bo'lmasa
 * foydalanuvchi ilovani ochib turishi kerak — do'kon tasdiqlaganini
 * bilmaydi.
 *
 * ⚠️ Push YETKAZILISHI KAFOLATLANMAGAN: token eskirgan, qurilma o'chiq,
 * foydalanuvchi ruxsat bermagan bo'lishi mumkin. Shuning uchun buyurtma
 * holati doim ilovada ham ko'rinadi — push faqat qulaylik.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Bir so'rovda 100 tagacha xabar (§6). */
const BATCH_SIZE = 100;

interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
}

interface ExpoResponse {
  data?: PushTicket[];
  errors?: Array<{ message: string }>;
}

export function isPushEnabled(): boolean {
  return env().EXPO_ACCESS_TOKEN.length > 0;
}

async function loadTokens(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ push_token: string }>(
    `SELECT DISTINCT push_token FROM devices
      WHERE user_id = $1 AND push_token IS NOT NULL`,
    [userId],
  );
  return rows.map((row) => row.push_token);
}

/** `DeviceNotRegistered` — ilova o'chirilgan, token abadiy yaroqsiz. */
async function dropToken(token: string): Promise<void> {
  await pool.query(`UPDATE devices SET push_token = NULL WHERE push_token = $1`, [token]);
}

export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (!isPushEnabled()) return;

  const tokens = await loadTokens(userId);
  if (tokens.length === 0) return;

  for (let start = 0; start < tokens.length; start += BATCH_SIZE) {
    const batch = tokens.slice(start, start + BATCH_SIZE);

    const messages = batch.map((token) => ({
      to: token,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
      channelId: 'orders',
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env().EXPO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(10_000),
      });

      const result = (await response.json()) as ExpoResponse;

      if (result.errors) {
        logger.warn({ errors: result.errors }, 'expo push xatosi');
        continue;
      }

      const tickets = result.data ?? [];
      for (const [index, ticket] of tickets.entries()) {
        const token = batch[index];
        if (token && ticket.details?.error === 'DeviceNotRegistered') {
          await dropToken(token);
        }
      }
    } catch (err) {
      // Push yuborilmagani buyurtmaga ta'sir qilmaydi
      logger.warn({ err, userId }, 'push yuborilmadi');
    }
  }
}

type PushStatus = 'seen' | 'confirmed' | 'rejected' | 'ready' | 'completed' | 'expired';

/** Matnlar 05-mobile §9 dagi jadval bo'yicha. */
const MESSAGES: Record<PushStatus, Record<Locale, { title: string; body: string }>> = {
  seen: {
    uz: { title: 'Buyurtma ko`rildi', body: 'Do`kon buyurtmangizni ko`rdi' },
    ru: { title: 'Заказ просмотрен', body: 'Магазин увидел ваш заказ' },
    en: { title: 'Order seen', body: 'The store has seen your order' },
    ar: { title: 'تمت مشاهدة الطلب', body: 'اطلع المتجر على طلبك' },
  },
  confirmed: {
    uz: { title: 'Buyurtma tasdiqlandi', body: 'Do`kon buyurtmangizni tasdiqladi' },
    ru: { title: 'Заказ подтверждён', body: 'Магазин подтвердил ваш заказ' },
    en: { title: 'Order confirmed', body: 'The store confirmed your order' },
    ar: { title: 'تم تأكيد الطلب', body: 'أكد المتجر طلبك' },
  },
  rejected: {
    uz: { title: 'Buyurtma rad etildi', body: 'Do`kon buyurtmani rad etdi' },
    ru: { title: 'Заказ отклонён', body: 'Магазин отклонил заказ' },
    en: { title: 'Order rejected', body: 'The store rejected the order' },
    ar: { title: 'تم رفض الطلب', body: 'رفض المتجر الطلب' },
  },
  ready: {
    uz: { title: 'Buyurtma tayyor', body: 'Buyurtmangiz tayyor' },
    ru: { title: 'Заказ готов', body: 'Ваш заказ готов' },
    en: { title: 'Order ready', body: 'Your order is ready' },
    ar: { title: 'الطلب جاهز', body: 'طلبك جاهز' },
  },
  completed: {
    uz: { title: 'Buyurtma yakunlandi', body: 'Xaridingiz uchun rahmat' },
    ru: { title: 'Заказ завершён', body: 'Спасибо за покупку' },
    en: { title: 'Order completed', body: 'Thank you for your purchase' },
    ar: { title: 'اكتمل الطلب', body: 'شكرًا لشرائك' },
  },
  expired: {
    uz: { title: 'Javob kelmadi', body: 'Do`kon javob bermadi. Boshqa do`konni ko`ring' },
    ru: { title: 'Нет ответа', body: 'Магазин не ответил. Посмотрите другой магазин' },
    en: { title: 'No response', body: 'The store did not respond. Try another store' },
    ar: { title: 'لا يوجد رد', body: 'لم يرد المتجر. جرّب متجرًا آخر' },
  },
};

function isPushStatus(status: string): status is PushStatus {
  return status in MESSAGES;
}

/**
 * Buyurtma statusi o'zgarganda mijozga xabar.
 * Til foydalanuvchi profilidan olinadi — ilova tilida keladi.
 */
export async function notifyCustomer(orderId: string, status: string): Promise<void> {
  if (!isPushStatus(status)) return;

  try {
    const { rows } = await pool.query<{
      user_id: string;
      order_number: string;
      locale: Locale;
      reject_reason: string | null;
    }>(
      `SELECT o.user_id, o.order_number, o.reject_reason, u.locale
         FROM orders o JOIN users u ON u.id = o.user_id
        WHERE o.id = $1`,
      [orderId],
    );

    const order = rows[0];
    if (!order) return;

    const template = MESSAGES[status][order.locale] ?? MESSAGES[status].uz;

    const body =
      status === 'rejected' && order.reject_reason
        ? `${template.body}: ${order.reject_reason}`
        : template.body;

    await sendPush(order.user_id, template.title, `${body} · ${order.order_number}`, {
      orderId,
      status,
    });
  } catch (err) {
    logger.warn({ err, orderId, status }, 'mijozga push yuborilmadi');
  }
}
