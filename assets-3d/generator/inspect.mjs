import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

import * as THREE from 'three';

/**
 * Tashqaridan olingan GLB ichida nima borligini aytadi.
 *
 *   node assets-3d/generator/inspect.mjs <fayl.glb>
 *
 * NEGA KERAK: yuklab olingan model ilovaga to'g'ridan-to'g'ri tushmaydi.
 * Ilova aniq nomlarni kutadi (`body_torso`, `mixamorig:Hips`, `mt_waist`)
 * va ular tayyor modellarda deyarli hech qachon bo'lmaydi.
 *
 * ⚠️ NEGA `GLTFLoader` EMAS: u teksturali modelni ochishda `self.URL` ni
 * so'raydi — bu brauzer API'si, Node'da yo'q va butun o'qish yiqiladi.
 * GLB konteyneri esa oddiy: sarlavha + JSON bo'lagi + ikkilik bo'lak.
 * JSON'ni to'g'ridan-to'g'ri o'qish ham ishonchliroq, ham tezroq —
 * 37 MB tekstura xotiraga umuman yuklanmaydi.
 */

const file = process.argv[2];
if (!file) {
  console.error('Foydalanish: node assets-3d/generator/inspect.mjs <fayl.glb>');
  process.exit(1);
}

const buffer = readFileSync(file);

// ── GLB konteyneri ──
if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error('Bu GLB fayl emas');

const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
let offset = 12; // sarlavha: magic + versiya + uzunlik
let json = null;
let bin = null;

while (offset < buffer.byteLength) {
  const chunkLength = view.getUint32(offset, true);
  const chunkType = view.getUint32(offset + 4, true);
  const start = offset + 8;

  if (chunkType === 0x4e4f534a) json = JSON.parse(buffer.toString('utf8', start, start + chunkLength));
  if (chunkType === 0x004e4942) bin = buffer.subarray(start, start + chunkLength);
  offset = start + chunkLength;
}

if (!json) throw new Error('GLB ichida JSON bo`lagi topilmadi');

const nodes = json.nodes ?? [];
const meshes = json.meshes ?? [];
const accessors = json.accessors ?? [];

