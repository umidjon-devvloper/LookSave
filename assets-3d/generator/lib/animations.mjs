import * as THREE from 'three';

import { buildSkeleton } from './skeleton.mjs';

/**
 * Animatsiya klip'lari (`idle`, `turn`, `walk`, `sit`).
 *
 * Klip GLB'da GEOMETRIYA YO'Q — faqat skelet va treklar. Hujjat shuni
 * talab qiladi (04-3d-pipeline): klip fayli ~50-150 KB bo'lishi kerak,
 * chunki u har bir avatar uchun alohida yuklanadi.
 *
 * ⚠️ Bular Mixamo klip'lari EMAS — qo'lda yozilgan oddiy harakatlar.
 * Ular tabiiy emas (oyoq yerga tegishi hisobga olinmagan, og'irlik
 * markazi ko'chmaydi), lekin skelet, trek nomlari va o'tishlar zanjirini
 * to'liq sinab beradi. Mixamo'dan haqiqiy klip kelganda shu fayllar
 * almashadi va ilovada hech narsa o'zgarmaydi.
 *
 * ⚠️ KIYIM HARAKATLANMAYDI. Ilova kiyimni tana skeletiga bog'lamaydi
 * (`garments.mjs` izohiga qarang) — animatsiya o'ynaganda tana qimirlaydi,
 * kiyim joyida qoladi. Klip'lardan foydalanishdan oldin shu hal qilinsin.
 */

/**
 * ⚠️ KLIP FAYLIDA SUYAK NOMI IKKI NUQTASIZ: `mixamorigHips`, `mixamorig:Hips`
 * emas.
 *
 * Sabab `three` ning trek nomi grammatikasida: `:` PAPKA AJRATGICHI deb
 * o'qiladi (`((?:[\w-]+[\/:])*)`). Ya'ni `mixamorig:Hips.quaternion` da
 * `PropertyBinding.findNode` `mixamorig:` ni papka deb tashlab, `Hips`
 * nomli node qidiradi — bunday node yo'q, trek jimgina yo'qoladi va
 * eksportda klip umuman bo'sh chiqadi.
 *
 * Ikki nuqtani olib tashlash hech narsani buzmaydi: `GLTFLoader` tana
 * modelidagi `mixamorig:Hips` ni ham yuklashda `mixamorigHips` ga
 * aylantiradi, ilovadagi `normalizeBoneName` esa ikkalasini bir xil
 * ko'radi. Ya'ni klip haqiqiy Mixamo faylidek bog'lanadi.
 */
const bone = (name) => `mixamorig${name}`;

/** Eyler burchaklaridan (gradus) kvaternion trek */
function rotationTrack(name, times, rotations) {
  const values = [];
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();

  for (const [x, y, z] of rotations) {
    euler.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z));
    quaternion.setFromEuler(euler);
    values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }

  return new THREE.QuaternionKeyframeTrack(`${bone(name)}.quaternion`, times, values);
}

/** Lokal pozitsiya treki — Hips uchun (ko'tarilish/tushish) */
function positionTrack(name, times, positions) {
  return new THREE.VectorKeyframeTrack(`${bone(name)}.position`, times, positions.flat());
}

/** Nafas olish — ko'krak biroz ko'tariladi, tana sekin tebranadi */
function idleClip() {
  const t = [0, 1.4, 2.8, 4.2];

  return new THREE.AnimationClip('idle', 4.2, [
    positionTrack('Hips', t, [
      [0, 0.98, 0],
      [0, 0.991, 0],
      [0, 0.98, 0],
      [0, 0.991, 0],
    ]),
    rotationTrack('Spine1', t, [
      [0, 0, 0],
      [-1.6, 0, 0],
      [0, 0, 0],
      [-1.6, 0, 0],
    ]),
    rotationTrack('Spine2', t, [
      [0, 1.2, 0],
      [0, -1.2, 0],
      [0, 1.2, 0],
      [0, -1.2, 0],
    ]),
    rotationTrack('LeftArm', t, [
      [0, 0, 2],
      [0, 0, 4],
      [0, 0, 2],
      [0, 0, 4],
    ]),
    rotationTrack('RightArm', t, [
      [0, 0, -2],
      [0, 0, -4],
      [0, 0, -2],
      [0, 0, -4],
    ]),
  ]);
}

