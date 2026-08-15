import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { MORPH_NAMES } from './lib/shape.mjs';

/**
 * Yasalgan GLB'larni QAYTADAN yuklab tekshiradi.
 *
 *   node assets-3d/generator/validate.mjs
 *
 * NEGA KERAK: eksport muvaffaqiyatli tugashi model to'g'ri degani emas.
 * Ilova aniq nomlarni qidiradi — `mt_height` shape key'i, `body_torso`
 * mesh'i, `mixamorig:` suyaklari. Bittasi noto'g'ri bo'lsa ilova jimgina
 * ishlamay qo'yadi: shape key qo'llanmaydi yoki tana qismi yashirilmaydi.
 * Bu skript aynan shu nomlarni tekshiradi.
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'export');
const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));

/** Ilova `AvatarScene.BODY_SLOT` da shu nomlarni qidiradi */
const REQUIRED_BODY_PARTS = [
  'body_head',
  'body_neck',
  'body_torso',
  'body_upperArm_L',
  'body_upperArm_R',
  'body_forearm_L',
  'body_forearm_R',
  'body_hand_L',
  'body_hand_R',
  'body_thigh_L',
  'body_thigh_R',
  'body_calf_L',
  'body_calf_R',
  'body_foot_L',
  'body_foot_R',
];

const REQUIRED_SOCKETS = [
  'socket_head',
  'socket_face',
  'socket_neck',
  'socket_wrist_L',
  'socket_wrist_R',
  'socket_foot_L',
  'socket_foot_R',
  'socket_bag',
];

/** `mixamorig:` → yuklovchi tozalagandan keyingi shakl (`mixamorig`) */
const SANITIZED_PREFIX = THREE.PropertyBinding.sanitizeNodeName('mixamorig:');

const loader = new GLTFLoader();

function load(file) {
  const buffer = readFileSync(join(OUT, file));
  // `parse` tarmoqqa chiqmaydi — Node'da FileLoader ishlamaydi
  return new Promise((resolve, reject) =>
    loader.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '', resolve, reject),
  );
}

const problems = [];
const fail = (file, message) => problems.push(`${file}: ${message}`);

function collectNames(scene) {
  const names = new Set();
  scene.traverse((child) => names.add(child.name));
  return names;
}

/** Har bir mesh'da oltita shape key to'g'ri nom bilan turibdimi */
function checkMorphs(file, scene) {
  let checked = 0;

  scene.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    checked++;

    const dictionary = child.morphTargetDictionary;
    if (!dictionary) {
      fail(file, `${child.name} da shape key yo'q`);
      return;
    }

    for (const name of MORPH_NAMES) {
      if (dictionary[name] === undefined) fail(file, `${child.name} da "${name}" yo'q`);
    }
  });

  if (checked === 0) fail(file, 'birorta mesh topilmadi');
}

// ── Tanalar ──
for (const gender of manifest.bodies) {
  const file = `${gender}-base-${manifest.version}.glb`;
  const gltf = await load(file);
  const names = collectNames(gltf.scene);

  for (const part of REQUIRED_BODY_PARTS) {
    if (!names.has(part)) fail(file, `mesh yo'q: ${part}`);
  }
  for (const socket of REQUIRED_SOCKETS) {
    if (!names.has(socket)) fail(file, `socket yo'q: ${socket}`);
  }

  let skinned = 0;
  let bones = 0;
  gltf.scene.traverse((child) => {
    if (child.isSkinnedMesh) skinned++;
    if (child.isBone) bones++;
    /*
     * ⚠️ FAYLDA nom `mixamorig:Hips`, LEKIN YUKLANGANDA `mixamorigHips`.
     * `GLTFLoader` `PropertyBinding.sanitizeNodeName` orqali `:` ni olib
     * tashlaydi — bu belgi animatsiya yo'llari sintaksisida band.
     *
     * Bu muammo emas: Mixamo klipi ham GLTFLoader orqali yuklanadi va
     * uning trek nomlari AYNAN SHU tarzda tozalanadi, ya'ni ikkalasi
     * baribir mos tushadi. Shuning uchun kutilgan nom ham tozalangan
     * shaklda hisoblanadi — fayldagi xom nom bilan solishtirilmaydi.
     */
    if (child.isBone && !child.name.startsWith(SANITIZED_PREFIX)) {
      fail(file, `suyak nomi Mixamo standartida emas: ${child.name}`);
    }
  });

  if (skinned !== REQUIRED_BODY_PARTS.length) {
    fail(file, `skinned mesh soni ${skinned}, kutilgani ${REQUIRED_BODY_PARTS.length}`);
  }
  if (bones < 20) fail(file, `suyak soni juda kam: ${bones}`);

  checkMorphs(file, gltf.scene);
  console.log(`  ${file}: ${skinned} mesh, ${bones} suyak`);
}

