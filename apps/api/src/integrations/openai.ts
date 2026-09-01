import sharp from 'sharp';

import { env } from '../config/env';
import { logger } from '../logger';

/**
 * OpenAI `gpt-image-1` — avatar yasash va kiyintirish.
 *
 * ⚠️ BU YAGONA AI PROVAYDER. Ilgari FASHN ham bor edi va ikkalasi
 * `TRYON_PROVIDER` bilan almashtirilardi; FASHN butunlay olib tashlandi.
 *
 * ⚠️ BILIB TURISH KERAK BO'LGAN CHEKLOV. `gpt-image-1` — UMUMIY rasm
 * generatori, kiyim try-on uchun maxsus o'qitilmagan. U kiyimni nusxa
 * ko'chirmaydi, balki ko'rgan narsasiga o'xshash kiyimni QAYTADAN
 * CHIZADI. Amalda: brend logosi buzilishi, naqsh boshqacha tushishi,
 * tugma va chok joyi o'zgarishi mumkin.
 *
 * Marketplace uchun bu jiddiy: mahsulot sahifasida ko'rsatilgan narsa
 * yetkazilgani bilan mos kelishi kerak. Quyidagi promptdagi cheklovlar
 * shuni imkon qadar ushlab turadi, lekin kafolat bermaydi.
 *
 * ⚠️ BU MODUL PUL SARFLAYDI. Har rasm uchun to'lanadi. Shuning uchun bu
 * yerda takroriy urinish YO'Q — xato yuqoriga qaytariladi va qaror u
 * yerda qabul qilinadi.
 *
 * ⚠️ ODDIY `Error` TASHLANADI, `ApiError` EMAS. Integratsiya qatlami
 * HTTP holat kodini bilmasligi kerak; uni chaqiruvchi foydalanuvchi
 * ko'radigan xabarga aylantiradi.
 *
 * ⚠️ HAMMASI SINXRON. FASHN ish yaratib `id` qaytarardi va natija keyin
 * so'ralardi; `gpt-image-1` javobda darhol rasm beradi (30–60 s).
 * Shuning uchun chaqiruvchi buni FONDA bajarishi shart — HTTP so'rov
 * ichida kutish taymautga olib keladi.
 */

/** Kiyim turi — promptda ishlatiladi, model qayerga kiydirishni bilishi uchun. */
export type GarmentKind = 'tops' | 'bottoms' | 'one-pieces' | 'auto';

export function garmentKindForSlot(slot: string): GarmentKind {
  switch (slot) {
    case 'top':
    case 'outer':
      return 'tops';
    case 'bottom':
      return 'bottoms';
    case 'dress':
      return 'one-pieces';
    default:
      return 'auto';
  }
}

export function isOpenAiEnabled(): boolean {
  return env().OPENAI_API_KEY.length > 0;
}

/** Kiyim turini o'zbekcha emas, INGLIZCHA aytamiz — model shunga o'qitilgan. */
const PLACEMENT: Record<GarmentKind, string> = {
  tops: 'as the upper-body garment (shirt/top/jacket)',
  bottoms: 'as the lower-body garment (trousers/skirt)',
  'one-pieces': 'as the full-body garment (dress/jumpsuit)',
  auto: 'in its natural position on the body',
};

/**
 * Prompt.
 *
 * ⚠️ HAR BIR JUMLA SABABLI. Model erkin bo'lsa odamning yuzini, gavdasini
 * va fonini ham qayta chizadi — natijada foydalanuvchi o'zini emas,
 * boshqa odamni ko'radi. Quyidagi cheklovlar shuni to'sadi:
 *
 *   «keep the person's face … unchanged»  — yuz o'zgarmasin
 *   «keep the body proportions»           — gavda o'zgarmasin
 *   «photorealistic»                      — illyustratsiya emas
 *   «same lighting and background»        — kadr o'zgarmasin
 */
