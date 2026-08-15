import * as FileSystem from 'expo-file-system';
import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { CACHE_BUDGET_MB, ModelCache, pickModelUrl, type Quality, type TryonItem } from './core';
import { patchNavigatorUserAgent } from './glCompat';

// GLTFLoader yaratilishidan OLDIN — aks holda birinchi parse yiqiladi
patchNavigatorUserAgent();

/**
 * GLB yuklash va tozalash.
 *
 * Bu yerda `three.js` bor, shuning uchun test yozilmagan — mantiq
 * `core.ts` da, u yerda testlangan. Bu fayl faqat mantiqni `three.js`
 * obyektlariga bog'laydi.
 *
 * ⚠️ Qurilmada sozlanadigan joylar shu faylda: yuklash vaqti, xotira
 * byudjeti, `dispose` to'liqligi. Ularni `eas build` dan keyin o'lchash
 * kerak.
 */

const loader = new GLTFLoader();

let cache = new ModelCache<THREE.Group>(CACHE_BUDGET_MB.medium);
let cacheQuality: Quality = 'medium';

/** Sifat o'zgarganda byudjet ham o'zgaradi — eski kesh tozalanadi. */
export function setCacheQuality(quality: Quality): void {
  if (quality === cacheQuality) return;

  for (const entry of cache.clear()) disposeObject(entry.value);
  cache = new ModelCache<THREE.Group>(CACHE_BUDGET_MB[quality]);
  cacheQuality = quality;
}

/**
 * Modelni to'liq tozalash (05-mobile §7.6).
 *
 * Bu qilinmasa 20-30 svaypdan keyin ilova qulaydi: `three.js` GPU
 * xotirasini o'zi bo'shatmaydi, `dispose()` aniq chaqirilishi kerak.
 */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry?.dispose();

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;

      // Materialdagi barcha teksturalar: map, normalMap, roughnessMap…
      for (const value of Object.values(material)) {
        const texture = value as THREE.Texture | null;
        if (texture && texture.isTexture) texture.dispose();
      }

      material.dispose();
    }
  });

  root.removeFromParent();
}

/**
 * Base64 → bayt. Hermes'da `atob` ham, `Buffer` ham yo'q, shuning uchun
 * qo'lda. Faqat shu fayl uchun kerak — alohida paket olib kelishga arzimaydi.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array((clean.length * 3) >> 2);

  let byte = 0;
  let bits = 0;
  let out = 0;

  for (let i = 0; i < clean.length; i++) {
    byte = (byte << 6) | B64.indexOf(clean[i] as string);
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (byte >> bits) & 0xff;
    }
  }

  return bytes;
}

/** URL → keshdagi barqaror fayl nomi (djb2) */
function cacheName(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) hash = ((hash << 5) + hash + url.charCodeAt(i)) >>> 0;
  return `looksave-model-${hash.toString(36)}.glb`;
}

/**
 * Modelni yuklab, XOM BAYT qaytaradi.
 *
 * ⚠️ NEGA `loader.load(uri)` EMAS: three'ning `FileLoader` React Native'da
 * ishlamaydi. U `fetch` bilan `file://` manzilini o'qishga urinadi, RN esa
 * uni Metro dev serveriga yo'naltiradi va javobda HTML keladi — natijada
 * `GLTFLoader` "JSON Parse error: Unexpected character: <" beradi. Xato
 * modelga umuman aloqasi yo'qdek ko'rinadi, shuning uchun uni topish qiyin.
 *
 * ⚠️ NEGA `expo-asset` EMAS: `Asset` ilova ichiga joylashtirilgan resurslar
 * uchun. Ixtiyoriy URL berilganda ichkarida nom/kengaytmani ajratishga
 * urinib `Cannot read property 'match' of undefined` bilan yiqiladi.
 *
 * `expo-file-system` esa aynan shu ish uchun: faylni diskka yuklaydi va
 * keshda qoldiradi — ikkinchi marta tarmoqqa chiqilmaydi.
 */
