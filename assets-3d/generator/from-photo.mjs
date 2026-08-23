import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import sharp from 'sharp';
import * as THREE from 'three';

import { makeAt, readAdoptedBones } from './lib/adoptedSkeleton.mjs';
import { buildBody } from './lib/body.mjs';
import { loadBodyParts, shellFromMeshes } from './lib/bodyShell.mjs';
import { buildGarment, CATALOG } from './lib/garments.mjs';
import { writeGlb } from './lib/glb.mjs';

/**
 * Sotuvchi suratidan 3D model yasaydi va navbatni bo'shatadi.
 *
 *   node assets-3d/generator/from-photo.mjs            # rejani ko'rsatadi
 *   node assets-3d/generator/from-photo.mjs --apply    # bajaradi
 *
 * ⚠️ NEGA "PROTSEDURAL ASOS": suratdan to'g'ridan-to'g'ri mesh yasaydigan
 * xizmatlar (Meshy, Tripo) YOPIQ BUYUM qaytaradi — u tanaga moslanmagan,
 * `mt_*` shape key'i yo'q, o'lchami va joyi tasodifiy. Ilova esa kiyimni
 * avatar bilan bitta fazoda va o'lcham morflari bilan kutadi, aks holda
 * kiyim tanadan chetda osilib qoladi.
 *
 * Shuning uchun geometriya TANADAN quriladi (moslik va morflar kafolatli),
 * surat esa RANGNI beradi. Natija — to'g'ri kesim va to'g'ri rangdagi toza
 * model. Realistik nusxa kerak bo'lsa, admin panelidagi "yaxshilash"
 * bosqichi tashqi xizmatga yuboradi (2-bosqich).
 *
 * Ilova ishlashi uchun kerak bo'lgan yagona narsa — `status = 'ready'` va
 * `glb_url` (`GET /tryon/slot/:slot` shu shart bilan tanlaydi).
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = join(ROOT, 'export');
const REPO = join(ROOT, '..');
const VERSION = 'v1';

const APPLY = process.argv.includes('--apply');

const apiEnv = readFileSync(join(REPO, 'apps/api/.env'), 'utf8');
const env = (key) => apiEnv.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim();

const CDN = env('CDN_BASE_URL');
const BUCKET = env('R2_BUCKET_ASSETS');

/** Slot → qaysi kiyim qolipi quriladi. Katalogdagi qoliplar bilan bir xil. */
const BUILDER_FOR_SLOT = {
  top: 'tshirt',
  outer: 'jacket',
  bottom: 'pants',
  feet: 'sneakers',
  head: 'cap',
  wrist: 'watch',
};

/** Qolip uchun `hideBodyParts` — katalogdagi tayyor qiymatdan olinadi. */
function hiddenFor(builder) {
  const sample = CATALOG.find((item) => item.builder === builder);
  return sample?.hideBodyParts ?? [];
}

/**
 * Suratdan asosiy rangni oladi.
 *
 * ⚠️ MARKAZIY QISM OLINADI VA OCH PIKSELLAR TASHLANADI. Mahsulot surati
 * deyarli har doim oq studiya fonida bo'ladi; butun kadrning o'rtachasi
 * olinsa har kiyim oqish-kulrang bo'lib chiqadi. Markazda kiyimning o'zi
 * turadi, fon esa chetda qoladi.
 */
async function dominantColour(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`surat yuklanmadi: HTTP ${response.status}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  const image = sharp(bytes).removeAlpha();
  const { width, height } = await image.metadata();

  const side = Math.max(8, Math.round(Math.min(width, height) * 0.5));
  const { data } = await image
    .extract({
      left: Math.round((width - side) / 2),
      top: Math.round((height - side) / 2),
      width: side,
      height: side,
    })
    .resize(32, 32, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0;
  let g = 0;
  let b = 0;
  let counted = 0;

  for (let i = 0; i < data.length; i += 3) {
    const [pr, pg_, pb] = [data[i], data[i + 1], data[i + 2]];
    // Deyarli oq — fon; deyarli qora — soya. Ikkalasi ham rangni buzadi.
    const light = (pr + pg_ + pb) / 3;
    if (light > 238 || light < 14) continue;

    r += pr;
    g += pg_;
    b += pb;
    counted += 1;
  }

  // Hamma piksel tashlab yuborilgan bo'lsa (masalan sof oq kiyim) —
  // o'rtacha kulrang, chunki rangsiz qoldirgandan ko'ra shu yaxshiroq
  if (counted === 0) return 0xd8d8de;

  const to = (value) => Math.round(value / counted);
  return (to(r) << 16) | (to(g) << 8) | to(b);
}

const hex = (value) => `#${value.toString(16).padStart(6, '0').toUpperCase()}`;

/** Nom ko'p tilli bo'lishi mumkin (`{uz, ru}`) — o'qiladigan qatorga keltiramiz. */
function readable(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const first = value.uz ?? value.ru ?? value.en ?? Object.values(value)[0];
    if (typeof first === 'string') return first;
  }
  return null;
}

