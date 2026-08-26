import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
/*
 * ⚠️ FAQAT DEKODER, `jpeg-js` INDEXI EMAS. Index encoder'ni ham tortadi
 * va u modul darajasida `Buffer` ishlatadi — Hermes'da `Buffer` yo'q,
 * ilova ishga tushishda yiqilardi (`loader.ts` da xuddi shu izoh).
 */
// @ts-expect-error — jpeg-js/lib/decoder tip e'lonisiz; qaytishi quyida tiplanadi
import decodeJpeg from 'jpeg-js/lib/decoder';
import * as THREE from 'three';

import { base64ToBytes } from './base64';

/**
 * Kod bilan yasaladigan mikro-relyef teksturalari.
 *
 * NEGA KERAK: teksturasiz sirt mutlaqo silliq bo'ladi va yorug'lik undan
 * bir tekis qaytadi — natijada mato ham, teri ham plastmassaga o'xshaydi.
 * Mayda notekislik shu taassurotni buzadi: mato to'qimasi va teri g'adir-
 * budurligi yorug'likni tarqatadi.
 *
 * NEGA KOD BILAN, FAYLDAN EMAS: relyef mayda va takrorlanuvchi, shuning
 * uchun uni rasm sifatida saqlash ma'nosiz — 256×256 normal map ~100 KB
 * joy egallaydi va har model bilan yuklab olinadi. Kod esa bir necha
 * qatordan iborat va natija bir xil.
 *
 * ⚠️ Teksturalar BIR MARTA yasaladi va qayta ishlatiladi. Har material
 * uchun alohida yasalsa GPU xotirasi bekorga sarflanadi.
 */

const SIZE = 128;

/**
 * Balandlik xaritasidan normal xarita yasaydi.
 *
 * Har piksel uchun qo'shni pikselga nisbatan qiyalik hisoblanadi —
 * bu sirtning shu nuqtadagi burilishini beradi.
 */
function normalFromHeight(height: Float32Array, strength: number): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const at = (x: number, y: number): number =>
    height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)] ?? 0;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;

      // Normal vektor: (-dx, -dy, 1) normalizatsiya qilinadi va
      // 0…1 oralig'iga siqiladi (normal map konvensiyasi)
      const length = Math.hypot(dx, dy, 1);
      const index = (y * SIZE + x) * 4;

      data[index] = ((-dx / length) * 0.5 + 0.5) * 255;
      data[index + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
      data[index + 2] = (1 / length) * 0.5 * 255 + 128;
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
}

/** Takrorlanuvchi shovqin — bir xil urug'dan har doim bir xil natija */
function noise(seed: number): Float32Array {
  const height = new Float32Array(SIZE * SIZE);
  let state = seed;

  const random = (): number => {
    // xorshift — tez va takrorlanadigan
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000) / 1000;
  };

  for (let i = 0; i < height.length; i++) height[i] = random();
  return height;
}

let fabric: THREE.Texture | null = null;
let skin: THREE.Texture | null = null;

/**
 * Mato to'qimasi — o'zaro kesishgan iplar.
 *
 * Sinus to'lqinlari ip yo'nalishini beradi, ustiga qo'shilgan shovqin
 * ularni jonlantiradi (ideal to'g'ri iplar sun'iy ko'rinadi).
 */
export function fabricNormal(): THREE.Texture {
  if (fabric) return fabric;

  const height = new Float32Array(SIZE * SIZE);
  const grain = noise(12345);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const weave = Math.sin(x * 0.85) * Math.sin(y * 0.85);
      height[y * SIZE + x] = weave * 0.6 + (grain[y * SIZE + x] ?? 0) * 0.25;
    }
  }

  fabric = normalFromHeight(height, 1.6);
  fabric.repeat.set(8, 8);
  return fabric;
}

/**
 * Mato ALBEDO teksturasi — to'qima naqshi.
 *
 * ⚠️ NEGA KERAK. Ilgari kiyimda faqat normal map bor edi (relyef), rang
 * esa TEKIS bitta tus. Tekis rang plastmassaga o'xshaydi — mato emas.
 * Albedo yorug'lik rangini piksel-piksel o'zgartiradi: ip yo'nalishi
 * bo'ylab och-to'q chiziqlar va tasodifiy tola ranglari.
 *
 * ⚠️ OQ-KULRANG QAYTARADI, RANG EMAS. three'da `material.map` `material.
 * color` ga KO'PAYTIRILADI. Ya'ni bu tekstura ~1.0 atrofida o'zgarib
 * turadi va asos rangni MODULYATSIYA qiladi — shu bir tekstura har rangdagi
 * kiyimga yaraydi (oq futbolka ham, binafsha ham). Aks holda har rang uchun
 * alohida tekstura kerak bo'lardi.
 *
 * `variance` — tolalar rangining tarqoqligi. Denimda katta (rangi notekis),
 * trikotajda kichik (bir tekisroq).
 */