export function buildPrompt(
  kind: GarmentKind,
  extras: { face?: boolean; print?: boolean } = {},
): string {
  const lines = [
    'Photorealistic virtual try-on.',
    `Dress the person from the first image in the garment from the second image, ${PLACEMENT[kind]}.`,
    "Keep the person's face, hair, skin tone and body proportions completely unchanged.",
  ];

  /*
   * ⚠️ RAQAMLAR DINAMIK HISOBLANADI. Prompt rasmlarni «third/fourth
   * image» deb ataydi va bu raqamlar `image[]` tartibiga AYNAN mos
   * kelishi shart. Yuz surati bo'lmasa bosma uchinchi bo'lib qoladi —
   * raqamni qotirib qo'ysak, model noto'g'ri rasmga qarardi.
   */
  const ORDINALS = ['third', 'fourth'];
  let next = 0;

  if (extras.face) {
    const n = ORDINALS[next++];
    lines.push(
      `The ${n} image is a close-up reference of the same person's face.`,
      'Match the facial features, bone structure and skin tone to that reference exactly.',
      `Use the ${n} image ONLY for the face — take pose, body and framing from the first image.`,
    );
  }

  if (extras.print) {
    const n = ORDINALS[next++];
    /*
     * ⚠️ ENG QAT'IY JUMLA SHU YERDA. Model bosmani «qayta chizishga»
     * moyil: matnni to'g'ri, lekin ikonkalarni boshqa joyga qo'yadi.
     * Shuning uchun «copy exactly», «do not redraw», «do not rearrange»
     * uchalasi ham yoziladi — bittasi yetmasligi o'lchangan.
     */
    lines.push(
      `The ${n} image is a close-up of the exact artwork printed on the garment.`,
      `Copy that artwork EXACTLY onto the garment: same layout, same icon positions, same text, same colours.`,
      'Do not redraw, do not rearrange, do not substitute any element of the artwork.',
      'Only warp it naturally to follow the fabric folds and body curvature.',
    );
  }

  lines.push(
    /*
     * ⚠️ BU JUMLA HAR DOIM QOLADI. Bosma manbasi bo'lmagan kiyimlar ham
     * bor (bir rangli futbolka, oddiy shim) va ular uchun aniqlik talabi
     * shu yerda. Qayta tuzishda bir marta tushib qolgan edi — sinov
     * ushladi.
     */
    'Reproduce the garment colour, pattern and shape as accurately as possible.',
    'Keep the same pose, lighting and background.',
    'Natural fabric folds and realistic fit. No text or watermarks added.',
  );

  return lines.join(' ');
}

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
}

/**
 * Kiyim suratidan BOSMA sohasini qirqib oladi.
 *
 * ⚠️ NEGA QIRQAMIZ. To'liq surat modelga «odam futbolkada» bo'lib
 * ko'rinadi va u bosmani tafsilot deb qabul qiladi. Yaqin qirqim esa
 * bosmani KADR MAVZUSIGA aylantiradi — «buni aynan takrorla» degan
 * ko'rsatma aniq nishonga tushadi.
 *
 * ⚠️ QIRQIM O'RTADAN, TAXMINIY. Bosma qayerdaligini bilmaymiz —
 * mahsulot suratlarida u deyarli doim ko'krak markazida bo'ladi.
 * Kengligi 60%, balandligi 45%, markazdan biroz yuqorida.
 *
 * Bu evristika: bosmasi chetda bo'lgan kiyimda qirqim bo'sh matoga
 * tushadi va foyda bermaydi — lekin zarar ham qilmaydi, chunki asosiy
 * kiyim surati baribir ikkinchi rasm bo'lib boradi.
 */
async function cropPrint(source: Blob): Promise<Blob | null> {
  try {
    const input = Buffer.from(await source.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return null;

    const width = Math.round(meta.width * 0.6);
    const height = Math.round(meta.height * 0.45);
    const left = Math.round((meta.width - width) / 2);
    const top = Math.round(meta.height * 0.22);

    const out = await sharp(input)
      .extract({ left, top, width, height })
      // Kattalashtiramiz: mayda detal modelga yaxshiroq yetsin
      .resize({ width: 1024, withoutEnlargement: false })
      .jpeg({ quality: 92 })
      .toBuffer();

    return new Blob([out], { type: 'image/jpeg' });
  } catch {
    // Qirqib bo'lmasa kiyintirish bosmasiz davom etadi
    return null;
  }
}

/** Havoladan suratni olib, `multipart/form-data` uchun `Blob` qiladi. */
async function fetchAsBlob(url: string, label: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} yuklanmadi: HTTP ${response.status}`);
  }
  return response.blob();
}

export interface OpenAiTryonInput {
  /** Foydalanuvchining to'liq bo'yli surati (ochiq HTTPS havola) */
  modelImageUrl: string;
  /** Kiyim surati */
  garmentImageUrl: string;
  kind: GarmentKind;
  /**
   * Yuz surati — ixtiyoriy uchinchi manba.
   *
   * ⚠️ BO'LSA O'XSHASHLIK SEZILARLI YAXSHILANADI, chunki model yuzni
   * gavda suratidan taxmin qilmaydi, haqiqiysini ko'radi.
   */
  faceReferenceUrl?: string | null;
}

/**
 * Kiyintirilgan suratni yasaydi va XOM BAYT qaytaradi.
 *
 * ⚠️ CHAQIRUVCHI BUNI FONDA BAJARISHI SHART. `gpt-image-1` javobda
 * darhol rasm beradi, lekin 30–60 soniya oladi — HTTP so'rov ichida
 * kutish taymautga olib keladi.
 */
export async function generateTryon(input: OpenAiTryonInput): Promise<Buffer> {
  const key = env().OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI kaliti sozlanmagan');
  }

  const [person, garment, face] = await Promise.all([
    fetchAsBlob(input.modelImageUrl, 'Foydalanuvchi surati'),
    fetchAsBlob(input.garmentImageUrl, 'Kiyim surati'),
    /*
     * ⚠️ YUZ SURATI YIQILSA OQIM TO'XTAMAYDI. U yaxshilash, shart emas —
     * `null` bo'lsa kiyintirish yuzsiz manba bilan davom etadi.
     */
    input.faceReferenceUrl
      ? fetchAsBlob(input.faceReferenceUrl, 'Yuz surati').catch(() => null)
      : Promise.resolve(null),
  ]);

  /*
   * ⚠️ RASMLAR BIR MAYDONDA (`image[]`). `gpt-image-1` bir nechta kirish
   * rasmini qabul qiladi va promptda ular «first/second/third image» deb
   * ataladi. TARTIB MUHIM va promptdagi raqamlar bilan mos kelishi shart:
   * birinchisi — odam, ikkinchisi — kiyim, uchinchisi — yuz (ixtiyoriy).
   */
  const form = new FormData();
  form.append('model', env().OPENAI_IMAGE_MODEL);
  const print = await cropPrint(garment);

  form.append('image[]', person, 'person.jpg');
  form.append('image[]', garment, 'garment.jpg');
  // ⚠️ TARTIB PROMPTDAGI RAQAMLAR BILAN BOG'LIQ — o'zgartirmang
  if (face) form.append('image[]', face, 'face.jpg');
  if (print) form.append('image[]', print, 'print.jpg');
  form.append('prompt', buildPrompt(input.kind, { face: Boolean(face), print: Boolean(print) }));
  // Tik kadr — odam to'liq bo'yi bilan sig'adi
  form.append('size', '1024x1536');
  form.append('quality', 'high');
  form.append('n', '1');

  const response = await fetch(`${env().OPENAI_BASE_URL}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  return readImage(response, 'kiyintirish');
}

