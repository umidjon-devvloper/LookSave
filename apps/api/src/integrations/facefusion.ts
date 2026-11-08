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
    form.append('source', new Blob([sourceBuffer], { type: 'image/jpeg' }), 'source.jpg');
    form.append('target', new Blob([input.target], { type: 'image/png' }), 'target.png');
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

    return Buffer.from(bytes);
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
