import type * as THREE from 'three';

/**
 * Kiyim bilan teri kesishishini tuzatish.
 *
 * MUAMMO: gavda va kiyim alohida modellashtirilgan va ular bir-biriga juda
 * yaqin turadi — futbolka gavdadan atigi ~7 mm kengroq. Past poligonli
 * sirtlarda bu yetmaydi: gavdaning uchburchagi kiyimning uchburchagidan
 * tashqariga chiqib qoladi va ekranda teri rangidagi "arra tishlari" paydo
 * bo'ladi. Yelka, ko'krak yoni va sonda eng ko'p ko'rinadi.
 *
 * NEGA TANA QISMINI YASHIRISH BILAN YECHILMAYDI: o'lchov olindi —
 * `body_torso` Y bo'yicha 0.75…1.451, futbolka esa 0.958…1.434. Ya'ni
 * gavdaning 20 sm pastki qismini futbolka umuman yopmaydi. Uni yashirsak
 * shim yechilgan zahoti bel o'rnida teshik paydo bo'ladi.
 *
 * YECHIM: kiyimni o'z normali bo'yicha bir necha millimetr "shishirish".
 * Shunda mato teridan aniq masofada turadi va hech qanday holatda kesishmaydi.
 *
 * ⚠️ NORMAL AVVAL "PAYVANDLANADI". Qattiq qirralarda (manjet chekkasi, yoqa)
 * bitta nuqtada bir nechta vertex turadi va ularning normallari har xil.
 * Har biri o'z normali bo'yicha surilsa qirra yorilib, orasidan teri
 * ko'rinadi — ya'ni bir nuqson ikkinchisiga almashadi. Shuning uchun oldin
 * bir joydagi vertexlarning normali o'rtachalanadi, keyin surish qilinadi.
 *
 * ⚠️ MORPH TARGET LARGA TEGILMAYDI. glTF da ular NISBIY (delta) saqlanadi,
 * shuning uchun asosiy pozitsiya surilganda o'lcham morflari o'z ishini
 * to'g'ri bajaraveradi.
 */

/** Bir joyda turgan vertexlarni topish uchun koordinata yaxlitlanadi (0.1 mm). */
const WELD = 1e4;

export function inflateGeometry(geometry: THREE.BufferGeometry, distance: number): void {
  // Geometriya `useGLTF` keshida — bir necha nusxa uni bo'lishadi, shuning
  // uchun ish faqat bir marta bajarilishi kerak
  if (geometry.userData['inflated'] || distance === 0) return;
  geometry.userData['inflated'] = distance;

  const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!position || !normal) return;

  const count = position.count;

  /* 1-qadam: bir nuqtadagi normallarni qo'shib chiqamiz */
  const welded = new Map<string, [number, number, number]>();
  const keys: string[] = new Array<string>(count);

  for (let i = 0; i < count; i++) {
    const key = `${Math.round(position.getX(i) * WELD)},${Math.round(
      position.getY(i) * WELD,
    )},${Math.round(position.getZ(i) * WELD)}`;
    keys[i] = key;

    const sum = welded.get(key);
    if (sum) {
      sum[0] += normal.getX(i);
      sum[1] += normal.getY(i);
      sum[2] += normal.getZ(i);
    } else {
      welded.set(key, [normal.getX(i), normal.getY(i), normal.getZ(i)]);
    }
  }

  /* 2-qadam: o'rtachalangan normal bo'yicha surish */
  for (let i = 0; i < count; i++) {
    const sum = welded.get(keys[i] as string);
    if (!sum) continue;

    const length = Math.hypot(sum[0], sum[1], sum[2]);
    if (length < 1e-6) continue;

    position.setXYZ(
      i,
      position.getX(i) + (sum[0] / length) * distance,
      position.getY(i) + (sum[1] / length) * distance,
      position.getZ(i) + (sum[2] / length) * distance,
    );
  }

  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/** Daraxtdagi barcha mesh geometriyalarini shishiradi. */
export function inflate(root: THREE.Object3D, distance: number): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) inflateGeometry(mesh.geometry, distance);
  });
}

/**
 * O'lchov morflarini qo'llash.
 *
 * Nomlar `mt_` prefiksi bilan saqlanadi (`mt_height`, `mt_waist`…) —
 * `apps/mobile/src/three/loader.ts` dagi `applyMorphs` bilan bir xil qoida,
 * shuning uchun ikkala platformada bir xil raqam bir xil gavdani beradi.
 *
 * Har bir mesh o'z morf ro'yxatiga ega (oyoqda `mt_waist` yo'q) — mos
 * kelmagan nom shunchaki o'tkazib yuboriladi.
 */
export function applyMorphs(root: THREE.Object3D, morphs: Record<string, number>): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

    for (const [name, value] of Object.entries(morphs)) {
      const index = mesh.morphTargetDictionary[`mt_${name}`];
      if (index !== undefined) mesh.morphTargetInfluences[index] = value;
    }
  });
}
