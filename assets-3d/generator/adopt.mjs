// FBXLoader brauzer global'larini kutadi — Node'da minimal polifill
globalThis.self = globalThis;
globalThis.window = globalThis;

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { writeGlb } from './lib/glb.mjs';
import { loft, verticalRings } from './lib/loft.mjs';
import { addMorphTargets, attachMorphNames } from './lib/shape.mjs';

/**
 * Mixamo'dan kelgan riglangan FBX ni ilova kutgan GLB ga aylantiradi.
 *
 *   node assets-3d/generator/adopt.mjs <fayl.fbx> <male|female>
 *
 * NIMA QILADI:
 *   1. O'lchovni metrga keltiradi va oyoqni `y = 0` ga tushiradi
 *   2. Bitta yaxlit mesh'ni 15 ta nomlangan qismga bo'ladi
 *   3. Har qismga 6 ta `mt_*` shape key qo'shadi
 *   4. 8 ta socket biriktiradi
 *   5. GLB qilib `export/` ga yozadi
 *
 * NEGA BO'LISH KERAK: `assets_3d.hide_body_parts` kiyim ostidagi tana
 * qismini yashiradi. Yaxlit mesh'da yashiriladigan narsa yo'q — futbolka
 * kiyilganda gavda kiyim ichidan chiqib turadi (04-3d-pipeline §2).
 *
 * QANDAY BO'LINADI: har verteksning ENG KATTA teri og'irligiga ega suyagi
 * topiladi va shu suyak qaysi qismga tegishli bo'lsa, verteks o'sha qismga
 * ketadi. Mixamo og'irliklari anatomik to'g'ri, shuning uchun chegaralar
 * bo'g'imlardan o'tadi. Uchburchak esa uch verteksining ko'pchiligi qayerda
 * bo'lsa o'sha qismga qo'shiladi — aks holda chegarada teshik qoladi.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_HEIGHT = 1.72;

const [, , file, gender = 'male'] = process.argv;
if (!file) {
  console.error('Foydalanish: node assets-3d/generator/adopt.mjs <fayl.fbx> <male|female>');
  process.exit(1);
}

/** Suyak → tana qismi. Nomlar `AvatarScene.BODY_SLOT` bilan bir xil. */
const BONE_TO_PART = {
  Head: 'body_head',
  HeadTop_End: 'body_head',
  Neck: 'body_neck',
  Hips: 'body_torso',
  Spine: 'body_torso',
  Spine1: 'body_torso',
  Spine2: 'body_torso',
  LeftShoulder: 'body_torso',
  RightShoulder: 'body_torso',
  LeftArm: 'body_upperArm_L',
  RightArm: 'body_upperArm_R',
  LeftForeArm: 'body_forearm_L',
  RightForeArm: 'body_forearm_R',
  LeftHand: 'body_hand_L',
  RightHand: 'body_hand_R',
  LeftUpLeg: 'body_thigh_L',
  RightUpLeg: 'body_thigh_R',
  LeftLeg: 'body_calf_L',
  RightLeg: 'body_calf_R',
  LeftFoot: 'body_foot_L',
  LeftToeBase: 'body_foot_L',
  LeftToe_End: 'body_foot_L',
  RightFoot: 'body_foot_R',
  RightToeBase: 'body_foot_R',
  RightToe_End: 'body_foot_R',
};

/** Socket → ota suyak va lokal siljish (04-3d-pipeline §2) */
const SOCKETS = [
  ['socket_head', 'Head', [0, 0.12, 0]],
  ['socket_face', 'Head', [0, 0.04, 0.1]],
  ['socket_neck', 'Neck', [0, 0.02, 0.04]],
  ['socket_wrist_L', 'LeftHand', [0, -0.04, 0]],
  ['socket_wrist_R', 'RightHand', [0, -0.04, 0]],
  ['socket_foot_L', 'LeftFoot', [0, -0.05, 0.02]],
  ['socket_foot_R', 'RightFoot', [0, -0.05, 0.02]],
  ['socket_bag', 'Spine2', [0, 0.02, -0.09]],
];

/** `mixamorigLeftArm` yoki `mixamorig:LeftArm` → `LeftArm` */
const shortBoneName = (name) => name.replace(/^mixamorig:?/i, '');

