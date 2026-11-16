import sharp from 'sharp';

import { env } from '../config/env';
import { logger } from '../logger';

/**
 * Facefusion integration — yuz almashtirish post-processor.
 *
 * ⚠️ NIMA ISH QILADI. AI kiyintirishdan keyin qaytgan rasmda yuz
 * foydalanuvchiga 100% o'xshamasligi mumkin (model o'z taxminini
 * aralashtiradi). Bu modul asl yuzimizni natijaga joylashtiradi —
 * ya'ni "men o'zim shu kiyimda" degan tuyg'u beradi.
 *
 * ⚠️ IXTIYORIY. `FACEFUSION_URL` bo'sh bo'lsa — butun oqim o'tkazib
 * yuboriladi va AI natijasi o'zgarmasdan qaytadi.
 *
 * ⚠️ FAQAT FRONT BURCHAKDA. `FACEFUSION_FRONT_ONLY=true` bo'lsa yon/orqa
 * surati uchun almashtirish qilinmaydi — ularda yuz ko'rinmaydi.
 *
 * ⚠️ NATIJA «RASM KELDI» BILAN TUGAMAYDI (2026-11-12). Ilgari bu modul
 * har qanday nosozlikda jimgina asl rasmni qaytarardi va chaqiruvchi
 * «almashtirildi» bilan «almashtirilmadi» ni ajrata olmasdi — mijozga AI
 * chizgan begona yuz ketardi va bu hech qayerda ko'rinmasdi. Endi natija
 * `face` maydoni bilan qaytadi va chaqiruvchi uni tekshirishi SHART.
 */

export interface FaceSwapInput {
  /** Natija rasm (AI kiyintirishi chiqargani) */
  target: Buffer;
  /** Mijozning asl yuzi (avatar ro'yxatdagi face reference) */
  sourceFaceUrl: string;
  /** Qaysi burchakda ekanimiz — front_only sozlamasini hurmat qilish uchun */
  angle: 'front' | 'side' | 'back';
}

/**
 * Yuz bilan nima bo'ldi.
 *
 *   swapped   — mijozning yuzi qo'yildi
 *   unchanged — xizmat ishladi, lekin rasmda yuz topmadi va uni o'zgartirmadi
 *   failed    — xizmat javob bermadi yoki xato qaytardi (qayta urinishlardan keyin ham)
 *   skipped   — almashtirish kerak emas: bu burchakda (yon/orqa) yoki
 *               xizmatning o'zida o'chirilgan (`FACE_SWAP=off`)
 */
export type FaceOutcome = 'swapped' | 'unchanged' | 'failed' | 'skipped';

export interface FaceSwapResult {
  /** Yakuniy rasm. Almashtirilmagan bo'lsa — asl rasm yoki uning kesimi */
  image: Buffer;
  face: FaceOutcome;
  /** `image` shaffof PNG — alohida fon olib tashlash kerak emas */
  transparent: boolean;
  /** `swapped` bo'lmaganda sabab — logga va operatorga */
  reason?: string;
}

export interface FaceSwapOptions {
  /**
   * Vaqtinchalik nosozlikda urinishlar orasidagi tanaffuslar. Uzunligi —
   * qo'shimcha urinishlar soni.
   */
  retryDelaysMs?: readonly number[];
}

/**
 * ⚠️ TANAFFUSLAR MASHINANING QAYTA KO'TARILISH VAQTIDAN OLINGAN.
 * 2026-11-11 da o'lchandi: fly.io mashinasi xotira tugab o'ldirilgach
 * (`oom_killed=true`) taxminan 60 soniyada yana javob bera boshladi.
 * 20 + 45 soniya shu oraliqni qoplaydi; uzunroq kutish esa operator
 * so'rovini (`POST /result`) ushlab turadi.
 */
const RETRY_DELAYS_MS: readonly number[] = [20_000, 45_000];

/**
 * Bitta chaqiruvga beriladigan vaqt.
 *
 * ⚠️ 45 SONIYA YETMASDI. O'lchangan almashtirish 39–63 soniya oladi
 * (2026-11-11, CPU): eski `faceSwap` 45 soniyada uzib, asl rasmni jimgina
 * qaytarardi — ya'ni har ikkinchi natija almashtirilmasdan ketardi.
 */
