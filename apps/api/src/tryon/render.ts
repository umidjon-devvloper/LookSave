import { createHash, randomUUID } from 'node:crypto';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import {
  categoryForSlot,
  downloadResult,
  isFashnEnabled,
  pollTryon,
  submitTryon,
} from '../integrations/fashn';
import { uploadObject } from '../integrations/r2';
import { makeCutout } from '../store/cutout';
import { logger } from '../logger';
import { env } from '../config/env';

/**
 * AI kiyintirish — foydalanuvchining surati + kiyim surati -> tayyor foto.
 *
 * ⚠️ BU MODUL PUL SARFLAYDI. Har yasalgan surat provayderga to'lanadi,
 * shuning uchun butun mantiq shu savol atrofida qurilgan: "bu chaqiruv
 * haqiqatan zarurmi?". Uch qatlam himoya bor va uchalasi ham kerak:
 *
 *   1. KESH      — bir odam + bir kiyim + o'sha surat uchun bir marta
 *   2. POYGA     — bir vaqtda kelgan ikki so'rov bitta ish yaratadi
 *   3. CHEGARA   — kunlik limit, katalogni aylanib chiqishning oldini oladi
 *
 * Natija fonda tayyorlanadi (5–17 soniya), shuning uchun so'rov darhol
 * javob qaytaradi va ilova holatni so'rab turadi.
 */

export type RenderStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type RenderAngle = 'front' | 'side' | 'back';

export interface RenderDto {
  id: string;
  variantId: string;
  angle: RenderAngle;
  status: RenderStatus;
  imageUrl: string | null;
  /** Fondan ajratilgan variant — qorong'i sahnaga qo'yish uchun */
  cutoutUrl: string | null;
  error: string | null;
}

interface RenderRow {
  id: string;
  variant_id: string;
  angle: RenderAngle;
  status: RenderStatus;
  result_url: string | null;
  cutout_url: string | null;
  error: string | null;
  provider_job_id: string | null;
}

function toDto(row: RenderRow): RenderDto {
  return {
    id: row.id,
    variantId: row.variant_id,
    angle: row.angle ?? 'front',
    status: row.status,
    imageUrl: row.result_url,
    cutoutUrl: row.cutout_url,
    error: row.error,
  };
}

/**
 * Kesh kaliti.
 *
 * ⚠️ IKKALA MANZIL HAM KIRADI. Faqat kiyim manzili olinsa, foydalanuvchi
 * yangi surat yuklaganda eski natija qaytaverardi — ya'ni u boshqa odamning
 * gavdasini o'ziniki deb ko'rardi. Surat almashsa hash o'zgaradi va natija
 * qaytadan yasaladi.
 */
function sourceHash(bodyPhotoUrl: string, garmentImageUrl: string): string {
  return createHash('sha256').update(`${bodyPhotoUrl}|${garmentImageUrl}`).digest('hex');
}

interface Sources {
  bodyPhotoUrl: string;
  garmentImageUrl: string;
  slot: string;
}

