import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';

/**
 * Do'kon jamoasi (07-web-panels §4.8).
 *
 * Nima uchun kerak: hozircha faqat do'kon egasi kira oladi. Bitta odam
 * 24 soat buyurtma kutib o'tira olmaydi — javob tezligi esa qidiruv
 * reytingiga ta'sir qiladi.
 *
 * ⚠️ Xodim avval **ilovada ro'yxatdan o'tishi** kerak. Do'kon egasi uni
 * telefon raqami bo'yicha qo'shadi. Sabab: parol va raqam tasdiqlash
 * foydalanuvchining o'zida qolishi kerak — egasi xodim uchun akkaunt
 * yaratsa, parolni ham u biladi.
 */

export type MemberRole = 'owner' | 'manager' | 'staff';

interface MemberRow {
  id: string;
  user_id: string;
  role: MemberRole;
  created_at: Date;
  full_name: string | null;
  phone: string;
  last_active_at: Date | null;
  is_store_owner: boolean;
}

export async function listMembers(storeId: string) {
  const { rows } = await pool.query<MemberRow>(
    `SELECT m.id, m.user_id, m.role, m.created_at,
            u.full_name, u.phone, u.last_active_at,
            (s.owner_id = u.id) AS is_store_owner
       FROM store_members m
       JOIN users u ON u.id = m.user_id
       JOIN stores s ON s.id = m.store_id
      WHERE m.store_id = $1
      ORDER BY (s.owner_id = u.id) DESC, m.created_at`,
    [storeId],
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone,
    addedAt: row.created_at.toISOString(),
    lastActiveAt: row.last_active_at?.toISOString() ?? null,
    // Do'kon egasini ro'yxatdan chiqarib bo'lmaydi
    isStoreOwner: row.is_store_owner,
  }));
}

export async function addMember(
  storeId: string,
  phone: string,
  role: MemberRole,
): Promise<{ id: string }> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: users } = await client.query<{ id: string; role: string; is_active: boolean }>(
      `SELECT id, role, is_active FROM users WHERE phone = $1`,
      [phone],
    );

    const user = users[0];
    if (!user) {
      throw ApiError.notFound(
        'Bu raqam bilan foydalanuvchi topilmadi. Xodim avval ilovada ro`yxatdan o`tsin.',
      );
    }
    if (!user.is_active) {
      throw new ApiError('INVALID_STATE', 'Bu akkaunt bloklangan');
    }
    if (user.role === 'admin') {
      throw new ApiError('INVALID_STATE', 'Administratorni xodim sifatida qo`shib bo`lmaydi');
    }

    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM store_members WHERE store_id = $1 AND user_id = $2`,
      [storeId, user.id],
    );
    if (existing[0]) {
      throw new ApiError('ALREADY_EXISTS', 'Bu odam allaqachon jamoada');
    }

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO store_members (store_id, user_id, role) VALUES ($1, $2, $3) RETURNING id`,
      [storeId, user.id, role],
    );

    // Panelga kirish uchun `users.role` ham ko'tariladi: `store_members`
    // da yozuv bo'lsa ham, rol `customer` bo'lsa middleware to'xtatadi.
    if (user.role === 'customer') {
      await client.query(`UPDATE users SET role = 'store_owner' WHERE id = $1`, [user.id]);
    }

    await client.query('COMMIT');

    const member = rows[0];
    if (!member) throw ApiError.internal('Xodim qo`shilmadi');
    return member;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function assertNotStoreOwner(storeId: string, memberId: string): Promise<string> {
  const { rows } = await pool.query<{ user_id: string; is_store_owner: boolean }>(
    `SELECT m.user_id, (s.owner_id = m.user_id) AS is_store_owner
       FROM store_members m
       JOIN stores s ON s.id = m.store_id
      WHERE m.id = $1 AND m.store_id = $2`,
    [memberId, storeId],
  );

  const member = rows[0];
  if (!member) throw ApiError.notFound('Xodim topilmadi');

  if (member.is_store_owner) {
    throw new ApiError('INVALID_STATE', 'Do`kon egasini o`zgartirib bo`lmaydi');
  }

  return member.user_id;
}

export async function updateMemberRole(
  storeId: string,
  memberId: string,
  role: MemberRole,
): Promise<void> {
  await assertNotStoreOwner(storeId, memberId);
  await pool.query(`UPDATE store_members SET role = $3 WHERE id = $1 AND store_id = $2`, [
    memberId,
    storeId,
    role,
  ]);
}

export async function removeMember(storeId: string, memberId: string): Promise<void> {
  const userId = await assertNotStoreOwner(storeId, memberId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM store_members WHERE id = $1 AND store_id = $2`, [
      memberId,
      storeId,
    ]);

    // Boshqa do'koni ham, o'z do'koni ham qolmagan bo'lsa — oddiy
    // foydalanuvchiga qaytariladi, aks holda panelga kira olaveradi
    const { rows } = await client.query<{ count: string }>(
      `SELECT (SELECT COUNT(*) FROM store_members WHERE user_id = $1)
            + (SELECT COUNT(*) FROM stores WHERE owner_id = $1) AS count`,
      [userId],
    );

    if (Number(rows[0]?.count ?? 0) === 0) {
      await client.query(`UPDATE users SET role = 'customer' WHERE id = $1 AND role <> 'admin'`, [
        userId,
      ]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Do'kon yaratilganda egasi jamoada bo'lmasligi mumkin — eski
 * do'konlar uchun. Ro'yxatni ochganda bir marta to'g'rilanadi.
 */
export async function ensureOwnerMembership(storeId: string): Promise<void> {
  await pool.query(
    `INSERT INTO store_members (store_id, user_id, role)
     SELECT id, owner_id, 'owner' FROM stores WHERE id = $1
     ON CONFLICT (store_id, user_id) DO NOTHING`,
    [storeId],
  );
}