// ── Kiyimlar ──
for (const garment of manifest.garments) {
  const gltf = await load(garment.file);
  checkMorphs(garment.file, gltf.scene);

  // Kiyim mesh nomi `body_` bilan boshlanmasligi kerak — aks holda
  // `applyHiddenParts` uni tana qismi deb yashirib qo'yadi
  gltf.scene.traverse((child) => {
    if (child.name.startsWith('body_')) {
      fail(garment.file, `mesh nomi "body_" bilan boshlanmasin: ${child.name}`);
    }
  });

  console.log(`  ${garment.file}: ${garment.slot}, yashiradi ${garment.hideBodyParts.length} qism`);
}

// ── Kiyim yashiradigan qismlar haqiqatan mavjudmi ──
for (const garment of manifest.garments) {
  for (const part of garment.hideBodyParts) {
    if (!REQUIRED_BODY_PARTS.includes(part)) {
      fail(garment.file, `hideBodyParts da mavjud bo'lmagan qism: ${part}`);
    }
  }
}

// ── Animatsiya klip'lari ──
/**
 * `apps/mobile/src/three/animation.ts` dagi `normalizeBoneName` ning
 * AYNAN NUSXASI. Ikkisi ajralib ketmasligi shart — shuning uchun
 * o'zgartirsangiz ikkalasini birga o'zgartiring.
 */
function normalizeBoneName(name) {
  return name
    .toLowerCase()
    .replace(/\.\d+$/, '')
    .replace(/^armature[:_]?/, '')
    .replace(/mixamorig\d*[:_]?/, '')
    .replace(/[^a-z0-9]/g, '');
}

const bodyGltf = await load(`male-base-${manifest.version}.glb`);
const bodyBones = new Set();
bodyGltf.scene.traverse((child) => {
  if (child.isBone) bodyBones.add(normalizeBoneName(child.name));
});

for (const animation of manifest.animations ?? []) {
  const gltf = await load(animation.file);

  if (gltf.animations.length === 0) {
    fail(animation.file, 'klip topilmadi');
    continue;
  }

  let bound = 0;
  for (const clip of gltf.animations) {
    for (const track of clip.tracks) {
      const target = track.name.slice(0, track.name.lastIndexOf('.'));
      if (bodyBones.has(normalizeBoneName(target))) bound++;
      else fail(animation.file, `trek suyakka bog'lanmadi: ${track.name}`);
    }
  }

  // Geometriya bo'lmasligi shart — klip fayli kichik qolishi kerak
  gltf.scene.traverse((child) => {
    if (child.isMesh) fail(animation.file, `klipda geometriya bor: ${child.name}`);
  });

  console.log(`  ${animation.file}: ${bound} trek bog'landi`);
}

console.log('');
if (problems.length > 0) {
  console.error(`❌ ${problems.length} ta muammo:`);
  for (const problem of problems) console.error(`   ${problem}`);
  process.exit(1);
}

console.log('✅ Barcha modellar ilova kutgan tuzilishga mos');