/** Surat va kiyim manzilini yig'adi; yetishmasa sababini aniq aytadi. */
async function loadSources(
  userId: string,
  variantId: string,
  angle: RenderAngle,
): Promise<Sources> {
  const { rows } = await pool.query<{
    body_photo_url: string | null;
    avatar_image_url: string | null;
    avatar_angles: Record<string, string> | null;
    slot: string;
    variant_images: unknown;
    product_images: unknown;
  }>(
    `SELECT pr.body_photo_url, pr.avatar_image_url,
            COALESCE(pr.avatar_angles, '{}')::jsonb AS avatar_angles, p.slot,
            v.images AS variant_images, p.images AS product_images
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       LEFT JOIN profiles pr ON pr.user_id = $2
      WHERE v.id = $1`,
    [variantId, userId],
  );

  const row = rows[0];
  if (!row) throw ApiError.notFound('Mahsulot topilmadi');

  /*
   * ⚠️ YASALGAN AVATAR USTUN, HAQIQIY SURAT EMAS.
   *
   * Asosiy yo'l — yuz skaneri va o'lchovlardan yasalgan avatar: to'liq
   * bo'yli suratga tushish hammaga ham qulay emas. Haqiqiy surat ixtiyoriy
   * qo'shimcha yo'l bo'lib qoladi.
   *
   * Ikkalasi ham bo'lsa yasalgani olinadi: u ataylab kiyintirish uchun
   * tayyorlangan — tik poza, tor asosiy kiyim, sodda fon. Uydagi tasodifiy
   * surat esa bularning hech birini kafolatlamaydi.
   */
  /*
   * ⚠️ BURCHAK BIRINCHI. Aylantirilgan holatda kiyintirish o'sha burchakdagi
   * avatarga qo'llanadi — sinovda tasdiqlandi: model yon ko'rinishda ham
   * pozani tanidi va kiyimni to'g'ri joyladi.
   *
   * Burchak hali yasalmagan bo'lsa old ko'rinishga tushamiz: kiyintirishni
   * to'xtatgandan ko'ra oldindan ko'rsatgan yaxshiroq.
   */
  const model = (row.avatar_angles ?? {})[angle] ?? row.avatar_image_url ?? row.body_photo_url;

  if (!model) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Avval avatar yasang — yuzingizni skaner qiling va o`lchovlaringizni kiriting',
    );
  }

  /*
   * Variant surati ustun: rang variantlari har xil ko'rinadi va mahsulotning
   * umumiy surati boshqa rangda bo'lishi mumkin.
   */
  const variantImages = Array.isArray(row.variant_images) ? row.variant_images : [];
  const productImages = Array.isArray(row.product_images) ? row.product_images : [];
  const garment = [...variantImages, ...productImages].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  if (!garment) {
    throw new ApiError('VALIDATION_ERROR', 'Bu mahsulotning surati yo`q — kiyintirib bo`lmaydi');
  }

  return { bodyPhotoUrl: model, garmentImageUrl: garment, slot: row.slot };
}

/**
 * Kunlik chegara.
 *
 * Faqat HAQIQATAN yasalganlar sanaladi — keshdan qaytgan javob pul
 * turmaydi, shuning uchun u chegarani yemasligi kerak.
 */
async function assertDailyLimit(userId: string): Promise<void> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM tryon_renders
      WHERE user_id = $1 AND created_at > now() - interval '24 hours'`,
    [userId],
  );

  const used = Number(rows[0]?.count ?? 0);
  if (used >= env().TRYON_DAILY_LIMIT) {
    throw new ApiError(
      'RATE_LIMITED',
      `Kunlik chegara tugadi (${env().TRYON_DAILY_LIMIT} ta). Ertaga davom ettirishingiz mumkin.`,
    );
  }
}

/**
 * AI kiyintirish uchun kiyimlar ro'yxati.
 *
 * ⚠️ NEGA `/tryon/slot/:slot` YARAMAYDI: u `assets_3d.status = 'ready'`
 * shartini qo'yadi, ya'ni 3D modeli borlarini. AI'ga esa 3D umuman kerak
 * emas — unga kiyimning ODDIY SURATI kerak. Ikkalasi butunlay boshqa
 * ro'yxat: 3D modeli bor mahsulot suratsiz bo'lishi mumkin va aksincha.
 *
 * Surati yo'q mahsulot qo'shilmaydi — uni kiyintirib bo'lmaydi va
 * ro'yxatda ko'rsatilsa foydalanuvchi bosib xato oladi.
 */
