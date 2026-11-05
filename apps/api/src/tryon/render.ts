import { createHash, randomUUID } from 'node:crypto';

import { AI_TRYON_SLOTS, garmentImageForAngle, normalizeSize } from '@looksave/validation';

import type { AvatarGender, AvatarMeasurements } from './avatar-prompt';
import { buildTryonSheetPrompt } from './tryon-prompt';

import { enqueueTask, isAutoAiUser, isManual } from '../developer-ai/tasks';
import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import {
  garmentKindForSlot,
  generateTryon,
  generationFingerprint,
  isOpenAiEnabled,
} from '../integrations/openai';
import { deleteByUrl, presignRead, uploadObject } from '../integrations/r2';
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
  /** Qaysi natija ustiga kiydirilgan. `null` — asl suratga */
  baseRenderId: string | null;
  error: string | null;
}

interface RenderRow {
  id: string;
  variant_id: string;
  angle: RenderAngle;
  status: RenderStatus;
  result_url: string | null;
  cutout_url: string | null;
  base_render_id: string | null;
  error: string | null;
  provider_job_id: string | null;
}

/** Har so'rovda takrorlanadigan ustunlar ro'yxati — bir joyda tursin. */
const RENDER_COLUMNS = `id, variant_id, angle, status, result_url, cutout_url,
                        base_render_id, error, provider_job_id`;

