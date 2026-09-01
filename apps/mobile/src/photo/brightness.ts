import * as FileSystem from 'expo-file-system';
// @ts-expect-error — jpeg-js/lib/decoder tip e'lonisiz; qaytishi quyida tiplanadi
import decodeJpeg from 'jpeg-js/lib/decoder';

import { base64ToBytes } from './base64';
import { MIN_BRIGHTNESS } from './faceQuality';

export { MIN_BRIGHTNESS };

/**
 * Suratning o'rtacha yorqinligini o'lchaydi (0…255).
 *
 * ⚠️ NEGA KERAK. Yuz nuqtalarini serverda `@vladmandic/human` aniqlaydi
 * (`faceShape.mjs`), lekin u QORONG'I suratda yuzni topa olmaydi.
 * Bazadagi ikki sinov selfisi o'lchandi: biri 30/255, ikkinchisi
 * **3/255** — deyarli qora kadr, unda yuz umuman ko'rinmaydi.
 *
 * Bunday surat jimgina yuklanadi, server yuzni topolmaydi va
 * `face_morphs` bo'sh qoladi. Foydalanuvchi esa skanerlaganini
 * ko'rgani uchun avatar o'zgarishini kutadi — sabab hech qayerda
 * ko'rinmaydi. Shu tekshiruv o'sha jim yo'qotishni oldini oladi.
 *
 * ⚠️ NEGA QURILMADA, SERVERDA EMAS. Server ham tekshirishi mumkin, lekin
 * javob kechikadi va foydalanuvchi allaqachon kameradan chiqib ketgan
 * bo'ladi. Bu yerda esa u darhol qayta suratga oladi.
 */

interface JpegDecoded {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Fayldagi JPEG suratning o'rtacha yorqinligini qaytaradi.
 * O'qib bo'lmasa `null` — bunda tekshiruv o'tkazib yuboriladi
 * (skanerni butunlay to'xtatib qo'yish noto'g'ri bo'lardi).
 */
export async function averageBrightness(uri: string): Promise<number | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { width, height, data } = decodeJpeg(base64ToBytes(base64), {
      useTArray: true,
    }) as JpegDecoded;

    /*
     * ⚠️ HAR PIKSEL EMAS, HAR 64-CHI. To'liq 4000×3000 surat 12 million
     * piksel — Hermes'da bu sezilarli pauza beradi. Yorqinlik esa
     * o'rtacha qiymat, unga namuna yetarli.
     */
    const step = 64 * 4;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += step) {
      // Yorqinlik — inson ko'zi sezgirligiga qarab tortilgan (Rec. 601)
      sum +=
        0.299 * (data[i] as number) +
        0.587 * (data[i + 1] as number) +
        0.114 * (data[i + 2] as number);
      count += 1;
    }

    if (count === 0 || width < 1 || height < 1) return null;
    return sum / count;
  } catch {
    return null;
  }
}