console.log(`\n=== ${basename(file)} — ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`);
console.log(`    ${json.asset?.generator ?? 'noma`lum dastur'}\n`);

// ── Skinlarda ishlatilgan node'lar — suyaklar ──
const boneIndices = new Set();
for (const skin of json.skins ?? []) for (const joint of skin.joints) boneIndices.add(joint);
const boneNames = [...boneIndices].map((i) => nodes[i]?.name ?? `node${i}`);

// ── Mesh'lar ──
const rows = [];
let totalTriangles = 0;
let morphNames = null;

for (const node of nodes) {
  if (node.mesh === undefined) continue;
  const mesh = meshes[node.mesh];
  if (!mesh) continue;

  let triangles = 0;
  for (const primitive of mesh.primitives ?? []) {
    const count =
      primitive.indices !== undefined
        ? accessors[primitive.indices]?.count
        : accessors[primitive.attributes?.POSITION]?.count;
    triangles += (count ?? 0) / 3;
  }
  totalTriangles += triangles;

  const targets = mesh.primitives?.[0]?.targets ?? [];
  const names = mesh.extras?.targetNames ?? [];
  if (targets.length > 0 && !morphNames) morphNames = names.length > 0 ? names : ['(nomsiz)'];

  rows.push({
    nom: node.name ?? mesh.name ?? '(nomsiz)',
    tur: node.skin !== undefined ? 'skinned' : 'oddiy',
    uchburchak: Math.round(triangles),
    'shape key': targets.length,
  });
}

console.table(rows.slice(0, 25));
if (rows.length > 25) console.log(`… va yana ${rows.length - 25} ta mesh`);
console.log(`Jami: ${rows.length} mesh, ${Math.round(totalTriangles).toLocaleString()} uchburchak`);

/*
 * ── O'lchami ──
 *
 * ⚠️ Akssessordagi min/max MESH KOORDINATASIDA. Sketchfab va Blender
 * eksportlari ko'pincha node darajasida burish/masshtab qo'yadi (masalan
 * Z-up dunyoni Y-up ga aylantirish uchun). Transformni qo'llamasdan
 * o'lchansa natija butunlay yanglish chiqadi — shuning uchun node
 * daraxti bo'ylab matritsalar to'planadi va chegara nuqtalari o'giriladi.
 */
const bounds = new THREE.Box3();
const corner = new THREE.Vector3();

function nodeMatrix(node) {
  const matrix = new THREE.Matrix4();
  if (node.matrix) return matrix.fromArray(node.matrix);

  return matrix.compose(
    new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
  );
}

function walk(index, parentMatrix) {
  const node = nodes[index];
  if (!node) return;

  const world = new THREE.Matrix4().multiplyMatrices(parentMatrix, nodeMatrix(node));

  if (node.mesh !== undefined) {
    for (const primitive of meshes[node.mesh]?.primitives ?? []) {
      const accessor = accessors[primitive.attributes?.POSITION];
      if (!accessor?.min || !accessor?.max) continue;

      // Sakkizta burchakni o'girib chegarani kengaytiramiz
      for (let bit = 0; bit < 8; bit++) {
        corner.set(
          bit & 1 ? accessor.max[0] : accessor.min[0],
          bit & 2 ? accessor.max[1] : accessor.min[1],
          bit & 4 ? accessor.max[2] : accessor.min[2],
        );
        bounds.expandByPoint(corner.applyMatrix4(world));
      }
    }
  }

  for (const child of node.children ?? []) walk(child, world);
}

const sceneNodes = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
for (const index of sceneNodes) walk(index, new THREE.Matrix4());

const min = bounds.min.toArray();
const max = bounds.max.toArray();
const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

console.log(
  `\nO'lchami: ${size[0].toFixed(2)} × ${size[1].toFixed(2)} × ${size[2].toFixed(2)}` +
    `   (y: ${min[1].toFixed(2)} … ${max[1].toFixed(2)})`,
);

// Eng uzun o'q qaysi — model tik turibdimi yoki yotibdimi
const tallest = size.indexOf(Math.max(...size));
console.log(`   eng uzun o'q: ${'XYZ'[tallest]}${tallest === 1 ? ' (tik — to`g`ri)' : ' ⚠️ Y emas'}`);

// ── Skelet ──
console.log(`\nSuyaklar: ${boneNames.length} ta`);
if (boneNames.length > 0) {
  const mixamo = boneNames.filter((name) => /mixamorig/i.test(name)).length;
  console.log(`   Mixamo nomlash: ${mixamo}/${boneNames.length}`);
  console.log(`   Namuna: ${boneNames.slice(0, 8).join(', ')}`);
}

console.log(`\nShape key: ${morphNames ? morphNames.slice(0, 10).join(', ') : 'yo`q'}`);

// ── Tekstura ──
const images = json.images ?? [];
console.log(`\nMateriallar: ${(json.materials ?? []).length} ta`);
console.log(`Teksturalar: ${images.length} ta`);
for (const image of images.slice(0, 8)) {
  const bufferView = json.bufferViews?.[image.bufferView];
  const kb = bufferView ? Math.round(bufferView.byteLength / 1024) : '?';
  console.log(`   ${image.name ?? '(nomsiz)'} — ${image.mimeType ?? '?'}, ${kb} KB`);
}

console.log(`\nAnimatsiya: ${(json.animations ?? []).length} ta`);
for (const animation of json.animations ?? []) {
  console.log(`   ${animation.name ?? '(nomsiz)'} — ${animation.channels.length} kanal`);
}

/*
 * ── Proporsiya ──
 *
 * Vertekslar BIN bo'lagidan o'qiladi. Eng ishonchli mezon — BOSH SONI:
 * kattalar tanasi ~7.5 bosh balandligida. 7 dan kam bo'lsa multfilm,
 * 8 dan ko'p bo'lsa moda illyustratsiyasi — ikkalasi ham kiyim o'lchamiga
 * bog'langan ilovada yaramaydi.
 *
 * Bosh balandligi siluetdan topiladi: yuqori choraкда en eng tor bo'lgan
 * joy — bo'yin, undan tepasi bosh.
 */
function readPoints() {
  const points = [];

  const visit = (index, parentMatrix) => {
    const node = nodes[index];
    if (!node) return;
    const world = new THREE.Matrix4().multiplyMatrices(parentMatrix, nodeMatrix(node));

    if (node.mesh !== undefined) {
      for (const primitive of meshes[node.mesh]?.primitives ?? []) {
        const accessor = accessors[primitive.attributes?.POSITION];
        const bufferView = json.bufferViews?.[accessor?.bufferView];
        if (!accessor || !bufferView || !bin) continue;

        const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const stride = bufferView.byteStride ?? 12;

        for (let i = 0; i < accessor.count; i++) {
          const at = start + i * stride;
          points.push(
            new THREE.Vector3(
              bin.readFloatLE(at),
              bin.readFloatLE(at + 4),
              bin.readFloatLE(at + 8),
            ).applyMatrix4(world),
          );
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };

  for (const index of sceneNodes) visit(index, new THREE.Matrix4());
  return points;
}

const points = readPoints();

if (points.length > 0) {
  const height = size[1];
  const widthAt = (fraction) => {
    const y = min[1] + height * fraction;
    const slab = points.filter((point) => Math.abs(point.y - y) < height * 0.02);
    if (slab.length < 3) return 0;
    return Math.max(...slab.map((p) => p.x)) - Math.min(...slab.map((p) => p.x));
  };

  // Bo'yin — yuqori chorakda eng tor kesim
  let neck = 0.88;
  let narrowest = Infinity;
  for (let f = 0.8; f < 0.95; f += 0.01) {
    const w = widthAt(f);
    if (w > 0 && w < narrowest) {
      narrowest = w;
      neck = f;
    }
  }

  const headCount = 1 / (1 - neck);
  console.log(`\nProporsiya: bosh soni ~${headCount.toFixed(1)}  (kattalarda 7–8)`);

  console.log('\nSiluet:');
  for (let f = 0.95; f >= 0.05; f -= 0.1) {
    const w = widthAt(f);
    const bar = '█'.repeat(Math.round((w / height) * 45));
    console.log(`  ${(f * 100).toFixed(0).padStart(3)}%  ${bar || '—'}`);
  }
}

// ── Ilova talablari ──
const REQUIRED_PARTS = [
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
const REQUIRED_MORPHS = [
  'mt_height',
  'mt_weight',
  'mt_shoulderWidth',
  'mt_chest',
  'mt_waist',
  'mt_hips',
];

const meshNames = new Set(rows.map((row) => row.nom));
const haveParts = REQUIRED_PARTS.filter((part) => meshNames.has(part));
const haveMorphs = REQUIRED_MORPHS.filter((name) => morphNames?.includes(name));
const sockets = nodes.filter((node) => node.name?.startsWith('socket_'));

console.log('\n── Ilova talablari ──');
const check = (ok, label) => console.log(`   ${ok ? '✓' : '✗'} ${label}`);

check(haveParts.length === REQUIRED_PARTS.length, `15 ta nomlangan tana qismi (${haveParts.length}/15)`);
check(boneNames.length > 0, `skelet (${boneNames.length} suyak)`);
check(
  boneNames.length > 0 && boneNames.every((name) => /mixamorig/i.test(name)),
  'Mixamo suyak nomlari',
);
check(haveMorphs.length === REQUIRED_MORPHS.length, `6 ta mt_* shape key (${haveMorphs.length}/6)`);
check(sockets.length === 8, `8 ta socket (${sockets.length}/8)`);
check(Math.abs(min[1]) < 0.05, `oyoq y=0 da (hozir ${min[1].toFixed(3)})`);
check(size[1] > 1.4 && size[1] < 2.1, `bo'y metrda (${size[1].toFixed(2)})`);
check(statSync(file).size < 3 * 1024 * 1024, `hajmi 3 MB dan kichik (hozir ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