function toDto(row: RenderRow): RenderDto {
  return {
    id: row.id,
    variantId: row.variant_id,
    angle: row.angle ?? 'front',
    status: row.status,
    imageUrl: row.result_url,
    cutoutUrl: row.cutout_url,
    baseRenderId: row.base_render_id,
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
 *
 * ⚠️ RETSEPT HAM KIRADI (`generationFingerprint`). Manzillar model
 * almashganda o'zgarmaydi: `gpt-image-1` dan `2.5` ga o'tilganda kalit
 * o'sha bo'lib qolardi va gallereyada eski, yuzi buzuq natijalar
 * qaytaverardi — yangi model umuman chaqirilmasdi.
 *
 * ⚠️ ESKI QATORLAR O'CHMAYDI, SHUNCHAKI MOS KELMAY QOLADI. `INSERT`
 * yangi xesh bilan yangi qator qo'shadi; `listRenders` esa
 * `ORDER BY created_at DESC` bilan eng yangisini oladi, ya'ni ilova
 * darhol yangisini ko'radi. Eskilari bazada va R2 da qoladi —
 * ularni tozalash alohida ish.
 */
function sourceHash(bodyPhotoUrl: string, garmentImageUrl: string): string {
  const recipe = generationFingerprint(env().OPENAI_IMAGE_MODEL);
  return createHash('sha256').update(`${recipe}|${bodyPhotoUrl}|${garmentImageUrl}`).digest('hex');
}

interface Sources {
  bodyPhotoUrl: string;
  garmentImageUrl: string;
  slot: string;
  /**
   * Yuz surati — GPT ga qo'shimcha manba sifatida beriladi.
   *
   * ⚠️ NEGA KERAK. Model kadrni qaytadan chizadi — `gpt-image-2.5` da
   * yuz ancha aniq saqlanadi, lekin nusxa ko'chirish emas, baribir
   * qayta chizish. Faqat gavda surati berilsa, u o'sha suratdagi
   * TAXMINIY yuzni yana bir bor taxmin qiladi: saytda gavda surati
   * ko'pincha o'zi yasalgan avatar bo'ladi. Haqiqiy yuz suratini
   * ko'rsatsak, zanjirda bitta haqiqiy manba paydo bo'ladi.
   *
   * Havola `integrations/openai.ts` da `cropFace` bilan boshga qirqib
   * kattalashtiriladi — to'liq kadrda yuz mayda detal bo'lib qolardi.
   */
  faceReferenceUrl: string | null;
}

/**
 * Qatlam asosi — ustiga kiyintiriladigan tayyor natijaning surati.
 *
 * ⚠️ EGALIK VA HOLAT IKKALASI HAM TEKSHIRILADI. Egalik: `id` ni bilgan
 * boshqa foydalanuvchi o'z kiyimini BEGONA gavdaga kiydirib olardi.
 * Holat: hali tayyor bo'lmagan natijaning surati `null` va u model
 * sifatida berilsa provayder chaqiruvi behuda ketardi.
 */
async function loadLayerBase(userId: string, baseRenderId: string): Promise<string> {
  const { rows } = await pool.query<{ status: RenderStatus; result_url: string | null }>(
    `SELECT status, result_url FROM tryon_renders WHERE id = $1 AND user_id = $2`,
    [baseRenderId, userId],
  );

  const row = rows[0];
  if (!row) throw ApiError.notFound('Asos qatlam topilmadi');

  if (row.status !== 'ready' || !row.result_url) {
    throw new ApiError('VALIDATION_ERROR', 'Avvalgi qatlam hali tayyor emas');
  }

  return row.result_url;
}

/** Surat va kiyim manzilini yig'adi; yetishmasa sababini aniq aytadi. */
async function loadSources(
  userId: string,
  variantId: string,
  angle: RenderAngle,
  baseRenderId: string | null,
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
   * Lekin o'lchov boshqa narsani ko'rsatdi. Model yuzni NUSXA
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
  /*
   * ⚠️ QATLAM HAMMASIDAN USTUN. Asos berilgan bo'lsa model surati aynan
   * o'sha natija: futbolka kiyingan gavda ustiga kurtka kiydiriladi.
   * Asl suratga qaytilsa, futbolka yo'qolib, ekranda faqat kurtka
   * qolardi — komplekt esa buzilardi.
   */
  const layerBase = baseRenderId ? await loadLayerBase(userId, baseRenderId) : null;

  const rotated = angle === 'front' ? null : ((row.avatar_angles ?? {})[angle] ?? null);
  const model = layerBase ?? rotated ?? row.body_photo_url ?? row.avatar_image_url;

  if (!model) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Avval avatar yasang — yuzingizni skaner qiling va o`lchovlaringizni kiriting',
    );
  }

  /*
   * ⚠️ YUZ MAJBURIY — AKS HOLDA NATIJA BOSHQA ODAM BO'LADI (2026-11-03).
   *
   * `face_texture_url` yo'q bo'lsa, kiyintirish faqat gavda+kiyimdan ketardi
   * va GPT yuzni gavda suratidan (mannequin ko'rinishdagi `avatar_image_url`
   * dan) olardi. Natija har doim MANIKEN yuzli chiqib, mijoz o'zini
   * tanimasdi. Yuz skaneri endi ro'yxatdan o'tishda majburiy — lekin eski
   * akkauntlarda yuz hali ham yo'q bo'lishi mumkin; ularga aniq xato
   * ko'rsatamiz va /ai/avatar ga qaytaramiz.
   */
  if (!row.face_texture_url) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Avval yuzingizni skaner qiling — ularsiz kiyintirilgan rasm boshqa odamga o`xshab chiqadi',
    );
  }

  /*
   * Variant surati ustun: rang variantlari har xil ko'rinadi va mahsulotning
   * umumiy surati boshqa rangda bo'lishi mumkin.
   */
  const onlyUrls = (value: unknown): string[] =>
    (Array.isArray(value) ? value : []).filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );

  const variantImages = onlyUrls(row.variant_images);
  const productImages = onlyUrls(row.product_images);

  /*
   * ⚠️ BURCHAKKA MOS SURAT TANLANADI.
   *
   * Ilgari shunchaki BIRINCHI surat olinardi — ya'ni odam yon tomonga
   * burilganda ham modelga kiyimning OLD surati berilardi va u yon
   * ko'rinishni o'zidan o'ylab topardi: kesim, yeng chizig'i va mato
   * burmasi haqiqiy mahsulotga o'xshamasdi.
   *
   * Sotuvchi endi uchta suratni belgilangan tartibda yuklaydi
   * (`seller/product-new.tsx` — Old / Orqa / Yon), `GARMENT_ANGLE_ORDER`
   * esa o'sha tartibni belgilaydi.
   *
   * ⚠️ KESH BUZILMAYDI: `sourceHash` ichida kiyim surati bor, ya'ni har
   * burchak o'z xeshiga ega bo'ladi va natijalar aralashib ketmaydi.
   */
  const garment =
    garmentImageForAngle(variantImages, angle) ?? garmentImageForAngle(productImages, angle);

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
export interface GarmentFilters {
  slots: string[];
  gender?: string | null;
  category?: string | null;
  /** Uslub slugi (`GARMENT_STYLES`) — `products.tags` bilan kesishma */
  style?: string | null;
  /**
   * Do'kon.
   *
   * ⚠️ OQIMNING MA'NOSI SHU YERDA. Foydalanuvchi sehrgarda do'kon
   * tanlaydi va buyurtma o'sha do'kondan ketadi. Ro'yxat filtrlanmasa u
   * boshqa do'konning kiyimini kiyintirib, keyin «bu do'kondan emas»
   * degan javob olardi — sarflangan kredit behuda ketardi.
   */
  storeId?: string | null;
  /**
   * O'lcham — faqat OMBORDA shu o'lchami borlari.
   *
   * ⚠️ TAVSIYA EMAS, FILTR. Ilgari o'lcham faqat kartochkada «sizga M»
   * deb ko'rsatilardi; ro'yxatning o'zi esa o'lchamini bilmasdi va
   * unda mos kelmaydigan kiyimlar ham turardi.
   */
  size?: string | null;
  /**
   * Aynan shu variantlarni qaytarish (boshqa filtrlar e'tiborga olinmaydi).
   *
   * ⚠️ Turli do'konlardan yig'ilgan "Look" primerkada ko'rsatilsin uchun —
   * `storeId` filtri bilan boshqa do'kondagi kiyim tushib qolardi.
   */
  variantIds?: string[] | null;
  limit: number;
}

