import type { Locale } from '@looksave/shared-types';

import { pool } from '../db/pool';
import { sendPush } from '../integrations/push';
import { logger } from '../logger';

/**
 * «Narx tushsa xabar» — sevimlidagi mahsulot arzonlashsa yoki yana
 * sotuvga chiqsa, push yuboriladi (migratsiya 039).
 *
 * Rejalashtiruvchi (`jobs/scheduler.ts`) ~15 daqiqada bir marta
 * `checkFavoriteAlerts` ni chaqiradi: joriy narx va mavjudlik
 * `favorites.seen_*` bilan solishtiriladi. Qaror sof funksiyada
 * (`decideAlerts`) — sinovlar bazasiz yuradi.
 *
 * ⚠️ FAQAT ROZILIK BERGANLARGA (`users.price_alerts`, sukut o'chiq).
 * ⚠️ TUNDA YUBORILMAYDI — Toshkent 21:00–09:00 oralig'ida tekshiruv
 * o'tkazib yuboriladi; holat yangilanmagani uchun xabar ertalab boradi.
 * ⚠️ HOLAT PUSHDAN OLDIN YOZILADI. Push yiqilsa xabar yo'qoladi, lekin
 * hech qachon ikki marta bormaydi — takroriy «narx tushdi» yomonroq.
 */

/** Shundan kam arzonlashish xabarga arzimaydi (5%). */
const MIN_DROP_RATIO = 0.05;
/** Bitta mahsulot bo'yicha ikki xabar orasidagi eng kam vaqt. */
const ALERT_COOLDOWN_MS = 24 * 60 * 60_000;
/** Ruxsat etilgan soatlar (UTC): 04–16 = Toshkentda 09:00–21:59. */
const SEND_FROM_UTC_HOUR = 4;
const SEND_UNTIL_UTC_HOUR = 16;

export interface FavoriteStateRow {
  user_id: string;
  product_id: string;
  title: string;
  base_price: string;
  currency: string;
  in_stock: boolean;
  seen_price: string | null;
  seen_in_stock: boolean | null;
  alerted_at: Date | null;
  locale: Locale;
}

export interface AlertEvent {
  productId: string;
  title: string;
  kind: 'drop' | 'restock';
  price: number;
  /** Faqat `drop` da — avvalgi (foydalanuvchi bilgan) narx */
  oldPrice: number | null;
  currency: string;
}

export interface StateUpdate {
  userId: string;
  productId: string;
  seenPrice: number;
  seenInStock: boolean;
  alerted: boolean;
}

export interface AlertDecision {
  /** Foydalanuvchi → til va hodisalar (bir foydalanuvchiga bitta push) */
  alerts: Map<string, { locale: Locale; events: AlertEvent[] }>;
  /** Faqat o'zgargan qatorlar */
  updates: StateUpdate[];
}

/**
 * Har sevimli qator uchun qaror:
 * - `seen_price` yo'q (eski qator) — faqat boshlang'ich holat yoziladi;
 * - narx `seen_price` dan kamida 5% past VA sotuvda bor → «narx tushdi»;
 *   sotuvda yo'q mahsulotning arzonlashgani foydasiz — u qaytib kelganda
 *   «yana sotuvda» xabari yangi narx bilan boradi;
 * - avval sotuvda yo'q edi, endi bor → «yana sotuvda»;
 * - so'nggi 24 soatda xabar ketgan bo'lsa kutiladi: holat yangilanmaydi,
 *   ya'ni hodisa keyingi tekshiruvda yana ko'rinadi.
 */
