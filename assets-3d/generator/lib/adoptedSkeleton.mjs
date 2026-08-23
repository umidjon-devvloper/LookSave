import { readFileSync } from 'node:fs';

import * as THREE from 'three';

/**
 * Tashqi (adopted) avatar GLB'idan suyak o'rinlarini o'qish.
 *
 * ⚠️ NEGA BU KERAK — bu jim xato butun kiyintirishni buzgan edi.
 *
 * `skeleton.mjs` dagi skelet QO'LDA yozilgan va uning bind pozasi
 * "qo'llar pastga, tanadan ~12°". Kiyimlar aynan shu o'rinlardan
 * yasaladi. Lekin tana `adopt.mjs` bilan tashqi modelga almashtirilganda
 * (`Base Mesh Pro_LP.fbx`) uning O'Z skeleti keladi va unda qo'llar
 * yonga ~45° ochilgan.
 *
 * Natijada kiyim bir skelet uchun, tana esa boshqasi bilan chiqadi:
 * yeng qo'ldan chetda osilib turadi, soat havoda son yonida qoladi,
 * kepka yuzni yopadi. Hech qanday xato chiqmaydi — shunchaki noto'g'ri.
 *
 * Shuning uchun tana tashqi bo'lsa, suyak o'rinlari o'sha modeldan
 * o'qiladi. `at()` chaqiruvlari o'zgarmaydi.
 *
 * Nom mosligi: tashqi modelda suyaklar `mixamorigLeftArm` ko'rinishida,
 * generatorda esa `LeftArm`. Prefiks olib tashlanadi.
 */
export function readAdoptedBones(glbPath) {
  const buffer = readFileSync(glbPath);

  // GLB sarlavhasi: 12 bayt, keyin JSON bo'lagi uzunligi va turi
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));

  const nodes = (gltf.nodes ?? []).map((node) => {
    const object = new THREE.Object3D();
    object.name = node.name ?? '';

    if (node.matrix) {
      object.matrix.fromArray(node.matrix);
      object.matrix.decompose(object.position, object.quaternion, object.scale);
    } else {
      if (node.translation) object.position.fromArray(node.translation);
      if (node.rotation) object.quaternion.fromArray(node.rotation);
      if (node.scale) object.scale.fromArray(node.scale);
    }

    return object;
  });

  // Ierarxiyani tiklaymiz — jahon o'rni faqat shundan keyin to'g'ri bo'ladi
  const root = new THREE.Object3D();
  const attached = new Set();

  (gltf.nodes ?? []).forEach((node, index) => {
    for (const child of node.children ?? []) {
      nodes[index].add(nodes[child]);
      attached.add(child);
    }
  });

  nodes.forEach((object, index) => {
    if (!attached.has(index)) root.add(object);
  });

  root.updateMatrixWorld(true);

  const byName = new Map();
  for (const object of nodes) {
    if (!object.name.startsWith('mixamorig')) continue;

    const name = object.name.replace(/^mixamorig:?/, '');
    byName.set(name, new THREE.Vector3().setFromMatrixPosition(object.matrixWorld));
  }

  return byName;
}

/**
 * `at(name)` yasaydi: avval tashqi modeldan, topilmasa protsedural
 * skeletdan.
 *
 * Zaxira yo'l kerak, chunki tashqi modelda ba'zi yordamchi suyaklar
 * bo'lmaydi (masalan `HeadTop_End`). Ular yo'q deb kiyimni umuman
 * yasamaslikdan ko'ra, o'sha bittasini eski o'rindan olish yaxshiroq.
 */
export function makeAt(adoptedBones, fallbackAt) {
  const missing = new Set();

  const at = (name) => {
    const position = adoptedBones.get(name);
    if (position) return position.clone();

    if (!missing.has(name)) {
      missing.add(name);
      console.log(`   ⚠︎ tashqi skeletda '${name}' yo'q — protsedural o'rin ishlatildi`);
    }
    return fallbackAt(name);
  };

  return at;
}
