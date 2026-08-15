import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';

import { ANIMATION_NAMES, buildAnimation } from './lib/animations.mjs';
import { buildBody } from './lib/body.mjs';
import { buildGarment, CATALOG } from './lib/garments.mjs';
import { writeGlb } from './lib/glb.mjs';

/**
 * Barcha GLB modellarni yasaydi.
 *
 *   node assets-3d/generator/build.mjs
 *
 * Chiqish: `assets-3d/export/` — hujjatdagi papka tuzilishi bo'yicha
 * (04-3d-pipeline §4). Bu yerdagi fayllar XOM: Draco siqilmagan, LOD yo'q.
 * Optimizatsiya keyingi bosqichda `gltf-transform` bilan qilinadi.
 *
 * ⚠️ Bu fayllar Blender modellarining O'RNINI BOSMAYDI. Ular butun zanjirni
 * (CDN → yuklab olish → GLTFLoader → skelet → shape key → slot → kiyintirish)
 * haqiqiy model kelishidan oldin sinab ko'rish uchun. `assets-3d/README.md`
 * dagi 3-qadam aynan shuni talab qiladi.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'export');
const VERSION = 'v1';

/** Eksport uchun toza sahna — kamera va yorug'lik GLB ga tushmasin */
function sceneWith(object) {
  const scene = new THREE.Scene();
  scene.add(object);
  return scene;
}

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

const report = [];

async function emit(label, object, file) {
  const bytes = await writeGlb(sceneWith(object), join(OUT, file));
  const triangles = countTriangles(object);
  report.push({ model: label, fayl: file, KB: Math.round(bytes / 1024), uchburchak: triangles });
}

// ── Tana modellari ──
const bodies = {};

for (const gender of ['male', 'female']) {
  const body = buildBody(gender);
  bodies[gender] = body;
  await emit(`${gender} tana`, body.group, `${gender}-base-${VERSION}.glb`);
}

// ── Kiyimlar ──
// Erkak tanasining suyak o'rinlari asos qilib olinadi: ayol skeleti
// faqat yelka/son kengligida farq qiladi, kiyim esa shape key orqali
// moslashadi (04-3d-pipeline §3).
const at = bodies.male.at;
const manifest = [];

for (const spec of CATALOG) {
  const garment = buildGarment(spec, at);
  const file = `${spec.key}-${VERSION}.glb`;
  await emit(spec.key, garment, file);

  manifest.push({
    key: spec.key,
    file,
    slot: spec.slot,
    title: spec.title,
    colorName: spec.colorName,
    colorHex: spec.colorHex,
    hideBodyParts: spec.hideBodyParts,
    hasMorphs: true,
  });
}

// ── Animatsiya klip'lari ──
// Geometriyasiz: faqat skelet va treklar (04-3d-pipeline)
const animations = [];

for (const name of ANIMATION_NAMES) {
  const { scene, clip } = buildAnimation(name);
  const file = `anim/${name}-${VERSION}.glb`;

  const bytes = await writeGlb(scene, join(OUT, file), { animations: [clip] });
  report.push({
    model: `anim:${name}`,
    fayl: file,
    KB: Math.round(bytes / 1024),
    uchburchak: 0,
  });
  animations.push({ name, file });
}

// Manifest — yuklash skripti qaysi faylni qaysi slotga bog'lashni shundan biladi
mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, 'manifest.json'),
  `${JSON.stringify(
    { version: VERSION, bodies: ['male', 'female'], garments: manifest, animations },
    null,
    2,
  )}\n`,
);

console.table(report);
console.log(`\n✅ ${report.length} ta model → ${OUT}`);
console.log('   manifest.json — yuklash skripti uchun');
