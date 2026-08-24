import type * as THREE from 'three';

/**
 * Kiyimni avatarga biriktirish (spetsifikatsiya §4.3).
 *
 * Uch xil kiyim uch xil biriktiriladi:
 *
 *   SKINNED   — ko'ylak, shim: avatar skeletiga bog'lanadi va tana bilan
 *               birga qimirlaydi
 *   ATTACHED  — bosh kiyim, soat: bitta suyakka osiladi (`Head`, `LeftHand`)
 *   STATIC    — skeletsiz va suyaksiz: avatar ildiziga qo'yiladi
 *
 * ⚠️ HOZIRGI ASSETLAR SKINNED EMAS. Ular tinch holatda (rest pose) shu
 * tananing o'lchamiga qarab yasalgan, ya'ni to'g'ri joyda turadi — lekin
 * avatar animatsiya qilinsa joyida qolib ketadi. Animatsiya kerak bo'lganda
 * kiyimlar Blender'da skeletga bog'lanishi kerak (§3, 5-bosqich). Kod
 * ikkala holatni ham qo'llab-quvvatlaydi, shuning uchun assetlar
 * yangilanganda bu faylni o'zgartirish shart emas.
 */

/**
 * `skinIndex` ni NOM bo'yicha qayta joylashtiradi.
 *
 * ⚠️ BUSIZ KIYIM BUTUNLAY BUZILADI VA XATO CHIQMAYDI.
 *
 * `skinIndex` — skelet suyaklar MASSIVIDAGI o'rin, nom emas. Kiyim o'z
 * skeleti bilan keladi va uning tartibi tana skeletidan boshqa bo'lishi
 * mumkin. LookSave'da aynan shunday (2026-08-24 da o'lchandi):
 *
 *   tana (Blender'dan):  52 suyak — Hips, LeftUpLeg, LeftLeg, LeftFoot…
 *   generator:           23 suyak — Hips, Spine, Spine1, Spine2…
 *
 * Ya'ni oddiy `mesh.bind(bodySkeleton)` da 1-indeks kiyim uchun `Spine`,
 * tana uchun `LeftUpLeg` bo'lardi — futbolka gavdasi CHAP OYOQQA
 * bog'lanardi. Xato ham, ogohlantirish ham bo'lmaydi: mesh shunchaki
 * noto'g'ri joyda paydo bo'ladi.
 *
 * ⚠️ NOM TOZALANADI. `GLTFLoader` `mixamorig:Hips` ni `mixamorigHips` ga
 * aylantiradi (`:` animatsiya yo'llarida band). Ikki skelet turli yo'l
 * bilan yuklangan bo'lsa nomlar farq qilishi mumkin, shuning uchun
 * solishtirishdan oldin ikkalasi ham tozalanadi.
 *
 * Topilmagan suyak `0` ga (ildiz) tushadi va og'irligi nolga chiqadi —
 * noto'g'ri joyda turgandan ko'ra qimirlamagani yaxshi.
 */
export function normalizeBoneName(name: string): string {
  return name.replace(/[:._\s]/g, '');
}

export function remapSkinIndex(
  mesh: THREE.SkinnedMesh,
  target: THREE.Skeleton,
): { remapped: number; missing: string[] } {
  const source = mesh.skeleton;
  const attribute = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  if (!source || !attribute || !weights) return { remapped: 0, missing: [] };

  const byName = new Map<string, number>();
  target.bones.forEach((bone, index) => byName.set(normalizeBoneName(bone.name), index));

  // Kiyim indeksi → tana indeksi
  const lookup = source.bones.map((bone) => byName.get(normalizeBoneName(bone.name)) ?? -1);
  const missing = source.bones.filter((_, index) => lookup[index] === -1).map((bone) => bone.name);

  let remapped = 0;
  for (let i = 0; i < attribute.count; i += 1) {
    for (let component = 0; component < 4; component += 1) {
      const from = attribute.getComponent(i, component);
      const to = lookup[from] ?? -1;

      if (to === -1) {
        // Suyak yo'q — og'irlikni nolga chiqaramiz, indeks ildizga
        attribute.setComponent(i, component, 0);
        weights.setComponent(i, component, 0);
        continue;
      }

      if (to !== from) remapped += 1;
      attribute.setComponent(i, component, to);
    }
  }

  attribute.needsUpdate = true;
  weights.needsUpdate = true;
  return { remapped, missing };
}

