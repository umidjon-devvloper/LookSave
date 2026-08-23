import { createHash, randomUUID } from 'node:crypto';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { downloadResult, isFashnEnabled, pollTryon, submitAvatar } from '../integrations/fashn';
import { uploadObject } from '../integrations/r2';
import { makeCutout } from '../store/cutout';
import { logger } from '../logger';
import {
  buildAvatarPrompt,
  missingForAvatar,
  type AvatarAngle,
  type AvatarGender,
  type AvatarMeasurements,
} from './avatar-prompt';

/**
 * AI yasagan to'liq bo'yli avatar.
 *
 * OQIM: yuz skaneri -> o'lchovlardan tavsif -> `model-create` -> surat.
 * Natija profilda saqlanadi va BARCHA kiyintirishlarda asos bo'ladi.
 *
 * ⚠️ BIR MARTA YASALADI. `face_reference` har natijaga +3 kredit qo'shadi,
 * ya'ni avatar oddiy kiyintirishdan bir necha barobar qimmat. Uni har kiyim
 * uchun qayta yasash xarajatni bir necha barobar oshirardi va hech qanday
 * foyda bermasdi — avatar o'zgarmaydi.
 */

export type AvatarStatus = 'none' | 'processing' | 'ready' | 'failed';

export interface AvatarDto {
  status: AvatarStatus;
  imageUrl: string | null;
  /** Fondan ajratilgan variant — qorong'i sahnaga qo'yish uchun */
  cutoutUrl: string | null;
  error: string | null;
  /** Burchak -> surat. Yasalganlari shu yerda; qolganlari talab bo'yicha. */
  angles: Record<string, string>;
  /** Hozir yasalayotgan burchak (bo'lsa) — ilova kutish holatini ko'rsatadi. */
  anglePending: string | null;
}

interface AvatarRow {
  face_texture_url: string | null;
  avatar_image_url: string | null;
  avatar_status: AvatarStatus;
  avatar_job_id: string | null;
  avatar_error: string | null;
  avatar_source_hash: string | null;
  measurements: AvatarMeasurements | null;
  gender: AvatarGender;
  avatar_angles: Record<string, string> | null;
  angle_job_id: string | null;
  angle_pending: AvatarAngle | null;
  avatar_cutout_url: string | null;
}

