import type { AuthUser, CountryCode, Gender, Locale, UserRole } from '@looksave/shared-types';
import type { PoolClient } from 'pg';

import { pool } from '../db/pool';

export interface UserRow {
  id: string;
  phone: string;
  password_hash: string | null;
  full_name: string | null;
  role: UserRole;
  gender: Gender | null;
  locale: Locale;
  country: CountryCode | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: Date;
}

const USER_COLUMNS = `id, phone, password_hash, full_name, role, gender, locale, country,
                      avatar_url, is_active, created_at`;

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    phone: row.phone,
    fullName: row.full_name,
    role: row.role,
    gender: row.gender,
    locale: row.locale,
    country: row.country,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE phone = $1`, [
    phone,
  ]);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [
    id,
  ]);
  return rows[0] ?? null;
}

/** `store_owner` va `staff` uchun JWT ichiga tushadigan do'kon ro'yxati (03-api-spec §2). */
export async function findStoreIds(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ store_id: string }>(
    `SELECT id AS store_id FROM stores WHERE owner_id = $1
     UNION
     SELECT store_id FROM store_members WHERE user_id = $1`,
    [userId],
  );
  return rows.map((row) => row.store_id);
}

export interface CreateUserInput {
  phone: string;
  fullName: string;
  passwordHash: string;
  country: CountryCode;
  locale: Locale;
}

/**
 * Ro'yxatdan o'tkazish. Bitta tranzaksiyada:
 * foydalanuvchi + savat + ishonch balli + tasdiqlangan raqam.
 *
 * ⚠️ `verified_via = 'password_signup'` — raqam OTP bilan TEKSHIRILMAGAN.
 * Sabab va oqibati: infra/migrations/009_auth.sql
 */
export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (phone, full_name, password_hash, password_set_at, country, locale, role)
       VALUES ($1, $2, $3, now(), $4, $5, 'customer')
       RETURNING ${USER_COLUMNS}`,
      [input.phone, input.fullName, input.passwordHash, input.country, input.locale],
    );

    const user = rows[0];
    if (!user) throw new Error('foydalanuvchi yaratilmadi');

    await client.query(
      `INSERT INTO verified_phones (user_id, phone, country, is_primary, verified_via)
       VALUES ($1, $2, $3, true, 'password_signup')`,
      [user.id, input.phone, input.country],
    );

    await client.query(`INSERT INTO user_trust (user_id) VALUES ($1)`, [user.id]);
    await client.query(`INSERT INTO carts (user_id) VALUES ($1)`, [user.id]);

    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await pool.query(`UPDATE users SET password_hash = $2, password_set_at = now() WHERE id = $1`, [
    userId,
    passwordHash,
  ]);
}

export async function touchLastActive(userId: string): Promise<void> {
  await pool.query(`UPDATE users SET last_active_at = now() WHERE id = $1`, [userId]);
}

export async function recordLoginAttempt(input: {
  phone: string;
  ip: string | null;
  success: boolean;
  userAgent: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO login_attempts (phone, ip, success, user_agent) VALUES ($1, $2, $3, $4)`,
    [input.phone, input.ip, input.success, input.userAgent?.slice(0, 256) ?? null],
  );
}

export async function upsertDevice(input: {
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string | null;
  pushToken?: string | null;
}): Promise<void> {
  // `pushToken` berilmasa eskisi saqlanadi — kirish paytida token hali
  // olinmagan bo'lishi mumkin, uni o'chirib yuborish kerak emas.
  await pool.query(
    `INSERT INTO devices (user_id, device_id, platform, app_version, push_token)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, device_id)
     DO UPDATE SET last_seen_at = now(),
                   platform = EXCLUDED.platform,
                   app_version = EXCLUDED.app_version,
                   push_token = COALESCE(EXCLUDED.push_token, devices.push_token)`,
    [input.userId, input.deviceId, input.platform, input.appVersion, input.pushToken ?? null],
  );
}

/**
 * Bitta push token bitta qurilmada bo'lishi kerak. Foydalanuvchi
 * akkauntni almashtirса, eski egasidan token olib tashlanadi — aks holda
 * yangi egasining buyurtmasi haqida eski egaga xabar boradi.
 */
export async function claimPushToken(userId: string, pushToken: string): Promise<void> {
  await pool.query(
    `UPDATE devices SET push_token = NULL
      WHERE push_token = $2 AND user_id <> $1`,
    [userId, pushToken],
  );
}