export async function listGarments(filters: GarmentFilters) {
  const {
    slots,
    gender = null,
    category = null,
    storeId = null,
    size = null,
    style = null,
    variantIds = null,
    limit,
  } = filters;

  /*
   * ⚠️ `variantIds` BERILGANDA FAQAT SHU VARIANTLAR QAYTADI.
   *
   * Mijoz turli do'konlardan Look yig'adi — natija qanday do'kondan
   * kelganiga qarab filtrlab bo'lmaydi. Shu sababli ro'yxat berilsa,
   * kategoriya/do'kon/slot/o'lcham chegirilmaydi: aynan o'sha ID'lar
   * qaytariladi (variant faol va mahsulot ham faol bo'lishi shart).
   */
  const byIds = variantIds && variantIds.length > 0;

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
    sold_out_sizes: string[] | null;
    colors: Array<{ variantId: string; colorHex: string | null; colorName: unknown }> | null;
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
     *
     * ⚠️ LOOK REJIMIDA (variantIds berilganda) — DISTINCT ON v.id,
     * chunki mijoz AYNAN SHU VARIANT ID larni so'ragan va ularning har
     * biri alohida ko'rinishi kerak (bitta mahsulotning ikki rangi ham).
     * Aks holda Look'da 4 ta variant berilsa-yu bir mahsulotdan ikki variant
     * bo'lsa, faqat 3 ta karta chiqardi.
     */
    `SELECT DISTINCT ON (CASE WHEN $8::uuid[] IS NOT NULL THEN v.id ELSE p.id END)
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
            /*
             * ⚠️ TUGAGAN O'LCHAMLAR ALOHIDA QAYTADI.
             *
             * Ilgari faqat mavjudlari kelardi, tugagani shunchaki
             * YO'QOLARDI. Foydalanuvchi uchun ikki holat bir xil
             * ko'rinardi: «bu do'kon M ishlab chiqarmaydi» va «M bor edi,
             * sotilib ketdi». Ikkinchisi muhim — odam kutishi yoki boshqa
             * do'konga o'tishi mumkin.
             */
            (SELECT array_agg(vs.size ORDER BY vs.size)
               FROM variant_stock vs
              WHERE vs.variant_id = v.id AND vs.stock <= vs.reserved) AS sold_out_sizes,
            -- RANGLAR ICHMA-ICH QAYTADI.
            --
            -- DISTINCT ON (p.id) har mahsulotdan BITTA qator beradi:
            -- tasmada bir xil kartalar takrorlanmasligi uchun. Lekin
            -- ilovadagi rang tanlagich "shu mahsulotning boshqa
            -- variantlari" ni ro'yxatdan qidirardi va ular u yerda hech
            -- qachon bo'lmasdi -- tanlagich umuman ko'rinmasdi.
            --
            -- Yechim: kartani takrorlamasdan, variantlarni shu qatorning
            -- ichiga solish. Faqat surati va ombori borlari olinadi --
            -- tanlab bo'lmaydigan rangni ko'rsatish aldash bo'lardi.
            (SELECT json_agg(json_build_object(
                      'variantId', cv.id,
                      'colorHex', cv.color_hex,
                      'colorName', cv.color_name
                    ) ORDER BY cv.sort_order, cv.id)
               FROM product_variants cv
              WHERE cv.product_id = p.id
                AND cv.is_active
                AND COALESCE(NULLIF(cv.images->>0, ''), NULLIF(p.images->>0, '')) IS NOT NULL
                AND EXISTS (SELECT 1 FROM variant_stock cvs
                             WHERE cvs.variant_id = cv.id AND cvs.stock > cvs.reserved)
            ) AS colors,
            s.id AS store_id, s.name AS store_name
       FROM products p
       JOIN product_variants v ON v.product_id = p.id AND v.is_active
       JOIN stores s ON s.id = p.store_id AND s.status = 'active'
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active'
        -- variantIds bergan bo'lsa, SLOT filtri qo'llanmaydi:
        -- Look turli do'kondan, turli slotdan bo'lishi mumkin.
        AND ($8::uuid[] IS NOT NULL OR p.slot = ANY($1::text[]))
        AND ($8::uuid[] IS NULL OR v.id = ANY($8::uuid[]))
        -- Kategoriya berilsa u ustun: slotdan aniqroq
        AND ($4::text IS NULL OR c.slug = $4)
        AND COALESCE(NULLIF(v.images->>0, ''), NULLIF(p.images->>0, '')) IS NOT NULL
        AND ($2::text IS NULL OR p.gender IN ($2, 'unisex'))
        AND ($5::uuid IS NULL OR p.store_id = $5)
        -- O'lcham: aynan shu variantda, aynan shu o'lcham, aynan omborda.
        --
        -- ⚠️ EXISTS VARIANT BO'YICHA, MAHSULOT BO'YICHA EMAS. Bir
        -- mahsulotning qora rangida M bor, oq rangida yo'q bo'lishi
        -- oddiy hol — mahsulot darajasida tekshirsak, foydalanuvchi
        -- omborda bo'lmagan rangni tanlab qolardi.
        AND ($6::text IS NULL OR EXISTS (
              SELECT 1 FROM variant_stock vs2
               WHERE vs2.variant_id = v.id AND replace(replace(upper(regexp_replace(btrim(vs2.size), '^EU[[:space:]]*', '', 'i')), 'XXXL', '3XL'), '2XL', 'XXL') = $6 AND vs2.stock > vs2.reserved))
        -- Uslub: KESISHMA, tenglik emas. Tags erkin massiv va do'kon
        -- unga o'z belgilarini ham qo'shishi mumkin.
        AND ($7::text IS NULL OR p.tags @> ARRAY[$7]::text[])
      ORDER BY CASE WHEN $8::uuid[] IS NOT NULL THEN v.id ELSE p.id END, (v.images->>0) IS NOT NULL DESC, v.id
      LIMIT $3`,
    [
      slots,
      gender,
      byIds ? variantIds.length : limit,
      category,
      storeId,
      size ? normalizeSize(size) : null,
      style,
      byIds ? variantIds : null,
    ],
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
    /*
     * Tugaganlari alohida: ilova ularni ko'rsatadi, lekin tanlab
     * bo'lmaydigan qilib — «bor edi, sotilib ketdi» degani.
     */
    soldOutSizes: row.sold_out_sizes ?? [],
    /** Shu mahsulotning tanlash mumkin bo'lgan rang variantlari */
    colors: row.colors ?? [],
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
  baseRenderId: string | null = null,
): Promise<RenderDto> {
  /*
   * ⚠️ OPERATOR REJIMIDA OPENAI SHART EMAS (avatardagidek). `render`
   * `DEVELOPER_AI_KINDS` da bo'lsa ish navbatga tushadi va uni odam
   * bajaradi — payloadga gavda va KIYIM rasmi yoziladi.
   */
  // Istisno akkauntlar (masalan App Store demo) operator rejimida ham OpenAI'dan
  const manual = isManual('render') && !isAutoAiUser(userId);
  if (!manual && !isOpenAiEnabled()) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'AI kiyintirish hozircha sozlanmagan');
  }

  const sources = await loadSources(userId, variantId, angle, baseRenderId);
  const hash = sourceHash(sources.bodyPhotoUrl, sources.garmentImageUrl);

  /*
   * ⚠️ YIQILGAN URINISH KESHLANMAYDI — VA BU JIDDIY XATO EDI.
   *
   * Quyidagi `ON CONFLICT DO NOTHING` qator BORLIGINI ko'radi, holatiga
   * qaramaydi. Ya'ni bir marta yiqilgan natija abadiy qaytarilardi:
   * foydalanuvchi «qayta urinish» ni qancha bossa ham o'sha `failed`
   * qatorni olardi va ekranda «Kiyintirib bo'lmadi» qotib qolardi.
   * Vaqtincha tarmoq uzilishi shu tarzda DOIMIY nosozlikka aylanardi.
   *
   * Yiqilgan urinish saqlashga arzimaydi: natija yo'q, ya'ni kesh
   * qiladigan narsa ham yo'q. O'chiramiz va oqim oddiy yo'ldan ketadi —
   * kunlik chegara ham odatdagidek qo'llanadi.
   *
   * ⚠️ `base_render_id` DA CASCADE BOR, shuning uchun shartga bolasi
   * yo'qligi ham qo'shilgan. Amalda yiqilgan qator asos bo'la olmaydi
   * (`loadLayerBase` faqat `ready` ni qaytaradi), lekin CASCADE jimgina
   * butun zanjirni o'chiradi — bunday joyda ehtiyot shart arzon.
   */
  await pool.query(
    `DELETE FROM tryon_renders
      WHERE user_id = $1 AND variant_id = $2 AND angle = $3 AND source_hash = $4
        AND status = 'failed'
        AND NOT EXISTS (SELECT 1 FROM tryon_renders c WHERE c.base_render_id = tryon_renders.id)`,
    [userId, variantId, angle, hash],
  );

  /*
   * ⚠️ POYGADAN HIMOYA. Ikki so'rov bir vaqtda kelsa ikkalasi ham "kesh yo'q"
   * deb ko'rardi va ikkita ish yaratardi — ya'ni ikki marta to'lanardi.
   *
   * `ON CONFLICT DO NOTHING` shuni hal qiladi: qatorni FAQAT bittasi
   * qo'shadi va provayderga ham faqat o'sha murojaat qiladi. Ikkinchisiga
   * `rowCount = 0` qaytadi va u mavjud qatorni o'qiydi.
   */
  const inserted = await pool.query<RenderRow>(
    `INSERT INTO tryon_renders (user_id, variant_id, angle, source_hash, base_render_id, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (user_id, variant_id, angle, source_hash) DO NOTHING
     RETURNING ${RENDER_COLUMNS}`,
    [userId, variantId, angle, hash, baseRenderId],
  );

  const fresh = inserted.rows[0];
  if (!fresh) {
    // Kesh yoki allaqachon ketayotgan ish
    const { rows } = await pool.query<RenderRow>(
      `SELECT ${RENDER_COLUMNS}
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
   * ── Operator rejimi ──
   * OpenAI o'rniga ishni navbatga qo'yamiz. Payloadga KANONIK manzillar
   * yoziladi (`...Url` bilan tugagan kalitlarni panel o'qiyotgan paytda
   * `signPreviews` yangidan imzolaydi). `refId` = render qatori id'si —
   * operator natijani yuklaganda `applyResult` aynan shu `tryon_renders`
   * qatorini `ready` qiladi.
   */
  if (manual) {
    /*
     * ⚠️ O'LCHAM VA JINS HAM BERILADI (2026-09-25). Kengaytma endi AI'ga
     * gavda suratini bermaydi — faqat yuz va kiyim; gavda shu raqamlardan
     * (bo'y, vazn, razmer) prompt ichida quriladi.
     */
    const person = await pool.query<{ measurements: unknown; gender: string | null }>(
      `SELECT COALESCE(p.measurements, '{}'::jsonb) AS measurements, u.gender
         FROM users u LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = $1`,
      [userId],
    );
    const measurements = (person.rows[0]?.measurements ?? {}) as Record<string, number | string>;
    const gender = person.rows[0]?.gender ?? null;
    await enqueueTask('render', userId, fresh.id, {
      bodyUrl: sources.bodyPhotoUrl,
      garmentImageUrl: sources.garmentImageUrl,
      ...(sources.faceReferenceUrl ? { faceUrl: sources.faceReferenceUrl } : {}),
      angle,
      slot: sources.slot,
      measurements,
      gender,
      // Operator QO'LDA ishlaganda nusxalaydigan matn (avtomatik rejim o'zi quradi)
      prompt: buildTryonSheetPrompt(
        sources.slot,
        measurements as AvatarMeasurements,
        gender as AvatarGender,
      ),
    });
    logger.info({ userId, renderId: fresh.id }, 'kiyintirish operator navbatiga qo`yildi');
    return toDto(fresh);
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
   * ⚠️ NAVBATGA QO'YILADI, DARHOL BOSHLANMAYDI. Ilgari bu yerda holat
   * `processing` ga o'tkazilib, provayder darhol chaqirilardi — chunki
   * bir vaqtda faqat bitta so'rov kelardi.
   *
   * Endi ilova tasmadagi HAMMA kiyimni oldindan kiyintiradi: bir zumda
   * 30 tagacha so'rov keladi. Ularning hammasi bir vaqtda provayderga
   * yuborilsa OpenAI tezlik chegarasiga uriladi va yarmi 429 bilan
   * qaytadi — ya'ni foydalanuvchi kutgan surat umuman kelmaydi.
   *
   * Navbat buni tekislaydi: qator `pending` bo'lib turadi (ilova buni
   * «navbatda» deb ko'rsatadi), ish boshlanganda `processing` ga o'tadi.
   */
  enqueueRender({
    renderId: fresh.id,
    modelImageUrl,
    garmentImageUrl: sources.garmentImageUrl,
    slot: sources.slot,
    faceReferenceUrl,
    layer: baseRenderId !== null,
  });

  return toDto(fresh);
}

/**
 * Bir necha kiyimni bir yo'la navbatga qo'yadi.
 *
 * ⚠️ XATO YIQITMAYDI, TO'XTATADI. Kunlik chegaraga yetilganda qolgan
 * kiyimlar shunchaki navbatga tushmaydi va `limitReached` qaytadi.
 * Xato tashlansa butun so'rov yiqilardi va allaqachon navbatga tushgan
 * kiyimlar haqida ilova hech narsa bilmasdi.
 *
 * ⚠️ KETMA-KET, PARALLEL EMAS. Har chaqiruv chegarani SANAYDI, ya'ni
 * parallel ketsa hammasi bir xil sonni ko'rib chegaradan o'tib ketardi.
 */
export async function requestRenderBatch(
  userId: string,
  variantIds: string[],
  angle: RenderAngle = 'front',
  baseRenderId: string | null = null,
): Promise<{ renders: RenderDto[]; limitReached: boolean }> {
  const renders: RenderDto[] = [];
  let limitReached = false;

  for (const variantId of variantIds) {
    try {
      renders.push(await requestRender(userId, variantId, angle, baseRenderId));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        limitReached = true;
        break;
      }

      /*
       * Bitta kiyimning nosozligi (surati yo'q, o'chirilgan) qolganini
       * to'xtatmasligi kerak — ilova uni ro'yxatda ko'rmaydi, xolos.
       */
      logger.warn({ err, variantId }, 'tryon: kiyimni navbatga qo`shib bo`lmadi');
    }
  }

  return { renders, limitReached };
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
    `SELECT ${RENDER_COLUMNS}
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
    key: `tryon/${randomUUID()}.png`,
    body: buffer,
    contentType: 'image/png',
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

interface QueuedRender {
  renderId: string;
  modelImageUrl: string;
  garmentImageUrl: string;
  slot: string;
  faceReferenceUrl: string | null;
  /** Model surati allaqachon kiyintirilgan — prompt boshqacha bo'ladi */
  layer: boolean;
}

/**
 * Generatsiya navbati.
 *
 * ⚠️ XOTIRADA, BAZADA EMAS — VA BU ONGLI CHEKLOV. To'g'ri yechim
 * bazadagi navbat bo'lardi (server qayta ishga tushsa navbat qolardi),
 * lekin u alohida ishchi jarayonni talab qiladi. Hozircha bitta API
 * jarayoni bor, shuning uchun navbat ham shu yerda.
 *
 * Yo'qolgan ishlar `sweepStaleRenders` bilan yopiladi: `pending` da
 * osilib qolgan qator xatoga o'tkaziladi va ilova qayta so'ray oladi.
 */
const queue: QueuedRender[] = [];
let running = 0;

/**
 * Bir vaqtda nechta generatsiya ketadi.
 *
 * ⚠️ RAQAM PROVAYDER CHEGARASIDAN KELIB CHIQADI, tezlikdan emas. Uchtasi
 * OpenAI ning odatiy tezlik chegarasiga bemalol sig'adi; ko'paytirilsa
 * 429 boshlanadi va qayta urinish YO'Q (`integrations/openai.ts`) — ya'ni
 * surat umuman kelmaydi.
 */
const MAX_CONCURRENT = 3;

function enqueueRender(job: QueuedRender): void {
  queue.push(job);
  drainQueue();
}

/** Bo'sh joy bo'lsa navbatdan keyingisini oladi. */
function drainQueue(): void {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    if (!job) return;

    running += 1;
    void runOpenAi(job)
      .catch(() => {
        // `runOpenAi` xatoni o'zi yutadi — bu faqat kutilmagan hol uchun
      })
      .finally(() => {
        running -= 1;
        drainQueue();
      });
  }
}

/**
 * OpenAI oqimi — fonda bajariladi.
 *
 * ⚠️ XATO YUTILMAYDI, QATORGA YOZILADI. Fon vazifasida `throw` hech
 * kimga yetib bormaydi: HTTP javob allaqachon berilgan. Shuning uchun
 * xato `failed` holati bilan bazaga tushadi — ilova uni ko'radi va
 * foydalanuvchiga aytadi.
 */
async function runOpenAi({
  renderId,
  modelImageUrl,
  garmentImageUrl,
  slot,
  faceReferenceUrl,
  layer,
}: QueuedRender): Promise<void> {
  /*
   * Holat ish HAQIQATAN boshlanganda yoziladi. Navbatda turgan qator
   * `pending` bo'lib qoladi va ilova uni «navbatda» deb ko'rsatadi —
   * hammasi birdan «kiyintirilmoqda» bo'lib turgani yolg'on bo'lardi.
   */
  await pool
    .query(`UPDATE tryon_renders SET status = 'processing' WHERE id = $1`, [renderId])
    .catch((err: unknown) => {
      logger.warn({ err, renderId }, 'tryon: holatni processing ga o`tkazib bo`lmadi');
    });

  try {
    const buffer = await generateTryon({
      modelImageUrl,
      garmentImageUrl,
      kind: garmentKindForSlot(slot),
      faceReferenceUrl,
      layer,
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
  baseRenderId: string | null = null,
  scope: 'base' | 'all' = 'base',
): Promise<RenderDto[]> {
  if (variantIds.length === 0) return [];

  /*
   * ⚠️ `all` DA `DISTINCT ON` YO'Q. Ilova aynan HAR asos ustidagi
   * natijani ko'rishi kerak — bittasini tanlab bersak zanjirni tiklab
   * bo'lmasdi. Qatorlar soni chegaralangan: bir variantga nechta qatlam
   * kombinatsiyasi bo'lsa shuncha, amalda birdan uchtagacha.
   */
  if (scope === 'all') {
    const { rows } = await pool.query<RenderRow>(
      `SELECT ${RENDER_COLUMNS}
         FROM tryon_renders
        WHERE user_id = $1 AND variant_id = ANY($2::uuid[]) AND angle = $3
        ORDER BY created_at DESC`,
      [userId, variantIds, angle],
    );

    return rows.map(toDto);
  }

  const { rows } = await pool.query<RenderRow>(
    /*
     * ⚠️ BURCHAK BO'YICHA FILTR SHART. Usiz `DISTINCT ON (variant_id)`
     * tasodifiy burchakni qaytarardi va gallereyada old ko'rinish o'rniga
     * yon ko'rinish chiqib qolishi mumkin edi.
     *
     * ⚠️ ASOS BO'YICHA HAM SHUNDAY. Bitta kurtkaning bir necha natijasi
     * bo'ladi: yalang'och gavdaga, futbolka ustiga, ko'ylak ustiga.
     * Ilova aynan JORIY komplekt ustidagisini so'raydi.
     *
     * `IS NOT DISTINCT FROM` — `NULL` ni ham solishtiradi (oddiy `=`
     * `NULL` bilan hech qachon rost bo'lmaydi), ya'ni birinchi qatlam
     * ham shu shart bilan topiladi.
     */
    `SELECT DISTINCT ON (variant_id) ${RENDER_COLUMNS}
       FROM tryon_renders
      WHERE user_id = $1 AND variant_id = ANY($2::uuid[]) AND angle = $3
        AND base_render_id IS NOT DISTINCT FROM $4::uuid
      ORDER BY variant_id, created_at DESC`,
    [userId, variantIds, angle, baseRenderId],
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
 * 10 daqiqa — modelning eng sekin holatidan (30–60 s) ancha ko'p,
 * ya'ni tirik ish xato bilan yopilmaydi.
 *
 * ⚠️ `pending` HAM YOPILADI — NAVBAT XOTIRADA. Navbatda turgan ish
 * ham server qayta ishga tushganda yo'qoladi va qator abadiy `pending`
 * bo'lib qolardi. Muddat uzunroq (30 daqiqa): navbat uzun bo'lsa ish
 * haqiqatan uzoq kutishi mumkin va tirigini o'ldirib qo'ymaslik kerak.
 */
export async function sweepStaleRenders(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE tryon_renders
        SET status = 'failed', error = $1, completed_at = now()
      WHERE (status = 'processing' AND created_at < now() - interval '10 minutes')
         OR (status = 'pending'    AND created_at < now() - interval '30 minutes')`,
    ['Kiyintirish uzilib qoldi — qaytadan urinib ko`ring'],
  );

  return rowCount ?? 0;
}