export async function listGarments(slots: string[], gender: string | null, limit: number) {
  const { rows } = await pool.query<{
    variant_id: string;
    product_id: string;
    title: string;
    slot: string;
    price: string;
    currency: string;
    image: string;
    color_hex: string | null;
    sizes: string[] | null;
    store_id: string;
    store_name: string;
  }>(
    /*
     * `DISTINCT ON (p.id)` — har mahsulotdan bitta karta.
     *
     * Variantlar bu yerda ranglar. Ko'pchiligining o'z surati yo'q va ular
     * mahsulot suratiga tushadi — ya'ni gallereyada bir xil ko'rinadigan
     * bir necha karta paydo bo'lardi. Tartiblashda o'z surati borlari
     * oldinda turadi, shuning uchun tanlangan variant eng aniqrog'i bo'ladi.
     */
    `SELECT DISTINCT ON (p.id)
            v.id AS variant_id, p.id AS product_id, p.title, p.slot,
            p.base_price AS price, p.currency,
            COALESCE(NULLIF(v.images->>0, ''), NULLIF(p.images->>0, '')) AS image,
            v.color_hex,
            -- Mavjud o'lchamlar — faqat ombordagilari.
            --
            -- ⚠️ stock > reserved SHART: reserved — buyurtma qilingan,
            -- lekin hali topshirilmagan dona. Uni hisobga olmasak,
            -- foydalanuvchi allaqachon sotilgan o'lchamni tanlab, keyin
            -- savatda xato olardi.
            (SELECT array_agg(vs.size ORDER BY vs.size)
               FROM variant_stock vs
              WHERE vs.variant_id = v.id AND vs.stock > vs.reserved) AS sizes,
            s.id AS store_id, s.name AS store_name
       FROM products p
       JOIN product_variants v ON v.product_id = p.id AND v.is_active
       JOIN stores s ON s.id = p.store_id AND s.status = 'active'
      WHERE p.status = 'active'
        AND p.slot = ANY($1::text[])
        AND COALESCE(NULLIF(v.images->>0, ''), NULLIF(p.images->>0, '')) IS NOT NULL
        AND ($2::text IS NULL OR p.gender IN ($2, 'unisex'))
      ORDER BY p.id, (v.images->>0) IS NOT NULL DESC, v.id
      LIMIT $3`,
    [slots, gender, limit],
  );

  return rows.map((row) => ({
    variantId: row.variant_id,
    productId: row.product_id,
    title: row.title,
    slot: row.slot,
    price: row.price,
    currency: row.currency,
    image: row.image,
    colorHex: row.color_hex,
    sizes: row.sizes ?? [],
    store: { id: row.store_id, name: row.store_name },
  }));
}

/**
 * Kiyintirishni so'raydi. Kesh bo'lsa darhol qaytaradi, aks holda ish boshlaydi.
 */
