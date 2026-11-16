import { AI_TRYON_SLOTS } from '@looksave/validation';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { isOwnCdnUrl, presignRead } from '../integrations/r2';
import { logger } from '../logger';
import { makeCutout } from '../store/cutout';
import { storeAvatarSheet } from '../tryon/avatar-sheet';
import { faceNeedsAttention, faceReference, putCustomerFace, type Angle } from './face';
import { warnFaceNotApplied } from './notify';

/**
 * Operator kiyintirishi — `developer_ai` paneli.
 *
 * Avatar tayyor bo'lgach, operator do'kon kiyimlarini BITTALAB avatarga
 * kiydiradi (brauzerdagi AI'da) va natijani yuklaydi. Har natija mijozning
 * `tryon_renders` yozuviga tushadi — ya'ni mijoz ilovada o'zini o'sha
 * kiyimda tayyor holda ko'radi.
 *
 * ⚠️ NEGA ALOHIDA, KIYINTIRISH NAVBATIDAN EMAS. Bir avatarga o'nlab kiyim
 * kiydiriladi — har biri alohida navbat yozuvi bo'lsa, navbat panjarasi
 * yuzlab yozuv bilan to'lardi. Bu yerda hammasi BITTA avatar ishining
 * ichida: operator gridda har kiyimni ko'radi va yuklaydi.
 */

export interface DressGarment {
  variantId: string;
  productId: string;
  title: string;
  slot: string;
  /** Kiyimning tekis surati — operator uni AI'ga beradi */
  garmentImage: string | null;
  /** Bu kiyim allaqachon kiydirilganmi (mijozda ready render bor) */
  done: boolean;
}

export interface DressBoard {
  /** Kiydiriladigan avatar (imzolangan) — operator uni AI'ga beradi */
  avatarImage: string | null;
  garments: DressGarment[];
}

/**
 * Shu foydalanuvchiga kiydirilishi kerak bo'lgan kiyimlar.
 *
 * ⚠️ FAQAT AI TRY-ON SLOTLARI VA OMBORDA BORLARI. 3D yoki tugagan kiyimni
 * kiydirishning ma'nosi yo'q — mijoz uni baribir sotib ololmaydi.
 * `DISTINCT ON (p.id)` — har mahsulotdan bitta (ranglar takrorlanmasin).
 */
export async function listDressBoard(userId: string, storeId: string | null): Promise<DressBoard> {
  const avatar = await pool.query<{ avatar_image_url: string | null }>(
    `SELECT avatar_image_url FROM profiles WHERE user_id = $1`,
    [userId],
  );
  const avatarUrl = avatar.rows[0]?.avatar_image_url ?? null;

  const { rows } = await pool.query<{
    variant_id: string;
    product_id: string;
    title: string;
    slot: string;
    image: string | null;
    done: boolean;
  }>(
    `SELECT DISTINCT ON (p.id)
            v.id AS variant_id, p.id AS product_id, p.title, p.slot,
            COALESCE(NULLIF(v.images->>0, ''), NULLIF(p.images->>0, '')) AS image,
            EXISTS (
              SELECT 1 FROM tryon_renders t
               WHERE t.user_id = $1 AND t.variant_id = v.id
                 AND t.angle = 'front' AND t.status = 'ready'
            ) AS done
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       JOIN stores s ON s.id = p.store_id
      WHERE p.status = 'active'
        AND s.status = 'active'
        AND v.is_active
        AND p.slot = ANY($2::text[])
        AND ($3::uuid IS NULL OR p.store_id = $3)
        AND EXISTS (SELECT 1 FROM variant_stock vs WHERE vs.variant_id = v.id AND vs.stock > vs.reserved)
      ORDER BY p.id, (v.images->>0) IS NOT NULL DESC, v.sort_order ASC, v.id ASC`,
    [userId, [...AI_TRYON_SLOTS], storeId],
  );

  const garments = rows.map((row) => ({
    variantId: row.variant_id,
    productId: row.product_id,
    title: row.title,
    slot: row.slot,
    garmentImage: row.image,
    done: row.done,
  }));

  return { avatarImage: (await presignRead(avatarUrl)) ?? avatarUrl, garments };
}

/**
 * Operator bitta kiyimni kiydirdi — natijani mijozning renderiga yozadi.
 *
 * ⚠️ MANZIL BIZNING OMBORDAN BO'LISHI SHART (`/result` bilan bir xil sabab).
 * ⚠️ KESIM ALOHIDA, TRANZAKSIYADAN KEYIN — u sekin va nosozligi renderni
 * buzmasligi kerak (ilova kesimsiz ham suratni ko'rsatadi).
 */