/**
 * Eskirgan natijalarni tozalaydi — baza qatorini ham, R2 dagi suratni ham.
 *
 * ⚠️ NEGA KERAK. `sourceHash` ichida generatsiya retsepti bor
 * (`integrations/openai.ts` — `generationFingerprint`), ya'ni AI modeli
 * yoki chiqish sozlamasi almashganda eski qator YANGI kalit bilan mos
 * kelmay qoladi. U hech qachon qaytarilmaydi, lekin bazada va R2 da
 * turaveradi — har model almashtirish yangi qatlam axlat qoldiradi.
 *
 * ⚠️ «ESKIRGAN» NIMA. Ayni shu odam, shu kiyim, shu burchak va shu asos
 * uchun XESHI BOSHQA, YANGIROQ qator bo'lsa — eskisi o'lik. Xeshni
 * qaytadan hisoblab bo'lmaydi (surat manzillari qatorda saqlanmaydi),
 * lekin buni bilish ham shart emas: yangisi bor ekan, hamma yo'l
 * o'shanga boradi.
 *
 * ⚠️ UCHTA HIMOYA BOR VA UCHALASI HAM HAQIQIY ZARARNI TO'SADI:
 *
 *   1. QATLAM (eng o'tkiri). `base_render_id` da `ON DELETE CASCADE`
 *      turibdi. Ustiga qatlam qurilgan natijani o'chirsak, butun
 *      komplekt zanjiri JIMGINA o'chib ketardi — foydalanuvchi yig'gan
 *      kiyimlar yo'qolardi va sabab hech qayerda ko'rinmasdi.
 *      Shuning uchun bolasi bor qator tegilmaydi. Zanjir pastdan
 *      yuqoriga, bir necha yurishda tozalanadi.
 *
 *   2. YOSH. Ilova natijani `id` bo'yicha ham so'raydi (`pollRender`,
 *      `loadLayerBase`) va ochiq turgan seansda eski `id` qo'lda
 *      bo'lishi mumkin. Bir hafta — har qanday seansdan uzun.
 *
 *   3. SAQLANGAN KOMPLEKT. `looks.thumbnail_url` shu suratga ishora
 *      qilishi mumkin. Bugun ilova uni to'ldirmaydi, lekin API qabul
 *      qiladi — o'chirsak saqlangan komplekt eskizsiz qolardi.
 *
 * ⚠️ `pending` VA `processing` TEGILMAYDI. Ular uchun pul allaqachon
 * ketgan va natija hali yo'lda.
 *
 * ⚠️ AVVAL QATOR, KEYIN SURAT. Teskarisi qilinsa, R2 o'chib qator
 * qolgan oraliqda ilova buzilgan rasmga ishora qilardi (`scope: 'all'`
 * eski qatorlarni ham qaytaradi). Bu tartibda eng yomon holat —
 * egasiz qolgan obyekt, ya'ni biroz joy; `deleteByUrl` esa xatoni
 * o'zi yutadi va logga yozadi.
 */

