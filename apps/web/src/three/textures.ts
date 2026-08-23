import * as THREE from 'three';

/**
 * Kod bilan yasaladigan mikro-relyef teksturalari.
 *
 * NEGA KERAK: teksturasiz sirt mutlaqo silliq bo'ladi va yorug'lik undan
 * bir tekis qaytadi — natijada mato ham, teri ham plastmassaga o'xshaydi.
 * Aynan shu narsa "arzon 3D" taassurotini beradi. Mayda notekislik esa
 * aksni sindiradi: mato to'qimasi, jinsi diagonali, teri porasi.
 *
 * NEGA KOD BILAN, FAYLDAN EMAS: relyef mayda va takrorlanuvchi. 256×256
 * PNG ~120 KB joy egallardi va har bir sahifa ochilishida yuklanardi;
 * bu yerda esa bir necha o'nlab qator kod va tarmoqqa nol so'rov.
 * `apps/mobile/src/three/textures.ts` bilan bir xil yondashuv — ikkala
 * platformada mato bir xil ko'rinadi.
 *
 * ⚠️ HAR BIR TEKSTURA BIR MARTA YASALADI. Modul darajasida keshlanadi:
 * sahifada 6-8 ta kanvas bo'lishi mumkin, har biriga alohida 256×256
 * DataTexture yasash GPU xotirasini bekorga yeydi.
 */

const SIZE = 256;

type Field = Float32Array;

/** Takrorlanuvchi shovqin — bir xil urug'dan har doim bir xil natija. */
function noise(seed: number): Field {
  const field = new Float32Array(SIZE * SIZE);
  let state = seed >>> 0 || 1;

  for (let i = 0; i < field.length; i++) {
    // xorshift32 — tez va determinlashgan
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    field[i] = (state >>> 0) / 0xffffffff;
  }

  return field;
}

/** Shovqinni `step` marta yiriklashtirib o'qiydi — oktavalar shundan quriladi. */
function sample(field: Field, x: number, y: number, step: number): number {
  const sx = Math.floor(x / step) % SIZE;
  const sy = Math.floor(y / step) % SIZE;
  return field[sy * SIZE + sx] ?? 0;
}

/**
 * Balandlik xaritasidan normal xarita yasaydi.
 *
 * Har piksel uchun qo'shni pikselgacha qiyalik hisoblanadi — bu sirtning
 * shu nuqtadagi burilishi. Chetlar `% SIZE` orqali tutashadi, shuning
 * uchun tekstura chok qoldirmasdan takrorlanadi.
 */
function normalFromHeight(height: Field, strength: number): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const at = (x: number, y: number): number =>
    height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)] ?? 0;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;

      // Normal vektor (-dx, -dy, 1) normalizatsiya qilinib 0…1 ga siqiladi
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
  texture.anisotropy = 4;

  return texture;
}

/**
 * Balandlikdan g'adir-budurlik xaritasi.
 *
 * NEGA NORMAL YETMAYDI: normal xarita faqat yorug'lik burchagini
 * o'zgartiradi, aks-sadoning KENGLIGI esa bir xil qoladi — sirt hamon
 * bir tekis yaltiraydi. Roughness'ni ozgina "chalkashtirish" aksni
 * bo'lak-bo'lak qiladi, mato aynan shunday ko'rinadi.
 *
 * `min`…`max` oralig'i tor: 0.06 dan katta farq matoni dog'li qiladi.
 */
function roughnessFromHeight(height: Field, min: number, max: number): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);

  let low = Infinity;
  let high = -Infinity;
  for (const value of height) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  const span = Math.max(high - low, 0.0001);

  for (let i = 0; i < height.length; i++) {
    const t = ((height[i] ?? 0) - low) / span;
    const level = Math.round((min + t * (max - min)) * 255);
    const index = i * 4;

    // Uchala kanal ham bir xil: three faqat G (roughness) ni o'qiydi,
    // qolganlari xatolik izlaganda ko'rish uchun qulay bo'lsin.
    data[index] = level;
    data[index + 1] = level;
    data[index + 2] = level;
    data[index + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
}

export type Surface = {
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  /** Modelning UV oralig'iga nisbatan necha marta takrorlanishi. */
  repeat: number;
  /** `normalScale` uchun — har mato boshqacha chuqurlikda. */
  depth: number;
};

/** Oddiy to'qima: ikki yo'nalishdagi iplar kesishadi (paxta, futbolka). */
function buildWeave(): Field {
  const height = new Float32Array(SIZE * SIZE);
  const grain = noise(0x5eed01);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      /*
       * Ikkala yo'nalish KO'PAYTIRILMAYDI, QO'SHILADI. Ko'paytirilganda
       * shakl shaxmat taxtasiga aylanadi va mato emas, to'r bo'lib
       * ko'rinadi. Qo'shilganda esa ustma-ust tushgan iplar chiqadi.
       */
      const warp = Math.sin((x / SIZE) * Math.PI * 32);
      const weft = Math.sin((y / SIZE) * Math.PI * 32);
      const fuzz = sample(grain, x, y, 1) * 0.22 + sample(grain, x, y, 4) * 0.18;

      height[y * SIZE + x] = (warp + weft) * 0.25 + fuzz;
    }
  }

  return height;
}