/** Avatardagi birinchi skeletni topadi — kiyimlar shunga bog'lanadi. */
export function findSkeleton(avatar: THREE.Object3D): THREE.Skeleton | null {
  let skeleton: THREE.Skeleton | null = null;

  avatar.traverse((child) => {
    if (skeleton) return;
    const mesh = child as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) skeleton = mesh.skeleton;
  });

  return skeleton;
}

export type MountKind = 'skinned' | 'attached' | 'static';

/**
 * Kiyimni avatarga qo'yadi va qaysi yo'l ishlatilganini qaytaradi.
 *
 * `attachBone` berilgan bo'lsa, u avatardagi suyak NOMI bo'lishi kerak
 * (masalan `mixamorigHead`). Topilmasa buyum yo'qolib qolmaydi — ildizga
 * qo'yiladi, chunki ko'rinmay qolgandan ko'ra noto'g'ri joyda turgani
 * yaxshiroq va xatosi darhol ko'rinadi.
 */
export function mountGarment(
  avatar: THREE.Object3D,
  garment: THREE.Object3D,
  attachBone?: string | null,
): MountKind {
  const skeleton = findSkeleton(avatar);
  let skinned = false;

  if (skeleton) {
    garment.traverse((child) => {
      const mesh = child as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;

      /*
       * Kiyim O'Z skeleti bilan keladi, lekin u avatarnikidan alohida
       * yashaydi va yangilanmaydi. Avatar skeletiga qayta bog'lasak,
       * kiyim tana bilan birga qimirlaydi.
       *
       * ⚠️ INDEKSLAR QAYTA JOYLASHTIRILADI. Ikki skeletning suyak tartibi
       * bir xil DEB O'YLASH mumkin emas — LookSave'da ular butunlay
       * boshqa (`remapSkinIndex` izohiga qarang). Tozalash bind'dan
       * OLDIN bo'lishi kerak: `bind` dan keyin geometriya allaqachon
       * noto'g'ri indekslar bilan ishlatilardi.
       */
      const { missing } = remapSkinIndex(mesh, skeleton);
      if (missing.length > 0) {
        // Jim qolmaydi: yetishmagan suyak kiyimning bir qismini
        // qimirlamas qilib qo'yadi va sabab boshqa joyda ko'rinmaydi
        console.warn(
          `[garment] "${mesh.name}" — tana skeletida topilmagan suyak: ${missing.join(', ')}`,
        );
      }

      mesh.bind(skeleton, mesh.bindMatrix);

      /*
       * Skeletli mesh chegara qutisi bind pozasidan hisoblanadi va
       * harakat paytida yangilanmaydi — natijada kiyim kamera burilganda
       * to'satdan yo'qoladi. Culling'ni o'chirish yagona ishonchli yechim.
       */
      mesh.frustumCulled = false;
      skinned = true;
    });
  }

  if (skinned) {
    avatar.add(garment);
    return 'skinned';
  }

  if (attachBone) {
    const bone = avatar.getObjectByName(attachBone);
    if (bone) {
      bone.add(garment);
      return 'attached';
    }
  }

  avatar.add(garment);
  return 'static';
}

/** Kiyimni sahnadan olib tashlaydi. Tozalash chaqiruvchida — kesh qaror qiladi. */
export function unmountGarment(garment: THREE.Object3D): void {
  garment.parent?.remove(garment);
}
