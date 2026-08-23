import { anonymizeDueAccounts } from '../auth/deletion';
import { pool } from '../db/pool';
import { redis } from '../db/redis';
import { notifyStatusChange } from '../integrations/notify';
import { sendMessage } from '../integrations/telegram';
import { logger } from '../logger';
import { sweepStaleAvatars } from '../tryon/avatar';
import { sweepStaleRenders } from '../tryon/render';

/**
 * Avtomatik jarayonlar (01-arxitektura §"Avtomatik jarayonlar", 02-database §10.7-10.9).
 *
 * Nima uchun ilova ichida, tashqi cron emas:
 * muddati o'tgan buyurtma uchun mijozga push va do'kon Telegramidagi
 * xabarni yangilash kerak. `psql` dan buni qilib bo'lmaydi — kod kerak.
 * `infra/migrations/010` dagi `expire_stale_orders()` funksiyasi qoladi:
 * u qo'lda tekshirish va zaxira yo'l sifatida ishlatiladi.
 *
 * ⚠️ API bir nechta nusxada ishlashi mumkin. Har vazifa Redis qulfi
 * ostida bajariladi — aks holda ikki nusxa bir vaqtda ishlab, mijozga
 * ikkita push yuborardi.
 */

const TICK_MS = 60_000;

/**
 * Qulf: `SET key NX EX`. Muvaffaqiyat bo'lsa true.
 * Qulf ochilmaydi — u TTL bilan o'zi tugaydi. Shu bilan vazifa
 * davr ichida faqat bir marta ishlaydi, hatto qayta ishga tushirilsa ham.
 */