export async function requestRender(
  userId: string,
  variantId: string,
  angle: RenderAngle = 'front',
): Promise<RenderDto> {
  if (!isFashnEnabled()) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'AI kiyintirish hozircha sozlanmagan');
  }

  const sources = await loadSources(userId, variantId, angle);
  const hash = sourceHash(sources.bodyPhotoUrl, sources.garmentImageUrl);

  /*
   * ⚠️ POYGADAN HIMOYA. Ikki so'rov bir vaqtda kelsa ikkalasi ham "kesh yo'q"
   * deb ko'rardi va ikkita ish yaratardi — ya'ni ikki marta to'lanardi.
   *
   * `ON CONFLICT DO NOTHING` shuni hal qiladi: qatorni FAQAT bittasi
   * qo'shadi va provayderga ham faqat o'sha murojaat qiladi. Ikkinchisiga
   * `rowCount = 0` qaytadi va u mavjud qatorni o'qiydi.
   */
  const inserted = await pool.query<RenderRow>(
    `INSERT INTO tryon_renders (user_id, variant_id, angle, source_hash, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (user_id, variant_id, angle, source_hash) DO NOTHING
     RETURNING id, variant_id, angle, status, result_url, cutout_url, error, provider_job_id`,
    [userId, variantId, angle, hash],
  );

  const fresh = inserted.rows[0];
  if (!fresh) {
    // Kesh yoki allaqachon ketayotgan ish
    const { rows } = await pool.query<RenderRow>(
      `SELECT id, variant_id, angle, status, result_url, cutout_url, error, provider_job_id
         FROM tryon_renders
        WHERE user_id = $1 AND variant_id = $2 AND angle = $3 AND source_hash = $4`,
      [userId, variantId, angle, hash],
    );

    const existing = rows[0];
    if (!existing) throw ApiError.internal('Kiyintirish yozuvi topilmadi');
    return toDto(existing);
  }

  /*
   * Chegara qator qo'shilgandan KEYIN tekshiriladi, chunki tekshiruv ham
   * shu jadvalni sanaydi. Chegara oshsa qator o'chiriladi va provayderga
   * umuman murojaat qilinmaydi — ya'ni pul sarflanmaydi.
   */
  try {
    await assertDailyLimit(userId);
  } catch (err) {
    await pool.query(`DELETE FROM tryon_renders WHERE id = $1`, [fresh.id]);
    throw err;
  }

  try {
    const job = await submitTryon({
      modelImageUrl: sources.bodyPhotoUrl,
      garmentImageUrl: sources.garmentImageUrl,
      category: categoryForSlot(sources.slot),
    });

    const { rows } = await pool.query<RenderRow>(
      `UPDATE tryon_renders SET status = 'processing', provider_job_id = $2
        WHERE id = $1
        RETURNING id, variant_id, angle, status, result_url, cutout_url, error, provider_job_id`,
      [fresh.id, job.id],
    );

    return toDto(rows[0] ?? { ...fresh, status: 'processing' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'noma`lum xato';
    logger.error({ err, variantId }, 'FASHN ishini boshlab bo`lmadi');

    await pool.query(
      `UPDATE tryon_renders SET status = 'failed', error = $2, completed_at = now()
        WHERE id = $1`,
      [fresh.id, message],
    );

    return { ...toDto(fresh), status: 'failed', error: message };
  }
}

/**
 * Holatni tekshiradi va tayyor bo'lsa natijani o'zimizga ko'chiradi.
 *
 * ⚠️ TEKSHIRUV SHU YERDA, ALOHIDA JARAYONDA EMAS. Ilova holatni so'rab
 * turadi va o'sha so'rov provayderni ham tekshiradi — shunda navbat
 * xizmati, ishchi jarayon va ular bilan keladigan nosozliklar kerak emas.
 * Tashlab ketilgan ishlar uchun `sweepStaleRenders` bor.
 */
export async function pollRender(userId: string, renderId: string): Promise<RenderDto> {
  const { rows } = await pool.query<RenderRow>(
    `SELECT id, variant_id, angle, status, result_url, cutout_url, error, provider_job_id
       FROM tryon_renders
      WHERE id = $1 AND user_id = $2`,
    [renderId, userId],
  );

  const row = rows[0];
  if (!row) throw ApiError.notFound('Kiyintirish topilmadi');

  // Tugagan ish qayta so'ralmaydi — javob allaqachon bazada
  if (row.status === 'ready' || row.status === 'failed') return toDto(row);
  if (!row.provider_job_id) return toDto(row);

  return finalize(row);
}

/** Provayderdan holatni oladi va natijani saqlaydi. */
async function finalize(row: RenderRow): Promise<RenderDto> {
  if (!row.provider_job_id) return toDto(row);

  let result;
  try {
    result = await pollTryon(row.provider_job_id);
  } catch (err) {
    /*
     * Tarmoq xatosi ishni MUVAFFAQIYATSIZ qilmaydi — provayder tomonda ish
     * davom etayotgan bo'lishi mumkin. Uni "failed" deb belgilasak, to'langan
     * natija yo'qolardi va foydalanuvchi qaytadan to'lardi.
     */
    logger.warn({ err, renderId: row.id }, 'FASHN holatini olib bo`lmadi');
    return toDto(row);
  }

  if (result.status === 'pending') return toDto(row);

  if (result.status === 'failed') {
    const { rows } = await pool.query<RenderRow>(
      `UPDATE tryon_renders SET status = 'failed', error = $2, completed_at = now()
        WHERE id = $1
        RETURNING id, variant_id, angle, status, result_url, cutout_url, error, provider_job_id`,
      [row.id, result.message],
    );
    return toDto(rows[0] ?? { ...row, status: 'failed', error: result.message });
  }

  // Tayyor — natijani o'zimizga ko'chiramiz
  try {
    const buffer = await downloadResult(result.imageUrl);
    const url = await uploadObject({
      key: `tryon/${randomUUID()}.jpg`,
      body: buffer,
      contentType: 'image/jpeg',
    });

    /*
     * Kesim — qorong'i sahna uchun. Uning nosozligi natijani buzmaydi:
     * `makeCutout` `null` qaytarsa ilova oddiy suratni ko'rsatadi.
     */
    const cutout = await makeCutout(url, 'tryon');

    const { rows } = await pool.query<RenderRow>(
      `UPDATE tryon_renders
          SET status = 'ready', result_url = $2, cutout_url = $3, completed_at = now()
        WHERE id = $1
        RETURNING id, variant_id, angle, status, result_url, cutout_url, error, provider_job_id`,
      [row.id, url, cutout],
    );

    return toDto(rows[0] ?? { ...row, status: 'ready', result_url: url, cutout_url: cutout });
  } catch (err) {
    /*
     * Natija tayyor, lekin ko'chirib bo'lmadi. Bu ham "failed" EMAS:
     * provayder havolasi hali bir necha kun yashaydi, keyingi so'rov
     * qaytadan urinadi va pul ikkinchi marta to'lanmaydi.
     */
    logger.error({ err, renderId: row.id }, 'natijani saqlab bo`lmadi');
    return toDto(row);
  }
}

/**
 * Gallereya uchun — bir so'rovda ko'p variantning holati.
 *
 * Svayp paytida har rasm uchun alohida so'rov yuborilsa tarmoq bo'g'iladi;
 * ilova ro'yxatni oldindan oladi va faqat tayyor bo'lmaganlarini kuzatadi.
 */
export async function listRenders(
  userId: string,
  variantIds: string[],
  angle: RenderAngle = 'front',
): Promise<RenderDto[]> {
  if (variantIds.length === 0) return [];

  const { rows } = await pool.query<RenderRow>(
    /*
     * ⚠️ BURCHAK BO'YICHA FILTR SHART. Usiz `DISTINCT ON (variant_id)`
     * tasodifiy burchakni qaytarardi va gallereyada old ko'rinish o'rniga
     * yon ko'rinish chiqib qolishi mumkin edi.
     */
    `SELECT DISTINCT ON (variant_id)
            id, variant_id, angle, status, result_url, cutout_url, error, provider_job_id
       FROM tryon_renders
      WHERE user_id = $1 AND variant_id = ANY($2::uuid[]) AND angle = $3
      ORDER BY variant_id, created_at DESC`,
    [userId, variantIds, angle],
  );

  return rows.map(toDto);
}

/**
 * Osilib qolgan ishlarni yakunlaydi.
 *
 * KERAK, chunki ilova holatni so'rab tugatmasligi mumkin: foydalanuvchi
 * ekranni yopadi yoki internet uziladi. O'sha ish "processing" bo'lib
 * qolib ketardi — pul to'langan, natija esa hech qachon olinmagan.
 */
export async function sweepStaleRenders(limit = 20): Promise<number> {
  const { rows } = await pool.query<RenderRow>(
    `SELECT id, variant_id, angle, status, result_url, cutout_url, error, provider_job_id
       FROM tryon_renders
      WHERE status = 'processing'
        AND provider_job_id IS NOT NULL
        AND created_at < now() - interval '30 seconds'
      ORDER BY created_at
      LIMIT $1`,
    [limit],
  );

  let finished = 0;
  for (const row of rows) {
    const dto = await finalize(row);
    if (dto.status === 'ready' || dto.status === 'failed') finished += 1;
  }

  return finished;
}
