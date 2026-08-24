import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Tana kiyim ostidan CHIQIB TURGANINI o'lchaydi (12-tz.md D-39, D-40).
 *
 *   node assets-3d/generator/poke.mjs
 *   node assets-3d/generator/poke.mjs tshirt-white
 *
 * ⚠️ NEGA `validate.mjs` YETMAYDI. U gavdani SILINDR sifatida o'lchaydi:
 * har balandlikda eng chetdagi nuqtani oladi va kiyimning `_body`/`_waist`
 * qismi bilan solishtiradi. Ya'ni yeng va shtanina UMUMAN tekshirilmaydi —
 * o'z izohida "ko'z bilan tekshiriladi" deb yozilgan, aynan tanaffuslar
 * ko'ringan joy. Silindr yaqinlashuvi mahalliy botishni ham yashiradi.
 *
 * ⚠️ SAVOL ANIQ QO'YILISHI KERAK. "Futbolka tanani qoplaydimi" — yomon
 * savol: u boshni ham, qo'lni ham qoplamasligi KERAK. To'g'ri savol —
 * "kiyimning HAR BIR QISMI o'zi qoplashi kerak bo'lgan tana qismini
 * qoplaydimi": yeng — yelka va bilakni, gavda — ko'krak va belni.
 *
 * Shuning uchun juftliklar aniq beriladi (`COVERS`) va o'lchov faqat
 * KIYIM QISMINING chegara qutisi ichida bo'ladi.
 *
 * USUL: tana verteksidan normal bo'ylab tashqariga nur otiladi. Kiyimga
 * tegsa — vertex kiyim ichida (to'g'ri). Tegmasa — chiqib turgan.
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'export');
const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
const only = process.argv[2] ?? null;

/** Nur uzunligi — kiyim tanadan bundan uzoq bo'lsa u allaqachon xato. */
const RAY_LENGTH = 0.08;

/** Chiqib turish ulushi shundan oshsa — muammo. */
const LIMIT = 0.15;

/*
 * ⚠️ "TASHQARIDA" DEB SANASH UCHUN KIYIM YAQIN BO'LISHI SHART.
 *
 * −normal da 4 sm uzoqda tegish "kiyim boshqa joyda" degani, muammo emas.
 * Ko'rinadigan nuqson esa YUZALAR USTMA-UST tushganda paydo bo'ladi:
 * tana kiyim sirtini kesib o'tadi va Z-fighting beradi. Bu holatda
 * masofa juda kichik.
 *
 * Bu chegarasiz yeng uchidan pastdagi qo'l ham "tashqarida" bo'lib
 * sanalardi (uning normali yengga qarab qaytadi) — o'lchovning ikkinchi
 * yolg'on natijasi aynan shundan edi.
 */
const NEAR = 0.006;

const loader = new GLTFLoader();

async function load(file) {
  const buffer = readFileSync(join(OUT, file));
  return loader.parseAsync(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    '',
  );
}

function meshesOf(root) {
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  return meshes;
}

/**
 * Tana qismi kiyim ostida qolganini o'lchaydi.
 *
 * ⚠️ CHEGARA QUTISI ISHLATILMAYDI. Birinchi urinishda yeng qutisi ichidagi
 * vertekslar tekshirildi va natija 88% chiqdi — yolg'on. Sabab: A-pozada
 * qo'l ~45° qiya turadi, o'qqa parallel quti esa yeng QOPLAMAGAN pastki
 * qismni ham qamrab oladi. `validate.mjs` xuddi shu tuzoqqa boshqa
 * tomondan tushgan (silindr yaqinlashuvi).
 *
 * USUL — har vertex uchun IKKI TOMONGA nur:
 *
 *   +normal da tegdi        → vertex kiyim ICHIDA        ✅
 *   faqat −normal da tegdi  → kiyim orqada, vertex TASHQARIDA ❌
 *   ikkalasida ham tegmadi  → kiyim bu yerda yo'q → HISOBGA OLINMAYDI
 *
 * Uchinchi holat muhim: yeng uchi ostidagi qo'l yoki etak ostidagi son
 * ochiq bo'lishi NORMAL. Ularni xato deb sanash yolg'on ogohlantirish
 * berardi — birinchi urinish aynan shundan yiqilgan.
 */
