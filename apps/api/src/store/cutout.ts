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
 * ⚠️ ISHLOV O'Z SERVERIMIZDA — tashqi xizmatga to'lanmaydi. Har surat
 * uchun bir necha soniya protsessor vaqti ketadi, shuning uchun natija
 * SAQLANADI va qayta hisoblanmaydi.
 */

/*
 * Kutubxona resurs yo'lini joriy ish papkasidan hisoblaydi, paket esa
 * ildizdagi `node_modules` da — shuning uchun yo'l qo'lda beriladi.
 * Batafsil izoh `garment-image.ts` da.
 */
const require_ = createRequire(import.meta.url);
const RESOURCE_PATH = `file://${dirname(require_.resolve('@imgly/background-removal-node'))}/`;

/**
 * Suratni yuklab, fonini olib tashlab, shaffof PNG sifatida saqlaydi.
 *
 * Xato bo'lsa `null` qaytadi — kesim BEZAK, uning yo'qligi asosiy oqimni
 * to'xtatmasligi kerak. Ilova bunday holatda oddiy suratni ko'rsatadi.
 */
/**
 * Suratda haqiqiy shaffof fon bormi: alfa kanali bor VA to'rt burchagi
 * shaffof. Faqat `hasAlpha` yetmaydi — ba'zi PNG'larda alfa kanal bor,
 * lekin hamma piksel to'liq ko'rinadigan (oq fon).
 */
async function isAlreadyTransparent(input: Buffer): Promise<boolean> {
  try {
    const image = sharp(input);
    const meta = await image.metadata();
    if (!meta.hasAlpha || !meta.width || !meta.height) return false;

    const { data, info } = await image
      .ensureAlpha()
      .resize(32, 32, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number): number =>
      data[(y * info.width + x) * info.channels + 3] ?? 255;
    const last = info.width - 1;
    const mid = Math.floor(info.width / 2);

    /*
     * ⚠️ BURCHAK + CHET + MARKAZ. Avval faqat 4 burchak tekshirilardi.
     * `storeAvatarSheet` yon'dan kesgan panellarda burchaklar shaffof,
     * lekin figura o'rtasida QORA fon qolgan — shunday hol "shaffof"
     * deb hisoblanib, kesim o'tkazib yuborilardi. Endi 4 burchak PLUS
     * 4 chetkning o'rtasi shaffof bo'lishi KERAK, VA markaziy piksel
     * opaque bo'lsa — bu haqiqiy shaffof emas, kesim qilish kerak.
     */
    const corners = [
      alphaAt(0, 0),
      alphaAt(last, 0),
      alphaAt(0, last),
      alphaAt(last, last),
    ];
    const edges = [
      alphaAt(mid, 0),
      alphaAt(mid, last),
      alphaAt(0, mid),
      alphaAt(last, mid),
    ];
    const center = alphaAt(mid, mid);

    const bordersTransparent = [...corners, ...edges].every((a) => a < 16);
    const centerOpaque = center > 200;

    // Burchak + chetlar shaffof VA markaz opak bo'lsa — haqiqiy shaffof PNG
    // (figurali, atrofi bo'sh). Markaz ham shaffof bo'lsa — bu bo'sh rasm
    // yoki anomaliya, kesim qilib ham foydasi yo'q.
    return bordersTransparent && centerOpaque;
  } catch {
    return false;
  }
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
 * 1) RGB'ni alfa bo'yicha PREMULTIPLY qilish o'rniga, chekkalardagi qora
 *    piksellarning RGB'sini QO'SHNI opak piksellar rangiga almashtiramiz.
 *    Buning uchun: alfa<255 bo'lgan pikselga sharp'ning `extract channel`
 *    + `recomb` bilan, yoki oddiyroq — alfa>200 bo'lmasa, qo'shni
 *    opak pikselni ko'chiramiz.
 * 2) Alfa'ni yumshoq blur bilan silliqlaymiz (0.4px) — chekkalardagi
 *    stupeni yo'qoladi, silliq antialias chiziq paydo bo'ladi.
 * 3) Shu silliq alfani oraliqda normallashtiramiz: <40 → 0, >200 → 255,
 *    o'rtada — yumshoq ramp. Halo'ni yo'qolgan, chekka silliq.
 */
