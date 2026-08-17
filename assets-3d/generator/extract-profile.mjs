import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Haqiqiy tana modelidan kiyim uchun profil o'lchab oladi.
 *
 *   node assets-3d/generator/extract-profile.mjs
 *
 * NEGA KERAK: kiyim shakli ilgari qo'lda yozilgan raqamlardan qurilardi
 * (`profiles.mjs`). Tana protsedural bo'lganda bu ishlagan — ikkalasi
 * bir manbadan edi. Endi tana tashqaridan keladi va uning o'lchamlari
 * boshqacha: ko'krak 98 sm o'rniga 117 sm. Qo'lda yozilgan profil
 * eskiradi va kiyim tanaga botadi — buni validator ushladi
 * (y=1.44 da 92 mm).
 *
 * Shuning uchun profil endi TANANING O'ZIDAN o'lchanadi: har balandlikda
 * gavda kesimi o'qiladi va ellips bilan yaqinlashtiriladi.
 *
 * ⚠️ O'LCHOV ERKAK TANASIDAN OLINADI. Ayol tanasi ingichkaroq (ko'krak
 * 99 sm), lekin ilova kiyimni jinsga qarab almashtirmaydi — bitta model
 * ikkalasiga ham kiyiladi. Kattarog'iga moslansa kiyim ayolda bo'sh
 * turadi (bu tabiiy), teskarisi bo'lsa tanaga botadi (bu buzuq).
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'export');

/** Qaysi balandliklarda o'lchanadi — bel va ko'krak atrofida zichroq */
const LEVELS = [
  0.8, 0.84, 0.88, 0.92, 0.96, 1.0, 1.04, 1.07, 1.11, 1.15, 1.19, 1.24, 1.28, 1.32, 1.36, 1.4,
  1.44, 1.47,
];

const buffer = readFileSync(join(OUT, 'male-base-v1.glb'));
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    '',
    resolve,
    reject,
  ),
);

/** Neytral holatdagi (shape key 0.5) gavda vertekslari */
const points = [];
gltf.scene.traverse((child) => {
  if (child.name !== 'body_torso') return;

  const position = child.geometry.attributes.position;
  const targets = child.geometry.morphAttributes.position ?? [];
  const relative = child.geometry.morphTargetsRelative;

  for (let i = 0; i < position.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i);
    for (const target of targets) {
      const delta = new THREE.Vector3().fromBufferAttribute(target, i);
      if (!relative) delta.sub(new THREE.Vector3().fromBufferAttribute(position, i));
      point.addScaledVector(delta, 0.5);
    }
    points.push(point);
  }
});

if (points.length === 0) throw new Error('body_torso topilmadi');

const keys = [];

for (const level of LEVELS) {
  const slab = points.filter((point) => Math.abs(point.y - level) <= 0.025);
  if (slab.length < 6) continue;

  const rx = Math.max(...slab.map((point) => Math.abs(point.x)));
  const zMin = Math.min(...slab.map((point) => point.z));
  const zMax = Math.max(...slab.map((point) => point.z));

  keys.push([
    Number(level.toFixed(3)),
    Number(rx.toFixed(4)),
    Number(((zMax - zMin) / 2).toFixed(4)),
    Number(((zMax + zMin) / 2).toFixed(4)),
  ]);
}

writeFileSync(
  join(OUT, 'body-profile.json'),
  `${JSON.stringify({ source: 'male-base-v1.glb', keys }, null, 2)}\n`,
);

console.log(`${keys.length} daraja o'lchandi → export/body-profile.json\n`);
console.log("balandlik   yon      chuqurlik   siljish");
for (const [y, rx, rz, cz] of keys) {
  console.log(
    `   ${y.toFixed(2)}    ${rx.toFixed(3)}    ${rz.toFixed(3)}      ${cz >= 0 ? ' ' : ''}${cz.toFixed(3)}`,
  );
}