function wovenAlbedo(
  seed: number,
  variance: number,
  tint: [number, number, number],
): THREE.Texture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const grain = noise(seed);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      /*
       * To'quv: ko'ndalang va bo'ylama iplar navbatlashadi. Ip ustidagi
       * nuqta yorug'roq, iplar orasidagi chuqurcha to'qroq — bu matoga
       * "to'qilgan" ko'rinish beradi.
       */
      const warp = Math.sin(x * 0.8);
      const weft = Math.sin(y * 0.8);
      const weave = warp * weft * 0.1;

      // Tola rangining tasodifiy o'zgarishi
      const fiber = ((grain[y * SIZE + x] ?? 0.5) - 0.5) * variance;

      const shade = 1 + weave + fiber;
      const index = (y * SIZE + x) * 4;
      data[index] = Math.max(0, Math.min(255, tint[0] * shade * 255));
      data[index + 1] = Math.max(0, Math.min(255, tint[1] * shade * 255));
      data[index + 2] = Math.max(0, Math.min(255, tint[2] * shade * 255));
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Mato turiga qarab material to'plami — albedo + normal + g'adir-budurlik.
 *
 * ⚠️ TUR SLOTDAN ANIQLANADI. `feet`/`wrist` (krossovka, soat) mato emas —
 * ularga to'qima berilsa noto'g'ri ko'rinadi. Trikotaj (top), denim
 * (outer), gabardin (bottom) har xil zichlik va relyefga ega.
 */
export type FabricKind = 'knit' | 'denim' | 'twill' | 'smooth';

interface FabricMaterial {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  normalScale: number;
  roughness: number;
  repeat: number;
}

const fabricCache = new Map<FabricKind, FabricMaterial>();

/** Slotdan mato turini topadi — chaqiruvchi slotni biladi. */
export function fabricKindForSlot(slot: string): FabricKind {
  switch (slot) {
    case 'outer':
      return 'denim';
    case 'bottom':
      return 'twill';
    case 'feet':
    case 'wrist':
    case 'head':
      return 'smooth';
    default:
      return 'knit'; // top va boshqalar
  }
}

const FABRIC_TINT: [number, number, number] = [1, 1, 1];

/**
 * Haqiqiy mato suratlari (PolyHaven, CC0). Protsedural to'quv matoning
 * qanday KO'RINISHINI taxmin qiladi; bular esa haqiqiy matoning skani —
 * trikotaj ipi, denim diagonali, charm g'adir-budurligi.
 *
 * ⚠️ ALBEDO KULRANG. Ilova uni bazaviy rangga KO'PAYTIRADI, ya'ni rangli
 * bo'lsa mahsulot rangi buziladi (oq futbolka jigarrang chiqardi). Kulrang
 * variant faqat yorug'lik o'zgarishini beradi.
 *
 * ⚠️ SURATLAR QIRQIB OLINGAN, KICHRAYTIRILMAGAN. 1024→256 siqishda mayda
 * to'quv averaging'da butunlay yo'qoladi — sinab ko'rildi, natija bir tekis
 * rang bo'lib chiqdi. Shuning uchun asl o'lchamdan 256×256 bo'lak kesilgan.
 */
const FABRIC_FILES: Record<FabricKind, { albedo: number; normal: number }> = {
  knit: {
    albedo: require('../../assets/textures/knit-albedo.jpg'),
    normal: require('../../assets/textures/knit-normal.jpg'),
  },
  denim: {
    albedo: require('../../assets/textures/denim-albedo.jpg'),
    normal: require('../../assets/textures/denim-normal.jpg'),
  },
  twill: {
    albedo: require('../../assets/textures/twill-albedo.jpg'),
    normal: require('../../assets/textures/twill-normal.jpg'),
  },
  smooth: {
    albedo: require('../../assets/textures/smooth-albedo.jpg'),
    normal: require('../../assets/textures/smooth-normal.jpg'),
  },
};