async function load(userId: string): Promise<AvatarRow> {
  const { rows } = await pool.query<AvatarRow>(
    `SELECT p.face_texture_url, p.avatar_image_url, p.avatar_status, p.avatar_job_id,
            p.avatar_error, p.avatar_source_hash,
            COALESCE(p.avatar_angles, '{}')::jsonb AS avatar_angles,
            p.angle_job_id, p.angle_pending, p.avatar_cutout_url,
            COALESCE(p.measurements, '{}')::jsonb AS measurements,
            u.gender
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );

  const row = rows[0];
  if (!row) throw ApiError.notFound('Foydalanuvchi topilmadi');
  return row;
}

function toDto(
  row: Pick<
    AvatarRow,
    | 'avatar_status'
    | 'avatar_image_url'
    | 'avatar_error'
    | 'avatar_angles'
    | 'angle_pending'
    | 'avatar_cutout_url'
  >,
): AvatarDto {
  const angles = row.avatar_angles ?? {};

  /*
   * Old ko'rinish har doim mavjud: u asosiy avatar bilan bir xil surat.
   * Alohida yasalmaydi, shunchaki ro'yxatga qo'shiladi — shunda ilova
   * "front" ni ham boshqa burchaklar kabi ishlatadi.
   */
  if (row.avatar_image_url && !angles['front']) angles['front'] = row.avatar_image_url;

  return {
    status: row.avatar_status ?? 'none',
    imageUrl: row.avatar_image_url,
    cutoutUrl: row.avatar_cutout_url,
    error: row.avatar_error,
    angles,
    anglePending: row.angle_pending,
  };
}

/** Baza qatorisiz javob — burchaklar hali noma'lum bo'lgan holatlar uchun. */
function bare(status: AvatarStatus, imageUrl: string | null, error: string | null): AvatarDto {
  return { status, imageUrl, cutoutUrl: null, error, angles: {}, anglePending: null };
}

function sourceHash(faceUrl: string, prompt: string): string {
  return createHash('sha256').update(`${faceUrl}|${prompt}`).digest('hex');
}

/** Hozirgi holat — ilova shu manzilni takrorlab natijani kutadi. */
export async function getAvatar(userId: string): Promise<AvatarDto> {
  let row = await load(userId);

  // Ketayotgan burchak bo'lsa avval uni yakunlaymiz
  if (row.angle_job_id) row = await finalizeAngle(userId, row);

  // Tugagan holat qayta so'ralmaydi
  if (row.avatar_status !== 'processing' || !row.avatar_job_id) return toDto(row);

  return finalize(userId, row.avatar_job_id);
}

/**
 * Avatarni yasashni boshlaydi.
 *
 * Tayyor avatar bor va manba o'zgarmagan bo'lsa — qayta yasalmaydi.
 */
export async function requestAvatar(userId: string): Promise<AvatarDto> {
  if (!isFashnEnabled()) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'AI hozircha sozlanmagan');
  }

  const row = await load(userId);

  if (!row.face_texture_url) {
    throw new ApiError('VALIDATION_ERROR', 'Avval yuzingizni skaner qiling');
  }

  const missing = missingForAvatar(row.measurements ?? {});
  if (missing) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Avatar yasash uchun ${missing} kerak — uni profilda kiriting`,
    );
  }

  const prompt = buildAvatarPrompt(row.gender, row.measurements ?? {});
  const hash = sourceHash(row.face_texture_url, prompt);

  /*
   * Manba o'zgarmagan bo'lsa qayta yasamaymiz.
   *
   * ⚠️ HOLAT HAM TEKSHIRILADI: `processing` bo'lsa ish allaqachon ketyapti
   * va ikkinchi marta yuborish ikki marta to'lash degani.
   */
  if (row.avatar_source_hash === hash) {
    if (row.avatar_status === 'ready' || row.avatar_status === 'processing') return toDto(row);
  }

  let job;
  try {
    job = await submitAvatar({ facePhotoUrl: row.face_texture_url, prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'noma`lum xato';
    logger.error({ err, userId }, 'avatar ishini boshlab bo`lmadi');

    await save(userId, { status: 'failed', error: message, hash });
    return bare('failed', null, message);
  }

  await save(userId, { status: 'processing', jobId: job.id, hash, error: null });
  logger.info({ userId, jobId: job.id }, 'avatar yasash boshlandi');

  return bare('processing', null, null);
}

/** Profil qatori bo'lmasligi mumkin — shuning uchun `INSERT ... ON CONFLICT`. */
async function save(
  userId: string,
  input: {
    status: AvatarStatus;
    jobId?: string | null;
    hash?: string;
    error?: string | null;
    url?: string;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO profiles (user_id, avatar_status, avatar_job_id, avatar_source_hash,
                           avatar_error, avatar_image_url, avatar_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id) DO UPDATE
       SET avatar_status     = EXCLUDED.avatar_status,
           avatar_job_id     = COALESCE(EXCLUDED.avatar_job_id, profiles.avatar_job_id),
           avatar_source_hash = COALESCE(EXCLUDED.avatar_source_hash, profiles.avatar_source_hash),
           avatar_error      = EXCLUDED.avatar_error,
           avatar_image_url  = COALESCE(EXCLUDED.avatar_image_url, profiles.avatar_image_url),
           avatar_updated_at = now()`,
    [
      userId,
      input.status,
      input.jobId ?? null,
      input.hash ?? null,
      input.error ?? null,
      input.url ?? null,
    ],
  );
}

/**
 * Provayderdan holatni oladi va tayyor bo'lsa suratni o'zimizga ko'chiradi.
 *
 * `model-create` va `tryon` bir xil `/status` endpointini ishlatadi,
 * shuning uchun `pollTryon` shu yerda ham to'g'ri keladi.
 */
async function finalize(userId: string, jobId: string): Promise<AvatarDto> {
  let result;
  try {
    result = await pollTryon(jobId);
  } catch (err) {
    // Tarmoq xatosi ishni bekor qilmaydi — provayder tomonda davom etayotgan bo'lishi mumkin
    logger.warn({ err, userId }, 'avatar holatini olib bo`lmadi');
    return bare('processing', null, null);
  }

  if (result.status === 'pending') return bare('processing', null, null);

  if (result.status === 'failed') {
    await save(userId, { status: 'failed', error: result.message });
    return bare('failed', null, result.message);
  }

  try {
    const buffer = await downloadResult(result.imageUrl);
    const url = await uploadObject({
      key: `avatar/${randomUUID()}.jpg`,
      body: buffer,
      contentType: 'image/jpeg',
    });

    await save(userId, { status: 'ready', url, error: null });

    /*
     * Kesim natijadan KEYIN yasaladi va uning nosozligi avatarni buzmaydi:
     * `makeCutout` xato bo'lsa `null` qaytaradi va ilova oddiy suratni
     * ko'rsatadi. Shuning uchun u alohida qadam.
     */
    const cutout = await makeCutout(url, 'avatar');
    if (cutout) {
      await pool.query(`UPDATE profiles SET avatar_cutout_url = $2 WHERE user_id = $1`, [
        userId,
        cutout,
      ]);
    }

    logger.info({ userId, cutout: Boolean(cutout) }, 'avatar tayyor');

    return { ...bare('ready', url, null), cutoutUrl: cutout };
  } catch (err) {
    /*
     * Surat tayyor, lekin ko'chirib bo'lmadi. Bu "failed" EMAS: provayder
     * havolasi hali yashaydi va keyingi so'rov qaytadan urinadi — kredit
     * ikkinchi marta sarflanmaydi.
     */
    logger.error({ err, userId }, 'avatarni saqlab bo`lmadi');
    return bare('processing', null, null);
  }
}

/**
 * Burchakni yasashni so'raydi (aylantirish).
 *
 * ⚠️ HAR BURCHAK ALOHIDA KREDIT. Shuning uchun ular oldindan yasalmaydi —
 * foydalanuvchi "aylantirish" bosganda kerakligi so'raladi. Yasalgani
 * saqlanadi va keyingi safar bepul keladi.
 *
 * ⚠️ BIR VAQTDA BITTA: `angle_job_id` band bo'lsa yangi so'rov qabul
 * qilinmaydi. Aks holda tugmani tez-tez bosgan odam bir necha ishni
 * parallel boshlab, har biriga alohida to'lardi.
 */
export async function requestAngle(userId: string, angle: AvatarAngle): Promise<AvatarDto> {
  if (!isFashnEnabled()) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'AI hozircha sozlanmagan');
  }

  const row = await load(userId);

  if (row.avatar_status !== 'ready' || !row.face_texture_url) {
    throw new ApiError('VALIDATION_ERROR', 'Avval avatar tayyor bo`lishi kerak');
  }

  // Allaqachon bor — qayta yasamaymiz
  const existing = row.avatar_angles ?? {};
  if (existing[angle]) return toDto(row);

  // Boshqa burchak ketayotgan bo'lsa kutamiz
  if (row.angle_job_id) return toDto(row);

  const prompt = buildAvatarPrompt(row.gender, row.measurements ?? {}, angle);

  let job;
  try {
    job = await submitAvatar({ facePhotoUrl: row.face_texture_url, prompt });
  } catch (err) {
    logger.error({ err, userId, angle }, 'burchak ishini boshlab bo`lmadi');
    return toDto(row);
  }

  await pool.query(
    `UPDATE profiles
        SET angle_job_id = $2, angle_pending = $3, angle_updated_at = now()
      WHERE user_id = $1`,
    [userId, job.id, angle],
  );

  logger.info({ userId, angle, jobId: job.id }, 'burchak yasash boshlandi');
  return { ...toDto(row), anglePending: angle };
}