/** Bir marta to'liq aylanish — mahsulotni har tomondan ko'rish uchun */
function turnClip() {
  const t = [0, 0.8, 1.6, 2.4];

  return new THREE.AnimationClip('turn', 2.4, [
    rotationTrack('Hips', t, [
      [0, 0, 0],
      [0, 120, 0],
      [0, 240, 0],
      [0, 360, 0],
    ]),
  ]);
}

/** Oddiy yurish tsikli — oyoqlar almashadi, qo'llar qarshi tomonga */
function walkClip() {
  const t = [0, 0.3, 0.6, 0.9, 1.2];
  const swing = (a, b) => [[a, 0, 0], [0, 0, 0], [b, 0, 0], [0, 0, 0], [a, 0, 0]];

  return new THREE.AnimationClip('walk', 1.2, [
    positionTrack('Hips', t, [
      [0, 0.98, 0],
      [0, 1.0, 0],
      [0, 0.98, 0],
      [0, 1.0, 0],
      [0, 0.98, 0],
    ]),
    rotationTrack('LeftUpLeg', t, swing(24, -20)),
    rotationTrack('RightUpLeg', t, swing(-20, 24)),
    rotationTrack('LeftLeg', t, [[-6, 0, 0], [-26, 0, 0], [-4, 0, 0], [-10, 0, 0], [-6, 0, 0]]),
    rotationTrack('RightLeg', t, [[-4, 0, 0], [-10, 0, 0], [-6, 0, 0], [-26, 0, 0], [-4, 0, 0]]),
    // Qo'llar oyoqqa qarshi — tabiiy yurishning asosiy belgisi
    rotationTrack('LeftArm', t, swing(-18, 16)),
    rotationTrack('RightArm', t, swing(16, -18)),
  ]);
}

/** O'tirish — chanoq pastga, son oldinga, tizza bukiladi */
function sitClip() {
  const t = [0, 0.75, 1.5];

  return new THREE.AnimationClip('sit', 1.5, [
    positionTrack('Hips', t, [
      [0, 0.98, 0],
      [0, 0.78, -0.05],
      [0, 0.6, -0.1],
    ]),
    rotationTrack('LeftUpLeg', t, [[0, 0, 0], [-45, 0, 0], [-85, 0, 0]]),
    rotationTrack('RightUpLeg', t, [[0, 0, 0], [-45, 0, 0], [-85, 0, 0]]),
    rotationTrack('LeftLeg', t, [[0, 0, 0], [40, 0, 0], [80, 0, 0]]),
    rotationTrack('RightLeg', t, [[0, 0, 0], [40, 0, 0], [80, 0, 0]]),
    rotationTrack('Spine', t, [[0, 0, 0], [4, 0, 0], [8, 0, 0]]),
  ]);
}

const CLIPS = { idle: idleClip, turn: turnClip, walk: walkClip, sit: sitClip };

export const ANIMATION_NAMES = Object.keys(CLIPS);

/**
 * Bitta klip uchun eksportga tayyor sahna.
 * Qaytadi: `{ scene, clip }` — `writeGlb` ga `{ animations: [clip] }` beriladi.
 */
export function buildAnimation(name) {
  const make = CLIPS[name];
  if (!make) throw new Error(`Noma'lum animatsiya: ${name}`);

  // Har klip uchun yangi skelet: bir obyektni ikki sahnada ishlatib
  // bo'lmaydi va eksportda ota-bola bog'lanishi buziladi
  const { root } = buildSkeleton();

  // Suyak nomlarini trek nomlari bilan bir xil qilamiz (yuqoridagi izoh)
  root.traverse((child) => {
    child.name = child.name.replace('mixamorig:', 'mixamorig');
  });

  const scene = new THREE.Scene();
  scene.add(root);

  return { scene, clip: make() };
}