export function decideAlerts(rows: FavoriteStateRow[], now: Date): AlertDecision {
  const alerts: AlertDecision['alerts'] = new Map();
  const updates: StateUpdate[] = [];

  for (const row of rows) {
    const price = Number(row.base_price);
    const base = { userId: row.user_id, productId: row.product_id };

    if (row.seen_price === null || row.seen_in_stock === null) {
      updates.push({ ...base, seenPrice: price, seenInStock: row.in_stock, alerted: false });
      continue;
    }

    const seen = Number(row.seen_price);
    const dropped = row.in_stock && price < seen && price <= seen * (1 - MIN_DROP_RATIO);
    const restocked = !row.seen_in_stock && row.in_stock;
    const coolingDown =
      row.alerted_at !== null && now.getTime() - row.alerted_at.getTime() < ALERT_COOLDOWN_MS;

    if ((dropped || restocked) && !coolingDown) {
      const event: AlertEvent = {
        productId: row.product_id,
        title: row.title,
        kind: dropped ? 'drop' : 'restock',
        price,
        oldPrice: dropped ? seen : null,
        currency: row.currency,
      };
      const entry = alerts.get(row.user_id) ?? { locale: row.locale, events: [] };
      entry.events.push(event);
      alerts.set(row.user_id, entry);
      updates.push({
        ...base,
        // Narx hech qachon ko'tarilmaydi: «yana sotuvda» narx oshganda kelsa ham
        seenPrice: Math.min(seen, price),
        seenInStock: true,
        alerted: true,
      });
      continue;
    }

    // Kutilayotgan «yana sotuvda» ni yo'qotmaslik uchun mavjudlik yozilmaydi
    const nextInStock = restocked && coolingDown ? row.seen_in_stock : row.in_stock;
    if (nextInStock !== row.seen_in_stock) {
      updates.push({ ...base, seenPrice: seen, seenInStock: nextInStock, alerted: false });
    }
  }

  return { alerts, updates };
}

const CURRENCY_UZS: Record<Locale, string> = { uz: "so'm", ru: 'сум', en: 'UZS', ar: 'سوم' };

export function formatPrice(amount: number, currency: string, locale: Locale): string {
  const grouped = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} ${currency === 'UZS' ? CURRENCY_UZS[locale] : currency}`;
}

function shortTitle(title: string): string {
  const clean = title.trim().replace(/\s+/g, ' ');
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

const TEXT: Record<
  Locale,
  {
    dropTitle: string;
    drop: (t: string, price: string, old: string) => string;
    restockTitle: string;
    restock: (t: string, price: string) => string;
    manyTitle: string;
    many: (n: number) => string;
  }
> = {
  uz: {
    dropTitle: 'Narx tushdi',
    drop: (t, p, o) => `${t} — endi ${p} (avval ${o})`,
    restockTitle: 'Yana sotuvda',
    restock: (t, p) => `${t} yana do'konda bor · ${p}`,
    manyTitle: 'Sevimlilaringizda yangilik',
    many: (n) => `${n} ta mahsulot arzonlashdi yoki yana sotuvga chiqdi`,
  },
  ru: {
    dropTitle: 'Цена снижена',
    drop: (t, p, o) => `${t} — теперь ${p} (было ${o})`,
    restockTitle: 'Снова в продаже',
    restock: (t, p) => `${t} снова в наличии · ${p}`,
    manyTitle: 'Новое в избранном',
    many: (n) => `Товаров: ${n} — подешевели или снова в продаже`,
  },
  en: {
    dropTitle: 'Price drop',
    drop: (t, p, o) => `${t} is now ${p} (was ${o})`,
    restockTitle: 'Back in stock',
    restock: (t, p) => `${t} is available again · ${p}`,
    manyTitle: 'Updates in your favorites',
    many: (n) => `${n} items dropped in price or are back in stock`,
  },
  ar: {
    dropTitle: 'انخفض السعر',
    drop: (t, p, o) => `${t} — الآن ${p} (كان ${o})`,
    restockTitle: 'متوفر مجددًا',
    restock: (t, p) => `${t} متوفر مرة أخرى · ${p}`,
    manyTitle: 'جديد في مفضلتك',
    many: (n) => `${n} منتجات انخفض سعرها أو عادت للتوفر`,
  },
};

/**
 * Bir foydalanuvchiga bitta push. Bitta hodisa — mahsulot sahifasi ochiladi;
 * bir nechta — umumiy xabar, sevimlilar ochiladi (5 ta alohida push spam).
 */
