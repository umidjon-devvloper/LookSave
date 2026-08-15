import * as THREE from 'three';

import { addMorphTargets, attachMorphNames, boxAt, capsuleBetween, ellipsoidAt } from './shape.mjs';

/**
 * Kiyim modellari.
 *
 * ⚠️ KIYIM SKINNED EMAS — oddiy mesh. Sabab ilova kodida: `AnimationRig`
 * faqat TANADAN quriladi (`AvatarScene.tsx`), kiyim esa sahnaga alohida
 * `primitive` bo'lib qo'shiladi va hech qayerda tana skeletiga qayta
 * bog'lanmaydi. Ya'ni kiyimga teri og'irliklari yozilsa ham ular hech
 * qachon ishlatilmaydi — faqat fayl hajmini oshiradi.
 *
 * ⚠️ BUNING NARXI: animatsiya qo'shilganda tana harakatlanadi, kiyim esa
 * joyida qotib qoladi. Buni tuzatish uchun ilovada kiyimni tana skeletiga
 * bog'lash kerak bo'ladi (`SkeletonUtils` yoki qo'lda). Hozircha klip yo'q,
 * shuning uchun bu ko'rinmaydi — lekin klip qo'shishdan oldin hal qilinsin.
 *
 * Shape key'lar esa SHART: `applyMorphs` kiyimga ham qo'llanadi va
 * o'lchamga moslanmagan kiyim tanadan chiqib turadi (04-3d-pipeline §3).
 */

/** Kiyim tanadan shuncha qalinroq — ichkariga botib ketmasligi uchun */
const CLEARANCE = 0.014;