const SWAP_TIMEOUT_MS = 240_000;
const CUTOUT_TIMEOUT_MS = 180_000;

export function isFacefusionEnabled(): boolean {
  return Boolean(env().FACEFUSION_URL);
}

function endpoint(path: string): string {
  return `${env().FACEFUSION_URL.replace(/\/+$/, '')}${path}`;
}

function authHeaders(): Record<string, string> {
  const token = env().FACEFUSION_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

type Call =
  | { ok: true; response: Response }
  | { ok: false; reason: string; status: number | null };

/**
 * Xizmatga bitta so'rov — vaqtinchalik nosozlikda qayta urinadi.
 *
 * ⚠️ QAYSI XATO «VAQTINCHALIK». Tarmoq uzilishi, vaqt tugashi va har qanday
 * 5xx: mashina qayta ko'tarilayotgan (502/503) yoki band (504) bo'lishi
 * mumkin. 4xx esa so'rovning o'zida xato borligini bildiradi (masalan 422 —
 * yuz suratida yuz yo'q) va uni takrorlash hech narsani o'zgartirmaydi.
 *
 * ⚠️ FORMA HAR URINISHDA QAYTADAN QURILADI — yuborilgan tana ikkinchi
 * marta o'qilmaydi.
 */
async function callService(
  path: string,
  buildForm: () => FormData,
  timeoutMs: number,
  retryDelaysMs: readonly number[],
): Promise<Call> {
  let last: Call = { ok: false, reason: 'chaqirilmadi', status: null };

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    if (attempt > 0) await sleep(retryDelaysMs[attempt - 1] ?? 0);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint(path), {
        method: 'POST',
        body: buildForm(),
        headers: authHeaders(),
        signal: controller.signal,
      });

      if (response.ok) return { ok: true, response };

      const body = (await response.text().catch(() => '')).slice(0, 200);
      last = { ok: false, reason: `HTTP ${response.status}: ${body}`, status: response.status };
      if (response.status < 500) return last;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'tarmoq xatosi';
      last = { ok: false, reason, status: null };
    } finally {
      clearTimeout(timer);
    }

    logger.warn(
      { path, attempt: attempt + 1, of: retryDelaysMs.length + 1, reason: last.reason },
      'facefusion: urinish muvaffaqiyatsiz',
    );
  }

  return last;
}

/** Xizmat javobidagi rasm; rasm bo'lmasa `null`. */
async function readImage(response: Response): Promise<Buffer | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) return null;

  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.byteLength >= 1024 ? bytes : null;
}

function swapForm(source: Buffer, target: Buffer): FormData {
  const form = new FormData();
  /*
   * ⚠️ TARGET VA OUTPUT KENGAYTMASI MOS BO'LSIN. Facefusion CLI output
   * faylni target nomidan kengaytmasini meros qilib oladi; mos kelmasa
   * "match the target and output extension!" degan xato bilan rc=1
   * qaytadi. Shuning uchun fayl nomi har doim `.jpg` — rasm PNG bo'lsa
   * ham (facefusion formatni baytlardan o'zi aniqlaydi).
   */
  form.append('source', new Blob([source], { type: 'image/jpeg' }), 'source.jpg');
  form.append('target', new Blob([target], { type: 'image/jpeg' }), 'target.jpg');
  form.append('model', env().FACEFUSION_MODEL);
  form.append('pixel_boost', env().FACEFUSION_PIXEL_BOOST);
  form.append('enhance', env().FACEFUSION_ENHANCE ? 'true' : 'false');
  return form;
}

/**
 * Xizmat sarlavhasidan yuz holati.
 *
 * ⚠️ SARLAVHA YO'Q BO'LSA — `swapped`. Eski xizmat uni yubormaydi va u
 * 200 qaytargan bo'lsa almashtirgan deb hisoblanardi; server xizmatdan
 * oldin yangilansa xulq o'zgarmasligi kerak.
 *
 * ⚠️ `off` — XATO EMAS. Xizmatda almashtirish ataylab o'chirilgan
 * (`services/facefusion-api`, `FACE_SWAP=off`: 2026-11-15 dan VPS'da rasmga
 * faqat kesim qilinadi). U `unchanged` deb olinsa har rasm «mijozga begona
 * yuz ketdi» deb operatorga xabar qilinardi.
 */
