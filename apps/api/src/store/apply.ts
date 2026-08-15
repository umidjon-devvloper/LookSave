import type { StoreApplicationInput } from '@looksave/validation';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { slugify, uniqueSlug } from './slug';

/**
 * Do'kon arizasi.
 *
 * ⚠️ HUJJATDA YO'Q OQIM. 03-api-spec §15 da admin `pending` statusli
 * do'konni tasdiqlaydi yoki rad etadi, lekin arizani kim yaratishi
 * yozilmagan. Shu vaqtgacha do'konlar `INSERT INTO stores` bilan qo'lda
 * qo'shilgan (RUNBOOK'da shunday yozilgan ham).
 *
 * Bu fayl shu bo'shliqni to'ldiradi. Qabul qilingan qarorlar:
 *
 * 1. **Ariza bergan foydalanuvchi darhol `store_owner` bo'ladi.**
 *    Tasdiqlashni kutmaydi — panelga kirib mahsulot va sozlamalarni
 *    tayyorlab qo'yishi mumkin. Do'kon `pending` bo'lgani uchun
 *    katalogda ko'rinmaydi (`WHERE s.status = 'active'`), ya'ni
 *    mijozga hech narsa chiqmaydi.
 *
 * 2. **Bir foydalanuvchi — bitta ariza.** Ikkinchi do'kon kerak bo'lsa
 *    admin qo'shadi. Aks holda soxta arizalar bilan navbat to'lib ketadi.
 *
 * 3. **Rad etilgan ariza qayta yuboriladi.** `rejected` holatdagi do'kon
 *    yangilanadi, yangisi yaratilmaydi — `reject_reason` tarixi qoladi.
 */

interface ApplicationRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  reject_reason: string | null;
  created_at: Date;
}

/** Bazadagi band sluglar — faqat bir xil boshlanishdagilar. */
async function takenSlugs(base: string): Promise<Set<string>> {
  const { rows } = await pool.query<{ slug: string }>(
    `SELECT slug FROM stores WHERE slug = $1 OR slug LIKE $1 || '-%'`,
    [base],
  );

  return new Set(rows.map((row) => row.slug));
}

/**
 * Nomdan lotin slug chiqmasa (arabcha nom) zaxira nom.
 * `store-` + tasodifiy qism: o'qilishi yomon, lekin ishlaydi va
 * do'kon egasi keyin sozlamalarda o'zgartira oladi.
 */
function fallbackSlug(): string {
  return `store-${Math.random().toString(36).slice(2, 8)}`;
}

export async function currentApplication(userId: string): Promise<ApplicationRow | null> {
  const { rows } = await pool.query<ApplicationRow>(
    `SELECT id, name, slug, status, reject_reason, created_at
       FROM stores WHERE owner_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );

  return rows[0] ?? null;
}

export async function submitApplication(
  userId: string,
  input: StoreApplicationInput,
): Promise<ApplicationRow> {
  const existing = await currentApplication(userId);

  if (existing && existing.status !== 'rejected') {
    throw new ApiError(
      'ALREADY_EXISTS',
      existing.status === 'pending'
        ? 'Arizangiz ko`rib chiqilmoqda'
        : 'Sizda allaqachon do`kon bor',
    );
  }

  const base = slugify(input.name);
  const slug = base === null ? fallbackSlug() : uniqueSlug(base, await takenSlugs(base));

  if (slug === null) {
    throw new ApiError('ALREADY_EXISTS', 'Bu nom band. Boshqa nom tanlang.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const values = [
      userId,
      input.name,
      slug,
      input.description ?? null,
      input.location.lng,
      input.location.lat,
      input.address,
      input.landmark ?? null,
      input.city,
      input.country,
      input.phone,
      JSON.stringify(input.workingHours ?? []),
      input.deliveryEnabled,
      input.pickupEnabled,
      input.currency,
    ];

    // Rad etilgan ariza yangilanadi — yangi qator yaratilmaydi, shunda
    // admin panelida takroriy yozuvlar to'planmaydi
    const query =
      existing === null
        ? `INSERT INTO stores (owner_id, name, slug, description, location, address, landmark,
                               city, country, phone, working_hours, delivery_enabled,
                               pickup_enabled, currency, status, reject_reason)
           VALUES ($1, $2, $3, $4, ST_MakePoint($5, $6)::geography, $7, $8,
                   $9, $10, $11, $12::jsonb, $13, $14, $15, 'pending', NULL)
           RETURNING id, name, slug, status, reject_reason, created_at`
        : `UPDATE stores SET name = $2, slug = $3, description = $4,
                  location = ST_MakePoint($5, $6)::geography, address = $7, landmark = $8,
                  city = $9, country = $10, phone = $11, working_hours = $12::jsonb,
                  delivery_enabled = $13, pickup_enabled = $14, currency = $15,
                  status = 'pending', reject_reason = NULL
            WHERE owner_id = $1 AND status = 'rejected'
            RETURNING id, name, slug, status, reject_reason, created_at`;

    const { rows } = await client.query<ApplicationRow>(query, values);
    const store = rows[0];
    if (!store) throw ApiError.internal('Do`kon yaratilmadi');

    // Egalik yozuvi: panel huquqlari shu jadvaldan tekshiriladi
    await client.query(
      `INSERT INTO store_members (store_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'owner'`,
      [store.id, userId],
    );

    // Rol ko'tariladi — panelga kirish uchun. Admin roli pasaytirilmaydi.
    await client.query(
      `UPDATE users SET role = 'store_owner' WHERE id = $1 AND role = 'customer'`,
      [userId],
    );

    await client.query('COMMIT');
    return store;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
