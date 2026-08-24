import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * `dist/_test/` → R2 `test/` : siqish sinovi nusxalari.
 *
 *   node assets-3d/generator/optimize.mjs --variants
 *   node assets-3d/generator/upload-test.mjs --apply
 *
 * ⚠️ NEGA CDN, TO'PLAM EMAS. Sinovning maqsadi — ishlab chiqarishdagi
 * YO'LNI tekshirish: tarmoqdan yuklab olish, `loader.parse` ga xom bayt
 * berish, dekoderni ishga tushirish. Modelni ilova to'plamiga qo'ysak
 * tarmoq qadamini butunlay o'tkazib yuborardik va sinov haqiqiy holatni
 * aks ettirmasdi (04-3d-pipeline §0).
 *
 * ⚠️ `test/` prefiksi — bu fayllar katalogga tushmaydi va `assets_3d`
 * jadvaliga ham yozilmaydi. Sinov tugagach ularni o'chirish mumkin.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist', '_test');
const REPO = join(ROOT, '..');

const APPLY = process.argv.includes('--apply');

const apiEnv = readFileSync(join(REPO, 'apps/api/.env'), 'utf8');
const env = (key) => apiEnv.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim();

const CDN = env('CDN_BASE_URL');
const BUCKET = env('R2_BUCKET_ASSETS');

const s3 = new S3Client({
  region: 'auto',
  endpoint: env('R2_ENDPOINT'),
  credentials: {
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  },
});

const files = readdirSync(DIST).filter((name) => name.endsWith('.glb'));
if (files.length === 0) {
  console.error('❌ dist/_test/ bo`sh — avval: node optimize.mjs --variants');
  process.exit(1);
}

console.log(`\n${APPLY ? '⚠️  BAJARILMOQDA' : 'REJA (--apply berilmagan)'}\n`);

for (const file of files) {
  const body = readFileSync(join(DIST, file));
  const key = `test/${file}`;

  if (APPLY) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'model/gltf-binary',
        /*
         * ⚠️ KESH QISQA — sinov fayllari qayta yasaladi. `immutable`
         * bo'lsa tuzatilgan nusxa qurilmaga yetmasdi va sinov eski
         * faylni o'lchardi (D-44 bilan bir xil tuzoq).
         */
        CacheControl: 'public, max-age=60',
      }),
    );
  }

  console.log(`  ${APPLY ? '↑' : '·'} ${key}  (${Math.round(body.length / 1024)} KB)`);
}

console.log(`\n${APPLY ? '✅' : 'Reja shu.'} Manzil: ${CDN}/test/<variant>.glb`);
if (!APPLY) console.log('Bajarish: node assets-3d/generator/upload-test.mjs --apply');
