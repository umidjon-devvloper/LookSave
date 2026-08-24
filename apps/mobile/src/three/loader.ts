/*
 * ⚠️ YON-TA'SIR UCHUN IMPORT — O'CHIRMANG, hech narsa ishlatilmasa ham.
 *
 * `expo-three` ichida `@expo/browser-polyfill` bor va u three'ga kerak
 * bo'lgan brauzer globallarini qo'yadi:
 *
 *   global.Image · HTMLCanvasElement · HTMLImageElement · ImageBitmap
 *   WebGLRenderingContext · TextDecoder · TextEncoder
 *
 * ⚠️ BU XATO BIR MARTA QILINDI (D-41, 2026-08-24). O'sha kuni yuz
 * teksturasi olib tashlandi va u bilan birga `loadTextureAsync` importi
 * ham ketdi — `expo-three` ni olib keladigan YAGONA joy shu edi. Natija:
 * model muvaffaqiyatli yuklandi, log toza, xato yo'q, EKRAN esa bo'sh.
 * Sababi hech qayerdan ko'rinmasdi.
 *
 * Shuning uchun import ochiq va yon-ta'sir sifatida turadi: undan hech
 * narsa olinmaydi, ya'ni "ishlatilmagan" deb o'chirib tashlash oson —
 * shu izoh buni to'sadi.
 */
import 'expo-three';

import * as FileSystem from 'expo-file-system';
import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { CACHE_BUDGET_MB, ModelCache, pickModelUrl, type Quality, type TryonItem } from './core';
import { patchNavigatorUserAgent } from './glCompat';
import { fabricNormal } from './textures';
import { Mesh } from 'three';

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
export async function download(url: string): Promise<ArrayBuffer> {
  /*
   * `file://` — model allaqachon qurilmada: ilova ichiga joylashtirilgan
   * yoki oldin yuklab olingan. Uni keshga qayta nusxalash ortiqcha ish va
   * ortiqcha joy, shuning uchun to'g'ridan-to'g'ri o'qiymiz.
   */
  if (url.startsWith('file://')) return readBytes(url);

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

  return readBytes(target);
}

