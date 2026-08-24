import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PresignInput } from '@looksave/validation';

import { env } from '../config/env';
import { ApiError } from '../http/api-error';
import { logger } from '../logger';

/**
 * Cloudflare R2 — imzolangan yuklash havolasi (09-integrations §4.2).
 *
 * Fayl to'g'ridan-to'g'ri R2 ga boradi, VPS orqali o'tmaydi:
 * bitta 5 MB rasm ham server kanalini band qilmaydi.
 *
 * R2 tanlangan sababi — egress bepul (K-03). 3D modellar og'ir va
 * doim yuklanadi; S3 da trafik hisobi tez o'sadi.
 */

let client: S3Client | null = null;

function r2(): S3Client {
  if (!env().R2_ACCESS_KEY_ID || !env().R2_SECRET_ACCESS_KEY || !env().R2_ENDPOINT) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'Fayl saqlash sozlanmagan');
  }

  client ??= new S3Client({
    region: 'auto',
    endpoint: env().R2_ENDPOINT,
    credentials: {
      accessKeyId: env().R2_ACCESS_KEY_ID,
      secretAccessKey: env().R2_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

/**
 * Kesh sarlavhalari (09-integrations §4.4).
 * `immutable` — rasm hech qachon o'zgarmaydi, o'zgarsa yangi UUID beriladi.
 * Shu sabab brauzer va CDN uni bir yil saqlaydi, R2 trafigi kamayadi.
 */
const CACHE_CONTROL: Record<PresignInput['purpose'], string> = {
  product: 'public, max-age=31536000, immutable',
  store: 'public, max-age=86400',
  face: 'private, max-age=3600',
  // Profil surati almashtirilganda yangi UUID beriladi — eskisi keshda qolsa ham zarari yo'q
  avatar: 'public, max-age=31536000, immutable',
  /*
   * To'liq bo'yli surat — `face` bilan bir xil qoidada.
   *
   * ⚠️ `private`: bu odamning butun gavdasi va u faqat o'ziga ko'rinishi
   * kerak. `public` bo'lsa CDN uni chetdagi so'rovga ham berardi — havolani
   * bilgan har kim ocha olardi.
   */
  body: 'private, max-age=3600',
};

/**
 * Shaxsiy maqsadlar — ular ALOHIDA bucketga boradi.
 *
 * ⚠️ `avatar` BU RO'YXATDA YO'Q va bu ataylab: profil surati
 * foydalanuvchi o'zi ko'rsatish uchun qo'yadigan rasm, u ro'yxatlarda va
 * do'kon panelida ko'rinishi kerak. `face` va `body` esa faqat egasiga
 * va kiyintirish provayderiga.
 */
const PRIVATE_PURPOSES = new Set<PresignInput['purpose']>(['face', 'body']);

/** Shaxsiy bucket sozlanganmi. */
export function hasPrivateBucket(): boolean {
  return env().R2_BUCKET_PRIVATE.length > 0;
}

/**
 * Obyekt qaysi bucketga tushishi.
 *
 * Shaxsiy bucket sozlanmagan bo'lsa hammasi eskicha `R2_BUCKET_ASSETS` ga
 * boradi — ya'ni sozlash tugamaguncha hech narsa buzilmaydi.
 */
function bucketFor(purpose: PresignInput['purpose']): string {
  if (PRIVATE_PURPOSES.has(purpose) && hasPrivateBucket()) {
    return env().R2_BUCKET_PRIVATE;
  }
  return env().R2_BUCKET_ASSETS;
}

/**
 * Kalit shaxsiy prefiksdami.
 *
 * ⚠️ PREFIKS — YAGONA BELGI. Bazada to'liq havola saqlanadi va u qaysi
 * bucketda ekanini aytmaydi. Kalit esa aytadi: `presignUpload` uni
 * `${purpose}/...` ko'rinishida yasaydi. Shu sabab prefiks nomlari maqsad
 * nomlari bilan bir xil bo'lishi SHART.
 */
export function isPrivateKey(key: string): boolean {
  const prefix = key.split('/')[0];
  return prefix !== undefined && PRIVATE_PURPOSES.has(prefix as PresignInput['purpose']);
}

const EXTENSIONS: Record<PresignInput['contentType'], string> = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
  /**
   * PUT so'rovida AYNAN shu sarlavhalar yuborilishi kerak.
   *
   * ⚠️ Imzolangan URL'da `SignedHeaders=host` — ya'ni `Content-Type` va
   * `Cache-Control` imzoga kirmaydi. Ular so'rovda yuborilmasa, R2 obyektni
   * sarlavhasiz saqlaydi va CDN keshi ishlamaydi (rasm har safar R2 dan
   * qayta yuklanadi). Buni oldindan aytmasak, panel `Cache-Control` ni
   * yubormaydi va muammo faqat trafik hisobida ko'rinadi.
   */
  headers: Record<string, string>;
}

export async function presignUpload(input: PresignInput): Promise<PresignResult> {
  // Kengaytma fayl nomidan emas, MIME turidan olinadi — foydalanuvchi
  // `shoe.php` deb yuborsa ham `.webp` bo'lib saqlanadi
  const fromName = extname(input.fileName).toLowerCase();
  const extension = EXTENSIONS[input.contentType] ?? (fromName === '.jpeg' ? '.jpg' : '.webp');

  const key = `${input.purpose}/${randomUUID()}${extension}`;
  const expiresIn = 900;

  const uploadUrl = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucketFor(input.purpose),
      Key: key,
      ContentType: input.contentType,
      CacheControl: CACHE_CONTROL[input.purpose],
    }),
    { expiresIn },
  );

  return {
    uploadUrl,
    publicUrl: `${env().CDN_BASE_URL}/${key}`,
    key,
    expiresIn,
    headers: {
      'Content-Type': input.contentType,
      'Cache-Control': CACHE_CONTROL[input.purpose],
    },
  };
}

