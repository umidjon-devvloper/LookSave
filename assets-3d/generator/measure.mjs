import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Yasalgan tananing proporsiyalarini o'lchaydi.
 *
 *   node assets-3d/generator/measure.mjs
 *
 * NEGA KERAK: modelni ko'rmasdan turib "odamga o'xshaydimi" degan savolga
 * javob berish kerak. Ko'z o'rniga nisbatlar ishlatiladi — ular
 * antropometriyada barqaror va chetga chiqqani darhol bilinadi.
 *
 * Eng ishonchli mezon — BOSH SONI: kattalar tanasi taxminan 7.5 bosh
 * balandligida. 6 dan kam bo'lsa figura bolalarnikidek, 8 dan ko'p bo'lsa
 * cho'zilgan (moda illyustratsiyasi) ko'rinadi.
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'export');

/**
 * Antropometrik oraliqlar. Bir qismi JINSGA BOG'LIQ — erkak mezonini
 * ayolga qo'llash modelni noto'g'ri "tuzatishga" undaydi (yelkani
 * kengaytirib, figurani erkaknikiga aylantirib qo'yadi).
 */
const EXPECTED = {
  male: {
    'bosh soni': [7.0, 8.0],
    'yelka / bo`y': [0.22, 0.27],
    'ko`krak / yelka': [0.72, 0.92],
    'bel / ko`krak': [0.72, 0.95],
    // Trokanter balandligi (son bo'g'imidan yergacha) — 0.53 atrofida
    'oyoq / bo`y': [0.5, 0.57],
    // Yelka bo'g'imidan barmoq uchigacha
    'qo`l / bo`y': [0.42, 0.5],
  },
  female: {
    'bosh soni': [7.0, 8.0],
    'yelka / bo`y': [0.2, 0.24],
    'ko`krak / yelka': [0.72, 0.92],
    'bel / ko`krak': [0.7, 0.9],
    'oyoq / bo`y': [0.5, 0.57],
    'qo`l / bo`y': [0.42, 0.5],
  },
};

/**
 * Berilgan balandlikdagi kesim aylanasi (metr).
 *
 * NEGA EN EMAS, AYLANA: kiyim o'lchami lenta bilan o'lchanadi va
 * `src/sizing.ts` ham aylanadan razmerni hisoblaydi. En bilan solishtirish
 * chalg'itadi — yassi va dumaloq kesim bir xil enda butunlay boshqa
 * aylanaga ega bo'ladi.
 *
 * Nuqtalar markaz atrofidagi burchak bo'yicha tartiblanadi va qo'shni
 * nuqtalar orasidagi masofalar qo'shiladi.
 */
function circumferenceAt(points, y, tolerance = 0.012) {
  const slice = points.filter((point) => Math.abs(point.y - y) <= tolerance);
  if (slice.length < 8) return 0;

  const cx = slice.reduce((sum, p) => sum + p.x, 0) / slice.length;
  const cz = slice.reduce((sum, p) => sum + p.z, 0) / slice.length;

  const ordered = slice
    .map((p) => ({ p, angle: Math.atan2(p.z - cz, p.x - cx) }))
    .sort((a, b) => a.angle - b.angle);

  let total = 0;
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i].p;
    const b = ordered[(i + 1) % ordered.length].p;
    total += Math.hypot(a.x - b.x, a.z - b.z);
  }
  return total;
}

async function load(file) {
  const buffer = readFileSync(join(OUT, file));
  return new Promise((resolve, reject) =>
    new GLTFLoader().parse(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      '',
      resolve,
      reject,
    ),
  );
}

/** Neytral holatdagi (barcha shape key 0.5) vertekslarni qaytaradi */
function neutralPoints(mesh) {
  const position = mesh.geometry.attributes.position;
  const targets = mesh.geometry.morphAttributes.position ?? [];
  const relative = mesh.geometry.morphTargetsRelative;
  const points = [];

  for (let i = 0; i < position.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i);
    for (const target of targets) {
      const delta = new THREE.Vector3().fromBufferAttribute(target, i);
      if (!relative) delta.sub(new THREE.Vector3().fromBufferAttribute(position, i));
      point.addScaledVector(delta, 0.5);
    }
    points.push(point);
  }

  return points;
}

/** Berilgan balandlikdagi kesimning eni (X bo'yicha) */
function widthAt(points, y, tolerance = 0.02) {
  let min = Infinity;
  let max = -Infinity;

  for (const point of points) {
    if (Math.abs(point.y - y) > tolerance) continue;
    if (point.x < min) min = point.x;
    if (point.x > max) max = point.x;
  }

  return max > min ? max - min : 0;
}

for (const gender of ['male', 'female']) {
  const gltf = await load(`${gender}-base-v1.glb`);

  const parts = new Map();
  gltf.scene.traverse((child) => {
    if (child.isMesh) parts.set(child.name, neutralPoints(child));
  });

  const all = [...parts.values()].flat();
  const box = new THREE.Box3().setFromPoints(all);
  const height = box.max.y - box.min.y;

  const head = new THREE.Box3().setFromPoints(parts.get('body_head') ?? []);
  const headHeight = head.max.y - head.min.y;

  const torso = parts.get('body_torso') ?? [];
  const shoulder = widthAt(torso, 1.38);
  const chest = widthAt(torso, 1.24);
  const waist = widthAt(torso, 1.07);
  const hips = widthAt(torso, 0.92);

  const foot = new THREE.Box3().setFromPoints(parts.get('body_foot_L') ?? []);
  const hip = new THREE.Box3().setFromPoints(parts.get('body_thigh_L') ?? []);
  const legLength = hip.max.y - foot.min.y;

  const hand = new THREE.Box3().setFromPoints(parts.get('body_hand_L') ?? []);
  const upperArm = new THREE.Box3().setFromPoints(parts.get('body_upperArm_L') ?? []);
  const armLength = upperArm.max.y - hand.min.y;

  const ratios = {
    'bosh soni': height / headHeight,
    'yelka / bo`y': shoulder / height,
    'ko`krak / yelka': chest / shoulder,
    'bel / ko`krak': waist / chest,
    'oyoq / bo`y': legLength / height,
    'qo`l / bo`y': armLength / height,
  };

  console.log(`\n── ${gender} — bo'y ${height.toFixed(3)} m, bosh ${headHeight.toFixed(3)} m`);
  console.log(
    `   yelka ${shoulder.toFixed(3)}  ko'krak ${chest.toFixed(3)}  bel ${waist.toFixed(3)}  son ${hips.toFixed(3)}`,
  );

  const cm = (value) => `${(value * 100).toFixed(0)} sm`;
  console.log(
    `   aylana — ko'krak ${cm(circumferenceAt(torso, 1.24))}, bel ${cm(circumferenceAt(torso, 1.07))}, son ${cm(circumferenceAt(torso, 0.92))}`,
  );

  for (const [label, value] of Object.entries(ratios)) {
    const [low, high] = EXPECTED[gender][label];
    const ok = value >= low && value <= high;
    console.log(
      `   ${ok ? '✓' : '✗'} ${label.padEnd(22)} ${value.toFixed(2)}  (kutilgan ${low}–${high})`,
    );
  }
}