function fabric(color, roughness = 0.86) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function part(name, geometry, material) {
  addMorphTargets(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return attachMorphNames(mesh);
}

/** Ustki kiyim gavdasi — futbolka va kurtka uchun umumiy */
function torsoShell(at, { extra, top, bottom }) {
  const geometry = capsuleBetween(
    [0, at('Hips').y + bottom, 0],
    [0, at('Spine2').y + top, 0],
    0.148 + CLEARANCE + extra,
    20,
  );
  geometry.scale(1, 1, 0.74);
  return geometry;
}

/** Yeng — yelkadan berilgan nuqtagacha */
function sleeve(at, side, { toBone, radius }) {
  const arm = side > 0 ? 'LeftArm' : 'RightArm';
  const end = side > 0 ? `Left${toBone}` : `Right${toBone}`;
  return capsuleBetween(at(arm).toArray(), at(end).toArray(), radius, 12);
}

const BUILDERS = {
  /** Futbolka — qisqa yeng */
  tshirt(at, color) {
    const material = fabric(color);
    const group = new THREE.Group();

    group.add(part('tshirt_body', torsoShell(at, { extra: 0.01, top: 0.05, bottom: 0.02 }), material));

    for (const side of [1, -1]) {
      const arm = at(side > 0 ? 'LeftArm' : 'RightArm');
      const fore = at(side > 0 ? 'LeftForeArm' : 'RightForeArm');
      // Qisqa yeng — yelkadan bilakning 45% igacha
      const end = arm.clone().lerp(fore, 0.45);
      const geometry = capsuleBetween(arm.toArray(), end.toArray(), 0.049 + CLEARANCE + 0.008, 12);
      group.add(part(side > 0 ? 'tshirt_sleeve_L' : 'tshirt_sleeve_R', geometry, material));
    }

    return group;
  },

  /** Kurtka — uzun yeng, gavdasi kengroq */
  jacket(at, color) {
    const material = fabric(color, 0.72);
    const group = new THREE.Group();

    group.add(part('jacket_body', torsoShell(at, { extra: 0.026, top: 0.06, bottom: -0.04 }), material));

    for (const side of [1, -1]) {
      const geometry = sleeve(at, side, { toBone: 'Hand', radius: 0.049 + CLEARANCE + 0.018 });
      group.add(part(side > 0 ? 'jacket_sleeve_L' : 'jacket_sleeve_R', geometry, material));
    }

    return group;
  },

  /** Shim — beldan to'piqqacha */
  pants(at, color) {
    const material = fabric(color, 0.9);
    const group = new THREE.Group();

    // Bel qismi
    const hips = at('Hips');
    const waist = capsuleBetween([0, hips.y - 0.07, 0], [0, hips.y + 0.06, 0], 0.15 + CLEARANCE, 18);
    waist.scale(1, 1, 0.8);
    group.add(part('pants_waist', waist, material));

    for (const side of [1, -1]) {
      const up = at(side > 0 ? 'LeftUpLeg' : 'RightUpLeg');
      const knee = at(side > 0 ? 'LeftLeg' : 'RightLeg');
      const ankle = at(side > 0 ? 'LeftFoot' : 'RightFoot');

      const thigh = capsuleBetween(up.toArray(), knee.toArray(), 0.077 + CLEARANCE + 0.012, 12);
      const calf = capsuleBetween(
        knee.toArray(),
        [ankle.x, ankle.y + 0.03, ankle.z],
        0.059 + CLEARANCE + 0.01,
        12,
      );

      group.add(part(side > 0 ? 'pants_thigh_L' : 'pants_thigh_R', thigh, material));
      group.add(part(side > 0 ? 'pants_calf_L' : 'pants_calf_R', calf, material));
    }

    return group;
  },

  /** Krossovka — taglik va ustki qism */
  sneakers(at, color) {
    const upper = fabric(color, 0.6);
    const sole = fabric(0x1b1724, 0.95);
    const group = new THREE.Group();

    for (const side of [1, -1]) {
      const foot = at(side > 0 ? 'LeftFoot' : 'RightFoot');
      const suffix = side > 0 ? 'L' : 'R';

      group.add(
        part(
          `sneaker_sole_${suffix}`,
          boxAt([foot.x, 0.017, foot.z + 0.05], [0.104, 0.034, 0.253]),
          sole,
        ),
      );
      group.add(
        part(
          `sneaker_upper_${suffix}`,
          ellipsoidAt([foot.x, 0.058, foot.z + 0.035], [0.05, 0.042, 0.115], 12),
          upper,
        ),
      );
    }

    return group;
  },

  /** Kepka — gumbaz va kozirek */
  cap(at, color) {
    const material = fabric(color, 0.7);
    const group = new THREE.Group();
    const head = at('Head');

    const dome = ellipsoidAt([0, head.y + 0.095, 0.008], [0.094, 0.078, 0.1], 16);
    group.add(part('cap_dome', dome, material));

    const visor = boxAt([0, head.y + 0.072, 0.115], [0.15, 0.014, 0.11]);
    group.add(part('cap_visor', visor, material));

    return group;
  },
};

/**
 * Katalog — nima yasaladi. `hideBodyParts` `assets_3d` jadvaliga tushadi
 * va ilova shu nomlarni yashiradi (04-3d-pipeline §2).
 */
export const CATALOG = [
  {
    key: 'tshirt-white',
    builder: 'tshirt',
    slot: 'top',
    title: 'Oddiy futbolka',
    colorName: 'Oq',
    colorHex: '#F2F2F5',
    color: 0xf2f2f5,
    hideBodyParts: ['body_torso'],
  },
  {
    key: 'tshirt-black',
    builder: 'tshirt',
    slot: 'top',
    title: 'Oddiy futbolka',
    colorName: 'Qora',
    colorHex: '#1C1A22',
    color: 0x1c1a22,
    hideBodyParts: ['body_torso'],
  },
  {
    key: 'tshirt-violet',
    builder: 'tshirt',
    slot: 'top',
    title: 'Oddiy futbolka',
    colorName: 'Binafsha',
    colorHex: '#8B5CF6',
    color: 0x8b5cf6,
    hideBodyParts: ['body_torso'],
  },
  {
    key: 'jacket-denim',
    builder: 'jacket',
    slot: 'outer',
    title: 'Jinsi kurtka',
    colorName: "Ko'k",
    colorHex: '#3B5A8C',
    color: 0x3b5a8c,
    hideBodyParts: [
      'body_torso',
      'body_upperArm_L',
      'body_upperArm_R',
      'body_forearm_L',
      'body_forearm_R',
    ],
  },
  {
    key: 'pants-graphite',
    builder: 'pants',
    slot: 'bottom',
    title: 'Klassik shim',
    colorName: 'Grafit',
    colorHex: '#3A3746',
    color: 0x3a3746,
    hideBodyParts: ['body_thigh_L', 'body_thigh_R', 'body_calf_L', 'body_calf_R'],
  },
  {
    key: 'pants-beige',
    builder: 'pants',
    slot: 'bottom',
    title: 'Chino shim',
    colorName: 'Bej',
    colorHex: '#C8B79A',
    color: 0xc8b79a,
    hideBodyParts: ['body_thigh_L', 'body_thigh_R', 'body_calf_L', 'body_calf_R'],
  },
  {
    key: 'sneakers-white',
    builder: 'sneakers',
    slot: 'feet',
    title: 'Krossovka',
    colorName: 'Oq',
    colorHex: '#EDEDF2',
    color: 0xededf2,
    hideBodyParts: ['body_foot_L', 'body_foot_R'],
  },
  {
    key: 'sneakers-black',
    builder: 'sneakers',
    slot: 'feet',
    title: 'Krossovka',
    colorName: 'Qora',
    colorHex: '#201D28',
    color: 0x201d28,
    hideBodyParts: ['body_foot_L', 'body_foot_R'],
  },
  {
    key: 'cap-black',
    builder: 'cap',
    slot: 'head',
    title: 'Kepka',
    colorName: 'Qora',
    colorHex: '#1C1A22',
    color: 0x1c1a22,
    // Kepka tana qismini yashirmaydi — soch alohida hal qilinadi
    hideBodyParts: [],
  },
  {
    key: 'cap-violet',
    builder: 'cap',
    slot: 'head',
    title: 'Kepka',
    colorName: 'Binafsha',
    colorHex: '#8B5CF6',
    color: 0x8b5cf6,
    hideBodyParts: [],
  },
];

export function buildGarment(spec, at) {
  const build = BUILDERS[spec.builder];
  if (!build) throw new Error(`Noma'lum kiyim turi: ${spec.builder}`);

  const group = build(at, spec.color);
  group.name = spec.key;
  return group;
}