/** Bir hafta — har qanday ochiq seansdan uzun. */
const CLEANUP_MIN_AGE_DAYS = 7;

/**
 * Bir yurishda nechta qator.
 *
 * ⚠️ HAR QATOR IKKITAGACHA TARMOQ CHAQIRUVI (surat + kesim). Ish kuniga
 * bir marta ishlaydi, shuning uchun katta orqada qolish bir necha kunda
 * tozalanadi — bu ataylab: cron yurishini soatlab ushlab turgandan ko'ra
 * sekin tozalagan yaxshi.
 */
const CLEANUP_BATCH = 200;

export async function cleanupSupersededRenders(): Promise<number> {
  const { rows } = await pool.query<{ result_url: string | null; cutout_url: string | null }>(
    `WITH superseded AS (
       SELECT r.id
         FROM tryon_renders r
        WHERE r.status IN ('ready', 'failed')
          AND r.created_at < now() - make_interval(days => $1::int)
          -- Yangiroq va BOSHQA xeshli natija bor: eskisiga yo'l qolmagan
          AND EXISTS (
                SELECT 1 FROM tryon_renders n
                 WHERE n.user_id = r.user_id
                   AND n.variant_id = r.variant_id
                   AND n.angle = r.angle
                   AND n.base_render_id IS NOT DISTINCT FROM r.base_render_id
                   AND n.source_hash <> r.source_hash
                   AND n.created_at > r.created_at)
          -- ⚠️ CASCADE: ustida qatlam turgan bo'lsa TEGILMAYDI
          AND NOT EXISTS (
                SELECT 1 FROM tryon_renders c WHERE c.base_render_id = r.id)
          -- Saqlangan komplekt eskizi shu suratga ishora qilmasin
          AND NOT EXISTS (
                SELECT 1 FROM looks l
                 WHERE l.thumbnail_url IS NOT NULL
                   AND l.thumbnail_url IN (r.result_url, r.cutout_url))
        ORDER BY r.created_at
        LIMIT $2
     )
     DELETE FROM tryon_renders
      WHERE id IN (SELECT id FROM superseded)
     RETURNING result_url, cutout_url`,
    [CLEANUP_MIN_AGE_DAYS, CLEANUP_BATCH],
  );

  if (rows.length === 0) return 0;

  /*
   * ⚠️ BO'LAKLAB — hammasi birdan emas. 200 qator = 400 gacha chaqiruv;
   * parallel yuborilsa R2 ni bo'g'ib qo'yardi.
   */
  const urls = rows.flatMap((row) => [row.result_url, row.cutout_url]).filter(Boolean);

  for (let i = 0; i < urls.length; i += 10) {
    await Promise.all(urls.slice(i, i + 10).map((url) => deleteByUrl(url)));
  }

  logger.info({ rows: rows.length, objects: urls.length }, 'tryon: eskirgan natijalar tozalandi');
  return rows.length;
}

