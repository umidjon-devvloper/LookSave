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
       */
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