/** Diskdagi faylni xom baytga aylantiradi. */
async function readBytes(path: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(path, {
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

/*
 * ── `loadFaceTexture` OLIB TASHLANDI (D-41, 2026-08-24) ──
 *
 * U selfini 3D bosh mesh'iga tekstura qilib yuklardi, lekin boshda yuz
 * UV joylashuvi yo'q va natija dog' bo'lib chiqardi. Yagona chaqiruvchi
 * `AvatarView` edi — sabab va qaytarish shartlari o'sha yerda yozilgan.
 *
 * `flipY = false` shartini esdan chiqarmang: glTF UV'lari yuqoridan
 * pastga hisoblanadi va busiz yuz teskari tushadi.
 */

export async function loadGarment(item: TryonItem, quality: Quality): Promise<THREE.Group | null> {
  const url = pickModelUrl(item, quality);
  if (!url) return null;

  const { scene } = await loadModel(`${item.variantId}:${quality}`, url, item.fileSizeBytes ?? 0);

  /*
   * Mato relyefi — barcha kiyim shu funksiyadan o'tadi, shuning uchun
   * shu yerda beriladi. Modelga singdirilmaydi: relyef takrorlanuvchi va
   * mayda, uni har GLB ichida saqlash faylni bekorga kattalashtirardi.
   *
   * Material NUSXALANADI: kesh bitta modelni bir necha marta qaytaradi va
   * materialni joyida o'zgartirish keshdagi asl nusxaga ham ta'sir qilardi.
   */
  const normalMap = fabricNormal();
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const material = (mesh.material as THREE.MeshStandardMaterial).clone();
    material.normalMap = normalMap;
    material.needsUpdate = true;
    mesh.material = material;
  });

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
/**
 * Shape key va skinning'ni VERTEKSLARGA SINGDIRADI, keyin ularni o'chiradi.
 *
 * ⚠️ NEGA MAJBURIY: `three` skelet va shape key ma'lumotini FLOAT TEKSTURA
 * orqali shaderga uzatadi. `expo-gl` da esa `EXT_color_buffer_float`
 * kengaytmasi yo'q — logda shu yozuv chiqadi:
 *
 *   THREE.WebGLRenderer: EXT_color_buffer_float extension not supported
 *
 * Natijada skinned mesh'lar umuman chizilmaydi. Xato berilmaydi, model
 * yuklanadi, kadrlar sanaladi — faqat ekran bo'sh qoladi. Buni topish
 * uchun bir necha kun ketdi.
 *
 * YECHIM: hisob-kitobni bir marta protsessorda bajarib, natijani oddiy
 * pozitsiyaga yozamiz. Shundan keyin mesh oddiy (skinsiz, morphsiz) bo'lib
 * qoladi va hech qanday float tekstura kerak emas.
 *
 * ⚠️ NARXI: animatsiya imkoni yo'qoladi — suyaklar endi vertekslarga
 * ta'sir qilmaydi. Hozircha yo'qotish emas: klip'lar baribir yo'q va
 * avatar tinch turadi. Animatsiya kerak bo'lganda `expo-gl` ni float
 * tekstura qo'llab-quvvatlaydigan versiyaga ko'tarish kerak bo'ladi.
 *
 * O'lchamlar esa SAQLANADI: shape key qiymatlari shu yerda qo'llanadi,
 * ya'ni bo'y va ko'krak baribir tanaga ta'sir qiladi.
 */
export function bakeForExpoGl(root: THREE.Object3D, morphs: Record<string, number>): void {
  const replacements: Array<{ from: THREE.Mesh; to: THREE.Mesh }> = [];

  root.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;

    const geometry = mesh.geometry;
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const targets = geometry.morphAttributes.position;

    // 1. Shape key'larni pozitsiyaga qo'shamiz
    if (targets && mesh.morphTargetDictionary) {
      const relative = geometry.morphTargetsRelative;

      /*
       * ⚠️ MODELDAGI STANDART OG'IRLIKLAR HAM QO'LLANADI — busiz hamma
       * narsa kichik chiziladi.
       *
       * Generator shape key'larni shunday yasaydi: geometriyaning asosi
       * neytral shakldan BARCHA og'ishlar yig'indisining yarmicha orqaga
       * suriladi, GLB da esa `weights: [0.5, 0.5, ...]` yoziladi. Ya'ni
       * to'g'ri o'lchamni ko'rish uchun og'irliklar 0.5 bo'lishi SHART.
       *
       * Ilgari bu yerda faqat aniq berilgan qiymatlar qo'llanardi. O'lcham
       * berilmagan holatda (`{}`) hech narsa qo'llanmay, har bir kiyim va
       * tananing o'zi ~4 sm kichik chizilardi: kiyim tor bo'lib tanaga
       * botib ketardi va yuzada teri bilan mato almashib turgan chipor
       * dog'lar paydo bo'lardi. Xato chiqmaydi — shunchaki hammasi kichik.
       */
      const defaults = mesh.morphTargetInfluences ?? [];

      const applied = Object.entries(mesh.morphTargetDictionary).map(([key, index]) => {
        const override = morphs[key.replace(/^mt_/, '')];
        return [index, override ?? defaults[index] ?? 0] as const;
      });

      for (const [index, value] of applied) {
        if (value === 0) continue;

        const target = targets[index];
        if (!target) continue;

        for (let i = 0; i < position.count; i++) {
          const dx = relative ? target.getX(i) : target.getX(i) - position.getX(i);
          const dy = relative ? target.getY(i) : target.getY(i) - position.getY(i);
          const dz = relative ? target.getZ(i) : target.getZ(i) - position.getZ(i);

          position.setXYZ(
            i,
            position.getX(i) + dx * value,
            position.getY(i) + dy * value,
            position.getZ(i) + dz * value,
          );
        }
      }

      position.needsUpdate = true;
      delete geometry.morphAttributes.position;
      mesh.morphTargetDictionary = undefined;
      mesh.morphTargetInfluences = undefined;
    }

    // 2. Teri og'irliklari — bind pozada skinning birlik almashtirish,
    //    ya'ni vertekslar joyida qoladi. Shuning uchun ularni shunchaki
    //    olib tashlaymiz.
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    geometry.computeVertexNormals();

    if (mesh.isSkinnedMesh) {
      const plain = new Mesh(geometry, mesh.material);
      plain.name = mesh.name;
      plain.userData = mesh.userData;
      plain.frustumCulled = false;
      replacements.push({ from: mesh, to: plain });
    }
  });

  // Almashtirish alohida: `traverse` ichida daraxtni o'zgartirib bo'lmaydi
  for (const { from, to } of replacements) {
    from.parent?.add(to);
    from.removeFromParent();
  }
}

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
    /*
     * ⚠️ ICHKI KIYIM HAM BOSHQARILADI. Ilgari faqat `body_` bilan
     * boshlanadigan nomlar tekshirilardi, shuning uchun shim kiyilganda
     * ichki kiyim uning ostidan qora bo'lib chiqib turardi: ichki kiyim
     * Y 0.72…0.97, shim beli esa 0.83 dan boshlanadi.
     */
    if (!MANAGED_PART.test(child.name)) return;

    child.visible = !hiddenSet.has(child.name);
  });
}

/** Ko'rinishi kiyimga qarab boshqariladigan qismlar. */
const MANAGED_PART = /^(body_|underwear_)/;