export async function submitDress(
  userId: string,
  variantId: string,
  resultUrl: string,
): Promise<{ variantId: string; done: true }> {
  if (!isOwnCdnUrl(resultUrl)) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Natija avval panel orqali yuklanishi kerak — tashqi havola qabul qilinmaydi',
    );
  }

  // Kiyim mavjud va AI'ga yaroqli slotdami — tekshiriladi
  const { rows } = await pool.query<{ slot: string }>(
    `SELECT p.slot FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE v.id = $1 AND p.status = 'active'`,
    [variantId],
  );
  const slot = rows[0]?.slot;
  if (!slot) throw ApiError.notFound('Bunday kiyim yo`q');
  if (!(AI_TRYON_SLOTS as readonly string[]).includes(slot)) {
    throw new ApiError('VALIDATION_ERROR', 'Bu kiyim AI kiyintirishni qo`llamaydi');
  }

  /*
   * ⚠️ `base_render_id = NULL` — birinchi qatlam (yalang'och avatar ustiga).
   * Ilova aynan shu shart bilan qidiradi (`listRenders`). `source_hash`
   * operator kiyintirishini belgilaydi va takroriy yuklashda O'CHIRIB
   * qaytadan yoziladi (operator qayta kiydirsa yangisi turadi).
   */
  /*
   * ⚠️ UCH PANELLI VARAQ (old · yon · orqa) BO'LSA — UCHTA RENDER
   * (2026-09-25). Kengaytma kiyimni bir so'rovda uch burchakdan chizadi;
   * server uni bo'lib har burchakni o'z `angle` si bilan yozadi. Mijoz
   * ilovasida Old/Yon/Orqa tugmalari shu yozuvlarni ko'rsatadi.
   * Bitta pozali surat avvalgidek faqat «old» bo'ladi.
   */
  const pieces = (await storeAvatarSheet(resultUrl)) ?? { front: resultUrl };

  /*
   * ⚠️ BU RASMGA HAM MIJOZNING YUZI QO'YILADI (2026-11-12).
   *
   * Ilgari bu yo'lda yuz almashtirish YO'Q edi. Kengaytma avatarni birinchi
   * kiyim bilan yasaydi va o'sha rasmni shu yerga ham yuboradi — avatarning
   * o'zi yuzi almashtirilib saqlanardi, shu yerga kelgan nusxasi esa AI
   * chizgan yuz bilan qolardi. Mijoz avatar yasagandan keyin ko'radigan
   * BIRINCHI rasm aynan shu edi.
   *
   * ⚠️ ALLAQACHON TAYYOR RASM QAYTA ISHLANMAYDI. Yangi kengaytma (0.9.11+)
   * bu yerga server qaytargan — yuzi almashtirilgan — avatar manzilini
   * yuboradi. U mijozning joriy avatari bilan bir xil bo'lsa, almashtirish
   * ham, kesim ham tayyor: ikkinchi marta bir daqiqa sarflash shart emas.
   */
  const { rows: profileRows } = await pool.query<{
    avatar_image_url: string | null;
    avatar_cutout_url: string | null;
  }>(`SELECT avatar_image_url, avatar_cutout_url FROM profiles WHERE user_id = $1`, [userId]);
  const profile = profileRows[0];

  let reference: string | null | undefined;

  for (const [angle, incoming] of Object.entries(pieces)) {
    let url = incoming;
    let cutout: string | null = null;

    if (incoming === profile?.avatar_image_url) {
      cutout = profile.avatar_cutout_url;
    } else {
      reference ??= await faceReference(userId, { avatarFallback: true });
      const stored = await putCustomerFace(incoming, reference, angle as Angle);

      url = stored.url;
      if (stored.transparent) cutout = stored.url;

      if (faceNeedsAttention(stored.face)) {
        const reason = stored.reason ?? stored.face;
        logger.error(
          { userId, variantId, angle, face: stored.face, reason },
          'developer_ai: kiyim natijasiga mijozning yuzi QO`YILMADI',
        );
        void warnFaceNotApplied({ kind: 'render', id: variantId, reason });
      }
    }

    await pool.query(
      `INSERT INTO tryon_renders (user_id, variant_id, angle, source_hash, base_render_id,
                                  status, provider, result_url, cutout_url, completed_at)
       VALUES ($1, $2, $3, 'operator', NULL, 'ready', 'manual', $4, $5, now())
       ON CONFLICT (user_id, variant_id, angle, source_hash)
         DO UPDATE SET result_url = EXCLUDED.result_url, cutout_url = EXCLUDED.cutout_url,
                       status = 'ready', error = NULL, completed_at = now()`,
      [userId, variantId, angle, url, cutout],
    );

    // Kesim allaqachon bor bo'lsa (shaffof natija) qayta yasalmaydi
    if (!cutout) void attachCutout(userId, variantId, angle, url);
  }

  logger.info({ userId, variantId, angles: Object.keys(pieces) }, 'developer_ai: kiyim kiydirildi');
  return { variantId, done: true };
}

async function attachCutout(
  userId: string,
  variantId: string,
  angle: string,
  url: string,
): Promise<void> {
  try {
    const cutout = await makeCutout(url, 'tryon');
    if (!cutout) return;
    await pool.query(
      `UPDATE tryon_renders SET cutout_url = $3
        WHERE user_id = $1 AND variant_id = $2 AND angle = $5
          AND source_hash = 'operator' AND result_url = $4`,
      [userId, variantId, cutout, url, angle],
    );
  } catch (err) {
    logger.warn({ err, userId, variantId }, 'developer_ai: kiyim kesimi yasalmadi');
  }
}
