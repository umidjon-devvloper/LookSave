import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';

import { env } from '../config/env';
import { uploadObject } from '../integrations/r2';
import { logger } from '../logger';

/**
 * Suratdan odamni (yoki kiyimni) fondan ajratib olish.
 *
 * ⚠️ NEGA KERAK: maketda odam QORONG'I SAHNADA, neon halqalar orasida
 * turadi. AI esa har doim och kulrang studiya foni bilan qaytaradi. Uni
 * to'g'ridan-to'g'ri qo'ysak, qora ekranda och kulrang to'rtburchak paydo
 * bo'ladi va butun taassurot buziladi.
 *
 * Shaffof kesim esa istalgan fonga qo'yiladi — sahna, halqalar, o'lchov
 * chiziqlari ilovada chiziladi va ular hech qanday qo'shimcha xarajat
 * talab qilmaydi.
 *
 * ⚠️ UCH YO'L, SHU TARTIBDA (`makeCutout`):
 *   1. Surat allaqachon kesilgan (o'z alfasi bor) — hech narsa qilinmaydi.
 *   2. Kesim xizmati (fly.io, birefnet) — asosiy yo'l, chekkasi eng toza.
 *   3. Shu serverdagi zaxira model (`@imgly`) — faqat xizmat javob
 *      bermaganda. Sifati pastroq, lekin mijoz kesimsiz qolmaydi.
 */

/*
 * Kutubxona resurs yo'lini joriy ish papkasidan hisoblaydi, paket esa
 * ildizdagi `node_modules` da — shuning uchun yo'l qo'lda beriladi.
 * Batafsil izoh `garment-image.ts` da.
 */
const require_ = createRequire(import.meta.url);
const RESOURCE_PATH = `file://${dirname(require_.resolve('@imgly/background-removal-node'))}/`;

/** Xom rasm: har piksel 4 bayt — R, G, B, alfa. */
interface RawImage {
  data: Buffer;
  width: number;
  height: number;
  /** Asl faylning O'ZIDA alfa kanali bormidi (`ensureAlpha` qo'shgani emas) */
  hasAlpha: boolean;
}

/**
 * Suratni xom RGBA ga ochadi. O'qib bo'lmasa `null`.
 *
 * ⚠️ KANALLAR SONI TEKSHIRILADI. Bu fayldagi hamma hisob «piksel = 4 bayt»
 * degan farazga tayanadi, sharp esa so'ralganidan boshqa sonda kanal
 * qaytarishi mumkin (`refineAlpha` izohiga qarang — aynan shundan butun
 * kesim buzilgan). Faraz buzilsa jim davom etgandan to'xtagan yaxshi.
 */
async function decodeRgba(input: Buffer): Promise<RawImage | null> {
  try {
    const meta = await sharp(input).metadata();
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels !== 4 || data.length !== info.width * info.height * 4) return null;
    return { data, width: info.width, height: info.height, hasAlpha: Boolean(meta.hasAlpha) };
  } catch {
    return null;
  }
}

/*
 * Asl alfaga ishonish shartlari.
 *
 * ⚠️ `services/facefusion-api/cutout.py` DAGI `trusted_alpha` BILAN BIR XIL
 * BO'LISHI SHART — o'zgartirsang ikkalasini birga o'zgartir. Xizmat ham,
 * server ham bitta savolga («bu rasm allaqachon kesilganmi?») javob beradi;
 * javoblar ayri tushsa bitta rasm bir joyda «tayyor», ikkinchisida
 * «kesilsin» bo'lib qoladi.
 */
const TRUST_GRID_WIDTH = 96;
const TRUST_GRID_HEIGHT = 144;
const TRUST_MIN_CLEAR = 0.08;
const TRUST_MIN_SOLID = 0.03;
const TRUST_MAX_FILL = 0.86;