/**
 * AI kiyintirish uchun mos do'konlar.
 *
 * ⚠️ NEGA `getNearbyStores` YARAMAYDI: u do'konlarni 3D modellari
 * bo'yicha sanaydi (`assets_3d.status = 'ready'`), AI'ga esa 3D umuman
 * kerak emas — unga kiyimning oddiy surati kerak. Natijada AI uchun
 * o'nlab kiyimi bor do'kon ro'yxatda «0 ta» bo'lib turardi.
 *
 * Bu ro'yxat ekranning pastidagi «boshqa do'kon» tanlagichida turadi,
 * shuning uchun u AYNAN shu ekran ko'rsatadigan narsani sanaydi: surati
 * bor, faol, va — o'lcham berilgan bo'lsa — o'sha o'lchami omborda
 * borlarini.
 */
export async function listTryonStores(filters: {
  lat?: number | null;
  lng?: number | null;
  gender?: string | null;
  size?: string | null;
  limit: number;
}): Promise<
  Array<{
    id: string;
    name: string;
    garmentCount: number;
    distanceM: number | null;
    logo: string | null;
  }>
> {
  const { lat = null, lng = null, gender = null, size = null, limit } = filters;

  const { rows } = await pool.query<{
    id: string;
    name: string;
    logo_url: string | null;
    garment_count: string;
    distance_m: string | null;
  }>(
    `SELECT s.id, s.name, s.logo_url,
            COUNT(DISTINCT p.id) AS garment_count,
            -- Koordinata berilmasa masofa ham yo'q: ilova uni ko'rsatmaydi
            CASE WHEN $1::float8 IS NULL OR $2::float8 IS NULL THEN NULL
                 ELSE ST_Distance(s.location, ST_MakePoint($2, $1)::geography)::int
            END AS distance_m
       FROM stores s
       JOIN products p ON p.store_id = s.id AND p.status = 'active'
                      AND p.slot = ANY($3::text[])
       JOIN product_variants v ON v.product_id = p.id AND v.is_active
      WHERE s.status = 'active'
        AND COALESCE(NULLIF(v.images->>0, ''), NULLIF(p.images->>0, '')) IS NOT NULL
        AND ($4::text IS NULL OR p.gender IN ($4, 'unisex'))
        AND ($5::text IS NULL OR EXISTS (
              SELECT 1 FROM variant_stock vs
               WHERE vs.variant_id = v.id AND replace(replace(upper(regexp_replace(btrim(vs.size), '^EU[[:space:]]*', '', 'i')), 'XXXL', '3XL'), '2XL', 'XXL') = $5 AND vs.stock > vs.reserved))
      -- s.id birlamchi kalit: qolgan ustunlar unga funksional bog'liq
      GROUP BY s.id
      -- Yaqinroq oldinda; koordinatasiz esa kiyimi ko'proq do'kon oldinda
      ORDER BY distance_m ASC NULLS LAST, garment_count DESC
      LIMIT $6`,
    [lat, lng, AI_TRYON_SLOTS, gender, size ? normalizeSize(size) : null, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    logo: row.logo_url,
    garmentCount: Number(row.garment_count),
    distanceM: row.distance_m === null ? null : Number(row.distance_m),
  }));
}
