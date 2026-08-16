import * as THREE from 'three';

import { limb, loft, verticalRings } from './loft.mjs';
import { bonePosition, buildSkeleton } from './skeleton.mjs';
import { headKeys, SHAPE, torsoKeys } from './profiles.mjs';
import { addMorphTargets, attachMorphNames, bindToBone } from './shape.mjs';

/**
 * Avatar tanasi (04-3d-pipeline §2).
 *
 * TANA BITTA MESH EMAS — 15 ta alohida qism. Sabab hujjatda: kiyim
 * ostidagi tana qismi yashirilishi kerak, aks holda u kiyim ichidan
 * "qalqib" chiqadi (Z-fighting). `assets_3d.hide_body_parts` aynan shu
 * nomlarni saqlaydi.
 *
 * SHAKL PROFIL JADVALLARIDAN quriladi (`loft.mjs`), primitivlardan emas.
 * Ya'ni yelka kengligi, bel torligi, boldir bo'rtig'i — hammasi shu
 * fayldagi raqamlar bilan boshqariladi va ularni o'zgartirish uchun
 * geometriya kodiga tegish shart emas.
 *
 * ⚠️ Bu STILIZATSIYA QILINGAN base mesh. Proporsiyalar o'rtacha
 * antropometriyaga yaqin, lekin yuz qirralari, soch, teri relyefi yo'q —
 * ular Blender/skan ishi. Bu model ularning o'rnini bosmaydi, ustiga
 * ishlash uchun asos beradi.
 */

const PARTS = [
  ['body_head', 'Head'],
  ['body_neck', 'Neck'],
  ['body_torso', 'Spine1'],
  ['body_upperArm_L', 'LeftArm'],
  ['body_upperArm_R', 'RightArm'],
  ['body_forearm_L', 'LeftForeArm'],
  ['body_forearm_R', 'RightForeArm'],
  ['body_hand_L', 'LeftHand'],
  ['body_hand_R', 'RightHand'],
  ['body_thigh_L', 'LeftUpLeg'],
  ['body_thigh_R', 'RightUpLeg'],
  ['body_calf_L', 'LeftLeg'],
  ['body_calf_R', 'RightLeg'],
  ['body_foot_L', 'LeftFoot'],
  ['body_foot_R', 'RightFoot'],
];

function partGeometry(name, at, shape) {
  const right = name.endsWith('_R');
  const side = right ? 'Right' : 'Left';
  const k = shape.limbs;

  switch (name) {
    case 'body_torso':
      return loft(verticalRings(torsoKeys(shape), 4), { radialSegments: 24, capEnd: false });

    case 'body_neck':
      return loft(
        verticalRings(
          [
            [1.4, 0.062, 0.066, 0],
            [1.47, 0.055, 0.06, 0.002],
            [1.52, 0.052, 0.058, 0.002],
          ],
          3,
        ),
        { radialSegments: 16, capStart: false, capEnd: false },
      );

    case 'body_head':
      return loft(verticalRings(headKeys(), 4), { radialSegments: 22, capStart: false });

    case 'body_upperArm_L':
    case 'body_upperArm_R':
      return limb(
        at(`${side}Arm`).toArray(),
        at(`${side}ForeArm`).toArray(),
        [
          [0, 0.06 * k, 0.06 * k], // deltoid
          [0.35, 0.05 * k, 0.05 * k], // bitseps
          [1, 0.041 * k, 0.041 * k], // tirsak
        ],
        { radialSegments: 14 },
      );

    case 'body_forearm_L':
    case 'body_forearm_R':
      return limb(
        at(`${side}ForeArm`).toArray(),
        at(`${side}Hand`).toArray(),
        [
          [0, 0.043 * k, 0.043 * k],
          [0.3, 0.041 * k, 0.041 * k],
          [1, 0.028 * k, 0.031 * k], // bilak
        ],
        { radialSegments: 14 },
      );

    case 'body_hand_L':
    case 'body_hand_R': {
      const wrist = at(`${side}Hand`);
      // Qo'l pastga osilgan — kaft tanaga qaragan, shuning uchun X bo'yicha
      // yupqa, Z bo'yicha keng
      return limb(
        wrist.toArray(),
        [wrist.x + (right ? -0.006 : 0.006), wrist.y - 0.19, wrist.z],
        [
          [0, 0.026 * k, 0.038 * k],
          [0.35, 0.03 * k, 0.05 * k], // kaft
          [0.75, 0.026 * k, 0.045 * k],
          [1, 0.016 * k, 0.028 * k], // barmoq uchlari
        ],
        { radialSegments: 12 },
      );
    }

    case 'body_thigh_L':
    case 'body_thigh_R':
      return limb(
        at(`${side}UpLeg`).toArray(),
        at(`${side}Leg`).toArray(),
        [
          [0, 0.092 * k, 0.096 * k],
          [0.3, 0.082 * k, 0.087 * k],
          [1, 0.056 * k, 0.059 * k], // tizza
        ],
        { radialSegments: 16 },
      );

    case 'body_calf_L':
    case 'body_calf_R':
      return limb(
        at(`${side}Leg`).toArray(),
        at(`${side}Foot`).toArray(),
        [
          [0, 0.057 * k, 0.059 * k],
          [0.25, 0.064 * k, 0.068 * k], // boldir bo'rtig'i
          [0.7, 0.042 * k, 0.046 * k],
          [1, 0.032 * k, 0.036 * k], // to'piq
        ],
        { radialSegments: 16 },
      );

    case 'body_foot_L':
    case 'body_foot_R': {
      const ankle = at(`${side}Foot`);
      // O'q deyarli gorizontal (tovondan barmoqqa) — halqalar tik turadi,
      // shuning uchun `rx` eni, `rz` balandligi bo'lib qoladi
      return limb(
        [ankle.x, 0.042, ankle.z - 0.058],
        [ankle.x, 0.02, ankle.z + 0.15],
        [
          [0, 0.032, 0.042], // tovon
          [0.35, 0.042, 0.038],
          [0.75, 0.045, 0.026],
          [1, 0.034, 0.016], // barmoqlar
        ],
        { radialSegments: 14 },
      );
    }

    default:
      throw new Error(`Noma'lum qism: ${name}`);
  }
}

export function buildBody(gender = 'male') {
  const shape = SHAPE[gender];
  if (!shape) throw new Error(`Noma'lum jins: ${gender}`);

  const { root, bones, boneIndex, byName } = buildSkeleton();

  // Yelka va son suyaklari ham jinsga qarab suriladi — aks holda qo'l
  // gavdadan ajralib qoladi
  for (const name of ['LeftShoulder', 'RightShoulder']) {
    byName.get(name).position.x *= shape.shoulders;
  }
  for (const name of ['LeftUpLeg', 'RightUpLeg']) {
    byName.get(name).position.x *= shape.hips;
  }
  root.updateMatrixWorld(true);

  const at = (name) => bonePosition(byName, name);

  const material = new THREE.MeshStandardMaterial({
    color: shape.color,
    roughness: 0.74,
    metalness: 0.03,
  });

  const group = new THREE.Group();
  group.name = `avatar_${gender}`;
  group.add(root);

  const skeleton = new THREE.Skeleton(bones);
  const meshes = [];

  for (const [name, bone] of PARTS) {
    const geometry = partGeometry(name, at, shape);
    addMorphTargets(geometry);
    bindToBone(geometry, `mixamorig:${bone}`, boneIndex);

    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = name;
    attachMorphNames(mesh);

    group.add(mesh);
    mesh.bind(skeleton);
    meshes.push(mesh);
  }

  return { group, skeleton, byName, boneIndex, at, meshes };
}
