import * as THREE from 'three';

/**
 * Geometriya yasash va shape key qo'shish.
 *
 * ⚠️ BARCHA GEOMETRIYA JAHON (BIND) KOORDINATASIDA yasaladi — ya'ni
 * vertex'lar avatarning haqiqiy o'rnida turadi, oyoq osti y = 0. Shu
 * sababli `SkinnedMesh.bind()` ga birlik matritsa beriladi va teskari
 * bind matritsalari suyaklarning jahon holatidan hisoblanadi. Aks holda
 * har bir qism o'z lokal koordinatasida bo'lib, ularni suyakka moslash
 * uchun qo'lda matritsa hisoblash kerak bo'lardi.
 */

const UP = new THREE.Vector3(0, 1, 0);

/** Ikki nuqta orasidagi kapsula — qo'l, oyoq, barmoq uchun */
export function capsuleBetween(from, to, radius, radialSegments = 12) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);

  const direction = new THREE.Vector3().subVectors(b, a);
  const span = direction.length();
  // Kapsula uzunligi — uchlaridagi yarim sharlardan tashqari qismi
  const length = Math.max(0.001, span - radius * 2);

  const geometry = new THREE.CapsuleGeometry(radius, length, 4, radialSegments);

  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
  geometry.applyQuaternion(quaternion);

  const middle = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  geometry.translate(middle.x, middle.y, middle.z);

  return geometry;
}

/** Ellipsoid — bosh, kaft, tana uchun */
export function ellipsoidAt(center, radii, segments = 16) {
  const geometry = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75));
  geometry.scale(radii[0], radii[1], radii[2]);
  geometry.translate(center[0], center[1], center[2]);
  return geometry;
}

/** Qutichа — oyoq kiyimi va tekis qismlar uchun */
export function boxAt(center, size, radiusSegments = 1) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2], 1, 1, radiusSegments);
  geometry.translate(center[0], center[1], center[2]);
  return geometry;
}

/**
 * Yumshoq oraliq: `y` `lo`…`hi` ichida 1, chetlarida 0 ga tushadi.
 *
 * Shape key faqat ma'lum balandlikdagi vertex'larga ta'sir qilishi kerak
 * (masalan `mt_waist` faqat belga). Keskin chegara qo'yilsa modelda
 * ko'rinadigan burma paydo bo'ladi — shuning uchun `smoothstep`.
 */
export function band(y, lo, hi, feather = 0.09) {
  if (y <= lo - feather || y >= hi + feather) return 0;
  if (y >= lo && y <= hi) return 1;

  const t = y < lo ? (y - (lo - feather)) / feather : ((hi + feather) - y) / feather;
  // smoothstep — chekkalarda hosila nolga teng, shuning uchun burma bo'lmaydi
  return t * t * (3 - 2 * t);
}

/**
 * Olti shape key (04-3d-pipeline §3).
 *
 * ⚠️ KONVENSIYA: hujjatga ko'ra `0.5` — NEYTRAL holat. Oddiy shape key'da
 * esa `0` asos, `1` cheti bo'ladi. Shuning uchun asos geometriya "kichik"
 * chetga, shape key esa "katta" chetga qo'yiladi — o'rtasi (0.5) aynan
 * o'ylangan neytral proporsiyani beradi. Ilova `profiles.morph_targets`
 * dan kelgan 0…1 qiymatni to'g'ridan-to'g'ri qo'llaydi.
 */
export const MORPH_NAMES = [
  'mt_height',
  'mt_weight',
  'mt_shoulderWidth',
  'mt_chest',
  'mt_waist',
  'mt_hips',
];

/** Har bir shape key qanday deformatsiya qilishi — `k` = -1 (kichik) … +1 (katta) */
const DEFORMERS = {
  // Bo'y — oyoq ostidan (y=0) vertikal cho'zilish
  mt_height: (v, k) => {
    v.y *= 1 + 0.06 * k;
  },
  // Umumiy hajm — butun tana bo'ylab gorizontal kengayish
  mt_weight: (v, k) => {
    const s = 1 + 0.13 * k;
    v.x *= s;
    v.z *= s;
  },
  // Yelka kengligi — faqat yelka balandligida, faqat X bo'yicha
  mt_shoulderWidth: (v, k) => {
    v.x *= 1 + 0.11 * k * band(v.y, 1.32, 1.48);
  },
  mt_chest: (v, k) => {
    const s = 1 + 0.11 * k * band(v.y, 1.18, 1.4);
    v.x *= s;
    v.z *= s;
  },
  mt_waist: (v, k) => {
    const s = 1 + 0.13 * k * band(v.y, 0.98, 1.16);
    v.x *= s;
    v.z *= s;
  },
  mt_hips: (v, k) => {
    const s = 1 + 0.11 * k * band(v.y, 0.82, 1.0);
    v.x *= s;
    v.z *= s;
  },
};

