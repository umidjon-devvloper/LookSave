import * as THREE from 'three';

import { bonePosition, buildSkeleton } from './skeleton.mjs';
import {
  addMorphTargets,
  attachMorphNames,
  bindToBone,
  boxAt,
  capsuleBetween,
  ellipsoidAt,
} from './shape.mjs';

/**
 * Avatar tanasi (04-3d-pipeline §2).
 *
 * TANA BITTA MESH EMAS — 15 ta alohida qism. Sabab hujjatda: kiyim
 * ostidagi tana qismi yashirilishi kerak, aks holda u kiyim ichidan
 * "qalqib" chiqadi (Z-fighting). `assets_3d.hide_body_parts` aynan shu
 * nomlarni saqlaydi.
 *
 * ⚠️ Bu STILIZATSIYA QILINGAN maneken, skan emas. Proporsiyalar o'rtacha
 * antropometriyaga yaqin, lekin anatomik aniqlikka da'vo qilmaydi.
 */

/** Erkak/ayol farqi — bir xil skelet, boshqa qalinliklar */
const SHAPE = {
  male: {
    color: 0xb9aec6,
    torsoRadius: 0.148,
    torsoDepth: 0.72,
    shoulderSpread: 1.0,
    hipSpread: 1.0,
    thighRadius: 0.077,
    armRadius: 0.049,
  },
  female: {
    color: 0xc7b6cf,
    torsoRadius: 0.134,
    torsoDepth: 0.7,
    // Yelka torroq, son kengroq
    shoulderSpread: 0.92,
    hipSpread: 1.1,
    thighRadius: 0.082,
    armRadius: 0.043,
  },
};

/** Har bir qism qaysi suyakka bog'lanadi */
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

/** Suyaklar orasidagi geometriyani yasaydi */
function partGeometry(name, at, shape) {
  const side = name.endsWith('_R') ? -1 : 1;

  switch (name) {
    case 'body_head': {
      const head = at('Head');
      return ellipsoidAt([0, head.y + 0.075, 0.008], [0.086, 0.108, 0.096], 18);
    }
    case 'body_neck':
      return capsuleBetween(at('Neck').toArray(), at('Head').toArray(), 0.046, 10);

    case 'body_torso': {
      const hips = at('Hips');
      const spine2 = at('Spine2');
      const geometry = capsuleBetween(
        [0, hips.y + 0.02, 0],
        [0, spine2.y + 0.06, 0],
        shape.torsoRadius,
        20,
      );
      // Ko'krak qafasi doira emas — oldindan orqaga yassiroq
      geometry.scale(1, 1, shape.torsoDepth);
      return geometry;
    }

    case 'body_upperArm_L':
    case 'body_upperArm_R':
      return capsuleBetween(
        at(side > 0 ? 'LeftArm' : 'RightArm').toArray(),
        at(side > 0 ? 'LeftForeArm' : 'RightForeArm').toArray(),
        shape.armRadius,
        10,
      );

    case 'body_forearm_L':
    case 'body_forearm_R':
      return capsuleBetween(
        at(side > 0 ? 'LeftForeArm' : 'RightForeArm').toArray(),
        at(side > 0 ? 'LeftHand' : 'RightHand').toArray(),
        shape.armRadius * 0.86,
        10,
      );

    case 'body_hand_L':
    case 'body_hand_R': {
      const hand = at(side > 0 ? 'LeftHand' : 'RightHand');
      return ellipsoidAt([hand.x, hand.y - 0.045, hand.z], [0.038, 0.058, 0.024], 10);
    }

    case 'body_thigh_L':
    case 'body_thigh_R':
      return capsuleBetween(
        at(side > 0 ? 'LeftUpLeg' : 'RightUpLeg').toArray(),
        at(side > 0 ? 'LeftLeg' : 'RightLeg').toArray(),
        shape.thighRadius,
        12,
      );

    case 'body_calf_L':
    case 'body_calf_R':
      return capsuleBetween(
        at(side > 0 ? 'LeftLeg' : 'RightLeg').toArray(),
        at(side > 0 ? 'LeftFoot' : 'RightFoot').toArray(),
        shape.thighRadius * 0.76,
        12,
      );

    case 'body_foot_L':
    case 'body_foot_R': {
      const foot = at(side > 0 ? 'LeftFoot' : 'RightFoot');
      return boxAt([foot.x, 0.038, foot.z + 0.05], [0.092, 0.076, 0.235]);
    }

    default:
      throw new Error(`Noma'lum qism: ${name}`);
  }
}

/**
 * Tanani quradi. Qaytadi: `{ group, skeleton, byName }` —
 * `skeleton` kiyimlarni ham shu suyaklarga bog'lash uchun kerak.
 */
export function buildBody(gender = 'male') {
  const shape = SHAPE[gender];
  if (!shape) throw new Error(`Noma'lum jins: ${gender}`);

  const { root, bones, boneIndex, byName } = buildSkeleton();

  // Yelka va son kengligi jinsga qarab — suyaklarning o'zi ham suriladi,
  // aks holda kiyim tanaga mos tushmaydi
  for (const name of ['LeftShoulder', 'RightShoulder']) byName.get(name).position.x *= shape.shoulderSpread;
  for (const name of ['LeftUpLeg', 'RightUpLeg']) byName.get(name).position.x *= shape.hipSpread;
  root.updateMatrixWorld(true);

  const at = (name) => bonePosition(byName, name);

  const material = new THREE.MeshStandardMaterial({
    color: shape.color,
    roughness: 0.78,
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
