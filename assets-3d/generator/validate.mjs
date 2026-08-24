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

/*
 * Kiyim yashira oladigan qismlar.
 *
 * ⚠️ `REQUIRED_BODY_PARTS` DAN ALOHIDA. U — skeletga bog'langan 15 ta gavda
 * mesh'i va uning UZUNLIGI mesh sonini tekshirishda ishlatiladi; ichki kiyim
 * esa 16-mesh emas, u ixtiyoriy. Ikkisini bitta ro'yxatga qo'shsak, ayol
 * tanasi (14 mesh) yolg'ondan yiqiladi.
 *
 * Ilovadagi `applyHiddenParts` shu ikkalasini `^(body_|underwear_)` qolipi
 * bilan qamrab oladi.
 */
const HIDEABLE_PARTS = [...REQUIRED_BODY_PARTS, 'underwear_briefs'];

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

/**
 * Shape key'lar joyidami.
 *
 * ⚠️ HAR MESH'DA OLTITASI SHART EMAS. `mt_waist` kabi kalitlar faqat
 * ma'lum balandlikda ta'sir qiladi, shuning uchun bosh yoki kaftda ularning
 * og'ishi nol bo'ladi va generator ularni faylga yozmaydi (o'nlab megabayt
 * tejaydi). Ilova shape key'ni nom bo'yicha qidiradi va topmasa jimgina
 * o'tkazadi — natija bir xil.
 *
 * Shuning uchun tekshiruv shunday: GAVDA'da oltitasi ham bo'lishi shart
 * (o'lchamlarning hammasi unga ta'sir qiladi), qolgan qismlarda esa
 * kamida ikkita umumiy kalit — `mt_height` va `mt_weight`.
 */