async function refineAlpha(input: Buffer): Promise<Buffer> {
  try {
    const base = sharp(input).ensureAlpha();
    const meta = await base.metadata();
    if (!meta.width || !meta.height) return input;

    const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels !== 4) return input;

    /*
     * 1) Chekkalardagi QORA piksel RGB'sini aniqlab, alfa>230 bo'lgan eng
     *    yaqin opak pikseldan (3x3 tagidan) ko'chiramiz. Bu halo'ning
     *    rangini o'zgartiradi — qora o'rniga teri/kiyim rangi bo'ladi.
     */
    const copy = Buffer.from(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = copy[i + 3]!;
        if (a >= 230 || a < 10) continue;
        const r = copy[i]!,
          g = copy[i + 1]!,
          b = copy[i + 2]!;
        if (r > 24 || g > 24 || b > 24) continue; // qora bo'lmasa qoldiramiz
        // 3x3 opak qo'shnini topamiz
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
    const rgbaBuffer = await sharp(data, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 0 })
      .toBuffer();

    const smoothed = await sharp(rgbaBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Alfa'ni ajratib blur qilamiz
    const alphaOnly = Buffer.alloc(width * height);
    for (let i = 0; i < width * height; i++) alphaOnly[i] = smoothed.data[i * 4 + 3]!;

    const blurredAlpha = await sharp(alphaOnly, {
      raw: { width, height, channels: 1 },
    })
      .blur(0.5)
      .raw()
      .toBuffer();

    // 3) Yangi alfa'ni ramp bilan normallashtirish va qaytarib qo'yish
    for (let i = 0; i < width * height; i++) {
      const a = blurredAlpha[i]!;
      let out: number;
      if (a < 40) out = 0;
      else if (a > 200) out = 255;
      else out = Math.round(((a - 40) / (200 - 40)) * 255);
      smoothed.data[i * 4 + 3] = out;
    }

    return await sharp(smoothed.data, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
  } catch {
    return input;
  }
}

export async function makeCutout(url: string, prefix: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const input = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';

    /*
     * ⚠️ `isAlreadyTransparent` SHORTCUT OLIB TASHLANDI (2026-11-09).
     *
     * Avval 4 burchak shaffof bo'lsa — rasm tayyor deb o'tkazib yuborilardi.
     * Operator rejimida `storeAvatarSheet` yon'dan kesgan panellarning
     * BURCHAKLARI SHAFFOF (bo'sh joy), lekin markazda FIGURA + QORA FON
     * qolgan. Shortcut shu holda ham `true` qaytarib, kesim qilmasdan
     * asl URL'ni cutout_url deb yozardi — mijoz ekranida qora to'rtburchak
     * ko'rinardi. Endi har doim Python/imgly ishlaydi — shaffof PNG ham
     * qayta ishlanadi, bu ~2-3s qo'shadi lekin natija har doim toza.
     */

    /*
     * ⚠️ PYTHON CUTOUT XIZMATI AVVAL (2026-11-09).
     * CUTOUT_URL sozlangan bo'lsa, `services/cutout-py` (rembg + isnet) ga
     * yuboramiz — chekkalari ancha silliq, qora halo yo'q. Xizmat yo'q
     * yoki javob bermasa, pastdagi `@imgly` fallback ishga tushadi, oqim
     * uzilmaydi.
     */
    const viaPy = await tryPythonCutout(input, contentType);
    if (viaPy) {
      return await uploadObject({
        key: `${prefix}/${randomUUID()}.png`,
        body: viaPy,
        contentType: 'image/png',
      });
    }

    const out = await removeBackground(new Blob([input], { type: contentType }), {
      publicPath: RESOURCE_PATH,
      model: 'medium',
      output: { format: 'image/png', quality: 1 },
    });

    const cleaned = await refineAlpha(Buffer.from(await out.arrayBuffer()));

    return await uploadObject({
      key: `${prefix}/${randomUUID()}.png`,
      body: cleaned,
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
