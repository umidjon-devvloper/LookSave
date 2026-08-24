import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, draco, meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

/**
 * `export/` → `dist/` : LOD'lar, siqish va thumbnail (04-3d-pipeline §7).
 *
 *   node assets-3d/generator/optimize.mjs                 # siqishsiz
 *   node assets-3d/generator/optimize.mjs --compress=draco
 *   node assets-3d/generator/optimize.mjs --compress=meshopt
 *   node assets-3d/generator/optimize.mjs --variants       # sinov nusxalari
 *
 * ⚠️ SUKUT BO'YICHA SIQISH YO'Q — ATAYLAB. Hujjat §0 aytadi: Draco va KTX2
 * `WASM` dekoderiga tayanadi, Hermes'da esa `WebAssembly` yo'q. Ya'ni
 * siqilgan model **qurilmada ochilmasligi mumkin** va buni 100 ta model
 * yasagandan keyin bilib qolish — hammasini qayta qilish.
 *
 * Shuning uchun tartib: `--variants` bilan sinov nusxalarini yasang,
 * qurilmada `/compression-test` ekranida sinang, keyin ISHLAGANINI
 * `--compress=` ga bering. Natijalar hujjatga yoziladi (§0).
 *
 * ⚠️ THUMBNAIL — VAQTINCHA RANG NAMUNASI. Haqiqiy thumbnail modelni
 * chizishni talab qiladi (headless GL), bu esa alohida ish. Hozircha
 * `manifest.json` dagi `colorHex` dan 256×256 kvadrat yasaladi: QA
 * ro'yxati `thumb.webp` mavjudligini talab qiladi va bo'sh joydan ko'ra
 * rang foydali.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'export');
const DIST = join(HERE, '..', 'dist');

const args = process.argv.slice(2);
const compress = (args.find((a) => a.startsWith('--compress='))?.split('=')[1] ?? 'none');
const wantVariants = args.includes('--variants');

if (!['none', 'draco', 'meshopt'].includes(compress)) {
  console.error(`❌ --compress= faqat none | draco | meshopt bo'ladi (berilgani: ${compress})`);
  process.exit(1);
}

/** QA ro'yxati chegarasi (04-3d-pipeline §6). */
const LOD0_LIMIT_KB = 1536;

const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));

const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression, EXTMeshoptCompression])
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptEncoder,
  });

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

/** Siqish bosqichi — `none` da hech narsa qo'shilmaydi. */
function compressionSteps(method) {
  if (method === 'draco') return [draco({ method: 'edgebreaker' })];
  if (method === 'meshopt') return [meshopt({ encoder: MeshoptEncoder })];
  return [];
}

/**
 * ⚠️ `simplify` `weld` NI TALAB QILADI. Kesimlardan qurilgan sirtda
 * qo'shni uchburchaklar vertekslarni bo'lishmaydi (har biri o'z nusxasi
 * bilan keladi), va soddalashtirish bunday to'rda hech narsa qilmaydi —
 * xato ham bermaydi, shunchaki bir xil poligon soni qaytadi.
 */
async function lod(document, ratio) {
  if (ratio < 1) {
    await document.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: ratio < 0.3 ? 0.02 : 0.01 }),
    );
  }
  return document;
}

function triangles(document) {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      count += indices ? indices.getCount() / 3 : 0;
    }
  }
  return Math.round(count);
}

async function writeLod(name, bytes, ratio, method) {
  const document = await io.readBinary(bytes);
  await document.transform(prune(), dedup());
  await lod(document, ratio);
  if (method !== 'none') await document.transform(...compressionSteps(method));

  const out = await io.writeBinary(document);
  return { bytes: out, tris: triangles(document) };
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const rows = [];
let overLimit = 0;

for (const garment of manifest.garments) {
  const source = join(OUT, garment.file);
  if (!existsSync(source)) {
    console.warn(`   ⚠️  ${garment.file} topilmadi`);
    continue;
  }

  const raw = readFileSync(source);
  const name = garment.file.replace(/\.glb$/, '');
  const dir = join(DIST, name);
  mkdirSync(dir, { recursive: true });

  const levels = [
    ['lod0', 1],
    ['lod1', 0.5],
    ['lod2', 0.25],
  ];

  const sizes = {};
  for (const [level, ratio] of levels) {
    const { bytes, tris } = await writeLod(name, raw, ratio, compress);
    writeFileSync(join(dir, `${level}.glb`), bytes);
    sizes[level] = { kb: Math.round(bytes.length / 1024), tris };
  }

  // Rang namunasi — haqiqiy render emas (yuqoridagi izoh)
  const hex = garment.colorHex ?? '#8B5CF6';
  await sharp({
    create: { width: 256, height: 256, channels: 3, background: hex },
  })
    .webp({ quality: 85 })
    .toFile(join(dir, 'thumb.webp'));

  if (sizes.lod0.kb > LOD0_LIMIT_KB) overLimit += 1;
  rows.push({ nom: name, ...sizes });
}

console.log(`\nSiqish: ${compress}\n`);
console.table(
  rows.map((row) => ({
    model: row.nom,
    'lod0 KB': row.lod0.kb,
    'lod0 tri': row.lod0.tris,
    'lod1 KB': row.lod1.kb,
    'lod1 tri': row.lod1.tris,
    'lod2 KB': row.lod2.kb,
    'lod2 tri': row.lod2.tris,
  })),
);

// ── Sinov nusxalari ────────────────────────────────────────────────────
/*
 * ⚠️ BITTA MODELDAN BARCHA VARIANT. Qurilmada sinash uchun bir xil
 * geometriyaning turli siqishdagi nusxalari kerak: farq faqat siqishda
 * bo'lsa, yiqilish sababi ham aniq bo'ladi.
 */
if (wantVariants) {
  const base = manifest.garments.find((g) => g.key === 'tshirt-white') ?? manifest.garments[0];
  const raw = readFileSync(join(OUT, base.file));
  const dir = join(DIST, '_test');
  mkdirSync(dir, { recursive: true });

  const variants = [
    ['plain', 'none'],
    ['draco', 'draco'],
    ['meshopt', 'meshopt'],
  ];

  console.log('\nSinov nusxalari → dist/_test/');
  const testRows = [];

  for (const [label, method] of variants) {
    try {
      const { bytes, tris } = await writeLod(label, raw, 1, method);
      writeFileSync(join(dir, `${label}.glb`), bytes);
      testRows.push({ variant: label, KB: Math.round(bytes.length / 1024), tri: tris });
    } catch (error) {
      testRows.push({ variant: label, KB: '—', tri: `❌ ${error.message.slice(0, 40)}` });
    }
  }

  console.table(testRows);
  console.log('Qurilmada sinash: ilovada `/compression-test` ekranini ochingv');
}

console.log(
  overLimit === 0
    ? `\n✅ ${rows.length} ta model → dist/ · barcha lod0 ≤ ${LOD0_LIMIT_KB} KB`
    : `\n⚠️  ${overLimit} ta model lod0 chegarasidan (${LOD0_LIMIT_KB} KB) oshdi`,
);