/**
 * Aniq xaritada yo'q suyaklar uchun qoidalar.
 *
 * ⚠️ NEGA KERAK: Mixamo skeleti ikki xil bo'lishi mumkin — "No Fingers"
 * (25 suyak) va "Standard" (65 suyak, barmoqlar bilan). Barmoq suyaklari
 * (`LeftHandIndex1`, `LeftHandThumb2`, …) aniq xaritada yo'q va ular
 * jimgina gavdaga tushib qolardi: barmoqlar ko'krak mesh'iga qo'shilib,
 * futbolka kiyilganda ular ham yashirinardi.
 */
const PREFIX_RULES = [
  [/^LeftHand/, 'body_hand_L'],
  [/^RightHand/, 'body_hand_R'],
  [/^LeftToe/, 'body_foot_L'],
  [/^RightToe/, 'body_foot_R'],
  [/^LeftFoot/, 'body_foot_L'],
  [/^RightFoot/, 'body_foot_R'],
];

const unmapped = new Set();

function partForBone(boneName) {
  const short = shortBoneName(boneName);
  if (BONE_TO_PART[short]) return BONE_TO_PART[short];

  for (const [pattern, part] of PREFIX_RULES) {
    if (pattern.test(short)) return part;
  }

  unmapped.add(short);
  return 'body_torso';
}

// ── 1. Yuklash ──
const buffer = readFileSync(file);
const source = new FBXLoader().parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  '',
);
source.updateMatrixWorld(true);

let skinned = null;
source.traverse((child) => {
  if (child.isSkinnedMesh && !skinned) skinned = child;
});
if (!skinned) throw new Error('Fayl ichida skinned mesh topilmadi');

const bones = skinned.skeleton.bones;
console.log(`\n${basename(file)} — ${bones.length} suyak, ${skinned.geometry.attributes.position.count} verteks`);

// ── 2. Metrga keltirish va oyoqni yerga tushirish ──
/*
 * Geometriya JAHON koordinatasiga keltiriladi va shu holda saqlanadi.
 * Sabab: shape key deformatorlari balandlik bo'yicha ishlaydi
 * (`band(y, 1.18, 1.4)` — ko'krak) va ular metrni kutadi. Shuningdek
 * `SkinnedMesh.bind()` ga birlik matritsa berish mumkin bo'ladi.
 */
const box = new THREE.Box3().setFromObject(skinned);
const scale = TARGET_HEIGHT / (box.max.y - box.min.y);

const toWorld = skinned.matrixWorld.clone();
const normalize = new THREE.Matrix4()
  .makeTranslation(0, -box.min.y * scale, 0)
  .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));

console.log(`O'lchov ×${scale.toFixed(5)}, oyoq ${box.min.y.toFixed(2)} → 0`);

/*
 * ⚠️ VERTEKSLARNI BIRLASHTIRISH SHART. FBXLoader indekssiz geometriya
 * beradi: har uchburchak o'z uchta verteksiga ega va qo'shni uchburchaklar
 * ularni bo'lishmaydi. 52 484 uchburchak → 157 452 verteks, ya'ni besh
 * barobar ortiqcha. Ustiga har verteks 6 ta shape key bilan takrorlanadi —
 * natijada GLB 20 MB ga chiqadi (byudjet ~2.5 MB).
 *
 * `mergeVertices` bir xil joydagi vertekslarni yagona qiladi va indeks
 * qo'yadi. Shakl o'zgarmaydi — faqat takror ma'lumot yo'qoladi.
 */
const raw = skinned.geometry.clone();
const before = raw.attributes.position.count;
const geometry = mergeVertices(raw);
console.log(
  `Verteks: ${before.toLocaleString()} → ${geometry.attributes.position.count.toLocaleString()}`,
);

geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize, toWorld));

// Suyaklarni ham o'sha o'zgartirish bilan
const boneRoots = [];
for (const bone of bones) {
  if (!bones.includes(bone.parent)) boneRoots.push(bone);
}
for (const root of boneRoots) {
  root.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize, toWorld));
}
for (const root of boneRoots) root.updateMatrixWorld(true);

// ── 3. Verteksni qismga taqsimlash ──
const position = geometry.attributes.position;
const skinIndex = geometry.attributes.skinIndex;
const skinWeight = geometry.attributes.skinWeight;
if (!skinIndex || !skinWeight) throw new Error('Meshda teri og`irliklari yo`q');