async function download(url: string): Promise<ArrayBuffer> {
  const target = `${FileSystem.cacheDirectory ?? ''}${cacheName(url)}`;

  const info = await FileSystem.getInfoAsync(target);
  let stale = false;

  /*
   * Ishlab chiqishda model URL o'zgarmasdan MAZMUNI almashadi (generator
   * qayta yasaydi va o'sha nom bilan yuklaydi). Kesh esa URL bo'yicha
   * ishlaydi — natijada telefon eski modelni ko'rsatib turaveradi va buni
   * sezish juda qiyin: xato yo'q, shunchaki eski shakl.
   *
   * Shuning uchun faqat `__DEV__` da server bilan hajm solishtiriladi.
   * Ishlab chiqarishda URL versiyalangan (`-v1`) va mazmuni o'zgarmaydi,
   * shuning uchun bu qo'shimcha so'rov u yerda qilinmaydi.
   */
  if (__DEV__ && info.exists) {
    try {
      const head = await fetch(url, { method: 'HEAD' });
      const remote = Number(head.headers.get('content-length'));
      stale = Number.isFinite(remote) && remote > 0 && remote !== info.size;
    } catch {
      // Tarmoq yo'q — keshdagi bilan davom etamiz
    }
  }

  if (!info.exists || info.size === 0 || stale) {
    const result = await FileSystem.downloadAsync(url, target);
    if (result.status !== 200) throw new Error(`Model yuklanmadi: HTTP ${result.status}`);
  }

  const base64 = await FileSystem.readAsStringAsync(target, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const bytes = base64ToBytes(base64);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export interface LoadResult {
  scene: THREE.Group;
  /** Keshdan olindimi — analitika va debug uchun */
  fromCache: boolean;
}

/**
 * Skeletli modelni nusxalash.
 *
 * ⚠️ `Object3D.clone()` SKINNED MESH UCHUN YARAMAYDI. U nusxadagi
 * `SkinnedMesh` ni ASL skeletga bog'langan holda qoldiradi: asl obyekt
 * sahnada bo'lmasa yoki yangilanmasa, nusxa bind pozasida qotib qoladi —
 * tana harakatlanadi, kiyim joyida turadi.
 *
 * `SkeletonUtils.clone` suyaklarni ham nusxalab, bog'lanishni qayta
 * quradi. Skeletsiz modelda ikkalasi bir xil ishlaydi, shuning uchun
 * har doim shu ishlatiladi.
 *
 * Bu xato namuna avatarda ko'rinmaydi (u skeletsiz) — faqat haqiqiy
 * rigli model kelganda chiqadi.
 */
function cloneModel(scene: THREE.Group): THREE.Group {
  return cloneSkinned(scene) as THREE.Group;
}

/**
 * Modelni yuklaydi. Keshda bo'lsa nusxa qaytaradi: bitta `Object3D` ni
 * ikki joyda ishlatib bo'lmaydi, lekin geometriya va material umumiy
 * qoladi — xotira takrorlanmaydi.
 */
export async function loadModel(key: string, url: string, sizeBytes: number): Promise<LoadResult> {
  const cached = cache.get(key);
  if (cached) return { scene: cloneModel(cached), fromCache: true };

  const data = await download(url);

  // `parse` — tayyor baytdan, tarmoqqa chiqmaydi. Ikkinchi argument
  // (`path`) tekstura kabi tashqi resurslar uchun; bizda ular yo'q.
  const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    loader.parse(
      data,
      '',
      (result) => resolve(result as unknown as { scene: THREE.Group }),
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });

  // Byudjetdan oshgan modellar chiqariladi va darhol tozalanadi
  for (const entry of cache.set(key, gltf.scene, sizeBytes)) {
    disposeObject(entry.value);
  }

  return { scene: cloneModel(gltf.scene), fromCache: false };
}

/**
 * Animatsiya kliplarini yuklash.
 *
 * Klip GLB'lari alohida fayl: ichida geometriya yo'q, faqat trek
 * ma'lumoti (~50-150 KB). Ular model keshiga tushmaydi — kesh
 * byudjeti geometriya uchun, kliplar esa kichik va sessiya davomida
 * kerak bo'lib turadi.
 */
const clipCache = new Map<string, THREE.AnimationClip[]>();

export async function loadClips(url: string): Promise<THREE.AnimationClip[]> {
  const cached = clipCache.get(url);
  if (cached) return cached;

  const data = await download(url);

  const gltf = await new Promise<{ animations: THREE.AnimationClip[] }>((resolve, reject) => {
    loader.parse(
      data,
      '',
      (result) => resolve(result as unknown as { animations: THREE.AnimationClip[] }),
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });

  clipCache.set(url, gltf.animations);
  return gltf.animations;
}

export function clearClipCache(): void {
  clipCache.clear();
}

export async function loadGarment(item: TryonItem, quality: Quality): Promise<THREE.Group | null> {
  const url = pickModelUrl(item, quality);
  if (!url) return null;

  const { scene } = await loadModel(`${item.variantId}:${quality}`, url, item.fileSizeBytes ?? 0);
  return scene;
}

/** Prefetch — natija keshda qoladi, qaytarilmaydi. */
export async function prefetch(item: TryonItem, quality: Quality): Promise<void> {
  const url = pickModelUrl(item, quality, 'prefetch');
  if (!url) return;

  const key = `${item.variantId}:${quality}`;
  if (cache.has(key)) return;

  try {
    await loadModel(key, url, item.fileSizeBytes ?? 0);
  } catch {
    // Prefetch jim yiqiladi — foydalanuvchi buni bilishi shart emas
  }
}

/** Kiyilgan model keshdan chiqarilmaydi — u ekranda ko'rinib turadi. */
export function pinModel(variantId: string, quality: Quality): void {
  cache.pin(`${variantId}:${quality}`);
}

export function unpinModel(variantId: string, quality: Quality): void {
  cache.unpin(`${variantId}:${quality}`);
}

/** Xotira kam signalida (05-mobile §7.8) — kiyilmaganlar tozalanadi. */
export function purgeCache(): void {
  for (const entry of cache.purgeUnpinned()) disposeObject(entry.value);
}

export function clearCache(): void {
  for (const entry of cache.clear()) disposeObject(entry.value);
}

/**
 * Blendshape qiymatlarini modelga qo'llaydi.
 *
 * Kiyim ham, tana ham bir xil nomdagi shape key'larga ega bo'lishi
 * kerak (04-3d-pipeline §3: `mt_height`, `mt_weight`, …). Aks holda
 * kiyim tanaga mos kelmaydi.
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

/** Har mesh'ga slot yozib qo'yiladi — raycast shu orqali ishlaydi. */
export function tagSlot(root: THREE.Object3D, slot: string): void {
  root.traverse((child) => {
    child.userData['slot'] = slot;
  });
}

/**
 * Kiyim ostidagi tana qismlarini yashirish.
 * Bu qilinmasa oyoq krossovka ichidan chiqib turadi (Z-fighting).
 */
export function applyHiddenParts(body: THREE.Object3D, hidden: string[]): void {
  const hiddenSet = new Set(hidden);

  body.traverse((child) => {
    if (child.name.startsWith('body_')) {
      child.visible = !hiddenSet.has(child.name);
    }
  });
}