/**
 * Javobdan rasmni oladi.
 *
 * ⚠️ IKKI SHAKL QO'LLAB-QUVVATLANADI. `gpt-image-1` doim base64
 * qaytaradi; `url` faqat eski `dall-e-*` modellarida bor. Model nomi
 * sozlama orqali almashtirilgani uchun ikkalasi ham hisobga olinadi.
 */
async function readImage(response: Response, what: string): Promise<Buffer> {
  const body = (await response.json().catch(() => ({}))) as OpenAiImageResponse;

  if (!response.ok) {
    const message = body.error?.message ?? `HTTP ${response.status}`;
    logger.error({ status: response.status, message, what }, 'openai: so`rov yiqildi');
    throw new Error(`OpenAI xatosi: ${message}`);
  }

  const first = body.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64');

  if (first?.url) {
    const image = await fetch(first.url);
    if (!image.ok) {
      throw new Error(`natija yuklanmadi: HTTP ${image.status}`);
    }
    return Buffer.from(await image.arrayBuffer());
  }

  throw new Error('OpenAI rasm qaytarmadi');
}

/**
 * Yuz suratidan to'liq bo'yli avatar yasaydi.
 *
 * ⚠️ YUZ O'ZGARMASLIGI ENG MUHIM TALAB. Foydalanuvchi o'zini ko'rishi
 * kerak; boshqa odam chiqsa butun oqimning ma'nosi yo'qoladi. Shuning
 * uchun prompt yuzni ochiq-oydin qulflaydi va bu jumlani o'chirmaslik
 * kerak.
 *
 * ⚠️ GAVDA O'LCHOVLARDAN. `prompt` ni `avatar-prompt.ts` yasaydi — u
 * yerda bo'y, vazn va tana tuzilishi matnga aylanadi. Bu yerda faqat
 * yuz bog'lanadi.
 *
 * @param facePhotoUrl Foydalanuvchining yuz surati (ochiq HTTPS havola)
 * @param prompt       Gavda tavsifi — `buildAvatarPrompt` natijasi
 */
export async function generateAvatar(facePhotoUrl: string, prompt: string): Promise<Buffer> {
  const key = env().OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI kaliti sozlanmagan');
  }

  const face = await fetchAsBlob(facePhotoUrl, 'Yuz surati');

  const form = new FormData();
  form.append('model', env().OPENAI_IMAGE_MODEL);
  form.append('image[]', face, 'face.jpg');
  form.append(
    'prompt',
    [
      'Full-body photorealistic portrait of the person in the reference image,',
      'standing straight, facing the camera, arms relaxed at the sides.',
      "Keep the person's face, hair, skin tone and facial features EXACTLY as in the reference — this is the same person.",
      prompt,
      'Plain neutral studio background, even soft lighting.',
      'Wearing plain fitted neutral underclothes. No text, no watermarks, no props.',
    ].join(' '),
  );
  // Tik kadr — to'liq bo'yli odam uchun
  form.append('size', '1024x1536');
  form.append('quality', 'high');
  form.append('n', '1');

  const response = await fetch(`${env().OPENAI_BASE_URL}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  return readImage(response, 'avatar');
}
