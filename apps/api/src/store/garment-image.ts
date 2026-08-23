import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';

import { ApiError } from '../http/api-error';
import { isOwnCdnUrl, uploadObject } from '../integrations/r2';
import { logger } from '../logger';

/**
 * Kiyim suratini AI kiyintirish uchun tayyorlash.
 *
 * ⚠️ NEGA KERAK: kiyintirish natijasining sifati to'g'ridan-to'g'ri kiyim
 * suratiga bog'liq. Do'konchi telefonda olgan surat odatda ilgichda,
 * manekenda yoki tartibsiz fonda bo'ladi — AI esa fonni ham kiyimning bir
 * qismi deb qabul qiladi va natija buziladi.
 *
 * ⚠️ GENERATIV MODEL ISHLATILMAYDI. Fonni olib tashlash — aniq vazifa:
 * u kiyimning o'ziga TEGMAYDI, faqat atrofini kesadi. Generativ model esa
 * kiyimni qayta chizadi va naqsh, tugma yoki kesim o'zgarishi mumkin.
 * Savdoda bu qabul qilib bo'lmaydi: mijoz ko'rgan narsasini olishi shart.
 *
 * Ishlov o'z serverimizda bajariladi — tashqi xizmatga to'lanmaydi.
 */

/** Ishlov natijasi — ilova ikkalasini yonma-yon ko'rsatadi. */
export interface PreparedGarment {
  /** Asl surat — do'konchi rad etsa shu qoladi */
  originalUrl: string;
  /** Foni olib tashlangan variant */
  cleanedUrl: string;
  /** Kiyim kadrning necha foizini egallaydi */
  coverage: number;
  /** Ogohlantirish — surat shubhali bo'lsa */
  warning: string | null;
}

/*
 * Qamrov chegaralari.
 *
 * ⚠️ BULAR "KIYIMMI" DEGAN SAVOLGA JAVOB BERMAYDI — buning uchun tasniflagich
 * kerak. Ular faqat AQL BOVAR QILMAYDIGAN holatlarni ushlaydi:
 *
 *   juda kam  — fon olib tashlashda deyarli hech narsa topilmadi
 *               (xira surat, bo'sh kadr)
 *   juda ko'p — deyarli hech narsa olib tashlanmadi
 *               (ekran surati, to'liq kadrli grafika)
 *
 * Oradagi qiymatlar o'tkaziladi va qarorni DO'KONCHI qabul qiladi: unga
 * oldin/keyin ko'rsatiladi. Odam ko'zi bu yerda har qanday chegaradan
 * ishonchli va u bepul.
 */
const MIN_COVERAGE = 0.04;
const MAX_COVERAGE = 0.92;

/** Eng kichik o'lcham — undan kichigi kiyintirishda bulanib ketadi. */
const MIN_SIDE = 400;

/**
 * Kutubxona resurslarining yo'li.
 *
 * ⚠️ QO'LDA BERILISHI SHART. Kutubxona standart holatda yo'lni
 * `path.resolve('node_modules/@imgly/…')` bilan hisoblaydi, ya'ni JORIY ISH
 * PAPKASIDAN. API `apps/api` dan ishga tushadi, paket esa npm tomonidan
 * ildizdagi `node_modules` ga ko'chirilgan — natijada u mavjud bo'lmagan
 * yo'lni qidiradi va "resources.json topilmadi" deb yiqiladi.
 *
 * `require.resolve` esa paketni HAQIQATDA qayerdan yuklanganini biladi.
 */
const require_ = createRequire(import.meta.url);
const RESOURCE_PATH = `file://${dirname(require_.resolve('@imgly/background-removal-node'))}/`;

export async function prepareGarmentImage(url: string): Promise<PreparedGarment> {
  /*
   * ⚠️ FAQAT O'Z CDN'IMIZ. Manzil tashqaridan berilsa server istalgan
   * saytga so'rov yuborardi — bu ichki tarmoqni tekshirish uchun ishlatilishi
   * mumkin bo'lgan ochiq eshik (SSRF).
   */
  if (!isOwnCdnUrl(url)) {
    throw new ApiError('VALIDATION_ERROR', 'Surat manzili noto`g`ri');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError('VALIDATION_ERROR', 'Suratni yuklab bo`lmadi');
  }

  const input = Buffer.from(await response.arrayBuffer());

  /*
   * ⚠️ MIME TURI SHART. Kutubxona kirish formatini `Blob.type` dan
   * o'qiydi va u bo'sh bo'lsa "Unsupported format" deb yiqiladi —
   * xato esa formatga umuman ishora qilmaydi.
   *
   * Server javobidagi tur ishlatiladi; u yo'q bo'lsa JPEG deb olamiz,
   * chunki R2 ga faqat rasm yuklanadi.
   */
  const contentType = response.headers.get('content-type') ?? 'image/jpeg';

  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (Math.min(width, height) < MIN_SIDE) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Surat juda kichik (${width}×${height}). Kamida ${MIN_SIDE} piksel kerak.`,
    );
  }

  let cleaned: Buffer;
  try {
    const out = await removeBackground(new Blob([input], { type: contentType }), {
      publicPath: RESOURCE_PATH,
      output: { format: 'image/png' },
    });
    cleaned = Buffer.from(await out.arrayBuffer());
  } catch (err) {
    logger.error({ err, url }, 'fonni olib tashlab bo`lmadi');
    throw new ApiError('INTERNAL_ERROR', 'Suratga ishlov berib bo`lmadi');
  }

  const coverage = await subjectCoverage(cleaned);

  let warning: string | null = null;
  if (coverage < MIN_COVERAGE) {
    warning = 'Suratda kiyim topilmadi. Kiyim kadrni to`ldirib turgan surat yuklang.';
  } else if (coverage > MAX_COVERAGE) {
    warning = 'Fon ajratilmadi. Kiyimni bir tekis fonda suratga oling.';
  }

  /*
   * ⚠️ PNG EMAS, OQ FONDA JPEG. Shaffof PNG chiroyli ko'rinadi, lekin
   * kiyintirish modeli shaffoflikni qora deb o'qishi mumkin va kiyim
   * chekkasida qorong'i hoshiya paydo bo'ladi. Oq fon esa modelga tanish
   * va u eng yaxshi natijani beradi.
   */
  const flattened = await sharp(cleaned)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const cleanedUrl = await uploadObject({
    key: `product/${randomUUID()}.jpg`,
    body: flattened,
    contentType: 'image/jpeg',
  });

  logger.info({ url, coverage: Number(coverage.toFixed(3)) }, 'kiyim surati tayyorlandi');

  return { originalUrl: url, cleanedUrl, coverage, warning };
}

/**
 * Kiyim kadrning necha qismini egallaydi.
 *
 * Alfa kanalidagi shaffofmas piksellar sanaladi — fon olib tashlangach
 * qolgan yagona narsa kiyimning o'zi bo'ladi.
 */
async function subjectCoverage(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    // Kichraytirib sanaymiz — natija bir xil, tezligi esa o'nlab barobar
    .resize(200, 200, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let kept = 0;
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 0) > 128) kept += 1;
  }

  const total = info.width * info.height;
  return total === 0 ? 0 : kept / total;
}
