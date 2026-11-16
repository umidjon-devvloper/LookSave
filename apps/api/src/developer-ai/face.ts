import { randomUUID } from 'node:crypto';

import { pool } from '../db/pool';
import {
  isFacefusionEnabled,
  swapAndCutout,
  type FaceOutcome,
} from '../integrations/facefusion';
import { presignRead, uploadObject } from '../integrations/r2';
import { logger } from '../logger';

/**
 * Operator yuklagan rasmga mijozning ASL yuzini qo'yish — BITTA joyda.
 *
 * ⚠️ NEGA ALOHIDA MODUL (2026-11-12). Operator natijasi serverga uch
 * eshikdan kiradi: avatar ishi, kiyintirish ishi (`completeTask`) va
 * avatar bilan birga yoziladigan birinchi kiyim (`submitDress`). Yuz
 * almashtirish faqat birinchi ikkitasida bor edi — uchinchisidan o'tgan
 * rasm AI chizgan yuz bilan mijozga borardi, va aynan o'sha rasm mijoz
 * avatar yasagandan keyin KO'RADIGAN BIRINCHI rasm edi. Endi uchala eshik
 * shu modul orqali o'tadi.
 */

export type Angle = 'front' | 'side' | 'back';

/**
 *   disabled     — facefusion sozlanmagan
 *   no-reference — mijozda yuz surati yo'q
 * Qolganlari `FaceOutcome` (integrations/facefusion.ts).
 */
export type FaceState = FaceOutcome | 'disabled' | 'no-reference';

export interface StoredFace {
  /** Yakuniy manzil — o'zgargan bo'lsa yangi, aks holda kelgani */
  url: string;
  face: FaceState;
  /** `url` dagi rasm shaffof PNG — alohida fon olib tashlash kerak emas */
  transparent: boolean;
  reason?: string;
}

/**
 * Bu holatda mijozga begona yuz ketdi va buni odam bilishi kerak.
 *
 * `skipped` (yon/orqa) va `disabled` — kutilgan holatlar, ular emas.
 */
export function faceNeedsAttention(face: FaceState): boolean {
  return face === 'failed' || face === 'unchanged' || face === 'no-reference';
}

/**
 * Mijozning yuz surati — imzolangan havola.
 *
 * ⚠️ `avatarFallback` FAQAT KIYINTIRISHDA. Yuz surati yo'q eski akkauntlarda
 * kiyintirish uchun yasalgan avatar yuz manbai bo'la oladi. Avatar ishining
 * o'zida esa mantiqsiz: avatar aynan o'sha payt yasalayapti va eskisini
 * yuz manbai qilish yangi yuzni eskisiga qaytarardi.
 */
export async function faceReference(
  userId: string,
  options: { avatarFallback: boolean },
): Promise<string | null> {
  const { rows } = await pool.query<{ face_texture_url: string | null; avatar_image_url: string | null }>(
    `SELECT face_texture_url, avatar_image_url FROM profiles WHERE user_id = $1`,
    [userId],
  );

  const raw =
    rows[0]?.face_texture_url ?? (options.avatarFallback ? rows[0]?.avatar_image_url : null) ?? null;
  if (!raw) return null;

  return (await presignRead(raw)) ?? raw;
}

/**
 * Ombordagi rasmga yuzni qo'yib, natijani YANGI kalit bilan saqlaydi.
 *
 * ⚠️ ASL RASM O'ZGARTIRILMAYDI — kesh va audit zanjiri buzilmasligi uchun.
 *
 * ⚠️ HECH QACHON XATO TASHLAMAYDI: almashtirib bo'lmasa kelgan manzil
 * qaytadi va mijoz rasmsiz qolmaydi. Lekin `face` maydoni buni aytadi va
 * chaqiruvchi `faceNeedsAttention` bilan tekshirishi kerak.
 */
export async function putCustomerFace(
  url: string,
  faceReferenceUrl: string | null,
  angle: Angle,
): Promise<StoredFace> {
  if (!isFacefusionEnabled()) return { url, face: 'disabled', transparent: false };
  if (!faceReferenceUrl) {
    return { url, face: 'no-reference', transparent: false, reason: 'mijozda yuz surati yo`q' };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { url, face: 'failed', transparent: false, reason: `natija o'qilmadi (${response.status})` };
    }

    const target = Buffer.from(await response.arrayBuffer());
    const result = await swapAndCutout({ target, sourceFaceUrl: faceReferenceUrl, angle });

    // Hech narsa o'zgarmagan (xizmat ham, kesim ham ishlamadi) — yuklash shart emas
    if (result.image === target) {
      return { url, face: result.face, transparent: false, reason: result.reason };
    }

    const stored = await uploadObject({
      key: `tryon/manual/${randomUUID()}.${result.transparent ? 'png' : 'jpg'}`,
      body: result.image,
      contentType: result.transparent ? 'image/png' : 'image/jpeg',
    });

    return { url: stored, face: result.face, transparent: result.transparent, reason: result.reason };
  } catch (err) {
    logger.error({ err, url: url.slice(0, 80) }, 'yuz qo`yishda kutilmagan xato');
    return {
      url,
      face: 'failed',
      transparent: false,
      reason: err instanceof Error ? err.message : 'kutilmagan xato',
    };
  }
}