const partOfBone = bones.map((bone) => partForBone(bone.name));
const partOfVertex = new Array(position.count);

for (let i = 0; i < position.count; i++) {
  let bestWeight = -1;
  let bestBone = 0;

  for (let k = 0; k < 4; k++) {
    const weight = skinWeight.getComponent(i, k);
    if (weight > bestWeight) {
      bestWeight = weight;
      bestBone = skinIndex.getComponent(i, k);
    }
  }
  partOfVertex[i] = partOfBone[bestBone] ?? 'body_torso';
}

// Uchburchakni ko'pchilik ovoz bilan — chegarada teshik qolmasin
const index = geometry.index;
const triangleCount = index ? index.count / 3 : position.count / 3;
const trianglesByPart = new Map();

for (let t = 0; t < triangleCount; t++) {
  const a = index ? index.getX(t * 3) : t * 3;
  const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
  const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;

  const votes = {};
  for (const vertex of [a, b, c]) {
    const part = partOfVertex[vertex];
    votes[part] = (votes[part] ?? 0) + 1;
  }
  const part = Object.entries(votes).sort((x, y) => y[1] - x[1])[0][0];

  if (!trianglesByPart.has(part)) trianglesByPart.set(part, []);
  trianglesByPart.get(part).push(a, b, c);
}

// ── 4. Har qism uchun alohida geometriya ──
const skeleton = new THREE.Skeleton(bones);
const group = new THREE.Group();
group.name = `avatar_${gender}`;
for (const root of boneRoots) group.add(root);

const material = new THREE.MeshStandardMaterial({
  color: gender === 'female' ? 0xc7b6cf : 0xb9aec6,
  roughness: 0.74,
  metalness: 0.03,
});

const report = [];

for (const [partName, indices] of trianglesByPart) {
  // Faqat shu qismda ishlatilgan vertekslarni ko'chiramiz
  const remap = new Map();
  const positions = [];
  const normals = [];
  const uvs = [];
  const skinIndices = [];
  const skinWeights = [];
  const newIndices = [];

  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;

  for (const old of indices) {
    let next = remap.get(old);
    if (next === undefined) {
      next = remap.size;
      remap.set(old, next);

      positions.push(position.getX(old), position.getY(old), position.getZ(old));
      if (normal) normals.push(normal.getX(old), normal.getY(old), normal.getZ(old));
      if (uv) uvs.push(uv.getX(old), uv.getY(old));

      for (let k = 0; k < 4; k++) {
        skinIndices.push(skinIndex.getComponent(old, k));
        skinWeights.push(skinWeight.getComponent(old, k));
      }
    }
    newIndices.push(next);
  }

  const partGeometry = new THREE.BufferGeometry();
  partGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) {
    partGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  if (uvs.length > 0) partGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  partGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  partGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  partGeometry.setIndex(newIndices);

  addMorphTargets(partGeometry);

  const mesh = new THREE.SkinnedMesh(partGeometry, material);
  mesh.name = partName;
  attachMorphNames(mesh);

  group.add(mesh);
  mesh.bind(skeleton);

  report.push({ qism: partName, verteks: remap.size, uchburchak: newIndices.length / 3 });
}

// ── 4b. Ichki kiyim ──
/*
 * NEGA TANAGA SINGDIRILADI: magazin ilovasida yalang'och maneken
 * ko'rsatib bo'lmaydi, lekin ichki kiyim SOTILADIGAN mahsulot ham emas —
 * uni slotga qo'yish noto'g'ri bo'lardi (foydalanuvchi uni yechib
 * qo'yishi mumkin bo'lardi).
 *
 * Shuning uchun u tana modelining ichida, alohida mesh sifatida keladi.
 * Nomi `body_` bilan boshlanmaydi, ya'ni `applyHiddenParts` uni hech
 * qachon yashirmaydi — shim kiyilganda ham joyida qoladi (shim kattaroq
 * va uni to'liq berkitadi).
 */

/** Tananing berilgan balandlikdagi kesimini o'lchaydi */
function sectionAt(points, level, tolerance = 0.02) {
  const slab = points.filter((point) => Math.abs(point.y - level) <= tolerance);
  if (slab.length < 6) return null;

  return {
    rx: Math.max(...slab.map((point) => Math.abs(point.x))),
    rz: (Math.max(...slab.map((p) => p.z)) - Math.min(...slab.map((p) => p.z))) / 2,
    cz: (Math.max(...slab.map((p) => p.z)) + Math.min(...slab.map((p) => p.z))) / 2,
  };
}