/**
 * Ketayotgan burchak ishini yakunlaydi.
 *
 * `getAvatar` har chaqirilganda tekshiriladi — ilova baribir holatni
 * so'rab turadi, alohida navbat kerak emas.
 */
async function finalizeAngle(userId: string, row: AvatarRow): Promise<AvatarRow> {
  if (!row.angle_job_id || !row.angle_pending) return row;

  let result;
  try {
    result = await pollTryon(row.angle_job_id);
  } catch (err) {
    logger.warn({ err, userId }, 'burchak holatini olib bo`lmadi');
    return row;
  }

  if (result.status === 'pending') return row;

  if (result.status === 'failed') {
    logger.warn({ userId, angle: row.angle_pending }, 'burchak yasalmadi');
    await pool.query(
      `UPDATE profiles SET angle_job_id = NULL, angle_pending = NULL WHERE user_id = $1`,
      [userId],
    );
    return { ...row, angle_job_id: null, angle_pending: null };
  }

  try {
    const buffer = await downloadResult(result.imageUrl);
    const url = await uploadObject({
      key: `avatar/${randomUUID()}.jpg`,
      body: buffer,
      contentType: 'image/jpeg',
    });

    const angles = { ...(row.avatar_angles ?? {}), [row.angle_pending]: url };

    await pool.query(
      `UPDATE profiles
          SET avatar_angles = $2::jsonb, angle_job_id = NULL, angle_pending = NULL,
              angle_updated_at = now()
        WHERE user_id = $1`,
      [userId, JSON.stringify(angles)],
    );

    logger.info({ userId, angle: row.angle_pending }, 'burchak tayyor');
    return { ...row, avatar_angles: angles, angle_job_id: null, angle_pending: null };
  } catch (err) {
    // Surat tayyor, lekin ko'chirilmadi — keyingi so'rov qaytadan urinadi
    logger.error({ err, userId }, 'burchakni saqlab bo`lmadi');
    return row;
  }
}

/**
 * Tashlab ketilgan avatar ishlarini yakunlaydi.
 *
 * Kiyintirish keshidagi kabi sabab: ilova yopilsa ish "processing" bo'lib
 * qolib ketardi — kredit sarflangan, natija esa olinmagan.
 */
export async function sweepStaleAvatars(limit = 10): Promise<number> {
  const { rows } = await pool.query<{ user_id: string; avatar_job_id: string }>(
    `SELECT user_id, avatar_job_id
       FROM profiles
      WHERE avatar_status = 'processing'
        AND avatar_job_id IS NOT NULL
        AND avatar_updated_at < now() - interval '30 seconds'
      ORDER BY avatar_updated_at
      LIMIT $1`,
    [limit],
  );

  let finished = 0;
  for (const row of rows) {
    const dto = await finalize(row.user_id, row.avatar_job_id);
    if (dto.status === 'ready' || dto.status === 'failed') finished += 1;
  }

  return finished;
}
