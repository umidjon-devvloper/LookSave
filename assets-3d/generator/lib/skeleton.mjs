import * as THREE from 'three';

/**
 * Mixamo humanoid skeleti (04-3d-pipeline §2).
 *
 * NOMLAR O'ZGARMASLIGI SHART: `mixamorig:` prefiksi va suyak nomlari
 * Mixamo standarti. Mixamo'dan yuklab olingan animatsiya aynan shu
 * nomlarni qidiradi — bittasi o'zgarsa klip skeletga tushmaydi va
 * `AnimationRig.add()` `false` qaytaradi.
 *
 * BIND POZASI — A-poza (qo'llar pastga, tanadan ~12° uzoqda), T-poza emas.
 * Sabab: hozircha animatsiya klipi yo'q, ilova avatarni bind pozasida
 * ko'rsatadi. T-pozada qo'llar yonga cho'zilgan holda qotib turadi va bu
 * kiyib ko'rish ekranida g'alati ko'rinadi. Mixamo A-pozani ham qabul
 * qiladi, shuning uchun keyinchalik animatsiya qo'shishga xalaqit bermaydi.
 *
 * ⚠️ Bo'ylar metrda, oyoq osti y = 0 da. Neytral bo'y 1.75 m.
 */

/** Suyak: [nom, ota, lokal pozitsiya] */
const BONES = [
  ['Hips', null, [0, 0.98, 0]],

  ['Spine', 'Hips', [0, 0.09, 0]],
  ['Spine1', 'Spine', [0, 0.11, 0]],
  ['Spine2', 'Spine1', [0, 0.11, 0]],

  ['Neck', 'Spine2', [0, 0.13, 0]],
  ['Head', 'Neck', [0, 0.08, 0]],
  ['HeadTop_End', 'Head', [0, 0.19, 0]],

  // Chap qo'l — A-poza: yelkadan pastga, biroz yonga
  ['LeftShoulder', 'Spine2', [0.05, 0.09, 0]],
  ['LeftArm', 'LeftShoulder', [0.11, 0.01, 0]],
  ['LeftForeArm', 'LeftArm', [0.055, -0.26, 0]],
  ['LeftHand', 'LeftForeArm', [0.035, -0.25, 0]],

  ['RightShoulder', 'Spine2', [-0.05, 0.09, 0]],
  ['RightArm', 'RightShoulder', [-0.11, 0.01, 0]],
  ['RightForeArm', 'RightArm', [-0.055, -0.26, 0]],
  ['RightHand', 'RightForeArm', [-0.035, -0.25, 0]],

  ['LeftUpLeg', 'Hips', [0.09, -0.06, 0]],
  ['LeftLeg', 'LeftUpLeg', [0, -0.42, 0]],
  ['LeftFoot', 'LeftLeg', [0, -0.42, 0]],
  ['LeftToeBase', 'LeftFoot', [0, -0.07, 0.08]],

  ['RightUpLeg', 'Hips', [-0.09, -0.06, 0]],
  ['RightLeg', 'RightUpLeg', [0, -0.42, 0]],
  ['RightFoot', 'RightLeg', [0, -0.42, 0]],
  ['RightToeBase', 'RightFoot', [0, -0.07, 0.08]],
];

/**
 * Aksessuar biriktirish nuqtalari (04-3d-pipeline §2).
 * Bo'sh `Object3D` — glTF'da oddiy node bo'lib chiqadi.
 */
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

export const BONE_PREFIX = 'mixamorig:';

/**
 * Skeletni quradi.
 *
 * Qaytadi: `{ root, bones, boneIndex }` — `root` sahnaga qo'shiladi,
 * `boneIndex` esa mesh'ni suyakka bog'lashda ishlatiladi (nom → indeks).
 */
export function buildSkeleton() {
  const byName = new Map();
  const bones = [];

  for (const [name, parent, position] of BONES) {
    const bone = new THREE.Bone();
    bone.name = BONE_PREFIX + name;
    bone.position.set(...position);

    if (parent) byName.get(parent).add(bone);
    byName.set(name, bone);
    bones.push(bone);
  }

  for (const [name, parent, position] of SOCKETS) {
    const socket = new THREE.Object3D();
    socket.name = name;
    socket.position.set(...position);
    byName.get(parent).add(socket);
  }

  const root = byName.get('Hips');
  // Jahon matritsalari kerak: teri og'irliklari suyakning fazodagi
  // o'rniga qarab hisoblanadi
  root.updateMatrixWorld(true);

  const boneIndex = new Map(bones.map((bone, index) => [bone.name, index]));

  return { root, bones, boneIndex, byName };
}

/** Suyakning jahon koordinatasidagi o'rni — og'irlik hisoblash uchun */
export function bonePosition(byName, name) {
  const bone = byName.get(name);
  return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
}
