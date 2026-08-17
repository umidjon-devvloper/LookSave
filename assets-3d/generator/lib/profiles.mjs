import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tana profillari — tana ham, kiyim ham SHU YERDAN oladi.
 *
 * NEGA UMUMIY: kiyim o'z raqamlari bilan yasalsa, tana profili
 * o'zgargan zahoti kiyim unga botib qoladi yoki osilib turadi. Bu
 * jimgina yuz beradi — model yuklanadi, xato yo'q, shunchaki noto'g'ri
 * ko'rinadi. Bitta manba bo'lsa, tana kengaysa kiyim ham kengayadi.
 *
 * Format: `[balandlik, yon yarim-eni, old-orqa yarim-eni, z-siljish]`,
 * metrda, o'rtacha bo'y 1.72 uchun.
 *
 * ⚠️ CHUQURLIK (rz) MUHIM. Kiyim razmeri AYLANAdan hisoblanadi
 * (`apps/mobile/src/sizing.ts`), en dan emas. Yassi kesim to'g'ri enda ham
 * juda kichik aylana beradi. O'zgartirgandan keyin `measure.mjs` bilan
 * tekshiring — u ko'krak/bel/son aylanasini santimetrda chiqaradi.
 */

/** Jins farqi — bir xil skelet, boshqa profil ko'paytmalari */
export const SHAPE = {
  male: {
    color: 0xb9aec6,
    shoulders: 1.0,
    chest: 1.0,
    waist: 1.0,
    hips: 1.0,
    limbs: 1.0,
  },
  female: {
    color: 0xc7b6cf,
    shoulders: 0.96,
    chest: 0.93,
    waist: 0.88,
    hips: 1.08,
    limbs: 0.9,
  },
};

/** Qo'l va oyoq qalinliklari — kiyim yenglari ham shundan boshlanadi */
export const LIMB_RADIUS = {
  deltoid: 0.06,
  bicep: 0.05,
  elbow: 0.041,
  forearm: 0.043,
  wrist: 0.028,
  thigh: 0.092,
  knee: 0.056,
  calf: 0.064,
  ankle: 0.032,
};

/**
 * Haqiqiy tanadan o'lchangan profil (`extract-profile.mjs` yozadi).
 *
 * Bo'lsa — kiyim shundan quriladi. Bo'lmasa protsedural jadvalga
 * qaytiladi, ya'ni generator tana modeli bo'lmasa ham ishlayveradi.
 *
 * ⚠️ Bu `export/` dagi build natijasini o'qiydi. Odатда kutubxona build
 * chiqishiga bog'liq bo'lmasligi kerak, lekin bu yerda ataylab: tana
 * o'zgarganda kiyim ham o'zgarishi SHART va ikkalasini qo'lda sinxron
 * ushlab turish — aynan botib qolishga olib kelgan xato edi.
 */
export function measuredTorsoKeys() {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'export', 'body-profile.json');
  if (!existsSync(file)) return null;

  const { keys } = JSON.parse(readFileSync(file, 'utf8'));
  // Juda kichik kesimlar — mesh uchidagi yakka nuqtalar, ular profilni buzadi
  return keys.filter(([, rx]) => rx > 0.08);
}

export function torsoKeys(shape) {
  const { shoulders, chest, waist, hips } = shape;

  return [
    [0.84, 0.158 * hips, 0.125, 0.004], // chanoq pastki qismi
    [0.92, 0.17 * hips, 0.135, 0.006], // dumba — eng keng joyi
    [1.0, 0.156 * waist, 0.124, 0.002],
    [1.07, 0.145 * waist, 0.115, 0], // bel — eng tor joyi
    [1.15, 0.158 * chest, 0.125, -0.002],
    [1.24, 0.175 * chest, 0.135, -0.004], // ko'krak
    [1.32, 0.19 * shoulders, 0.126, -0.004],
    [1.38, 0.196 * shoulders, 0.112, -0.004], // yelka chizig'i (deltoid bilan)
    [1.42, 0.142 * shoulders, 0.09, -0.002], // trapetsiya, bo'yinga o'tish
    [1.45, 0.075, 0.072, 0],
  ];
}

export function headKeys() {
  return [
    [1.485, 0.052, 0.058, 0],
    [1.52, 0.066, 0.076, 0.004], // jag' osti
    [1.55, 0.078, 0.094, 0.006], // jag'
    [1.585, 0.085, 0.101, 0.004], // yonoq
    [1.62, 0.087, 0.101, 0], // kalla — eng keng joyi
    [1.66, 0.079, 0.09, -0.004],
    [1.695, 0.056, 0.062, -0.006],
    [1.715, 0.02, 0.022, -0.006], // tepa
  ];
}

/** Ikki kalit orasidan `y` dagi qiymatni chiziqli topadi */
function sampleAt(keys, y) {
  if (y <= keys[0][0]) return keys[0];
  if (y >= keys[keys.length - 1][0]) return keys[keys.length - 1];

  for (let i = 0; i < keys.length - 1; i++) {
    const [y0, rx0, rz0, cz0 = 0] = keys[i];
    const [y1, rx1, rz1, cz1 = 0] = keys[i + 1];
    if (y < y0 || y > y1) continue;

    const t = (y - y0) / (y1 - y0);
    return [y, rx0 + (rx1 - rx0) * t, rz0 + (rz1 - rz0) * t, cz0 + (cz1 - cz0) * t];
  }

  return keys[keys.length - 1];
}

/**
 * Kiyim uchun profil: tana profilining `from`…`to` bo'lagi, `extra`
 * qalinlikka qalinlashtirilgan.
 *
 * Chekka qiymatlar aniq `from`/`to` balandligida qo'shiladi, aks holda
 * kiyim tananing o'rtasidan kesilib qolgandek ko'rinadi.
 */
export function shellKeys(keys, { from, to, extra }) {
  const inside = keys.filter(([y]) => y > from && y < to);
  const bounds = [sampleAt(keys, from), ...inside, sampleAt(keys, to)];

  return bounds.map(([y, rx, rz, cz = 0]) => [y, rx + extra, rz + extra, cz]);
}
