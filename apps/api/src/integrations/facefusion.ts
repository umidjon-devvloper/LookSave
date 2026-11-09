import sharp from 'sharp';

import { env } from '../config/env';
import { logger } from '../logger';

/**
 * Facefusion integration — yuz almashtirish post-processor.
 *
 * ⚠️ NIMA ISH QILADI. OpenAI kiyintirishdan keyin qaytgan rasmda yuz
 * foydalanuvchiga 100% o'xshamasligi mumkin (model o'z taxminini
 * aralashtiradi). Bu modul asl yuzimizni natijaga joylashtiradi —
 * ya'ni "men o'zim shu kiyimda" degan tuyg'u beradi.
 *
 * ⚠️ IXTIYORIY. `FACEFUSION_URL` bo'sh bo'lsa — butun oqim o'tkazib
 * yuboriladi va OpenAI natijasi o'zgarmasdan qaytadi. Shunday qilib
 * hech qanday xato bo'lsa ham mijozga rasm chiqadi.
 *
 * ⚠️ FAQAT FRONT BURCHAKDA. `FACEFUSION_FRONT_ONLY=true` bo'lsa yon/orqa
 * surati uchun almashtirish qilinmaydi — ularda yuz ko'rinmaydi.
 */

export interface FaceSwapInput {
  /** Natija rasm (OpenAI kiyintirishi chiqarilgani) */
  target: Buffer;
  /** Mijozning asl yuzi (avatar ro'yxatdagi face reference) */
  sourceFaceUrl: string;
  /** Qaysi burchakda ekanimiz — front_only sozlamasini hurmat qilish uchun */
  angle: 'front' | 'side' | 'back';
}

export function isFacefusionEnabled(): boolean {
  return Boolean(env().FACEFUSION_URL);
}

/**
 * Face swap VA cutout — birgalikda 1 ta HTTP call.
 *
 * ⚠️ NEGA YANGI ENDPOINT (2026-11-09): avval 2 ta chaqiruv edi:
 *   1. VPS → fly.io/swap → yuz almashadi, JPEG qaytadi
 *   2. VPS → lokal Python → cutout qilib shaffof PNG
 * Bu VPS RAM'ni 2GB+ eyar edi (Python cutout service doim ishlab turardi).
 *
 * Endi fly.io bitta so'rovda ikkalasini bajaradi va **shaffof PNG**
 * qaytaradi. VPS yengillashadi, lokal Python cutout service kerak emas.
 *
 * Xato bo'lsa — asl target qaytadi (fallback), pipeline buzilmaydi.
 */
export async function swapAndCutout(input: FaceSwapInput): Promise<Buffer> {
  const url = env().FACEFUSION_URL;
  if (!url) return input.target;

  // Front_only — yon/orqa uchun yuz swap qilinmaydi, lekin cutout kerak
  if (env().FACEFUSION_FRONT_ONLY && input.angle !== 'front') {
    return cutoutOnly(input.target);
  }

  try {
    const sourceBuffer = await fetchFaceSource(input.sourceFaceUrl);
    if (!sourceBuffer) return cutoutOnly(input.target);

    const form = new FormData();
    form.append('source', new Blob([sourceBuffer], { type: 'image/jpeg' }), 'source.jpg');
    form.append('target', new Blob([input.target], { type: 'image/jpeg' }), 'target.jpg');
    form.append('model', env().FACEFUSION_MODEL);
    form.append('pixel_boost', env().FACEFUSION_PIXEL_BOOST);
    form.append('enhance', env().FACEFUSION_ENHANCE ? 'true' : 'false');

    const headers: Record<string, string> = {};
    const token = env().FACEFUSION_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 240_000);

    const response = await fetch(`${url.replace(/\/+$/, '')}/swap-and-cutout`, {
      method: 'POST',
      body: form,
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn(
        { status: response.status, body: body.slice(0, 200) },
        'swap-and-cutout: xato — cutout-only fallback',
      );
      return cutoutOnly(input.target);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      logger.warn({ contentType }, 'swap-and-cutout: rasm emas javob — cutout-only fallback');
      return cutoutOnly(input.target);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 1024) {
      logger.warn({ size: bytes.byteLength }, 'swap-and-cutout: juda kichik — cutout-only fallback');
      return cutoutOnly(input.target);
    }

    return Buffer.from(bytes);
  } catch (err) {
    logger.warn({ err }, 'swap-and-cutout: chaqiruv muvaffaqiyatsiz — cutout-only fallback');
    return cutoutOnly(input.target);
  }
}

/**
 * Faqat cutout — face swap qilmasdan shaffof PNG qaytaradi.
 * Yon/orqa burchaklar yoki face reference yo'q holatlar uchun.
 */
async function cutoutOnly(target: Buffer): Promise<Buffer> {
  const url = env().FACEFUSION_URL;
  if (!url) return target;
  try {
    const form = new FormData();
    form.append('image', new Blob([target], { type: 'image/jpeg' }), 'target.jpg');
    const headers: Record<string, string> = {};
    const token = env().FACEFUSION_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);

    const response = await fetch(`${url.replace(/\/+$/, '')}/cutout`, {
      method: 'POST',
      body: form,
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) return target;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 1024) return target;
    return Buffer.from(bytes);
  } catch (err) {
    logger.warn({ err }, 'cutout-only: chaqiruv muvaffaqiyatsiz');
    return target;
  }
}

