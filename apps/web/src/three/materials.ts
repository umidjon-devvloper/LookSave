import * as THREE from 'three';

import {
  cottonSurface,
  denimSurface,
  leatherSurface,
  skinSurface,
  type Surface,
} from '@/three/textures';

/**
 * GLB dagi materiallarni "studiya" darajasiga ko'taradi.
 *
 * MUAMMO: eksportdagi materiallar `MeshStandardMaterial` — rang, metall,
 * g'adir-budurlik. Bu yetarli emas. Paxta matoning eng tanib olinadigan
 * xususiyati — `sheen`, ya'ni siluet chetida ipning tukidan hosil bo'ladigan
 * yumshoq yorug'lik halqasi. Usiz futbolka bo'yalgan plastmassa bo'lib
 * ko'rinadi va buni odam ongsiz ravishda sezadi, "nimadir sun'iy" deydi.
 *
 * YECHIM: `MeshPhysicalMaterial` (u `MeshStandardMaterial` ning kengaytmasi,
 * shuning uchun `copy()` ishlaydi) + mato turiga qarab `sheen`, `clearcoat`,
 * mikro-relyef va g'adir-budurlik xaritasi.
 *
 * ⚠️ MATERIAL NUSXALANADI VA KESHLANADI. `useGLTF` bitta sahnani qaytaradi,
 * `SkeletonUtils.clone` esa materiallarni NUSXALAMAYDI — havolani bo'lishadi.
 * Joyida o'zgartirilsa keshdagi asl nusxa buziladi va bir GLB ikki joyda
 * ishlatilganda ikkinchisi ham o'zgarib ketadi. Ayni paytda har nusxaga
 * alohida material yasash ham yaramaydi: har material — alohida shader
 * dasturi, sahifada 8 ta kanvas bor. Shuning uchun natija manba material
 * bo'yicha keshlanadi va barcha nusxalar bittasini bo'lishadi.
 */

export type Fabric = 'cotton' | 'denim' | 'leather' | 'metal' | 'skin';

/**
 * Fayl nomidan mato turi. Manifestda bunday maydon yo'q, qo'shish esa
 * `assets-3d` generatorini o'zgartirishni talab qiladi — bu yerda
 * nomlash konvensiyasi yetarli va u barqaror (`<key>-<rang>-v1.glb`).
 */
export function fabricFor(file: string): Fabric {
  if (file.startsWith('jacket-denim')) return 'denim';
  if (file.startsWith('sneakers')) return 'leather';
  if (file.startsWith('watch')) return 'metal';
  return 'cotton';
}

type Recipe = {
  surface: Surface | null;
  envMapIntensity: number;
  apply: (material: THREE.MeshPhysicalMaterial) => void;
};

const RECIPES: Record<Fabric, () => Recipe> = {
  /* Paxta trikotaj — tuki bor, aksi keng va xira. */
  cotton: () => ({
    surface: cottonSurface(),
    envMapIntensity: 0.7,
    apply: (material) => {
      material.sheen = 0.85;
      material.sheenRoughness = 0.78;
      /*
       * `sheenColor` matoning o'z rangidan OCHROQ olinadi. Oq olinsa
       * qora futbolka chetida kul rang halqa paydo bo'ladi va mato
       * changga botgandek ko'rinadi.
       */
      material.sheenColor = material.color.clone().lerp(new THREE.Color('#ffffff'), 0.45);
      material.metalness = 0;
    },
  }),

  /* Jinsi — qalinroq, diagonal to'qima, aksi deyarli yo'q. */
  denim: () => ({
    surface: denimSurface(),
    envMapIntensity: 0.5,
    apply: (material) => {
      material.sheen = 0.4;
      material.sheenRoughness = 0.9;
      material.sheenColor = material.color.clone().lerp(new THREE.Color('#cddaf2'), 0.3);
      material.metalness = 0;
    },
  }),

  /* Krossovka — charm/rezina aralashmasi, ustida yupqa lak qatlami. */
  leather: () => ({
    surface: leatherSurface(),
    envMapIntensity: 1.05,
    apply: (material) => {
      material.clearcoat = 0.45;
      material.clearcoatRoughness = 0.38;
      material.sheen = 0;
      material.metalness = 0.02;
    },
  }),

  /* Soat — sof metall, aks aniq. Mikro-relyef berilmaydi. */
  metal: () => ({
    surface: null,
    envMapIntensity: 1.6,
    apply: (material) => {
      material.metalness = 1;
      material.roughness = 0.17;
      material.sheen = 0;
    },
  }),

  /*
   * Teri. Ikki hiyla bilan "manekenlikdan" chiqadi:
   *   1) juda past `sheen` — mayda tukdan hosil bo'ladigan yumshoq chet;
   *   2) juda past `clearcoat` — terining yog'i, burun va yelka ustida
   *      ko'rinadigan nozik yaltirash.
   * Ikkalasi ham kuchaytirilsa yuz mumga o'xshab qoladi.
   */
  skin: () => ({
    surface: skinSurface(),
    envMapIntensity: 0.55,
    apply: (material) => {
      material.sheen = 0.3;
      material.sheenRoughness = 0.55;
      material.sheenColor = new THREE.Color('#ffd8c2');
      material.clearcoat = 0.09;
      material.clearcoatRoughness = 0.62;
      material.metalness = 0;
    },
  }),
};