function faceFromHeader(response: Response): FaceOutcome {
  const value = response.headers.get('x-face-swap');
  if (value === 'none') return 'unchanged';
  if (value === 'off') return 'skipped';
  return 'swapped';
}

/**
 * Face swap VA cutout — birgalikda 1 ta HTTP call.
 *
 * ⚠️ NEGA BITTA ENDPOINT (2026-11-09): avval 2 ta chaqiruv edi (fly.io'da
 * almashtirish, VPS'da lokal Python bilan kesim) va VPS RAM'ni 2GB+ yeyar
 * edi. Endi fly.io ikkalasini bitta so'rovda bajaradi va shaffof PNG
 * qaytaradi.
 *
 * ⚠️ HECH QACHON XATO TASHLAMAYDI — lekin natijani TEKSHIRISH SHART.
 * Almashtirib bo'lmasa `face: 'failed' | 'unchanged'` qaytadi va `image`
 * asl rasmning kesimi (yoki o'zi) bo'ladi: pipeline to'xtamaydi, lekin
 * chaqiruvchi mijozga begona yuz ketganini biladi.
 */
export async function swapAndCutout(
  input: FaceSwapInput,
  options: FaceSwapOptions = {},
): Promise<FaceSwapResult> {
  if (!isFacefusionEnabled()) {
    return { image: input.target, face: 'failed', transparent: false, reason: 'facefusion sozlanmagan' };
  }

  const retryDelaysMs = options.retryDelaysMs ?? RETRY_DELAYS_MS;

  // Front_only — yon/orqa uchun yuz swap qilinmaydi, lekin cutout kerak
  if (env().FACEFUSION_FRONT_ONLY && input.angle !== 'front') {
    return { ...(await cutoutOnly(input.target, retryDelaysMs)), face: 'skipped' };
  }

  const fail = async (reason: string): Promise<FaceSwapResult> => ({
    ...(await cutoutOnly(input.target, retryDelaysMs)),
    face: 'failed',
    reason,
  });

  const source = await fetchFaceSource(input.sourceFaceUrl);
  if (!source) return fail('yuz surati yuklab olinmadi');

  const call = await callService(
    '/swap-and-cutout',
    () => swapForm(source, input.target),
    SWAP_TIMEOUT_MS,
    retryDelaysMs,
  );

  if (!call.ok) {
    /*
     * 422 — xizmat mijozning YUZ SURATIDA yuz topmadi. Bu qayta urinish
     * bilan tuzalmaydi: surat qayta olinishi kerak.
     */
    const reason =
      call.status === 422 ? 'yuz suratida yuz topilmadi — qayta skaner kerak' : call.reason;
    return fail(reason);
  }

  const image = await readImage(call.response);
  if (!image) return fail('xizmat rasm qaytarmadi');

  const face = faceFromHeader(call.response);
  const cutout = call.response.headers.get('x-cutout');
  const contentType = call.response.headers.get('content-type') ?? '';

  return {
    image,
    face,
    // Kesim yiqilsa xizmat almashtirilgan JPEG'ni qaytaradi — u shaffof emas
    transparent: contentType.startsWith('image/png') && cutout !== 'failed',
    ...(face === 'unchanged' ? { reason: 'natijada yuz topilmadi' } : {}),
  };
}

/**
 * Faqat cutout — face swap qilmasdan shaffof PNG qaytaradi.
 * Yon/orqa burchaklar yoki almashtirib bo'lmagan holatlar uchun.
 */
async function cutoutOnly(
  target: Buffer,
  retryDelaysMs: readonly number[],
): Promise<Pick<FaceSwapResult, 'image' | 'transparent'>> {
  const call = await callService(
    '/cutout',
    () => {
      const form = new FormData();
      form.append('image', new Blob([target], { type: 'image/jpeg' }), 'target.jpg');
      return form;
    },
    CUTOUT_TIMEOUT_MS,
    // Almashtirish allaqachon o'z urinishlarini sarflagan — bu yerda bittasi yetadi
    retryDelaysMs.slice(0, 1),
  );

  if (!call.ok) return { image: target, transparent: false };

  const image = await readImage(call.response);
  return image ? { image, transparent: true } : { image: target, transparent: false };
}

/**
 * Yuzni almashtiradi (kesimsiz) — server o'zi yasagan natijalar uchun.
 *
 * Xato bo'lsa asl target qaytadi (pipeline to'xtamaydi), lekin bu endi
 * XATO darajasida logga yoziladi: ilgari `warn` edi va hech kim ko'rmasdi.
 */