export function buildAlertMessage(
  locale: Locale,
  events: AlertEvent[],
): { title: string; body: string; data: Record<string, string> } {
  const text = TEXT[locale] ?? TEXT.uz;

  if (events.length > 1) {
    return { title: text.manyTitle, body: text.many(events.length), data: { type: 'favorite_alert' } };
  }

  const [event] = events as [AlertEvent];
  const price = formatPrice(event.price, event.currency, locale);
  const title = shortTitle(event.title);
  const data = { type: 'favorite_alert', productId: event.productId };

  if (event.kind === 'drop' && event.oldPrice !== null) {
    const old = formatPrice(event.oldPrice, event.currency, locale);
    return { title: text.dropTitle, body: text.drop(title, price, old), data };
  }
  return { title: text.restockTitle, body: text.restock(title, price), data };
}

export function isSendingHour(now: Date): boolean {
  const hour = now.getUTCHours();
  return hour >= SEND_FROM_UTC_HOUR && hour <= SEND_UNTIL_UTC_HOUR;
}

/** Rejalashtiruvchi chaqiradi. Qaytaradi: yuborilgan push soni. */
export async function checkFavoriteAlerts(now: Date = new Date()): Promise<number> {
  if (!isSendingHour(now)) return 0;

  const { rows } = await pool.query<FavoriteStateRow>(
    `SELECT f.user_id, f.product_id, p.title, p.base_price, p.currency,
            product_in_stock(p.id) AS in_stock,
            f.seen_price, f.seen_in_stock, f.alerted_at, u.locale
       FROM favorites f
       JOIN users u    ON u.id = f.user_id AND u.price_alerts AND u.is_active
       JOIN products p ON p.id = f.product_id AND p.status = 'active'
       JOIN stores s   ON s.id = p.store_id AND s.status = 'active'`,
  );

  const { alerts, updates } = decideAlerts(rows, now);

  if (updates.length > 0) {
    await pool.query(
      `UPDATE favorites f
          SET seen_price = u.seen_price,
              seen_in_stock = u.seen_in_stock,
              alerted_at = CASE WHEN u.alerted THEN now() ELSE f.alerted_at END
         FROM unnest($1::uuid[], $2::uuid[], $3::numeric[], $4::boolean[], $5::boolean[])
              AS u(user_id, product_id, seen_price, seen_in_stock, alerted)
        WHERE f.user_id = u.user_id AND f.product_id = u.product_id`,
      [
        updates.map((u) => u.userId),
        updates.map((u) => u.productId),
        updates.map((u) => u.seenPrice),
        updates.map((u) => u.seenInStock),
        updates.map((u) => u.alerted),
      ],
    );
  }

  for (const [userId, { locale, events }] of alerts) {
    const message = buildAlertMessage(locale, events);
    await sendPush(userId, message.title, message.body, message.data);
  }

  if (alerts.size > 0) {
    logger.info({ users: alerts.size, checked: rows.length }, 'favorite-alerts: xabarlar yuborildi');
  }
  return alerts.size;
}

// ── Foydalanuvchi sozlamasi ──

export async function getPriceAlerts(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ price_alerts: boolean }>(
    `SELECT price_alerts FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.price_alerts ?? false;
}

/**
 * Yoqilganda sevimlilarning boshlang'ich holati JORIY holatga qaytariladi:
 * aks holda o'chiq paytdagi eski farqlar bir zumda xabar bo'lib kelardi.
 */
export async function setPriceAlerts(userId: string, enabled: boolean): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE users SET price_alerts = $2, updated_at = now() WHERE id = $1`, [
      userId,
      enabled,
    ]);
    if (enabled) {
      await client.query(
        `UPDATE favorites f
            SET seen_price = p.base_price,
                seen_in_stock = product_in_stock(p.id),
                alerted_at = NULL
           FROM products p
          WHERE p.id = f.product_id AND f.user_id = $1`,
        [userId],
      );
    }
    await client.query('COMMIT');
    return enabled;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