/**
 * Rasm allaqachon kesilganmi — ya'ni uning O'Z alfasi haqiqiy kesimmi.
 *
 * ⚠️ FAQAT «ALFA KANAL BOR» YETMAYDI — ikki tuzoq bor:
 *
 * • Alfa kanal bor, lekin hamma piksel to'liq ko'rinadi (oq/kulrang fonli
 *   PNG). Shaffof qism 8% dan kam bo'lsa ishonilmaydi.
 *
 * • Burchaklar shaffof, lekin figura ortida FON QOLGAN: uch panelli
 *   varaqdan qirqilgan bo'lak (`storeAvatarSheet`) shaffof hoshiya bilan
 *   to'ldirilganda shunday bo'ladi. 2026-11-09 da «to'rt burchagi shaffof
 *   = tayyor» degan eski tekshiruv aynan shularni o'tkazib yuborgan va
 *   mijoz ekranida qora to'rtburchak ko'ringan. Bunday rasmda ko'rinadigan
 *   qism o'z ramkasini deyarli TO'LIQ to'ldiradi; odam silueti esa
 *   ramkasining yarmi atrofini egallaydi. To'ldirish ulushi 86% dan oshsa —
 *   bu to'rtburchak, kesim emas.
 *
 * Hisob kichik to'rda (96×144) bo'ladi: har katak — o'z sohasidagi alfaning
 * o'rtachasi. Yakka piksellar natijaga ta'sir qilmaydi.
 */
function hasOwnCutout(image: RawImage): boolean {
  if (!image.hasAlpha) return false;

  const { data, width, height } = image;
  const cols = Math.min(TRUST_GRID_WIDTH, width);
  const rows = Math.min(TRUST_GRID_HEIGHT, height);
  const sums = new Float64Array(cols * rows);
  const counts = new Uint32Array(cols * rows);

  for (let y = 0; y < height; y += 1) {
    const cellRow = Math.floor((y * rows) / height) * cols;
    const pixelRow = y * width;
    for (let x = 0; x < width; x += 1) {
      const cell = cellRow + Math.floor((x * cols) / width);
      sums[cell] = sums[cell]! + data[(pixelRow + x) * 4 + 3]!;
      counts[cell] = counts[cell]! + 1;
    }
  }

  let clear = 0;
  let solid = 0;
  let visible = 0;
  let left = cols;
  let right = -1;
  let top = rows;
  let bottom = -1;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = row * cols + col;
      const alpha = sums[cell]! / Math.max(1, counts[cell]!);

      if (alpha > 239) solid += 1;
      if (alpha < 16) {
        clear += 1;
        continue;
      }

      visible += 1;
      if (col < left) left = col;
      if (col > right) right = col;
      if (row < top) top = row;
      if (row > bottom) bottom = row;
    }
  }

  const total = cols * rows;
  if (clear / total < TRUST_MIN_CLEAR || solid / total < TRUST_MIN_SOLID) return false;
  if (visible === 0) return false;

  const fill = visible / ((right - left + 1) * (bottom - top + 1));
  return fill <= TRUST_MAX_FILL;
}

/**
 * Zaxira model (`@imgly`) — fon maskasini shu serverda hisoblaydi.
 *
 * ⚠️ KIRISH HAM, CHIQISH HAM XOM RGBA — VA BU UCH SABABDAN (2026-11-13):
 *
 * 1. PNG so'ralsa kutubxona uni `quality` bilan kodlaydi, sharp esa
 *    `quality` berilgan PNG ni PALITRALI qiladi: butun surat 256 rangga
 *    tushadi (o'lchangan: 58 870 xil rangdan 254 tasi qolgan) — teri va
 *    mato silliq o'tishlari zina-zina bo'lib, surat «o'chgan» ko'rinadi.
 *    Xom chiqishda hech narsa kodlanmaydi; PNG ni o'zimiz, to'liq rangda
 *    yozamiz.
 *
 * 2. Kutubxona rasmning O'Z alfasini tashlab, o'rniga model taxminini
 *    yozadi. Shaffof joy ostidagi rang esa ixtiyoriy (AI u yerda yorug'
 *    halqa qoldiradi) — model o'sha joyni «odam» desa, yashirin rang
 *    yuzaga chiqadi. Shuning uchun yakuniy alfa — ikkalasining KICHIGI:
 *    asl rasmda ko'rinmagan piksel kesimda ham ko'rinmaydi. Xizmatdagi
 *    `model_alpha` ham xuddi shunday qiladi.
 *
 * 3. Rasmni bir marta, o'zimiz ochamiz — o'lcham va kanal soni aniq.
 */
