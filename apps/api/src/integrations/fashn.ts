import { env } from '../config/env';
import { logger } from '../logger';

/**
 * FASHN AI kiyintirish mijozi.
 *
 * Xizmat ikki qadamda ishlaydi: `POST /run` ish yaratadi va darhol `id`
 * qaytaradi, natija esa `GET /status/:id` orqali tayyor bo'lgach olinadi.
 * Yasash 5–17 soniya davom etadi, shuning uchun kutish HTTP so'rov ichida
 * emas, fonda bo'ladi.
 *
 * ⚠️ BU MODUL PUL SARFLAYDI. Har muvaffaqiyatli `run` — bitta kredit.
 * Shuning uchun bu yerda takroriy urinish YO'Q: xato bo'lsa qaytariladi va
 * qaror yuqorida qabul qilinadi, aks holda bitta nosozlik jim ravishda
 * bir necha marta to'lanardi.
 */

/** Provayder qaytaradigan holatlar (hujjatdagi beshta). */
export type FashnStatus = 'starting' | 'in_queue' | 'processing' | 'completed' | 'failed';

export interface FashnJob {
  id: string;
}

export type FashnResult =
  | { status: 'pending' }
  | { status: 'ready'; imageUrl: string }
  | { status: 'failed'; message: string };

/**
 * Kiyim turi. `auto` ko'p hollarda to'g'ri topadi, lekin bizda slot
 * allaqachon ma'lum — uni berish aniqlikni oshiradi va xatoni kamaytiradi.
 */
export type FashnCategory = 'auto' | 'tops' | 'bottoms' | 'one-pieces';

/** Ichki slotlarni provayder toifalariga o'giradi. */
export function categoryForSlot(slot: string): FashnCategory {
  switch (slot) {
    case 'top':
    case 'outer':
      return 'tops';
    case 'bottom':
      return 'bottoms';
    default:
      /*
       * Boshqa slotlar (oyoq kiyim, sumka, soat, bosh kiyim) — bu model
       * ular uchun mo'ljallanmagan. `auto` beriladi, lekin natija sifati
       * kafolatlanmaydi: chaqiruvni to'sish qarori yuqorida qabul qilinadi.
       */
      return 'auto';
  }
}

export function isFashnEnabled(): boolean {
  return env().FASHN_API_KEY.length > 0;
}

/** Tarmoq kutish vaqti — provayder osilib qolsa ish navbatni band qilmasin. */
const TIMEOUT_MS = 30_000;