/** Barcha tana vertekslari — kesim o'lchash uchun */
const bodyPoints = [];
{
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    bodyPoints.push(new THREE.Vector3().fromBufferAttribute(position, i));
  }
}

/** Berilgan balandliklar bo'yicha tanaga yopishgan qobiq yasaydi */
function underwearShell(levels, clearance) {
  const keys = [];
  for (const level of levels) {
    const section = sectionAt(bodyPoints, level);
    if (!section) continue;
    keys.push([level, section.rx + clearance, section.rz + clearance, section.cz]);
  }
  if (keys.length < 2) return null;
  return loft(verticalRings(keys, 3), { radialSegments: 20 });
}

const underwearMaterial = new THREE.MeshStandardMaterial({
  color: 0x2b2733,
  roughness: 0.88,
  metalness: 0.02,
});

const underwear = [];

// Trusik — chanoqdan sonning yuqorisigacha
const briefs = underwearShell([0.74, 0.8, 0.86, 0.92, 0.97, 1.0], 0.008);
if (briefs) underwear.push(['underwear_briefs', briefs]);

// Ayolda ko'krak uchun ham
if (gender === 'female') {
  const top = underwearShell([1.13, 1.18, 1.24, 1.28], 0.008);
  if (top) underwear.push(['underwear_top', top]);
}

for (const [name, partGeometry] of underwear) {
  addMorphTargets(partGeometry);
  const mesh = new THREE.Mesh(partGeometry, underwearMaterial);
  mesh.name = name;
  attachMorphNames(mesh);
  group.add(mesh);
  report.push({
    qism: name,
    verteks: partGeometry.attributes.position.count,
    uchburchak: (partGeometry.index?.count ?? 0) / 3,
  });
}

// ── 5. Socket'lar ──
const boneByName = new Map(bones.map((bone) => [shortBoneName(bone.name), bone]));
let socketCount = 0;

for (const [name, parent, offset] of SOCKETS) {
  const bone = boneByName.get(parent);
  if (!bone) {
    console.warn(`⚠️ socket "${name}" uchun "${parent}" suyagi topilmadi`);
    continue;
  }
  const socket = new THREE.Object3D();
  socket.name = name;
  socket.position.set(...offset);
  bone.add(socket);
  socketCount++;
}

// ── 6. Eksport ──
const totalTriangles = report.reduce((sum, row) => sum + row.uchburchak, 0);
console.table(report.sort((a, b) => a.qism.localeCompare(b.qism)));
console.log(`${report.length} qism, ${socketCount} socket`);

if (unmapped.size > 0) {
  console.warn(
    `\n⚠️ Xaritada yo'q suyaklar gavdaga qo'shildi: ${[...unmapped].join(', ')}\n` +
      '   Agar bular tana qismi bo`lsa, BONE_TO_PART ga qo`shing.',
  );
}

const scene = new THREE.Scene();
scene.add(group);

const out = join(ROOT, 'export', `${gender}-base-v1.glb`);
const bytes = await writeGlb(scene, out);

/*
 * Belgi qo'yamiz: bu tana TASHQI modeldan kelgan.
 *
 * ⚠️ NEGA: `build.mjs` protsedural tanalarni AYNAN SHU nomlar bilan
 * yozadi. Belgi bo'lmasa u haqiqiy modelni jimgina qayta yozib yuboradi —
 * xato chiqmaydi, fayl joyida turadi, faqat ichida boshqa model bo'ladi.
 * Bu bir marta sodir bo'ldi va faqat CDN'dagi hajm noto'g'ri ekanidan
 * bilindi.
 */
const marker = join(ROOT, 'export', 'adopted.json');
const adopted = existsSync(marker) ? JSON.parse(readFileSync(marker, 'utf8')) : {};
adopted[gender] = { source: basename(file), triangles: Math.round(totalTriangles) };
writeFileSync(marker, `${JSON.stringify(adopted, null, 2)}\n`);

console.log(`\n✅ ${out} — ${Math.round(bytes / 1024)} KB  (adopted.json ga belgilandi)`);