const GLOBAL_MORPHS = ['mt_height', 'mt_weight'];

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

    const required = child.name === 'body_torso' ? MORPH_NAMES : GLOBAL_MORPHS;
    for (const name of required) {
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
    if (names.has(part)) continue;

    /*
     * `body_neck` ixtiyoriy. Past poligonli modelda bo'yin uchun alohida
     * verteks bo'lmaydi — ular bosh yoki gavdaga tegishli bo'lib qoladi va
     * `adopt.mjs` bo'sh qism yasamaydi.
     *
     * Zarari yo'q: ilovaning `BODY_SLOT` xaritasida bo'yin yo'q va hozirgi
     * kiyimlarning birortasi uni yashirmaydi. Faqat sharf/marjon qo'shilsa
     * kerak bo'ladi — o'shanda modelni qayta ko'rish kerak.
     */
    if (part === 'body_neck') {
      console.log(`  ℹ️  ${file}: body_neck yo'q (past poligonli modelda normal)`);
      continue;
    }
    fail(file, `mesh yo'q: ${part}`);
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

  // Bo'yin ixtiyoriy bo'lgani uchun 14 ham, 15 ham to'g'ri
  if (skinned < REQUIRED_BODY_PARTS.length - 1) {
    fail(file, `skinned mesh soni ${skinned}, kamida ${REQUIRED_BODY_PARTS.length - 1} bo'lishi kerak`);
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
    if (!HIDEABLE_PARTS.includes(part)) {
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

// ── Kiyim tanaga botib qolmaganmi ──
/**
 * NEGA BU TEKSHIRUV: kiyim tanadan ichkarida qolsa, model YUKLANADI va
 * xato bermaydi — tana kiyim ichidan chiqib turadi (Z-fighting). Buni
 * faqat ko'z bilan sezish mumkin, shuning uchun raqam bilan tekshiramiz:
 * kiyim sirti har bir balandlikda tanadan tashqarida bo'lishi shart.
 */
function radiusProfile(root, include, step = 0.02) {
  const byLevel = new Map();

  root.traverse((child) => {
    if (!child.isMesh || !include(child.name)) return;
    const position = child.geometry.attributes.position;
    const targets = child.geometry.morphAttributes.position ?? [];
    const relative = child.geometry.morphTargetsRelative;

    for (let i = 0; i < position.count; i++) {
      let x = position.getX(i);
      let y = position.getY(i);
      let z = position.getZ(i);

      // Neytral holat (0.5) — ilova aynan shuni ko'rsatadi
      for (const target of targets) {
        const dx = relative ? target.getX(i) : target.getX(i) - position.getX(i);
        const dy = relative ? target.getY(i) : target.getY(i) - position.getY(i);
        const dz = relative ? target.getZ(i) : target.getZ(i) - position.getZ(i);
        x += 0.5 * dx;
        y += 0.5 * dy;
        z += 0.5 * dz;
      }

      const level = Math.round(y / step);
      const radius = Math.hypot(x, z);
      if (radius > (byLevel.get(level) ?? 0)) byLevel.set(level, radius);
    }
  });

  return byLevel;
}

/*
 * ⚠️ FAQAT GAVDA. Birinchi urinishda butun tana bilan solishtirilgan edi
 * va tekshiruv yolg'on ogohlantirish berdi: y≈1.0 da eng chetdagi nuqta —
 * pastga osilgan QO'L, futbolka esa uni qoplashi shart emas.
 *
 * ⚠️ YENG VA SHTANINA BU YERDA TEKSHIRILMAYDI. Ular Y o'qidan uzoqda
 * turadi va o'z o'qiga nisbatan o'lchash kerak bo'ladi — bu tekshiruvning
 * silindr yaqinlashuvi bunga yaramaydi.
 *
 * ⚠️ "KO'Z BILAN TEKSHIRILADI" DEB QOLDIRISH YETMADI (12-tz.md D-40): bu
 * tekshiruv "✅ hammasi mos" deb turgan holda krossovkada oraliq 0.0 mm,
 * sonda 0.1 mm edi — ya'ni z-fighting. Silindr yaqinlashuvi mahalliy
 * siqilishni yashiradi.
 *
 * Endi ular ALOHIDA vosita bilan o'lchanadi:
 *
 *     node assets-3d/generator/poke.mjs
 *
 * U har tana verteksidan ikki tomonga nur otadi va aytadi: qism kiyim
 * ichidami, tashqarisidami, yoki kiyim u yerda yo'qmi. Modelni
 * o'zgartirgandan keyin IKKALASINI ham yurgizing.
 */
const bodyRadius = radiusProfile(bodyGltf.scene, (name) => name === 'body_torso');

for (const garment of manifest.garments) {
  // Faqat gavdaga kiyiladiganlar — poyabzal va kepka tana o'qidan uzoqda
  if (!['top', 'outer', 'bottom'].includes(garment.slot)) continue;

  const gltf = await load(garment.file);
  // Kiyimning gavda qismi — yeng va shtanina emas
  const garmentRadius = radiusProfile(gltf.scene, (name) =>
    /_(body|waist)$/.test(name),
  );

  let tightest = Infinity;
  let tightestY = 0;

  /*
   * ⚠️ CHET DARAJALARI TEKSHIRILMAYDI. Kiyim biror balandlikda TUGAYDI —
   * etak, yoqa, yeng uchi. O'sha oxirgi qatlamga faqat kesim chetining
   * ichkariga qaragan nuqtalari tushadi (etakda — chov atrofi, radius
   * kichik), gavda esa o'sha balandlikda to'liq kengligida turadi.
   * Ularni solishtirish "kiyim tanaga botgan" degan yolg'on ogohlantirish
   * beradi: futbolka etagi y=0.99 da tugaydi, tekshiruv esa uni y=0.98
   * dagi son kengligi bilan taqqoslardi.
   */
  const levels = [...garmentRadius.keys()].sort((a, b) => a - b);
  const edges = new Set([levels[0], levels[levels.length - 1]]);

  for (const [level, radius] of garmentRadius) {
    if (edges.has(level)) continue;
    const body = bodyRadius.get(level);
    if (body === undefined) continue;

    const gap = radius - body;
    if (gap < tightest) {
      tightest = gap;
      tightestY = level * 0.02;
    }
  }

  if (tightest === Infinity) continue;

  const mm = (tightest * 1000).toFixed(0);
  if (tightest < 0) {
    fail(garment.file, `tanaga botgan: y=${tightestY.toFixed(2)} da ${mm} mm`);
  } else {
    console.log(`  ${garment.file}: eng tor joyi y=${tightestY.toFixed(2)} da ${mm} mm`);
  }
}

console.log('');
if (problems.length > 0) {
  console.error(`❌ ${problems.length} ta muammo:`);
  for (const problem of problems) console.error(`   ${problem}`);
  process.exit(1);
}

console.log('✅ Barcha modellar ilova kutgan tuzilishga mos');