/** Jinsi: diagonal chiziqlar (twill) va yiriroq ip. */
function buildTwill(): Field {
  const height = new Float32Array(SIZE * SIZE);
  const grain = noise(0x5eed02);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const diagonal = Math.sin(((x + y) / SIZE) * Math.PI * 26);
      const thread = Math.sin((x / SIZE) * Math.PI * 52) * 0.25;
      const fuzz = sample(grain, x, y, 2) * 0.3;

      height[y * SIZE + x] = diagonal * 0.4 + thread + fuzz;
    }
  }

  return height;
}

/** Teri: yirik notekislik ustiga mayda pora. */
function buildSkin(): Field {
  const height = new Float32Array(SIZE * SIZE);
  const grain = noise(0x5eed03);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const coarse = sample(grain, x, y, 8) * 0.55;
      const medium = sample(grain, x, y, 3) * 0.3;
      const pore = sample(grain, x, y, 1) * 0.15;

      height[y * SIZE + x] = coarse + medium + pore;
    }
  }

  return height;
}

/** Charm/rezina: mayda "yorilgan" hujayralar. */
function buildGrainy(): Field {
  const height = new Float32Array(SIZE * SIZE);
  const grain = noise(0x5eed04);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cell = sample(grain, x, y, 6);
      const detail = sample(grain, x, y, 2);

      // Kvadratlash cho'qqilarni o'tkirlashtiradi — charm donasi shunday
      height[y * SIZE + x] = cell * cell * 0.7 + detail * 0.3;
    }
  }

  return height;
}

const cache = new Map<string, Surface>();

function surface(
  key: string,
  build: () => Field,
  options: { strength: number; repeat: number; depth: number; rough: [number, number] },
): Surface {
  const existing = cache.get(key);
  if (existing) return existing;

  const height = build();
  const made: Surface = {
    normalMap: normalFromHeight(height, options.strength),
    roughnessMap: roughnessFromHeight(height, options.rough[0], options.rough[1]),
    repeat: options.repeat,
    depth: options.depth,
  };

  cache.set(key, made);
  return made;
}

/*
 * `repeat` TAXMIN BILAN EMAS, O'LCHOV BILAN TANLANGAN.
 *
 * Har bir tekstura tilida 16 ta ip bor. Modellarning UV yoyilmasi o'lchandi
 * (deyarli butun 0…1 oralig'ini egallaydi) va dunyo o'lchami bilan
 * solishtirildi:
 *
 *   futbolka gavdasi  0.476 m / UV 0.95
 *   shim shtaninasi   0.817 m / UV 0.77
 *   krossovka usti    0.222 m / UV 0.93
 *   tana gavdasi      0.701 m / UV 0.97
 *
 * Ip qalinligi 1.5–3 mm bo'lishi kerak: undan yirigi mato emas, to'r bo'lib
 * ko'rinadi (9 da shimda ip 7 mm chiqib, choklama qopga o'xshab qolgandi),
 * mayda esa ekranda umuman yo'qoladi.
 *
 * `depth` (normalScale) ham pasaytirildi — UV yo'q paytda xarita umuman
 * qo'llanmagani uchun bu qiymatlar hech qachon ko'rinmagan va juda baland
 * qolib ketgan edi.
 */
export const cottonSurface = (): Surface =>
  surface('cotton', buildWeave, { strength: 2.4, repeat: 20, depth: 0.3, rough: [0.82, 0.96] });

export const denimSurface = (): Surface =>
  surface('denim', buildTwill, { strength: 3.2, repeat: 16, depth: 0.45, rough: [0.78, 0.94] });

export const skinSurface = (): Surface =>
  surface('skin', buildSkin, { strength: 0.7, repeat: 22, depth: 0.14, rough: [0.52, 0.68] });

export const leatherSurface = (): Surface =>
  surface('leather', buildGrainy, { strength: 1.8, repeat: 8, depth: 0.28, rough: [0.35, 0.62] });

/** Sahifadan chiqilganda — testlar va HMR uchun. */
export function disposeSurfaces(): void {
  for (const item of cache.values()) {
    item.normalMap.dispose();
    item.roughnessMap.dispose();
  }
  cache.clear();
}
