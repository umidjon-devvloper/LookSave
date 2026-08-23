import * as THREE from 'three';

/**
 * Namuna avatar — kod bilan yasalgan odam shakli.
 *
 * NEGA BOR: haqiqiy `*-base-v1.glb` hali chiqarilmagan (`assets-3d/` bo'sh,
 * CDN 404 qaytaradi). Modelsiz Try-On ekrani butunlay ishlamaydi va u bilan
 * birga aylantirish, zoom, slot almashish, FPS bo'yicha sifat tuzatish,
 * xotira tozalash — hammasi sinovsiz qoladi. Bu shakl shu zanjirni hozir
 * qurilmada tekshirish imkonini beradi.
 *
 * GLB paydo bo'lgan zahoti bu almashadi: `AvatarView` avval haqiqiy modelni
 * yuklaydi, faqat u yiqilsa shu yerga tushadi.
 *
 * ⚠️ Bu O'LCHOV EMAS. Proporsiyalar ko'zga chiroyli ko'rinishi uchun tanlangan,
 * antropometrik jadvaldan olinmagan. Kiyim o'lchamini bunga qarab sozlamang.
 *
 * ⚠️ Shape key (morph target) yo'q — `applyMorphs` bunga ta'sir qilmaydi,
 * ya'ni o'lchamlarni o'zgartirish namuna avatarda ko'rinmaydi.
 */

/** Nomlar `AvatarView.BODY_SLOT` bilan bir xil bo'lishi shart. */
const PART_SLOT: Record<string, string> = {
  body_head: 'head',
  body_torso: 'top',
  body_legs: 'bottom',
  body_foot_L: 'feet',
  body_foot_R: 'feet',
  body_hand_L: 'wrist',
  body_hand_R: 'wrist',
};

/** Manekenning tanasi — mat, biroz binafsha (brend rangi bilan bir oilada) */
const SKIN = 0x6d5a8c;
/** Oyoq kiyimi va sochning to'q qismi */
const DARK = 0x2a2438;

function part(name: string, mesh: THREE.Object3D): THREE.Object3D {
  mesh.name = name;
  // Slot butun shoxobchaga yoziladi: raycast qaysi meshga tushishidan
  // qat'i nazar javob bir xil bo'lsin
  const slot = PART_SLOT[name];
  if (slot) mesh.traverse((child) => (child.userData['slot'] = slot));
  return mesh;
}

/**
 * Bo'yi ~1.72, oyoq ostki nuqtasi y = 0 da.
 * Kamera `(0, 0.9, 2.6)` dan `(0, 0.9, 0)` ga qaraydi — shu balandlikka mos.
 */
export function createPlaceholderAvatar(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'avatar_placeholder';
  root.userData['placeholder'] = true;

  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.72, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.85, metalness: 0.02 });

  // ── Bosh ──
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 20), skin);
  head.position.set(0, 1.6, 0);
  head.scale.set(0.92, 1.08, 0.95);
  root.add(part('body_head', head));

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.09, 16), skin);
  neck.name = 'neck';
  neck.position.set(0, 1.47, 0);
  root.add(neck);

  // ── Tana ──
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.3, 6, 20), skin);
  torso.position.set(0, 1.14, 0);
  // Odam ko'krak qafasi doira emas — oldindan orqaga yassiroq
  torso.scale.set(1, 1, 0.72);
  root.add(part('body_torso', torso));

  // ── Qo'llar ── slot xaritasida yo'q: ular kiyim biriktiriladigan joy emas
  const arms = new THREE.Group();
  arms.name = 'body_arms';
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.44, 5, 14), skin);
    arm.name = side < 0 ? 'arm_L' : 'arm_R';
    arm.position.set(side * 0.235, 1.12, 0);
    arm.rotation.z = side * 0.07;
    arms.add(arm);
  }
  root.add(arms);

  for (const side of [-1, 1]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), skin);
    hand.position.set(side * 0.258, 0.83, 0);
    hand.scale.set(0.85, 1.15, 0.7);
    root.add(part(side < 0 ? 'body_hand_L' : 'body_hand_R', hand));
  }

  // ── Oyoqlar ── ikkalasi bitta guruhda: kiyim "body_legs" ni yaxlit yashiradi
  const legs = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.073, 0.6, 5, 16), skin);
    leg.name = side < 0 ? 'leg_L' : 'leg_R';
    leg.position.set(side * 0.098, 0.44, 0);
    legs.add(leg);
  }
  root.add(part('body_legs', legs));

  // ── Oyoq kiyimi ──
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.07, 0.25), dark);
    foot.position.set(side * 0.098, 0.035, 0.045);
    root.add(part(side < 0 ? 'body_foot_L' : 'body_foot_R', foot));
  }

  // ── Yerdagi soya ── shakl havoda osilib turgandek ko'rinmasin
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  shadow.name = 'ground_shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  shadow.scale.set(1, 0.72, 1);
  root.add(shadow);

  /*
   * Kadrga sig'dirish. Kamera `(0, 0.9, 2.6)` dan fov 35° bilan qaraydi:
   * ko'rinadigan balandlik = 2 × 2.6 × tan(17.5°) ≈ 1.64, ya'ni y = 0.08…1.72.
   * Shakl 1.72 bo'yli — aynan chegarada, oyoq kesilib qolardi. 0.88 ga
   * kichraytirib biroz ko'tarilsa (0.10…1.61) ikki tomonda ham bo'shliq qoladi.
   */
  root.scale.setScalar(0.88);
  root.position.y = 0.1;

  return root;
}

/** Sahna shu obyektni namuna deb bilishi uchun */
export function isPlaceholderAvatar(object: THREE.Object3D): boolean {
  return object.userData['placeholder'] === true;
}