/** Manba material → tayyorlangan material. Kalit: uuid + mato turi. */
const upgraded = new Map<string, THREE.MeshPhysicalMaterial>();

function upgrade(source: THREE.Material, fabric: Fabric): THREE.MeshPhysicalMaterial {
  const key = `${source.uuid}:${fabric}`;
  const existing = upgraded.get(key);
  if (existing) return existing;

  const recipe = RECIPES[fabric]();
  const material = new THREE.MeshPhysicalMaterial();

  /*
   * ⚠️ `material.copy(source)` CHAQIRILMAYDI. `MeshPhysicalMaterial.copy`
   * manbadan `clearcoatNormalScale`, `sheenColor`, `iridescence` kabi
   * o'ziga xos maydonlarni o'qiydi — manba esa oddiy `MeshStandardMaterial`,
   * ularning hech biri unda yo'q. Natija: `Cannot read properties of
   * undefined (reading 'x')` va butun sahna yiqiladi.
   *
   * `MeshStandardMaterial.prototype.copy` esa faqat standart maydonlarni
   * ko'chiradi (rang, xaritalar, `side`, `transparent`, `alphaTest`…) va
   * ularning hammasi `MeshPhysicalMaterial` da bor. Shuning uchun nusxa
   * aynan shu daraja bilan olinadi, qolgani retseptdan qo'yiladi.
   */
  THREE.MeshStandardMaterial.prototype.copy.call(material, source);
  material.name = `${source.name || 'material'}__${fabric}`;

  if (recipe.surface) {
    const { normalMap, roughnessMap, repeat, depth } = recipe.surface;

    /*
     * ⚠️ TEKSTURA NUSXALANADI, `repeat` esa nusxada o'zgartiriladi.
     * `THREE.Texture` ni bo'lishib `repeat` ni yozish — bir sirt
     * uchun to'g'ri, ikkinchisi uchun noto'g'ri natija beradi, chunki
     * `repeat` teksturaning o'zida saqlanadi, materialda emas.
     * Nusxa GPU dagi rasmni bo'lishadi, faqat sozlamasi boshqa.
     */
    const normal = normalMap.clone();
    normal.repeat.set(repeat, repeat);
    normal.needsUpdate = true;

    const rough = roughnessMap.clone();
    rough.repeat.set(repeat, repeat);
    rough.needsUpdate = true;

    material.normalMap = normal;
    material.normalScale = new THREE.Vector2(depth, depth);
    material.roughnessMap = rough;
    // Xarita qiymati `roughness` ga KO'PAYTIRILADI — 1 bo'lsa xarita to'liq hukmron
    material.roughness = 1;
  }

  material.envMapIntensity = recipe.envMapIntensity;
  recipe.apply(material);
  material.needsUpdate = true;

  upgraded.set(key, material);
  return material;
}

/**
 * Daraxtdagi barcha mesh'larga tayyorlangan materialni beradi.
 *
 * `vertexColors` o'chiriladi: eksportda `COLOR_0` bor, lekin u butunlay oq
 * — hech narsani o'zgartirmaydi, faqat shaderga ortiqcha ish qo'shadi.
 */
export function dressMaterials(root: THREE.Object3D, fabric: Fabric): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!source) return;

    const material = upgrade(source, fabric);
    material.vertexColors = false;
    mesh.material = material;

    // Soya berish va olish — yumshoq soyalar shundan chiqadi
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

/** HMR va testlar uchun — keshdagi materiallarni bo'shatadi. */
export function disposeMaterials(): void {
  for (const material of upgraded.values()) {
    material.normalMap?.dispose();
    material.roughnessMap?.dispose();
    material.dispose();
  }
  upgraded.clear();
}