export async function faceSwap(
  input: FaceSwapInput,
  options: FaceSwapOptions = {},
): Promise<Buffer> {
  if (!isFacefusionEnabled()) return input.target;

  // Front_only — yon/orqa suratini o'tkazib yuboramiz
  if (env().FACEFUSION_FRONT_ONLY && input.angle !== 'front') return input.target;

  const giveUp = (reason: string): Buffer => {
    logger.error({ reason }, 'facefusion: yuz almashtirilmadi — mijozga AI chizgan yuz ketadi');
    return input.target;
  };

  const source = await fetchFaceSource(input.sourceFaceUrl);
  if (!source) return giveUp('yuz surati yuklab olinmadi');

  const call = await callService(
    '/swap',
    () => swapForm(source, input.target),
    SWAP_TIMEOUT_MS,
    options.retryDelaysMs ?? RETRY_DELAYS_MS,
  );
  if (!call.ok) return giveUp(call.reason);

  const swapped = await readImage(call.response);
  if (!swapped) return giveUp('xizmat rasm qaytarmadi');

  const face = faceFromHeader(call.response);
  if (face === 'unchanged') return giveUp('natijada yuz topilmadi');
  // Xizmatda almashtirish o'chirilgan — rasm o'zgarmagan, qayta ishlash shart emas
  if (face === 'skipped') return input.target;

  return restoreAlpha(input.target, swapped);
}

/**
 * ⚠️ ASL SHAFFOFLIKNI TIKLASH (2026-11-09).
 *
 * MUAMMO: Facefusion'ga target .jpg sifatida yuboriladi (CLI talabi) —
 * alpha kanali yo'qoladi. Natijada GPT yasagan shaffof PNG → Facefusion
 * ichida qora fonli JPEG bo'ladi va cutout qayta ishlagunga qadar
 * mijoz ekranida qora to'rtburchak ko'rinadi.
 *
 * YECHIM: asl target'ning alpha kanalini olib, Facefusion natijasiga
 * (RGB) qo'yamiz. Natija: yuzi almashtirilgan + original shaffof fon.
 *
 * Asl target'da alpha bo'lmasa (RGB JPEG) — swap natijasi o'z holicha
 * qaytadi.
 */
async function restoreAlpha(target: Buffer, swapped: Buffer): Promise<Buffer> {
  try {
    const origMeta = await sharp(target).metadata();
    if (!origMeta.hasAlpha || !origMeta.width || !origMeta.height) return swapped;

    const origAlpha = await sharp(target).ensureAlpha().extractChannel('alpha').raw().toBuffer();

    /*
     * ⚠️ RESIZE KERNEL: default lanczos3 chekkalarda "ringing" artefaktini
     * qoldiradi — alpha bilan birlashtirilsa qo'pol pikselli ko'rinadi.
     * Lanczos2 — joyida muvozanat: aniq lekin silliq.
     */
    const swappedRgb = await sharp(swapped)
      .removeAlpha()
      .resize(origMeta.width, origMeta.height, { fit: 'fill', kernel: sharp.kernel.lanczos2 })
      .toBuffer();

    /*
     * Alpha yengil blur qilinadi — chekka antialias bo'ladi, pikselli zina
     * yo'qoladi.
     *
     * ⚠️ `toColourspace('b-w')` SHART. sharp bir kanalli rasmni blur'dan
     * keyin UCH kanalli qilib chiqaradi; usiz quyidagi `joinChannel` uch
     * barobar uzun baytlarni bitta kanal deb o'qiydi va alfa buziladi
     * (2026-11-12 da sinov aynan shuni ushladi).
     */
    const smoothAlpha = await sharp(origAlpha, {
      raw: { width: origMeta.width, height: origMeta.height, channels: 1 },
    })
      .blur(0.8)
      .toColourspace('b-w')
      .raw()
      .toBuffer();

    return await sharp(swappedRgb)
      .joinChannel(smoothAlpha, {
        raw: { width: origMeta.width, height: origMeta.height, channels: 1 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (err) {
    logger.warn({ err }, 'facefusion: alpha tiklab bo`lmadi — swap natijasi o`z holicha qaytdi');
    return swapped;
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