async function acquire(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const result = await redis.set(`cron:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (err) {
    // Redis yo'q bo'lsa vazifa o'tkazib yuboriladi — ikki marta
    // bajarilishidan ko'ra bir marta o'tkazib yuborish xavfsizroq
    logger.warn({ err, key }, 'cron qulfi olinmadi');
    return false;
  }
}

/** Toshkent va Dubay orasida farq bor — vazifalar UTC bo'yicha rejalanadi. */
function utcNow(): {
  hour: number;
  minute: number;
  day: number;
  dateKey: string;
  monthKey: string;
} {
  const now = new Date();
  return {
    hour: now.getUTCHours(),
    minute: now.getUTCMinutes(),
    day: now.getUTCDate(),
    dateKey: now.toISOString().slice(0, 10),
    monthKey: now.toISOString().slice(0, 7),
  };
}

// ============================================================
// 1) Muddati o'tgan buyurtmalar — har 5 daqiqada
// ============================================================

export async function expireStaleOrders(): Promise<number> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.actor_type', 'system', true)`);
    await client.query(`SELECT set_config('app.channel', 'cron', true)`);

    const { rows } = await client.query<{ id: string }>(
      `UPDATE orders SET status = 'expired'
        WHERE status = 'new' AND expires_at < now()
        RETURNING id`,
    );

    await client.query('COMMIT');

    // Bildirishnomalar tranzaksiyadan TASHQARIDA: push sekin, uzoq
    // ochiq tranzaksiya ombor qulflarini ushlab turadi
    for (const order of rows) {
      await notifyStatusChange(order.id, 'expired');
    }

    if (rows.length > 0) {
      logger.info({ count: rows.length }, 'muddati o`tgan buyurtmalar yopildi');
    }

    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// 2) Javobsiz buyurtma haqida eslatma — 15 daqiqadan keyin
// ============================================================

export async function remindSilentStores(): Promise<number> {
  const { rows } = await pool.query<{
    id: string;
    order_number: string;
    telegram_chat_id: string | null;
  }>(
    `SELECT o.id, o.order_number, s.telegram_chat_id
       FROM orders o
       JOIN stores s ON s.id = o.store_id
      WHERE o.status = 'new'
        AND o.created_at < now() - interval '15 minutes'
        AND s.telegram_chat_id IS NOT NULL
      LIMIT 100`,
  );

  let sent = 0;

  for (const order of rows) {
    // Bir buyurtma uchun bir marta — kalit 24 soat yashaydi
    if (!(await acquire(`remind:${order.id}`, 86_400))) continue;
    if (order.telegram_chat_id === null) continue;

    await sendMessage(
      Number(order.telegram_chat_id),
      `⏰ <b>${order.order_number}</b> hali javobsiz.\n\nMijoz kutmoqda — tasdiqlang yoki rad eting.`,
    );
    sent += 1;
  }

  return sent;
}

// ============================================================
// 3) Do'kon javob tezligi — kuniga bir marta (02-database §10.7)
// ============================================================

export async function updateStoreStats(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE stores s SET
       avg_response_min = st.avg_min,
       confirm_rate     = st.confirm_rate
     FROM (
       SELECT store_id,
              ROUND(AVG(EXTRACT(EPOCH FROM (seen_at - created_at)) / 60)) AS avg_min,
              ROUND(COUNT(*) FILTER (WHERE status IN ('confirmed','ready','completed'))::numeric
                    / NULLIF(COUNT(*), 0), 3) AS confirm_rate
         FROM orders
        WHERE created_at > now() - interval '30 days'
        GROUP BY store_id
     ) st
     WHERE s.id = st.store_id`,
  );

  return rowCount ?? 0;
}

// ============================================================
// 4) Eskirgan yozuvlarni tozalash — kuniga bir marta
// ============================================================

export async function cleanupExpired(): Promise<{ otp: number; idempotency: number }> {
  const otp = await pool.query(`DELETE FROM otp_codes WHERE expires_at < now() - interval '1 day'`);

  // Idempotentlik kaliti 24 soatdan keyin keraksiz — takroriy so'rov
  // shunchalik kech kelmaydi
  const idempotency = await pool.query(
    `DELETE FROM idempotency_keys WHERE created_at < now() - interval '1 day'`,
  );

  return { otp: otp.rowCount ?? 0, idempotency: idempotency.rowCount ?? 0 };
}

// ============================================================
// 5) O'chirilgan akkauntlarni anonimlashtirish — kuniga bir marta
//
// 30 kundan oshgan so'rovlar bajariladi (03-api-spec §5). Ish bazada
// funksiya ichida qilinadi: bir nechta jadval bir tranzaksiyada
// tozalanishi kerak, JS'da buni qilish uzun va xatoga moyil.
// ============================================================

export async function anonymizeAccounts(): Promise<number> {
  const count = await anonymizeDueAccounts();
  if (count > 0) logger.info({ count }, 'akkauntlar anonimlashtirildi');
  return count;
}

// ============================================================
// 7) Do'kon arizalarini avtomatik tasdiqlash — har daqiqada
// ============================================================

/**
 * `pending` do'konlar 5 daqiqadan keyin `active` bo'ladi.
 *
 * ⚠️ QO'LDA TEKSHIRUV YO'Q. Bu ATAYIN qabul qilingan qaror: sotuvchi
 * ariza berib kutib o'tirmasin, darhol ishlay boshlasin. Kutish ko'p
 * sotuvchini yo'qotadi — ular boshqa platformaga ketadi.
 *
 * ⚠️ NEGA DARHOL EMAS, 5 DAQIQA: bu oyna admin uchun qoldirilgan. Soxta
 * yoki noto'g'ri ariza ko'rinsa, u shu vaqt ichida `reject` yoki
 * `suspend` qila oladi va do'kon umuman ochilmaydi. Darhol tasdiqlansa
 * bunday imkoniyat qolmasdi.
 *
 * ⚠️ TASDIQLANGANDAN KEYIN HAM NAZORAT BOR: admin istalgan vaqtda
 * `suspend` qila oladi va do'kon katalogdan yo'qoladi. Ya'ni bu
 * "tekshiruvsiz" emas, "keyin tekshirish" modeli.
 *
 * Mahsulot qo'shish uchun do'kon `active` bo'lishi shart
 * (`products.ts` dagi `WHERE status = 'active'`), shuning uchun bu
 * vazifa butun oqimni ochib beradi.
 */
export async function autoApproveStores(): Promise<number> {
  const { rows } = await pool.query<{ id: string; name: string }>(
    `UPDATE stores
        SET status = 'active'
      WHERE status = 'pending'
        AND created_at < now() - interval '5 minutes'
      RETURNING id, name`,
  );

  if (rows.length > 0) {
    logger.info({ count: rows.length, stores: rows.map((r) => r.name) }, 'do`konlar tasdiqlandi');
  }

  return rows.length;
}

