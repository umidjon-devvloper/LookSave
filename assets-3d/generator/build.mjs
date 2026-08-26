import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';

import { makeAt, readAdoptedBones } from './lib/adoptedSkeleton.mjs';
import { buildNormalAtlas, loadBodyParts, shellFromMeshes } from './lib/bodyShell.mjs';
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
/*
 * Tashqi modeldan kelgan tanaga TEGILMAYDI. `adopt.mjs` uni `adopted.json`
 * ga belgilaydi — belgisiz protsedural tana yasaladi, belgi bo'lsa mavjud
 * fayl saqlanadi. Aks holda haqiqiy model jimgina qayta yozilib ketardi.
 */
const markerFile = join(OUT, 'adopted.json');
const adopted = existsSync(markerFile) ? JSON.parse(readFileSync(markerFile, 'utf8')) : {};

const bodies = {};

for (const gender of ['male', 'female']) {
  if (adopted[gender]) {
    console.log(`   ${gender}: tashqi model saqlandi (${adopted[gender].source}) — qayta yasalmadi`);
    continue;
  }
  const body = buildBody(gender);
  bodies[gender] = body;
  await emit(`${gender} tana`, body.group, `${gender}-base-${VERSION}.glb`);
}

// ── Kiyimlar ──
// Erkak tanasining suyak o'rinlari asos qilib olinadi: ayol skeleti
// faqat yelka/son kengligida farq qiladi, kiyim esa shape key orqali
// moslashadi (04-3d-pipeline §3).
// Kiyim geometriyasi uchun suyak o'rinlari kerak — ular skeletdan,
// tana mesh'idan emas.
//
// ⚠️ TANA TASHQI BO'LSA, SUYAKLAR HAM O'SHA MODELDAN OLINADI. Protsedural
// skeletning bind pozasi tashqi modelnikidan farq qiladi (qo'llar ~12° va
// ~45°), va kiyim noto'g'ri skelet bo'yicha yasalsa hech qanday xato
// chiqmaydi — u shunchaki tanadan chetda osilib qoladi.
const fallbackAt = (bodies.male ?? buildBody('male')).at;
const adoptedMale = join(OUT, `male-base-${VERSION}.glb`);

const at =
  adopted.male && existsSync(adoptedMale)
    ? makeAt(readAdoptedBones(adoptedMale), fallbackAt)
    : fallbackAt;

if (at !== fallbackAt) console.log(`   suyak o'rinlari tashqi modeldan: ${adopted.male.source}`);
/*
 * Ustki kiyim gavdasi TANANING SIRTIDAN yasaladi.
 *
 * ⚠️ NEGA DOIRAVIY KESIM YETMAYDI: yelka qiya sirt va uning ko'ndalang
 * kesimi doira emas. Kesimlardan qurilgan kiyim yelkada tanaga tegmay,
 * ustida konus bo'lib osilib qolardi. Tana meshini normal bo'ylab surish
 * esa har bir qavariqni aynan takrorlaydi.
 */
const bodyParts = await loadBodyParts(adoptedMale);

/*
 * ⚠️ KIYIMLARDAN OLDIN. Atlas butun tana bo'ylab yagona normal beradi va
 * shu bilan ALOHIDA `shell()` chaqiruvlari tutashgan joydagi chokni yopadi
 * (yelka = gavda+yeng, bel = shim beli+shtanina). Bunsiz har chaqiruv o'z
 * normalini olib, qobiqlar turli tomonga surilardi.
 */
const atlasSize = buildNormalAtlas(bodyParts);
console.log(`   normal atlasi: ${atlasSize} noyob o'rin`);

/**
 * `shell(nomlar, sozlamalar)` — sanab o'tilgan tana qismlaridan kiyim
 * qobig'ini qaytaradi. Nom topilmasa xato beriladi: jimgina bo'sh kiyim
 * yasagandan ko'ra yig'ilishda to'xtagan yaxshi.
 */
const shell = (names, options) => {
  const sources = names.map((name) => {
    const geometry = bodyParts.get(name);
    if (!geometry) throw new Error(`Tana qismi topilmadi: ${name}`);
    return geometry;
  });

  return shellFromMeshes(sources, options);
};

const manifest = [];

for (const spec of CATALOG) {
  const garment = buildGarment(spec, at, shell);
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

/*
 * Blender'da qo'lda yasalgan kiyimlar manifestga QO'SHILADI, lekin qayta
 * yasalmaydi — ular generator qolipidan emas, rassomdan keladi.
 *
 * ⚠️ BUSIZ ULAR HAR QURISHDA YO'QOLARDI: manifest to'liq qayta yoziladi va
 * ro'yxatda faqat `CATALOG` dagilar qolardi. Fayl esa `export/` da turaverar,
 * ya'ni yo'qolgani ham sezilmasdi — ilova shunchaki uni ko'rsatmay qo'yardi.
 */
const externalFile = join(ROOT, 'external.json');

if (existsSync(externalFile)) {
  const external = JSON.parse(readFileSync(externalFile, 'utf8'));

  for (const garment of external.garments ?? []) {
    if (!existsSync(join(OUT, garment.file))) {
      console.warn(`   ⚠️  ${garment.file} topilmadi — manifestga qo'shilmadi`);
      continue;
    }

    const { source: _source, catalog, note: _note, ...entry } = garment;

    /*
     * ⚠️ `catalog: false` — fayl bor, lekin FOYDALANUVCHIGA KO'RSATILMAYDI.
     *
     * Sabab: qo'lda yasalgan model geometriyasi buzuq bo'lishi mumkin va
     * uni `poke.mjs` o'lchaydi. Buzuq modelni katalogda qoldirsak,
     * foydalanuvchi uni ko'radi; `export/` dan o'chirsak, eksport zanjiri
     * sinovi yo'qoladi. Shu bayroq ikkisini ajratadi.
     */
    if (catalog === false) {
      console.warn(`   ⏸  ${garment.file} — katalogdan tashqarida: ${garment.note ?? 'sabab yozilmagan'}`);
      continue;
    }

    manifest.push(entry);
    console.log(`   qo'lda yasalgan: ${garment.file} (${garment.source})`);
  }
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