async function modelCutout(image: RawImage): Promise<RawImage> {
  const { data, width, height } = image;

  const out = await removeBackground(
    new Blob([data], { type: `image/x-rgba8;width=${width};height=${height}` }),
    {
      publicPath: RESOURCE_PATH,
      model: 'medium',
      output: { format: 'image/x-rgba8' },
    },
  );

  const cut = Buffer.from(await out.arrayBuffer());
  if (cut.length !== data.length) {
    throw new Error(
      `fon modeli kutilmagan o'lchamda qaytardi: ${cut.length} bayt, kutilgani ${data.length}`,
    );
  }

  if (image.hasAlpha) {
    for (let i = 3; i < cut.length; i += 4) {
      if (data[i]! < cut[i]!) cut[i] = data[i]!;
    }
  }

  return { data: cut, width, height, hasAlpha: true };
}

/*
 * Chegaradagi qora halo'ni olib tashlaydi va chekkalarni silliq qiladi.
 *
 * ⚠️ MUAMMO: @imgly'ning alfa kanali yumshoq o'tish beradi — chekkalardagi
 * yarim-shaffof piksellarning RGB qiymati qora fondan olingan, bu halo
 * bo'lib ko'rinadi. To'g'ridan-to'g'ri qattiq threshold qo'llasak, halo
 * yo'qoladi, lekin chekkalar JAG'LANADI (pikselli stupeni ko'rinadi).
 *
 * YECHIM — uch bosqich:
 * 1) Chekkadagi qora piksellarning RGB'sini QO'SHNI opak piksellar rangiga
 *    almashtiramiz — halo'ning RANGI o'zgaradi, qora o'rniga teri/kiyim.
 * 2) Alfa'ni yumshoq blur bilan silliqlaymiz (0.5px) — chekkalardagi
 *    stupeni yo'qoladi, silliq antialias chiziq paydo bo'ladi.
 * 3) Shu silliq alfani oraliqda normallashtiramiz: <40 → 0, >200 → 255,
 *    o'rtada — yumshoq ramp. Halo yo'qolgan, chekka silliq.
 *
 * Xato bo'lsa rasm o'zgarmasdan qaytadi — silliqlash BEZAK, uning
 * nosozligi kesimni yo'q qilmasligi kerak.
 */