/**
 * Yuzni almashtiradi. Xato bo'lsa — asl target'ni qaytaradi (pipeline
 * to'xtamaydi). Rasm bo'lmasa — asl target.
 */
export async function faceSwap(input: FaceSwapInput): Promise<Buffer> {
  const url = env().FACEFUSION_URL;
  if (!url) return input.target;

  // Front_only — yon/orqa suratini o'tkazib yuboramiz
  if (env().FACEFUSION_FRONT_ONLY && input.angle !== 'front') return input.target;

  try {
    const sourceBuffer = await fetchFaceSource(input.sourceFaceUrl);
    if (!sourceBuffer) return input.target;

    const form = new FormData();
    /*
     * ⚠️ TARGET VA OUTPUT KENGAYTMASI MOS BO'LSIN. Facefusion CLI output
     * faylni target nomidan kengaytmasini meros qilib oladi; agar u
     * ichki pipeline (model/pixel_boost) kutgan formatdan farq qilsa,
     * "match the target and output extension!" degan xato bilan rc=1
     * qaytadi. Shuning uchun ikkala tomondan ham `.jpg` ishlatiladi —
     * OpenAI natijasi PNG bo'lsa ham MIME'si o'zgarmaydi (facefusion
     * bytes'dan formatni avtomatik aniqlaydi), lekin fayl nomi .jpg
     * bo'lishi shart.
     */
    form.append('source', new Blob([sourceBuffer], { type: 'image/jpeg' }), 'source.jpg');
    form.append('target', new Blob([input.target], { type: 'image/jpeg' }), 'target.jpg');
    form.append('model', env().FACEFUSION_MODEL);
    form.append('pixel_boost', env().FACEFUSION_PIXEL_BOOST);
    form.append('enhance', env().FACEFUSION_ENHANCE ? 'true' : 'false');

    const headers: Record<string, string> = {};
    const token = env().FACEFUSION_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);

    const response = await fetch(`${url.replace(/\/+$/, '')}/swap`, {
      method: 'POST',
      body: form,
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn(
        { status: response.status, body: body.slice(0, 200) },
        'facefusion: xato — asl natija qaytarildi',
      );
      return input.target;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      logger.warn({ contentType }, 'facefusion: rasm emas javob — asl natija qaytarildi');
      return input.target;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 1024) {
      logger.warn({ size: bytes.byteLength }, 'facefusion: juda kichik javob — asl natija qaytarildi');
      return input.target;
    }

    /*
     * ⚠️ ASL SHAFFOFLIKNI TIKLASH (2026-11-09).
     *
     * MUAMMO: Facefusion'ga target .jpg sifatida yuboriladi (CLI talabi) —
     * alpha kanali yo'qoladi. Natijada GPT yasagan shaffof PNG → Facefusion
     * ichida qora fonli JPEG bo'ladi va cutout qayta ishlagunga qadar
     * mijoz ekraninda qora to'rtburchak ko'rinadi.
     *
     * YECHIM: asl target'ning alpha kanalini olib, Facefusion natijasiga
     * (RGB) qo'yamiz. Natija: yuzi almashtirilgan + original shaffof fon.
     * Cutout keyin yana yaxshilashi mumkin, lekin asosiy qora yo'q.
     *
     * Asl target'da alpha bo'lmasa (RGB JPEG) — swap natijasini o'z holicha
     * qaytaramiz.
     */
    try {
      const swapped = Buffer.from(bytes);
      const origMeta = await sharp(input.target).metadata();
      if (origMeta.hasAlpha) {
        const origAlpha = await sharp(input.target).ensureAlpha().extractChannel('alpha').toBuffer();
        /*
         * ⚠️ RESIZE KERNEL: default lanczos3 chekkalarda "ringing" artefaktini
         * qoldiradi — alpha bilan birlashtirilsa qo'pol pikselli ko'rinadi.
         * Lanczos2 — joyida muvozanat: aniq lekin silliq.
         */
        const swappedRgb = await sharp(swapped)
          .removeAlpha()
          .resize(origMeta.width, origMeta.height, {
            fit: 'fill',
            kernel: sharp.kernel.lanczos2,
          })
          .toBuffer();
        /*
         * Alpha kanalni yengil blur qilib birlashtiramiz — chekka yengil
         * antialias bo'ladi, pixelli stupeni yo'qoladi.
         */
        const smoothAlpha = await sharp(origAlpha, {
          raw: { width: origMeta.width!, height: origMeta.height!, channels: 1 },
        })
          .blur(0.8)
          .toBuffer();
        const combined = await sharp(swappedRgb)
          .joinChannel(smoothAlpha)
          .png({ compressionLevel: 9 })
          .toBuffer();
        return combined;
      }
      return swapped;
    } catch (err) {
      logger.warn({ err }, 'facefusion: alpha tiklab bo\'lmadi — swap natijasi o\'z holicha qaytdi');
      return Buffer.from(bytes);
    }
  } catch (err) {
    logger.warn({ err }, 'facefusion: chaqiruv muvaffaqiyatsiz — asl natija qaytarildi');
    return input.target;
  }
}

async function fetchFaceSource(urlOrPath: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(urlOrPath, { signal: controller.signal }).finally(() =>
      clearTimeout(timer),
    );
    if (!response.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    return buf.byteLength > 1024 ? buf : null;
  } catch {
    return null;
  }
}