/**
 * Geometriyaga oltita shape key qo'shadi.
 *
 * Kirish geometriyasi NEYTRAL holatda bo'lishi kutiladi.
 *
 * ⚠️ MATEMATIKA (birinchi urinishda xato qilingan joy). glTF'da morph
 * target'lar QO'SHILADI:
 *
 *   yakuniy = asos + Σ tásir_i × (nishon_i − asos)
 *
 * Dastlab asos "kichik chet"ga, har nishon "katta chet"ga qo'yilgan edi.
 * Oltita kalit 0.5 dan berilganda jami ta'sir 3.0 bo'ladi va asos uch
 * marta ayirilib ketadi — natijada tana 1.75 m o'rniga 1.94 m chiqdi.
 *
 * To'g'ri yechim: asosni shunday suramizki, hamma kalit 0.5 bo'lganda
 * yig'indi aynan neytralga tushsin:
 *
 *   ogish_i = f_i(p, +1) − p          (kattalashish tomonidagi farq)
 *   asos    = p − 0.5 × Σ ogish_i
 *   nishon_i = asos + ogish_i
 *
 * Tekshirish: hammasi 0.5 → asos + 0.5 Σ ogish = p ✓
 *             i-kalit 1.0  → p + 0.5 × ogish_i (kattaroq) ✓
 *             i-kalit 0    → p − 0.5 × ogish_i (kichikroq) ✓
 */
export function addMorphTargets(geometry) {
  const neutral = geometry.attributes.position.clone();
  const count = neutral.count;

  const point = new THREE.Vector3();
  const deformed = new THREE.Vector3();

  // Har bir kalitning neytraldan og'ishi
  const offsets = MORPH_NAMES.map((name) => {
    const deform = DEFORMERS[name];
    const values = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      point.fromBufferAttribute(neutral, i);
      deformed.copy(point);
      deform(deformed, +1);
      deformed.sub(point).toArray(values, i * 3);
    }
    return values;
  });

  // Asos: neytraldan og'ishlar yig'indisining yarmicha orqaga surilgan
  const base = geometry.attributes.position;
  for (let i = 0; i < count; i++) {
    point.fromBufferAttribute(neutral, i);
    for (const offset of offsets) {
      point.x -= 0.5 * (offset[i * 3] ?? 0);
      point.y -= 0.5 * (offset[i * 3 + 1] ?? 0);
      point.z -= 0.5 * (offset[i * 3 + 2] ?? 0);
    }
    base.setXYZ(i, point.x, point.y, point.z);
  }
  base.needsUpdate = true;

  /*
   * Nishonlar: asos + o'sha kalitning to'liq og'ishi.
   *
   * ⚠️ NOL NISHONLAR TASHLANADI. `mt_waist` kabi kalitlar faqat ma'lum
   * balandlikda ishlaydi (`band(...)`), shuning uchun bosh yoki kaft
   * geometriyasida ularning og'ishi butunlay nol bo'ladi. Nol massiv ham
   * faylda to'liq joy egallaydi: 6 kalit har verteksni olti marta
   * takrorlaydi. Boshda 17 000 uchburchak bor va uning 4 ta kaliti nol —
   * bu bir necha megabayt bekorga.
   *
   * Tashlab yuborish xavfsiz: ilova shape key'ni NOM bo'yicha qidiradi
   * (`morphTargetDictionary['mt_' + nom]`) va topmasa jimgina o'tkazib
   * yuboradi. Ya'ni nolni saqlash bilan saqlamaslik bir xil natija beradi.
   */
  const kept = [];
  const morphs = [];

  offsets.forEach((offset, morphIndex) => {
    let largest = 0;
    for (let i = 0; i < offset.length; i++) {
      const value = Math.abs(offset[i]);
      if (value > largest) largest = value;
    }
    // 0.1 mm dan kichik siljish ko'zga ko'rinmaydi
    if (largest < 0.0001) return;

    const target = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3);
    for (let i = 0; i < count; i++) {
      target.setXYZ(
        i,
        base.getX(i) + (offset[i * 3] ?? 0),
        base.getY(i) + (offset[i * 3 + 1] ?? 0),
        base.getZ(i) + (offset[i * 3 + 2] ?? 0),
      );
    }
    kept.push(MORPH_NAMES[morphIndex]);
    morphs.push(target);
  });

  geometry.morphAttributes.position = morphs;
  geometry.morphTargetsRelative = false;
  geometry.computeVertexNormals();

  // Chaqiruvchi `attachMorphNames` ga aynan shu ro'yxatni berishi kerak
  geometry.userData.morphNames = kept;
  return geometry;
}

/**
 * Qattiq bog'lash: barcha vertex'lar bitta suyakka to'liq og'irlik bilan.
 *
 * ⚠️ Bu SODDALASHTIRISH. Haqiqiy modelda bo'g'imlarda ikki suyak orasida
 * og'irlik yumshoq taqsimlanadi va teri egilganda cho'ziladi. Bu yerda har
 * tana qismi alohida mesh bo'lgani uchun (04-3d-pipeline §2 talabi) uzluksiz
 * sirt yo'q — qattiq bog'lash ko'zga tashlanmaydi. Blender'dan haqiqiy
 * model kelganda bu almashadi.
 */
export function bindToBone(geometry, boneName, boneIndex) {
  const count = geometry.attributes.position.count;
  const index = boneIndex.get(boneName);

  if (index === undefined) throw new Error(`Suyak topilmadi: ${boneName}`);

  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    indices[i * 4] = index;
    weights[i * 4] = 1;
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));

  return geometry;
}

/**
 * Shape key nomlarini mesh'ga yozadi — ilova ular bo'yicha qidiradi.
 *
 * Nomlar `addMorphTargets` saqlab qolganlaridan olinadi: nol nishonlar
 * tashlangani uchun ro'yxat har mesh'da har xil bo'lishi mumkin.
 */
export function attachMorphNames(mesh) {
  const names = mesh.geometry.userData.morphNames ?? MORPH_NAMES;
  mesh.morphTargetDictionary = Object.fromEntries(names.map((name, i) => [name, i]));
  mesh.morphTargetInfluences = names.map(() => 0.5);
  return mesh;
}