async function refineAlpha(image: RawImage): Promise<RawImage> {
  try {
    const { width, height } = image;
    const pixels = width * height;
    const data = Buffer.from(image.data);

    /*
     * 1) Chekkalardagi QORA piksel RGB'sini aniqlab, alfa>230 bo'lgan eng
     *    yaqin opak pikseldan (5x5 atrofidan) ko'chiramiz. Bu halo'ning
     *    rangini o'zgartiradi — qora o'rniga teri/kiyim rangi bo'ladi.
     */
    const copy = image.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = copy[i + 3]!;
        if (a >= 230 || a < 10) continue;
        const r = copy[i]!,
          g = copy[i + 1]!,
          b = copy[i + 2]!;
        if (r > 24 || g > 24 || b > 24) continue; // qora bo'lmasa qoldiramiz
        // Opak qo'shnini topamiz
        let sumR = 0,
          sumG = 0,
          sumB = 0,
          cnt = 0;
        for (let dy = -2; dy <= 2 && cnt === 0; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ny = y + dy,
              nx = x + dx;
            if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
            const j = (ny * width + nx) * 4;
            if (copy[j + 3]! < 230) continue;
            sumR += copy[j]!;
            sumG += copy[j + 1]!;
            sumB += copy[j + 2]!;
            cnt++;
          }
        }
        if (cnt > 0) {
          data[i] = Math.round(sumR / cnt);
          data[i + 1] = Math.round(sumG / cnt);
          data[i + 2] = Math.round(sumB / cnt);
        }
      }
    }

    // 2) Alfa kanali bo'yicha yengil blur — chekkalar silliq bo'ladi
    const alphaOnly = Buffer.alloc(pixels);
    for (let i = 0; i < pixels; i++) alphaOnly[i] = data[i * 4 + 3]!;

    /*
     * ⚠️ `toColourspace('b-w')` VA UZUNLIK TEKSHIRUVI SHART (2026-11-13).
     *
     * sharp bir kanalli rasmni chiqishda UCH kanalli (sRGB) qilib beradi —
     * `.raw()` so'ralganda ham. Ilgari bu yerda `b-w` yo'q edi: bufer uch
     * barobar uzun qaytar, kod esa uning birinchi uchdan birini bitta kanal
     * deb o'qirdi. Natijada alfa uch barobar cho'zilib, har satr uch
     * bo'lakka sochilardi — kesim YO'L-YO'L chiqardi (har uch qatordan
     * ikkitasi shaffof), figura o'rnida esa fon ko'rinardi.
     *
     * Bu nuqson 2026-11-09 dan beri HAR zaxira kesimda bor edi; ko'rinmay
     * yurgani — zaxira yo'l faqat kesim xizmati javob bermaganda ishlaydi.
     * 2026-11-13 da prod'da ushlandi (`8b445355…`).
     *
     * Uzunlik mos kelmasa silliqlanmagan alfa ishlatiladi: kutilmagan
     * o'lchamdagi buferni HECH QACHON o'qimaymiz.
     */
    const blurred = await sharp(alphaOnly, { raw: { width, height, channels: 1 } })
      .blur(0.5)
      .toColourspace('b-w')
      .raw()
      .toBuffer({ resolveWithObject: true });

    let smooth: Buffer = alphaOnly;
    if (blurred.info.channels === 1 && blurred.data.length === pixels) {
      smooth = blurred.data;
    } else {
      logger.warn(
        { channels: blurred.info.channels, bytes: blurred.data.length, expected: pixels },
        'kesim: alfa silliqlanmadi — kutilmagan bufer',
      );
    }

    // 3) Yangi alfa'ni ramp bilan normallashtirish va qaytarib qo'yish
    for (let i = 0; i < pixels; i++) {
      const a = smooth[i]!;
      let out: number;
      if (a < 40) out = 0;
      else if (a > 200) out = 255;
      else out = Math.round(((a - 40) / (200 - 40)) * 255);
      data[i * 4 + 3] = out;
    }

    return { ...image, data };
  } catch (err) {
    logger.warn({ err }, 'kesim: chekkani silliqlab bo`lmadi — model natijasi o`z holicha');
    return image;
  }
}