interface JpegDecoded {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Ilova ichidagi JPEG ni XOM PIKSEL teksturaga aylantiradi. */
async function loadJpegTexture(moduleId: number, srgb: boolean): Promise<THREE.Texture | null> {
  try {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    if (!asset.localUri) return null;

    const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    /*
     * ⚠️ `DataTexture`, `TextureLoader` EMAS. RN'da `TextureLoader` rasm
     * uchun `fetch` va `Image` ga tayanadi va jimgina bo'sh tekstura
     * qaytaradi (GLB ichidagi JPEG bilan aynan shu bo'lgan). Xom piksel
     * esa Hermes'da ishonchli ishlaydi.
     */
    const bytes = base64ToBytes(base64);
    const { width, height, data } = decodeJpeg(bytes, { useTArray: true }) as JpegDecoded;
    const texture = new THREE.DataTexture(new Uint8Array(data), width, height, THREE.RGBAFormat);

    // Xom piksel yuqoridan pastga — GL kutganining teskarisi emas
    texture.flipY = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
  } catch {
    // Zaxira: protsedural tekstura ishlatiladi — kiyim baribir chiziladi
    return null;
  }
}

const fileTextures = new Map<FabricKind, { albedo: THREE.Texture; normal: THREE.Texture }>();
let preloaded: Promise<void> | null = null;

/**
 * Mato suratlarini bir marta yuklaydi. Kiyim yuklanishidan oldin
 * chaqiriladi; ikkinchi chaqiruv o'sha va'dani qaytaradi.
 */
export function preloadFabricTextures(): Promise<void> {
  preloaded ??= (async () => {
    for (const kind of Object.keys(FABRIC_FILES) as FabricKind[]) {
      const files = FABRIC_FILES[kind];
      const [albedo, normal] = await Promise.all([
        loadJpegTexture(files.albedo, true),
        loadJpegTexture(files.normal, false),
      ]);
      if (albedo && normal) fileTextures.set(kind, { albedo, normal });
    }

    /*
     * ⚠️ KESHNI TOZALASH SHART. `fabricMaterial` natijani keshlaydi va
     * agar biror kiyim preload tugashidan oldin yuklangan bo'lsa, keshda
     * PROTSEDURAL variant qolib ketardi — surat yuklangani bilan hech
     * qachon ishlatilmasdi.
     */
    fabricCache.clear();
  })();

  return preloaded;
}

/**
 * Nechta mato surati yuklandi — DEV ko'rsatkichi uchun.
 *
 * ⚠️ NEGA KERAK. Simulyator 3D ni umuman chizmaydi, ya'ni mato skani
 * qo'llanganini KO'Z BILAN faqat qurilmada tekshirish mumkin. Surat
 * yuklanmasa kod jimgina protsedural teksturaga tushadi — xato ham,
 * farq ham ko'rinmaydi. Bu qator shu ko'r nuqtani yopadi.
 */
export function fabricTextureStatus(): string {
  const total = Object.keys(FABRIC_FILES).length;
  if (!preloaded) return 'kutilmoqda';
  return fileTextures.size === 0 ? 'protsedural' : `surat ${fileTextures.size}/${total}`;
}

export function fabricMaterial(kind: FabricKind): FabricMaterial {
  const cached = fabricCache.get(kind);
  if (cached) return cached;

  let material: FabricMaterial;

  if (kind === 'denim') {
    // Denim: qalin diagonal to'quv, rangi notekis, g'adir-budur
    material = {
      albedo: wovenAlbedo(4242, 0.22, FABRIC_TINT),
      normal: fabricNormal(),
      normalScale: 1.1,
      roughness: 0.82,
      repeat: 6,
    };
  } else if (kind === 'twill') {
    material = {
      albedo: wovenAlbedo(1717, 0.12, FABRIC_TINT),
      normal: fabricNormal(),
      normalScale: 0.8,
      roughness: 0.7,
      repeat: 7,
    };
  } else if (kind === 'smooth') {
    // Krossovka, soat: to'qima yo'q, faqat mayin g'adir-budurlik
    material = {
      albedo: wovenAlbedo(9090, 0.05, FABRIC_TINT),
      normal: skinNormal(),
      normalScale: 0.3,
      roughness: 0.5,
      repeat: 3,
    };
  } else {
    // Trikotaj (futbolka): mayda bir tekis to'quv
    material = {
      albedo: wovenAlbedo(2626, 0.1, FABRIC_TINT),
      normal: fabricNormal(),
      normalScale: 0.7,
      roughness: 0.85,
      repeat: 10,
    };
  }

  /*
   * ⚠️ HAQIQIY SURAT USTUN. Yuklangan bo'lsa protsedural to'quv o'rniga
   * mato skani ishlatiladi — qolgan parametrlar (roughness, repeat,
   * normalScale) o'z joyida qoladi, ular mato TURINI belgilaydi.
   *
   * `repeat` esa KICHRAYTIRILADI: protsedural tekstura 128 px va juda
   * mayda, surat 256 px va unda to'quv allaqachon o'z o'lchamida. Bir xil
   * takrorlashda naqsh mayda nuqtaga aylanib, to'qima ko'rinmay qolardi.
   */
  const file = fileTextures.get(kind);
  if (file) {
    material = {
      ...material,
      albedo: file.albedo,
      normal: file.normal,
      repeat: Math.max(2, Math.round(material.repeat / 2.5)),
    };
  }

  fabricCache.set(kind, material);
  return material;
}

/** Teri — mayda, tartibsiz g'adir-budurlik */
export function skinNormal(): THREE.Texture {
  if (skin) return skin;

  const grain = noise(6789);
  const height = new Float32Array(SIZE * SIZE);

  // Ikki qatlam: yirikroq notekislik va ustidan mayda pora
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const coarse = (grain[((y >> 2) * SIZE + (x >> 2)) % grain.length] ?? 0) * 0.5;
      height[y * SIZE + x] = coarse + (grain[y * SIZE + x] ?? 0) * 0.5;
    }
  }

  skin = normalFromHeight(height, 0.45);
  skin.repeat.set(4, 4);
  return skin;
}

/** Ekrandan chiqilganda GPU xotirasini bo'shatish */
export function disposeTextures(): void {
  fabric?.dispose();
  skin?.dispose();
  fabric = null;
  skin = null;

  for (const material of fabricCache.values()) {
    material.albedo.dispose();
    // normal — fabric/skin bilan umumiy, yuqorida allaqachon dispose qilindi
  }
  fabricCache.clear();
}
