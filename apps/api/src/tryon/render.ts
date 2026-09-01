import { createHash, randomUUID } from 'node:crypto';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { garmentKindForSlot, generateTryon, isOpenAiEnabled } from '../integrations/openai';
import { presignRead, uploadObject } from '../integrations/r2';
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
  /**
   * Yuz surati — GPT ga qo'shimcha manba sifatida beriladi.
   *
   * ⚠️ NEGA KERAK. `gpt-image-1` yuzni nusxa ko'chirmaydi, butun kadrni
   * qaytadan chizadi va yuzni «o'xshatib» qo'yadi. Faqat gavda surati
   * berilsa u o'sha suratdagi TAXMINIY yuzni yana bir bor taxmin qiladi.
   * Haqiqiy yuz suratini ko'rsatsak, taxmin manbadan boshlanadi.
   */
  faceReferenceUrl: string | null;
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
    face_texture_url: string | null;
    avatar_angles: Record<string, string> | null;
    slot: string;
    variant_images: unknown;
    product_images: unknown;
  }>(
    `SELECT pr.body_photo_url, pr.avatar_image_url, pr.face_texture_url,
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
   * ⚠️ HAQIQIY SURAT USTUN, YASALGAN AVATAR EMAS — VA BU O'ZGARTIRILDI.
   *
   * Ilgari yasalgan avatar birinchi turardi: u ataylab kiyintirish uchun
   * tayyorlangan (tik poza, tor asosiy kiyim, sodda fon), uydagi tasodifiy
   * surat esa bularni kafolatlamaydi.
   *
   * Lekin o'lchov boshqa narsani ko'rsatdi. `gpt-image-1` yuzni NUSXA
   * KO'CHIRMAYDI — butun kadrni qaytadan chizadi. Yasalgan avatarning
   * o'zi allaqachon shunday qayta chizilgan, ya'ni undagi yuz taxminiy.
   * Uning ustiga kiyintirish qo'ysak, taxminning taxmini chiqadi va yuz
   * ikki qadamda buziladi — nusxadan nusxa olgandek.
   *
   * Haqiqiy surat bo'lsa zanjir bir qadam qisqaradi va o'xshashlik
   * sezilarli saqlanadi. Poza va fon yomonroq bo'lishi mumkin, lekin
   * foydalanuvchi uchun O'ZINI TANISH muhimroq.
   *
   * ⚠️ BURCHAK ISTISNO. Aylantirilgan ko'rinish faqat yasalgan avatarda
   * bor — haqiqiy surat old tomondan olingan. Shuning uchun burchak
   * so'ralganda o'sha avatar ishlatiladi.
   */
  const rotated = angle === 'front' ? null : ((row.avatar_angles ?? {})[angle] ?? null);
  const model = rotated ?? row.body_photo_url ?? row.avatar_image_url;

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

  return {
    bodyPhotoUrl: model,
    garmentImageUrl: garment,
    slot: row.slot,
    faceReferenceUrl: row.face_texture_url,
  };
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
export async function listGarments(
  slots: string[],
  gender: string | null,
  limit: number,
  category: string | null = null,
) {
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
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active'
        AND p.slot = ANY($1::text[])
        -- Kategoriya berilsa u ustun: slotdan aniqroq
        AND ($4::text IS NULL OR c.slug = $4)
        AND COALESCE(NULLIF(v.images->>0, ''), NULLIF(p.images->>0, '')) IS NOT NULL
        AND ($2::text IS NULL OR p.gender IN ($2, 'unisex'))
      ORDER BY p.id, (v.images->>0) IS NOT NULL DESC, v.id
      LIMIT $3`,
    [slots, gender, limit, category],
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
  if (!isOpenAiEnabled()) {
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

  /*
   * ⚠️ IMZO XESHDAN KEYIN (yuqoridagi `sourceHash` kanonik manzilni
   * oladi). Imzolangan havola xeshga tushsa kesh buzilardi va har
   * so'rov qaytadan to'lanardi.
   */
  const modelImageUrl = (await presignRead(sources.bodyPhotoUrl)) ?? sources.bodyPhotoUrl;

  /*
   * Yuz surati ham shaxsiy bucketda bo'lishi mumkin — u ham imzolanadi.
   * Xeshga tushmaydi: kiyintirish natijasi yuz manbasiga emas, gavda va
   * kiyimga bog'liq.
   */
  const faceReferenceUrl = sources.faceReferenceUrl
    ? ((await presignRead(sources.faceReferenceUrl)) ?? sources.faceReferenceUrl)
    : null;

  /*
   * ⚠️ HOLAT AVVAL BAZAGA, KEYIN FON ISHI. Tartib muhim: `await` fon
   * ishidan oldin, shunda tez tugagan generatsiya `ready` ni yozib
   * ulgursa ham bu yozuv uni bosib ketmaydi.
   */
  await pool.query(`UPDATE tryon_renders SET status = 'processing' WHERE id = $1`, [fresh.id]);
  void runOpenAi(fresh.id, modelImageUrl, sources.garmentImageUrl, sources.slot, faceReferenceUrl);

  return toDto({ ...fresh, status: 'processing' });
}

/**
 * Kiyintirish holati.
 *
 * ⚠️ PROVAYDERDAN SO'RALMAYDI. Ilgari FASHN'da ish `id` bilan yurardi va
 * har so'rovda holat provayderdan olinardi. OpenAI sinxron: natijani fon
 * ishi o'zi bazaga yozadi, shuning uchun bu yerda faqat qator o'qiladi —
 * tashqi chaqiruv ham, kutish ham yo'q.
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

  return toDto(row);
}

/**
 * Tayyor suratni saqlaydi va qatorni `ready` qiladi.
 *
 * ⚠️ NATIJA O'ZIMIZGA KO'CHIRILADI. OpenAI xom bayt qaytaradi va uni
 * darhol R2 ga yozamiz — provayderda saqlanmaydi, ya'ni keyin qayta
 * so'rab olish imkoni yo'q.
 */
async function storeResult(renderId: string, buffer: Buffer): Promise<string> {
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

  await pool.query(
    `UPDATE tryon_renders
        SET status = 'ready', result_url = $2, cutout_url = $3, completed_at = now()
      WHERE id = $1`,
    [renderId, url, cutout],
  );

  return url;
}

/**
 * OpenAI oqimi — fonda bajariladi.
 *
 * ⚠️ XATO YUTILMAYDI, QATORGA YOZILADI. Fon vazifasida `throw` hech
 * kimga yetib bormaydi: HTTP javob allaqachon berilgan. Shuning uchun
 * xato `failed` holati bilan bazaga tushadi — ilova uni ko'radi va
 * foydalanuvchiga aytadi.
 */
async function runOpenAi(
  renderId: string,
  modelImageUrl: string,
  garmentImageUrl: string,
  slot: string,
  faceReferenceUrl: string | null,
): Promise<void> {
  try {
    const buffer = await generateTryon({
      modelImageUrl,
      garmentImageUrl,
      kind: garmentKindForSlot(slot),
      faceReferenceUrl,
    });

    await storeResult(renderId, buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'noma`lum xato';
    logger.error({ err, renderId }, 'openai: kiyintirish yiqildi');

    await pool
      .query(
        `UPDATE tryon_renders SET status = 'failed', error = $2, completed_at = now()
          WHERE id = $1`,
        [renderId, message],
      )
      .catch(() => {
        // Baza ham yiqilsa qiladigan ish qolmaydi — log yuqorida yozilgan
      });
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
 * Tashlab ketilgan ishlarni yopadi.
 *
 * ⚠️ VAZIFASI O'ZGARDI. Ilgari bu provayderdan holat so'rab, tayyor
 * ishlarni yakunlardi. OpenAI sinxron bo'lgani uchun yakunlash fon
 * ishining o'zida bo'ladi — bu yerda faqat EGASIZ QOLGANLAR yopiladi.
 *
 * Egasiz qolish sababi: ish XOTIRADA edi, provayderda emas. Server
 * generatsiya paytida qayta ishga tushsa ish yo'qoladi va qator abadiy
 * `processing` da qolardi — foydalanuvchi aylanayotgan indikatorga qarab
 * o'tirardi.
 *
 * 10 daqiqa — `gpt-image-1` ning eng sekin holatidan (30–60 s) ancha
 * ko'p, ya'ni tirik ish xato bilan yopilmaydi.
 */
export async function sweepStaleRenders(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE tryon_renders
        SET status = 'failed', error = $1, completed_at = now()
      WHERE status = 'processing'
        AND created_at < now() - interval '10 minutes'`,
    ['Kiyintirish uzilib qoldi — qaytadan urinib ko`ring'],
  );

  return rowCount ?? 0;
}