async function call(path: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${env().FASHN_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env().FASHN_API_KEY}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      // Provayder HTML xato sahifasi qaytarishi mumkin — matnni saqlab qolamiz
      throw new Error(`FASHN javobi JSON emas (${response.status}): ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? String((body as { message: unknown }).message)
          : `HTTP ${response.status}`;
      throw new Error(`FASHN xatosi: ${message}`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

export interface SubmitInput {
  /** Foydalanuvchining to'liq bo'yli surati (ochiq HTTPS havola) */
  modelImageUrl: string;
  /** Kiyim surati — oq fonda, tekis yotqizilgan bo'lsa sifat yuqori */
  garmentImageUrl: string;
  category: FashnCategory;
}

/**
 * Ish yaratadi va provayderning `id` sini qaytaradi.
 *
 * ⚠️ `seed` ATAYIN QAT'IY. Bir xil surat + bir xil kiyim har doim bir xil
 * natija berishi kerak: aks holda kesh buzilganda foydalanuvchi o'zini
 * boshqacha ko'radi va bu xatodek taassurot qoldiradi.
 */
export async function submitTryon(input: SubmitInput): Promise<FashnJob> {
  const body = await call('/run', {
    method: 'POST',
    body: JSON.stringify({
      model_name: env().FASHN_MODEL,
      inputs: {
        model_image: input.modelImageUrl,
        garment_image: input.garmentImageUrl,
        category: input.category,
        mode: env().FASHN_MODE,
        output_format: 'jpeg',
        num_samples: 1,
        seed: 42,
      },
    }),
  });

  const id =
    typeof body === 'object' && body !== null && 'id' in body
      ? String((body as { id: unknown }).id)
      : null;

  if (id === null || id.length === 0) {
    throw new Error('FASHN ish raqamini qaytarmadi');
  }

  return { id };
}

/**
 * To'liq bo'yli avatar yasaydi: yuz surati + matnli tavsif -> odam surati.
 *
 * ⚠️ `face_reference` — BUTUN G'OYANING KALITI. U identifikatsiyani
 * qulflaydi, ya'ni yasalgan odamning yuzi foydalanuvchiniki bo'ladi.
 * Usiz shunchaki begona model chiqadi va butun ish ma'nosiz.
 *
 * ⚠️ NARX: `face_reference` har natijaga +3 kredit qo'shadi. Shuning uchun
 * avatar bir marta yasaladi va profilda saqlanadi — har kiyim uchun emas.
 *
 * `resolution` 1k da qoldirilgan: kiyintirish modeli baribir 864×1296 da
 * ishlaydi, kattaroq surat foyda bermay kredit yeydi.
 */
export async function submitAvatar(input: {
  facePhotoUrl: string;
  prompt: string;
}): Promise<FashnJob> {
  const body = await call('/run', {
    method: 'POST',
    body: JSON.stringify({
      model_name: 'model-create',
      inputs: {
        prompt: input.prompt,
        face_reference: input.facePhotoUrl,
        /*
         * `match_reference` — yuz aynan berilgan suratdagidek bo'ladi.
         * `match_base` esa tavsifdagi odamga moslashtiradi, ya'ni o'xshashlik
         * yo'qoladi. Bizga birinchisi kerak.
         */
        face_reference_mode: 'match_reference',
        // Tik to'rtburchak — to'liq bo'yli odam uchun
        aspect_ratio: '3:4',
        resolution: '1k',
        generation_mode: 'quality',
        output_format: 'jpeg',
        num_images: 1,
        seed: 42,
      },
    }),
  });

  const id =
    typeof body === 'object' && body !== null && 'id' in body
      ? String((body as { id: unknown }).id)
      : null;

  if (id === null || id.length === 0) {
    throw new Error('FASHN avatar ish raqamini qaytarmadi');
  }

  return { id };
}

/**
 * Ish holatini so'raydi.
 *
 * Provayder ikki xil xato shakli qaytaradi: yuqori darajadagi `{error, message}`
 * va ish ichidagi `{status:'failed', error:{name, message}}`. Ikkalasi ham shu
 * yerda bitta ko'rinishga keltiriladi, chunki yuqorida ular bir xil ishlov
 * oladi — ish muvaffaqiyatsiz va sabab yozib qo'yiladi.
 */
export async function pollTryon(jobId: string): Promise<FashnResult> {
  const body = (await call(`/status/${encodeURIComponent(jobId)}`, { method: 'GET' })) as {
    status?: FashnStatus;
    output?: unknown;
    error?: unknown;
  } | null;

  if (body === null) return { status: 'failed', message: 'FASHN bo`sh javob qaytardi' };

  if (body.status === 'failed') {
    const error = body.error;
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'sabab ko`rsatilmagan';
    return { status: 'failed', message };
  }

  if (body.status === 'completed') {
    const first = Array.isArray(body.output) ? body.output[0] : null;
    if (typeof first !== 'string' || first.length === 0) {
      return { status: 'failed', message: 'FASHN natija havolasini qaytarmadi' };
    }
    return { status: 'ready', imageUrl: first };
  }

  return { status: 'pending' };
}

/**
 * Provayder natijasini o'zimizga ko'chirish uchun yuklab oladi.
 *
 * ⚠️ NEGA KO'CHIRAMIZ: provayderning havolalari vaqtinchalik va bir necha
 * kundan keyin o'chadi. Kesh esa oylab yashashi kerak — aks holda saqlangan
 * komplekt ochilganda bo'sh rasm chiqadi va biz uni qayta to'lab yasaymiz.
 */
export async function downloadResult(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`natijani yuklab bo'lmadi: HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0) throw new Error('natija bo`sh');

    logger.debug({ bytes: buffer.byteLength }, 'FASHN natijasi yuklandi');
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}
