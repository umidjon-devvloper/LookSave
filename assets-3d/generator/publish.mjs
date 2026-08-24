import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

/**
 * Yasalgan modellarni R2 ga yuklaydi va bazaga ulaydi.
 *
 *   node assets-3d/generator/publish.mjs            # nima bo'lishini ko'rsatadi
 *   node assets-3d/generator/publish.mjs --apply    # haqiqatan bajaradi
 *
 * ⚠️ `--apply` HAQIQIY R2 BUCKETGA YOZADI va bazani o'zgartiradi.
 * Bayroqsiz ishga tushirilsa hech narsaga tegmaydi — faqat rejani chizadi.
 *
 * NIMA QILADI:
 *   1. Tana GLB'larini `avatar/` ga yuklaydi. Manzil `getAvatarConfig`
 *      yasaydigan manzil bilan bir xil bo'lishi shart:
 *      `${CDN_BASE_URL}/avatar/${gender}-base-${AVATAR_SKELETON_VERSION}.glb`
 *   2. Kiyim GLB'larini `models/` ga yuklaydi.
 *   3. Har bir kiyim uchun product + variant + assets_3d qatorini yaratadi
 *      (yoki mavjudini yangilaydi) va `status = 'ready'` qo'yadi.
 *
 * NEGA `ready` MUHIM: `GET /tryon/slot/:slot` so'rovida `a.status = 'ready'`
 * sharti bor (apps/api/src/tryon/tryon.ts). Statussiz model ilovada
 * ko'rinmaydi — hozirgi bo'sh ro'yxatlarning sababi aynan shu.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = join(ROOT, 'export');
const REPO = join(ROOT, '..');

const APPLY = process.argv.includes('--apply');

// ── Sozlamalar ──
const apiEnv = readFileSync(join(REPO, 'apps/api/.env'), 'utf8');
const env = (key) => apiEnv.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim();

const CDN = env('CDN_BASE_URL');
const BUCKET = env('R2_BUCKET_ASSETS');
const SKELETON_VERSION = env('AVATAR_SKELETON_VERSION') ?? 'v1';

const manifest = JSON.parse(readFileSync(join(EXPORT, 'manifest.json'), 'utf8'));

if (manifest.version !== SKELETON_VERSION) {
  throw new Error(
    `Versiya mos emas: modellar "${manifest.version}", .env dagi AVATAR_SKELETON_VERSION "${SKELETON_VERSION}". ` +
      'Ikkalasi bir xil bo`lmasa ilova model manzilini topolmaydi.',
  );
}

/** Kiyim → kategoriya slug va narx (UZS) */
const PRODUCT_META = {
  tshirt: { slug: 'tshirt', price: 149000 },
  jacket: { slug: 'jacket', price: 690000 },
  pants: { slug: 'trousers', price: 320000 },
  sneakers: { slug: 'sneakers', price: 850000 },
  cap: { slug: 'cap', price: 120000 },
  watch: { slug: 'watch', price: 1450000 },
};

/** `tshirt-white` → `tshirt` */
const builderOf = (key) => key.replace(/-[^-]+$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: env('R2_ENDPOINT'),
  credentials: {
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  },
});

async function upload(file, key) {
  const path = join(EXPORT, file);
  const body = readFileSync(path);
  const size = statSync(path).size;

  /*
   * ⚠️ MAZMUN XESHI — MODEL YANGILANISHINING YAGONA YO'LI (12-tz.md D-44).
   *
   * Fayl nomi `-v1` da qotib qolgan, kesh esa uzoq va `immutable`:
   *   • CDN obyektni bir yil saqlaydi
   *   • ilova esa `cacheName(url)` — URL XESHIDAN diskda saqlaydi
   *     (`loader.ts`)
   *
   * Ya'ni geometriya o'zgarsa ham URL o'sha bo'lib qoladi va ilova ESKI
   * modelni ishlataveradi. Bu jim xato: yangi model yuklandi, foydalanuvchi
   * eskisini ko'radi va sabab hech qayerda ko'rinmaydi.
   *
   * Xesh `?v=` da beriladi, kalitga tegmaydi — shuning uchun qayta nomlash
   * ham, migratsiya ham kerak emas. `keyFromCdnUrl` (r2.ts) so'rov qismini
   * kesib tashlaydi, ya'ni o'chirish ham ishlaydi.
   */
  const version = createHash('sha256').update(body).digest('hex').slice(0, 8);

  if (APPLY) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'model/gltf-binary',
        // URL da mazmun xeshi bor (`?v=`), shuning uchun uzoq kesh xavfsiz
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  console.log(`  ${APPLY ? '↑' : '·'} ${key}  (${Math.round(size / 1024)} KB)`);
  return { url: `${CDN}/${key}?v=${version}`, size };
}

console.log(`\n${APPLY ? '⚠️  BAJARILMOQDA' : 'REJA (--apply berilmagan, hech narsa o`zgarmaydi)'}\n`);

