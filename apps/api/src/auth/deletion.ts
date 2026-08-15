import { pool } from '../db/pool';

/**
 * Akkauntni o'chirish (03-api-spec §5, App Store talabi).
 *
 * Oqim:
 *   DELETE /auth/account  → `deletion_requested_at` yoziladi, sessiyalar yopiladi
 *   30 kun kutish         → foydalanuvchi qaytib kirsa bekor bo'ladi
 *   cron                  → `anonymize_due_accounts()` shaxsiy ma'lumotni o'chiradi
 *
 * ⚠️ HUJJATDAN CHEKINISH: 03-api-spec faqat "30 kunlik kutish, keyin
 * anonimlashtirish" deydi, ochiq buyurtma haqida hech narsa aytmaydi.
 * Bu yerda qo'shimcha shart qo'yildi: ochiq buyurtma bo'lsa o'chirish
 * so'rovi qabul qilinmaydi. Sabab — buyurtma do'kon uchun majburiyat,
 * mijoz yo'qolib qolsa sotuvchi tovarni ajratib qo'yib kutadi.
 * Foydalanuvchiga nima qilish kerakligi aytiladi (bekor qilish yoki
 * yakunlash), ya'ni tugma "ishlamayapti" holati bo'lmaydi.
 */

/**
 * Yakunlanmagan hisoblangan statuslar (005_orders.sql dagi CHECK).
 * `rejected`, `completed`, `cancelled`, `expired` — yopiq, ular to'sqinlik qilmaydi.
 */
const OPEN_ORDER_STATUSES = ['new', 'seen', 'confirmed', 'ready'] as const;

export interface DeletionState {
  requestedAt: Date | null;
  anonymizedAt: Date | null;
  /** Anonimlashtirish sanasi — ilova shuni ko'rsatadi. */
  scheduledFor: Date | null;
}

export const GRACE_DAYS = 30;

/** Kutish muddati tugaydigan sana. */
export function scheduledDate(requestedAt: Date, graceDays = GRACE_DAYS): Date {
  const result = new Date(requestedAt.getTime());
  result.setUTCDate(result.getUTCDate() + graceDays);
  return result;
}

export async function countOpenOrders(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM orders
      WHERE user_id = $1 AND status = ANY($2::text[])`,
    [userId, OPEN_ORDER_STATUSES],
  );

  return Number(rows[0]?.count ?? 0);
}

/**
 * Do'kon egasi o'z akkauntini o'chira olmaydi.
 *
 * Do'konda mahsulot, buyurtma va Telegram ulanishi bor — egasiz qolsa
 * mijozlar javobsiz buyurtma yuboraveradi. Avval do'kon admin orqali
 * yopilishi kerak. Apple uchun bu muammo emas: talab "akkauntni o'chirish
 * yo'li bo'lsin", va bu yo'l ko'rsatiladi.
 */
export async function ownsActiveStore(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM store_members m
       JOIN stores s ON s.id = m.store_id
      WHERE m.user_id = $1 AND m.role = 'owner' AND s.status IN ('pending', 'active')`,
    [userId],
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

/**
 * O'chirish so'rovini yozish. Takroriy so'rov sanani o'zgartirmaydi —
 * aks holda foydalanuvchi tugmani qayta bosib muddatni cheksiz uzaytirardi.
 */
export async function requestDeletion(userId: string): Promise<Date> {
  const { rows } = await pool.query<{ deletion_requested_at: Date }>(
    `UPDATE users
        SET deletion_requested_at = COALESCE(deletion_requested_at, now())
      WHERE id = $1 AND anonymized_at IS NULL
      RETURNING deletion_requested_at`,
    [userId],
  );

  const requestedAt = rows[0]?.deletion_requested_at;
  if (!requestedAt) throw new Error('Foydalanuvchi topilmadi yoki allaqachon anonimlashtirilgan');

  return requestedAt;
}

/**
 * Bekor qilish. Kirish oqimida ham chaqiriladi: foydalanuvchi 30 kun
 * ichida qaytsa, o'chirish avtomatik bekor bo'ladi (Apple tavsiyasi —
 * "akkauntni tiklash imkoni bo'lsin").
 */
export async function cancelDeletion(userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE users SET deletion_requested_at = NULL
      WHERE id = $1 AND deletion_requested_at IS NOT NULL AND anonymized_at IS NULL`,
    [userId],
  );

  return (rowCount ?? 0) > 0;
}

export async function deletionState(userId: string): Promise<DeletionState> {
  const { rows } = await pool.query<{
    deletion_requested_at: Date | null;
    anonymized_at: Date | null;
  }>(`SELECT deletion_requested_at, anonymized_at FROM users WHERE id = $1`, [userId]);

  const row = rows[0];
  if (!row) return { requestedAt: null, anonymizedAt: null, scheduledFor: null };

  return {
    requestedAt: row.deletion_requested_at,
    anonymizedAt: row.anonymized_at,
    scheduledFor: row.deletion_requested_at ? scheduledDate(row.deletion_requested_at) : null,
  };
}

/** Cron chaqiradi. Migratsiyadagi funksiya ishni bazada bajaradi. */
export async function anonymizeDueAccounts(graceDays = GRACE_DAYS): Promise<number> {
  const { rows } = await pool.query<{ anonymize_due_accounts: number }>(
    `SELECT anonymize_due_accounts($1) AS anonymize_due_accounts`,
    [graceDays],
  );

  return rows[0]?.anonymize_due_accounts ?? 0;
}