function measure(bodyPart, garmentMeshes) {
  const position = bodyPart.geometry.getAttribute('position');
  const normal = bodyPart.geometry.getAttribute('normal');
  if (!position || !normal) return null;

  const raycaster = new THREE.Raycaster();
  raycaster.far = RAY_LENGTH;

  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const back = new THREE.Vector3();

  let covered = 0;
  let outside = 0;
  let minGap = Infinity;

  for (let i = 0; i < position.count; i += 1) {
    origin.fromBufferAttribute(position, i).applyMatrix4(bodyPart.matrixWorld);
    direction.fromBufferAttribute(normal, i).normalize();
    if (direction.lengthSq() === 0) continue;

    raycaster.set(origin, direction);
    const front = raycaster.intersectObjects(garmentMeshes, false);
    if (front.length > 0) {
      covered += 1;
      // Eng kichik oraliq — Z-fighting xavfi shundan ko'rinadi
      if (front[0].distance < minGap) minGap = front[0].distance;
      continue;
    }

    back.copy(direction).negate();
    raycaster.set(origin, back);
    const behind = raycaster.intersectObjects(garmentMeshes, false);
    if (behind.length > 0 && behind[0].distance <= NEAR) outside += 1;
  }

  const total = covered + outside;
  if (total < 20) return null;
  return { covered, outside, total, share: outside / total, minGapMm: minGap * 1000 };
}

let problems = 0;

for (const garment of manifest.garments) {
  if (only && !garment.key.startsWith(only)) continue;
  if (!['top', 'outer', 'bottom', 'feet'].includes(garment.slot)) continue;

  const [bodyGltf, garmentGltf] = await Promise.all([
    load('male-base-v1.glb'),
    load(garment.file),
  ]);

  const garmentMeshes = meshesOf(garmentGltf.scene);
  const bodyParts = new Map();
  bodyGltf.scene.updateMatrixWorld(true);
  bodyGltf.scene.traverse((child) => {
    if (child.isMesh && child.name.startsWith('body_')) bodyParts.set(child.name, child);
  });

  console.log(`\n── ${garment.file}  (${garment.slot})`);
  console.log(
    `   hideBodyParts: ${garment.hideBodyParts.length > 0 ? garment.hideBodyParts.join(', ') : '(bo`sh)'}`,
  );

  const rows = [];
  for (const [name, bodyPart] of bodyParts) {
    const result = measure(bodyPart, garmentMeshes);
    if (result) rows.push({ name, ...result });
  }
  rows.sort((a, b) => b.share - a.share);

  const exposed = new Set();

  for (const row of rows) {
    const hidden = garment.hideBodyParts.includes(row.name);
    const over = row.share > LIMIT;
    if (over && !hidden) exposed.add(row.name);

    // Faqat kiyim tegib turgan qismlar ko'rsatiladi — qolgani shovqin
    console.log(
      `   ${over && !hidden ? '⚠️ ' : '   '}${row.name.padEnd(17)}` +
        ` tashqarida ${(row.share * 100).toFixed(0).padStart(3)}%` +
        ` (${row.outside}/${row.total})` +
        `  eng tor oraliq ${Number.isFinite(row.minGapMm) ? `${row.minGapMm.toFixed(1)} mm` : '—'}` +
        `${hidden ? ' [yashirilgan]' : ''}`,
    );
  }

  if (exposed.size > 0) {
    problems += 1;
    console.log(`   ❌ yashirilmagan holda chiqib turgan: ${[...exposed].join(', ')}`);
  } else {
    console.log('   ✅ muammo yo`q');
  }
}

console.log(
  problems === 0
    ? '\n✅ Barcha kiyim qismlari o`z tana qismini qoplaydi (yoki u yashirilgan)'
    : `\n❌ ${problems} ta kiyimda hideBodyParts to`+`'ldirilishi kerak`,
);
process.exit(problems === 0 ? 0 : 1);
