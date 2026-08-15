import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PresignInput } from '@looksave/validation';

import { env } from '../config/env';
import { ApiError } from '../http/api-error';

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
};

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
      Bucket: env().R2_BUCKET_ASSETS,
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
 * Rasm URL'i bizning CDN'dan kelganini tekshirish.
 * Aks holda do'kon istalgan saytdagi rasmni ulab qo'yishi mumkin —
 * u sayt o'chsa katalogda bo'sh joy qoladi.
 */
export function isOwnCdnUrl(url: string): boolean {
  return url.startsWith(`${env().CDN_BASE_URL}/`);
}