// ============================================================
// 6) Oylik komissiya hisoboti (02-database §10.9)
// ============================================================

export async function createMonthlyInvoices(): Promise<number> {
  const { rowCount } = await pool.query(
    `INSERT INTO store_invoices (store_id, period_start, period_end,
                                 orders_count, gross_amount, commission, currency)
     SELECT store_id,
            date_trunc('month', now() - interval '1 month')::date,
            (date_trunc('month', now()) - interval '1 day')::date,
            COUNT(*), SUM(total), SUM(commission_due), currency
       FROM orders
      WHERE status = 'completed'
        AND completed_at >= date_trunc('month', now() - interval '1 month')
        AND completed_at <  date_trunc('month', now())
      GROUP BY store_id, currency
     ON CONFLICT (store_id, period_start) DO NOTHING`,
  );

  return rowCount ?? 0;
}

// ============================================================
// Rejalashtiruvchi
// ============================================================

async function run(name: string, task: () => Promise<unknown>): Promise<void> {
  try {
    await task();
  } catch (err) {
    // Bitta vazifa yiqilsa qolganlari ishlashda davom etadi
    logger.error({ err, job: name }, 'cron vazifasi bajarilmadi');
  }
}

async function tick(): Promise<void> {
  const { hour, day, dateKey, monthKey } = utcNow();

  /*
   * Tashlab ketilgan AI kiyintirishlar — har daqiqada.
   *
   * ⚠️ NEGA TEZ-TEZ: bu ish uchun PUL TO'LANGAN. Odatda natijani ilovaning
   * o'zi so'rab oladi, lekin foydalanuvchi ekranni yopsa yoki internet
   * uzilsa, ish "processing" bo'lib qolib ketadi — to'lov ketgan, natija
   * esa hech qachon olinmagan. Bu esa uni qutqaradi.
   *
   * Qulf 50 soniya: keyingi tick yangisini oladi.
   */
  if (await acquire('tryon-sweep', 50)) {
    await run('tryon-sweep', sweepStaleRenders);
    await run('avatar-sweep', sweepStaleAvatars);
    // Do'kon arizalari — 5 daqiqalik oynadan keyin
    await run('store-approve', autoApproveStores);
  }

  // Har 5 daqiqada. Qulf 4 daqiqa — keyingi tick'da yangisi olinadi.
  if (await acquire('expire', 240)) {
    await run('expire', expireStaleOrders);
    await run('remind', remindSilentStores);
  }

  // Har kuni 04:00 UTC = Toshkentda 09:00
  if (hour === 4 && (await acquire(`daily:${dateKey}`, 90_000))) {
    await run('store-stats', updateStoreStats);
    await run('cleanup', cleanupExpired);
    await run('anonymize', anonymizeAccounts);
  }

  // Oyning 1-sanasi, 05:00 UTC
  if (day === 1 && hour === 5 && (await acquire(`monthly:${monthKey}`, 172_800))) {
    await run('invoices', createMonthlyInvoices);
  }
}

let timer: NodeJS.Timeout | null = null;

/**
 * Birinchi tekshiruv darhol emas, kechikib bajariladi.
 *
 * ⚠️ Sabab amalda topilgan: `startScheduler()` server `listen` bo'lishi
 * bilan chaqiriladi, lekin Redis ulanishi hali tayyor emas. `ioredis`
 * `enableOfflineQueue: false` bilan sozlangani uchun birinchi qulf
 * so'rovi darhol xato beradi ("Stream isn't writeable") — vazifa
 * o'tkazib yuboriladi va log'da keraksiz ogohlantirish qoladi.
 */
const FIRST_RUN_DELAY_MS = 10_000;

export function startScheduler(): void {
  if (timer) return;

  // Server uzoq to'xtab qolgan bo'lishi mumkin, shuning uchun birinchi
  // tekshiruv o'tkazib yuborilmaydi — faqat kechiktiriladi
  const firstRun = setTimeout(() => void tick(), FIRST_RUN_DELAY_MS);
  firstRun.unref();

  timer = setInterval(() => void tick(), TICK_MS);
  // Vazifalar jarayonni ushlab turmasin
  timer.unref();

  logger.info('rejalashtiruvchi ishga tushdi');
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