/** Xom RGBA → PNG, TO'LIQ RANGDA (palitrasiz — `modelCutout` izohiga qarang). */
async function encodePng(image: RawImage): Promise<Buffer> {
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

/**
 * Suratni yuklab, fonini olib tashlab, shaffof PNG sifatida saqlaydi va
 * uning manzilini qaytaradi. Surat allaqachon kesilgan bo'lsa — O'SHA
 * manzilning o'zi qaytadi.
 *
 * Xato bo'lsa `null` qaytadi — kesim BEZAK, uning yo'qligi asosiy oqimni
 * to'xtatmasligi kerak. Ilova bunday holatda oddiy suratni ko'rsatadi.
 */
export async function makeCutout(url: string, prefix: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const input = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';

    // sharp o'qiy olmasa ham xizmat o'qishi mumkin — shuning uchun bu xato emas
    const image = await decodeRgba(input);

    /*
     * ⚠️ TAYYOR KESIM QAYTA KESILMAYDI (2026-11-13) — shaffof rasmning
     * kesimi uning o'zi.
     *
     * TARIX. 2026-09-25 dan «to'rt burchagi shaffof = tayyor» yorlig'i bor
     * edi. 2026-11-09 da u olib tashlandi: `storeAvatarSheet` qirqqan
     * panellarda burchaklar shaffof, figura ortida esa QORA FON qolgan —
     * yorliq ularni ham o'tkazar, mijoz qora to'rtburchak ko'rardi.
     * Shundan keyin HAR rasm, allaqachon kesilgani ham, modelga ketdi.
     *
     * Bu ham xato bo'lib chiqdi:
     *  • yuz almashtirish xizmati natijani allaqachon shaffof qaytaradi —
     *    o'sha rasm shu yerda IKKINCHI marta xizmatga ketardi. Ortiqcha yuk
     *    aynan o'sha mo'rt xizmatga tushadi (xotirasi to'lib yiqiladi);
     *  • xizmat javob bermasa rasm zaxira modelga tushardi, u esa aniq
     *    alfani o'z taxminiga almashtiradi. 2026-11-13 da prod'da shunday
     *    bo'ldi: xizmat qayta ishga tushayotgan edi, kesim zaxira yo'ldan
     *    o'tdi va buzilib chiqdi (`refineAlpha` izohiga qarang).
     *
     * Yorliq qaytarildi, lekin QAT'IY qoida bilan — `hasOwnCutout`: qora
     * fonli panel undan o'tmaydi (to'ldirish ulushi), u modelga boradi.
     */
    if (image && hasOwnCutout(image)) return url;

    /*
     * ⚠️ KESIM XIZMATI AVVAL. `FACEFUSION_URL` (yoki eski `CUTOUT_URL`)
     * sozlangan bo'lsa rasm o'sha yerga boradi — chekkalari ancha silliq,
     * qora halo yo'q. Xizmat yo'q yoki javob bermasa pastdagi zaxira model
     * ishga tushadi, oqim uzilmaydi.
     */
    const viaPy = await tryPythonCutout(input, contentType);
    if (viaPy) {
      return await uploadObject({
        key: `${prefix}/${randomUUID()}.png`,
        body: viaPy,
        contentType: 'image/png',
      });
    }

    if (!image) throw new Error('suratni o`qib bo`lmadi');

    logger.info({ url }, 'kesim: xizmat natija bermadi — zaxira model ishlatiladi');
    const cleaned = await refineAlpha(await modelCutout(image));

    return await uploadObject({
      key: `${prefix}/${randomUUID()}.png`,
      body: await encodePng(cleaned),
      contentType: 'image/png',
    });
  } catch (err) {
    logger.warn({ err, url }, 'kesim yasalmadi');
    return null;
  }
}

/*
 * Cutout xizmatiga xom rasm POST qiladi. Muvaffaqiyatsiz bo'lsa null
 * qaytaradi — chaqiruvchi @imgly fallback'ga o'tadi.
 *
 * ⚠️ 2026-11-09 — endi FLY.IO Facefusion API orqali (bitta birlashgan
 * xizmat). `FACEFUSION_URL` sozlangan bo'lsa, uning `/cutout` endpoint'i
 * ishlatiladi (birefnet-general-lite). Eski `CUTOUT_URL` lokal Python
 * xizmat ham qo'llab-quvvatlanadi — tranzitsiya davrida ikkalasi ham
 * bir xil interfeysga ega.
 */
async function tryPythonCutout(input: Buffer, contentType: string): Promise<Buffer | null> {
  // Avval fly.io Facefusion API'ni sinab ko'ramiz (yangi, yagona xizmat)
  const facefusionBase = env().FACEFUSION_URL;
  if (facefusionBase) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180_000);
      const form = new FormData();
      form.append('image', new Blob([input], { type: contentType }), 'image.jpg');
      const headers: Record<string, string> = {};
      const token = env().FACEFUSION_TOKEN;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${facefusionBase.replace(/\/+$/, '')}/cutout`, {
        method: 'POST',
        body: form,
        headers,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > 1024) return buf;
      } else {
        const body = await res.text().catch(() => '');
        logger.warn({ status: res.status, body: body.slice(0, 200) }, 'facefusion /cutout: xato');
      }
    } catch (err) {
      logger.warn({ err }, 'facefusion /cutout: chaqiruv muvaffaqiyatsiz — CUTOUT_URL fallback');
    }
  }

  // Legacy: lokal Python xizmat (services/cutout-py)
  const base = env().CUTOUT_URL;
  if (!base) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    const res = await fetch(`${base.replace(/\/+$/, '')}/cutout`, {
      method: 'POST',
      body: input,
      headers: { 'Content-Type': contentType },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn({ status: res.status, body: body.slice(0, 200) }, 'cutout-py: xato');
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 1024 ? buf : null;
  } catch (err) {
    logger.warn({ err }, 'cutout-py: chaqiruv muvaffaqiyatsiz');
    return null;
  }
}