// ── 1. Tana modellari ──
console.log('Tana modellari → avatar/');
for (const gender of manifest.bodies) {
  await upload(`${gender}-base-${manifest.version}.glb`, `avatar/${gender}-base-${SKELETON_VERSION}.glb`);
}

// ── 1b. Animatsiya klip'lari ──
// Manzil `getAvatarConfig` yasaydigani bilan bir xil: `avatar/anim/<nom>-<versiya>.glb`
console.log('\nAnimatsiya klip`lari → avatar/anim/');
for (const animation of manifest.animations ?? []) {
  await upload(animation.file, `avatar/anim/${animation.name}-${SKELETON_VERSION}.glb`);
}

// ── 2. Kiyim modellari ──
console.log('\nKiyim modellari → models/');
const uploaded = new Map();
for (const garment of manifest.garments) {
  uploaded.set(garment.key, await upload(garment.file, `models/${garment.file}`));
}

// ── 3. Baza ──
const pool = new pg.Pool({
  connectionString: readFileSync(join(REPO, 'apps/api/.env'), 'utf8').match(
    /^DATABASE_URL=(.*)$/m,
  )[1].trim(),
});

const one = async (sql, params = []) => (await pool.query(sql, params)).rows[0];

const store = await one(
  `SELECT id, currency FROM stores WHERE status = 'active' ORDER BY currency = 'UZS' DESC LIMIT 1`,
);
if (!store) throw new Error('Faol do`kon topilmadi');

console.log(`\nBaza — do'kon: ${store.id} (${store.currency})`);

const client = await pool.connect();
try {
  if (APPLY) await client.query('BEGIN');

  for (const garment of manifest.garments) {
    const meta = PRODUCT_META[builderOf(garment.key)];
    if (!meta) throw new Error(`Narx/kategoriya sozlanmagan: ${garment.key}`);

    const category = await one(`SELECT id FROM categories WHERE slug = $1`, [meta.slug]);
    if (!category) throw new Error(`Kategoriya topilmadi: ${meta.slug}`);

    const asset = uploaded.get(garment.key);

    if (!APPLY) {
      console.log(
        `  · ${garment.title} (${garment.colorName}) → slot ${garment.slot}, ${meta.price} ${store.currency}`,
      );
      continue;
    }

    /*
     * Idempotent: skript ikki marta ishga tushsa yangi mahsulot yasamaydi.
     * Kalit — sarlavha + do'kon + slot. `tags` ga generator belgisi
     * qo'yiladi, keyin kerak bo'lsa shular bo'yicha topib o'chirsa bo'ladi.
     */
    const existing = await one(
      `SELECT id FROM products WHERE store_id = $1 AND title = $2 AND slot = $3`,
      [store.id, garment.title, garment.slot],
    );

    const product =
      existing ??
      (await one(
        `INSERT INTO products (store_id, category_id, title, slot, gender, base_price,
                               currency, status, has_3d, tags, description)
         VALUES ($1, $2, $3, $4, 'unisex', $5, $6, 'active', true, ARRAY['generated'], $7)
         RETURNING id`,
        [
          store.id,
          category.id,
          garment.title,
          garment.slot,
          meta.price,
          store.currency,
          'Generator yasagan sinov modeli (assets-3d/generator)',
        ],
      ));

    await client.query(`UPDATE products SET has_3d = true, status = 'active' WHERE id = $1`, [
      product.id,
    ]);

    const colorName = { uz: garment.colorName, ru: garment.colorName, en: garment.colorName };

    const existingVariant = await one(
      `SELECT id FROM product_variants WHERE product_id = $1 AND color_hex = $2`,
      [product.id, garment.colorHex],
    );

    const variant =
      existingVariant ??
      (await one(
        `INSERT INTO product_variants (product_id, color_hex, color_name)
         VALUES ($1, $2, $3) RETURNING id`,
        [product.id, garment.colorHex, JSON.stringify(colorName)],
      ));

    await client.query(
      `INSERT INTO assets_3d (variant_id, glb_url, file_size_bytes, hide_body_parts,
                              has_morphs, status, completed_at)
       VALUES ($1, $2, $3, $4, true, 'ready', now())
       ON CONFLICT (variant_id) DO UPDATE
         SET glb_url = EXCLUDED.glb_url,
             file_size_bytes = EXCLUDED.file_size_bytes,
             hide_body_parts = EXCLUDED.hide_body_parts,
             has_morphs = true,
             status = 'ready',
             error_message = NULL,
             completed_at = now()`,
      [variant.id, asset.url, asset.size, garment.hideBodyParts],
    );

    console.log(`  ✓ ${garment.title} (${garment.colorName}) → ${garment.slot}`);
  }

  if (APPLY) await client.query('COMMIT');
} catch (error) {
  if (APPLY) await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}

console.log(
  APPLY
    ? '\n✅ Yuklandi va bazaga ulandi'
    : '\nReja shu. Bajarish uchun: node assets-3d/generator/publish.mjs --apply',
);