/**
 * Faylni SERVER tomonidan yozadi va ochiq havolasini qaytaradi.
 *
 * ⚠️ NEGA `presignUpload` YETMAYDI: u brauzer yoki ilova faylni o'zi
 * yuborishi uchun. Bu yerda esa fayl serverning qo'lida — AI provayderidan
 * yuklab olingan natija. Uni imzolangan havola bilan qaytadan o'zimizga
 * yuborish ortiqcha qadam bo'lardi.
 *
 * Kesh `immutable`: kalitda tasodifiy UUID bor, ya'ni bu manzildagi rasm
 * hech qachon o'zgarmaydi.
 */
export async function uploadObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  await r2().send(
    new PutObjectCommand({
      Bucket: env().R2_BUCKET_ASSETS,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return `${env().CDN_BASE_URL}/${input.key}`;
}

/**
 * Obyektni R2 dan butunlay o'chirish.
 *
 * ⚠️ NEGA KERAK: ilgari hech qayerda o'chirish yo'q edi. Foydalanuvchi
 * yuz suratini olib tashlaganda yoki akkauntini o'chirganda bazadagi
 * havola tozalanardi, LEKIN faylning o'zi bucketda qolib ketardi va
 * ochiq manzilda o'qilaveradi. Ya'ni "o'chirdim" degan tugma
 * ma'lumotni o'chirmasdi.
 *
 * ⚠️ YO'QLIGI XATO EMAS. Fayl allaqachon o'chirilgan bo'lishi mumkin
 * (takroriy chaqiruv, qo'lda tozalash). S3 `DeleteObject` yo'q obyekt
 * uchun ham muvaffaqiyat qaytaradi — biz ham shu mantiqni saqlaymiz:
 * maqsad "fayl yo'q bo'lsin", "men uni o'chirdim" emas.
 */
export async function deleteObject(key: string): Promise<void> {
  /*
   * Bucket kalit prefiksidan aniqlanadi. Aks holda shaxsiy fayl ochiq
   * bucketda qidirilardi va "yo'q" deb hisoblanardi — `DeleteObject`
   * yo'q obyekt uchun ham muvaffaqiyat qaytaradi, ya'ni xato ham
   * ko'rinmasdi va fayl joyida qolaverardi.
   */
  const bucket =
    isPrivateKey(key) && hasPrivateBucket() ? env().R2_BUCKET_PRIVATE : env().R2_BUCKET_ASSETS;

  await r2().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * CDN havolasidan bucket kalitini ajratib olish.
 *
 * Bazada to'liq manzil saqlanadi (`https://cdn…/avatar/uuid.jpg`), R2 esa
 * kalit kutadi (`avatar/uuid.jpg`). Boshqa domendan kelgan havola uchun
 * `null` qaytadi — begona saytdagi faylni o'chirishga urinmaymiz.
 */
export function keyFromCdnUrl(url: string): string | null {
  if (!isOwnCdnUrl(url)) return null;
  const key = url.slice(`${env().CDN_BASE_URL}/`.length);
  // So'rov qismi bo'lsa kesiladi — kalitda `?` bo'lmaydi
  return key.split('?')[0] || null;
}

/**
 * Havola bo'yicha o'chirish — chaqiruvchi kalitni bilishi shart emas.
 *
 * Xato YUTILADI va faqat logga yoziladi. Sabab: bu doim biror asosiy
 * amalning yonida turadi (profil yangilash, akkaunt anonimlashtirish).
 * R2 javob bermagani uchun butun amal yiqilsa, foydalanuvchi "o'chirib
 * bo'lmadi" degan xato oladi — holbuki bazadagi havola allaqachon
 * tozalangan va u uchun ma'lumot ko'rinmaydi.
 */
export async function deleteByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const key = keyFromCdnUrl(url);
  if (!key) return;

  try {
    await deleteObject(key);
  } catch (error) {
    logger.warn({ err: error, key }, 'R2 obyektini o`chirib bo`lmadi');
  }
}

/**
 * Shaxsiy obyekt uchun VAQTINCHALIK o'qish havolasi.
 *
 * ⚠️ NEGA KERAK. Shaxsiy bucketning ommaviy manzili yo'q, ya'ni bazada
 * saqlangan `${CDN_BASE_URL}/face/…` havolasi u yerda ochilmaydi. O'qish
 * faqat imzolangan havola bilan bo'ladi.
 *
 * ⚠️ HAVOLA BAZAGA YOZILMAYDI. U muddatli va tez eskiradi; saqlangani
 * bir kundan keyin ishlamay qolardi va sabab tashqaridan ko'rinmasdi.
 * Bazada doim KANONIK havola turadi, imzo esa har o'qishda yasaladi.
 *
 * Shaxsiy bucket sozlanmagan yoki kalit shaxsiy emas bo'lsa havola
 * O'ZGARISHSIZ qaytadi — ya'ni bu funksiyani hamma joyda xavfsiz
 * chaqirish mumkin.
 *
 * `expiresIn` — 1 soat. Ko'rsatish uchun ham, provayder ishi uchun ham
 * (5–17 soniya) yetarli, lekin havola tarqalsa umrboqiy bo'lmaydi.
 */
export async function presignRead(
  url: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!url) return null;

  const key = keyFromCdnUrl(url);
  if (!key || !isPrivateKey(key) || !hasPrivateBucket()) return url;

  try {
    return await getSignedUrl(
      r2(),
      new GetObjectCommand({ Bucket: env().R2_BUCKET_PRIVATE, Key: key }),
      { expiresIn },
    );
  } catch (error) {
    /*
     * Imzo yasalmasa havolani O'ZGARISHSIZ qaytaramiz. Sabab: `null`
     * qaytarsak ekranda "surat yo'q" bo'lib ko'rinardi — holbuki surat
     * bor va muammo faqat imzolashda. Eski (ochiq bucketdagi) fayllar
     * uchun esa bu havola baribir ishlaydi.
     */
    logger.warn({ err: error, key }, 'imzolangan o`qish havolasi yasalmadi');
    return url;
  }
}

/**
 * Rasm URL'i bizning CDN'dan kelganini tekshirish.
 * Aks holda do'kon istalgan saytdagi rasmni ulab qo'yishi mumkin —
 * u sayt o'chsa katalogda bo'sh joy qoladi.
 */
export function isOwnCdnUrl(url: string): boolean {
  return url.startsWith(`${env().CDN_BASE_URL}/`);
}
