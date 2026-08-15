import type { Gender } from '@looksave/shared-types';
import type { MeasurementsInput, UpdateProfileInput } from '@looksave/validation';

import { env } from '../config/env';
import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import {
  computeMorphTargets,
  NEUTRAL,
  suggestQuality,
  type Measurements,
  type MorphTargets,
  type QualityHint,
} from './morphs';

/** Profil va avatar (03-api-spec §6-7). */

interface ProfileRow {
  measurements: Measurements | null;
  morph_targets: MorphTargets | null;
  face_texture_url: string | null;
  face_scan_status: string;
  avatar_preset: string;
  gender: Gender | null;
  is_restricted: boolean | null;
  open_orders: string;
  favorites_count: string;
  looks_count: string;
}

async function loadProfile(userId: string): Promise<ProfileRow> {
  const { rows } = await pool.query<ProfileRow>(
    `SELECT COALESCE(p.measurements, '{}')::jsonb   AS measurements,
            COALESCE(p.morph_targets, '{}')::jsonb  AS morph_targets,
            p.face_texture_url, p.face_scan_status, p.avatar_preset,
            u.gender,
            t.is_restricted,
            (SELECT COUNT(*) FROM orders o
              WHERE o.user_id = u.id
                AND o.status IN ('new','seen','confirmed','ready')) AS open_orders,
            (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favorites_count,
            (SELECT COUNT(*) FROM looks l WHERE l.user_id = u.id) AS looks_count
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN user_trust t ON t.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );

  const profile = rows[0];
  if (!profile) throw ApiError.notFound('Foydalanuvchi topilmadi');
  return profile;
}

function hasMorphs(value: MorphTargets | null): value is MorphTargets {
  return value !== null && typeof value.height === 'number';
}

export async function getProfileExtras(userId: string) {
  const profile = await loadProfile(userId);

  return {
    measurements: profile.measurements ?? {},
    // Profil to'ldirilmagan bo'lsa neytral avatar ko'rsatiladi
    morphTargets: hasMorphs(profile.morph_targets) ? profile.morph_targets : NEUTRAL,
    faceTextureUrl: profile.face_texture_url,
    faceScanStatus: profile.face_scan_status,
    // Profil ekranidagi uchta raqam
    favoritesCount: Number(profile.favorites_count),
    looksCount: Number(profile.looks_count),
    trust: {
      isRestricted: profile.is_restricted ?? false,
      openOrders: Number(profile.open_orders),
    },
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [userId];

  const push = (column: string, value: unknown): void => {
    params.push(value);
    fields.push(`${column} = $${params.length}`);
  };

  if (input.fullName !== undefined) push('full_name', input.fullName);
  if (input.gender !== undefined) push('gender', input.gender);
  if (input.locale !== undefined) push('locale', input.locale);
  if (input.avatarUrl !== undefined) push('avatar_url', input.avatarUrl);

  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $1`, params);

  // Jins o'zgarsa morph'lar qayta hisoblanadi: ayol va erkak tanasi
  // uchun tipik nisbatlar boshqacha
  if (input.gender !== undefined) {
    const profile = await loadProfile(userId);
    await saveMeasurements(userId, profile.measurements ?? {}, input.gender);
  }
}

async function saveMeasurements(
  userId: string,
  measurements: Measurements,
  gender: Gender | null,
): Promise<MorphTargets> {
  const morphTargets = computeMorphTargets(measurements, gender);

  await pool.query(
    `INSERT INTO profiles (user_id, measurements, morph_targets)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id)
     DO UPDATE SET measurements = EXCLUDED.measurements,
                   morph_targets = EXCLUDED.morph_targets,
                   updated_at = now()`,
    [userId, JSON.stringify(measurements), JSON.stringify(morphTargets)],
  );

  return morphTargets;
}

/**
 * O'lchamlar qisman yuboriladi — ilova bir ekranda bo'yni, boshqasida
 * ko'krakni so'raydi. Shuning uchun eskisi ustiga qo'shiladi.
 */
export async function updateMeasurements(userId: string, input: MeasurementsInput) {
  const profile = await loadProfile(userId);
  const merged: Measurements = { ...(profile.measurements ?? {}), ...input };

  const morphTargets = await saveMeasurements(userId, merged, profile.gender);
  return { measurements: merged, morphTargets };
}

/**
 * GET /avatar/config — Try-On ekrani ochilganda birinchi chaqiriladi.
 *
 * Model havolalari muhit o'zgaruvchilaridan: skelet versiyasi
 * yangilanganda ilovani qayta chiqarish shart emas.
 */
export async function getAvatarConfig(
  userId: string,
  deviceModel: string | null,
  platform: string | null,
): Promise<{
  bodyGlbUrl: string;
  skeletonVersion: string;
  morphTargets: MorphTargets;
  faceTextureUrl: string | null;
  animations: Record<string, string>;
  qualityHint: QualityHint;
}> {
  const profile = await loadProfile(userId);
  const cdn = env().CDN_BASE_URL;
  const version = env().AVATAR_SKELETON_VERSION;
  const body = profile.gender === 'female' ? 'female' : 'male';

  return {
    bodyGlbUrl: `${cdn}/avatar/${body}-base-${version}.glb`,
    skeletonVersion: version,
    morphTargets: hasMorphs(profile.morph_targets) ? profile.morph_targets : NEUTRAL,
    faceTextureUrl: profile.face_texture_url,
    animations: {
      idle: `${cdn}/avatar/anim/idle-${version}.glb`,
      turn: `${cdn}/avatar/anim/turn-${version}.glb`,
      walk: `${cdn}/avatar/anim/walk-${version}.glb`,
      sit: `${cdn}/avatar/anim/sit-${version}.glb`,
    },
    qualityHint: suggestQuality(deviceModel, platform),
  };
}

// ============================================================
// Telefon raqamlari (03-api-spec §7)
// ============================================================

export async function listPhones(userId: string) {
  const { rows } = await pool.query<{
    id: string;
    phone: string;
    is_primary: boolean;
    verified_at: Date;
    verified_via: string;
  }>(
    `SELECT id, phone, is_primary, verified_at, verified_via
       FROM verified_phones WHERE user_id = $1
      ORDER BY is_primary DESC, verified_at`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    isPrimary: row.is_primary,
    verifiedAt: row.verified_at.toISOString(),
    // Faza 1 da OTP yo'q — raqam ro'yxatdan o'tishda "tasdiqlangan"
    // deb belgilanadi. Ilova buni ko'rsatishi mumkin.
    verifiedVia: row.verified_via,
  }));
}

export async function deletePhone(userId: string, phoneId: string): Promise<void> {
  const { rows } = await pool.query<{ is_primary: boolean }>(
    `SELECT is_primary FROM verified_phones WHERE id = $1 AND user_id = $2`,
    [phoneId, userId],
  );

  const phone = rows[0];
  if (!phone) throw ApiError.notFound('Raqam topilmadi');

  // Asosiy raqamsiz buyurtma berib bo'lmaydi
  if (phone.is_primary) {
    throw new ApiError('INVALID_STATE', 'Asosiy raqamni o`chirib bo`lmaydi');
  }

  await pool.query(`DELETE FROM verified_phones WHERE id = $1 AND user_id = $2`, [phoneId, userId]);
}