function firstImage(images) {
  if (!Array.isArray(images)) return null;
  const first = images[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') return first.url ?? first.src ?? null;
  return null;
}

// ── Kiyim quruvchi ──
// `build.mjs` dagi sozlash bilan bir xil: suyak o'rinlari tashqi tanadan,
// qobiq esa tananing o'z sirtidan.
const bodyFile = join(EXPORT, `male-base-${VERSION}.glb`);
const at = makeAt(readAdoptedBones(bodyFile), buildBody('male').at);
const bodyParts = await loadBodyParts(bodyFile);

const shell = (names, options) =>
  shellFromMeshes(
    names.map((name) => {
      const geometry = bodyParts.get(name);
      if (!geometry) throw new Error(`Tana qismi topilmadi: ${name}`);
      return geometry;
    }),
    options,
  );

function countTriangles(object) {
  let total = 0;
  object.traverse((child) => {
    const geometry = child.geometry;
    if (!geometry?.attributes?.position) return;
    total += geometry.index
      ? geometry.index.count / 3
      : geometry.attributes.position.count / 3;
  });
  return Math.round(total);
}

// ── Navbat ──
const pool = new pg.Pool({ connectionString: env('DATABASE_URL') });

const { rows } = await pool.query(
  `SELECT a.id, a.variant_id,
          v.color_hex, v.color_name, v.images AS variant_images,
          p.title, p.images AS product_images,
          COALESCE(p.slot, c.slot) AS slot
     FROM assets_3d a
     JOIN product_variants v ON v.id = a.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN categories c ON c.id = p.category_id
    WHERE a.status = 'queued'
    ORDER BY a.requested_at`,
);

if (rows.length === 0) {
  console.log("Navbat bo'sh — yasaladigan model yo'q.");
  await pool.end();
  process.exit(0);
}

console.log(`Navbatda ${rows.length} ta variant${APPLY ? '' : '  (quruq yurish)'}\n`);

const client = new S3Client({
  region: 'auto',
  endpoint: env('R2_ENDPOINT'),
  credentials: {
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  },
});

const temp = mkdtempSync(join(tmpdir(), 'looksave-3d-'));
let done = 0;
let failed = 0;

for (const row of rows) {
  const builder = BUILDER_FOR_SLOT[row.slot];
  const label = `${readable(row.title) ?? 'nomsiz'} (${readable(row.color_name) ?? 'rangsiz'})`;

  if (!builder) {
    console.log(`  ✗ ${label}: slot "${row.slot ?? "yo'q"}" uchun qolip yo'q`);
    failed += 1;

    if (APPLY) {
      await pool.query(
        `UPDATE assets_3d SET status = 'failed', error_message = $2 WHERE id = $1`,
        [row.id, `slot "${row.slot ?? "yo'q"}" uchun 3D qolip yo'q`],
      );
    }
    continue;
  }

  try {
    // Sotuvchi rangni ko'rsatgan bo'lsa o'sha ishonchliroq — surat
    // yoritilishiga qarab o'zgaradi, kiritilgan qiymat esa aniq
    let colour;
    let source;

    if (typeof row.color_hex === 'string' && /^#?[0-9a-f]{6}$/i.test(row.color_hex)) {
      colour = parseInt(row.color_hex.replace('#', ''), 16);
      source = 'variant rangi';
    } else {
      const photo = firstImage(row.variant_images) ?? firstImage(row.product_images);
      if (!photo) throw new Error('na rang, na surat bor');
      colour = await dominantColour(photo);
      source = 'suratdan';
    }

    const spec = {
      key: `auto-${row.variant_id}`,
      builder,
      slot: row.slot,
      color: colour,
      hideBodyParts: hiddenFor(builder),
    };

    const garment = buildGarment(spec, at, shell);
    const scene = new THREE.Scene();
    scene.add(garment);

    const file = `models/auto/${row.variant_id}-${VERSION}.glb`;
    const path = join(temp, `${row.variant_id}.glb`);
    const size = await writeGlb(scene, path);
    const triangles = countTriangles(garment);

    console.log(
      `  ${APPLY ? '↑' : '·'} ${label} → ${builder}, ${hex(colour)} (${source}), ` +
        `${Math.round(size / 1024)} KB, ${triangles} uchburchak`,
    );

    if (APPLY) {
      await client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: file,
          Body: readFileSync(path),
          ContentType: 'model/gltf-binary',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      await pool.query(
        `UPDATE assets_3d
            SET glb_url = $2, poly_count = $3, file_size_bytes = $4,
                hide_body_parts = $5, has_morphs = true,
                status = 'ready', completed_at = now(), error_message = NULL
          WHERE id = $1`,
        [row.id, `${CDN}/${file}`, triangles, size, spec.hideBodyParts],
      );
    }

    done += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${label}: ${message}`);

    if (APPLY) {
      await pool.query(
        `UPDATE assets_3d SET status = 'failed', error_message = $2 WHERE id = $1`,
        [row.id, message.slice(0, 500)],
      );
    }
  }
}

rmSync(temp, { recursive: true, force: true });
await pool.end();

console.log(
  `\n${APPLY ? '✅' : 'Reja:'} ${done} ta yasaldi, ${failed} ta xato` +
    (APPLY ? '' : '\nBajarish uchun: node assets-3d/generator/from-photo.mjs --apply'),
);
