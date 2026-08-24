import type { Gender } from '@looksave/shared-types';

/**
 * O'lchamlardan blendshape qiymatlarini hisoblash.
 *
 * ⚠️ FORMULA HUJJATDA YO'Q. 03-api-spec §6 faqat "server morphTargets ni
 * o'zi hisoblaydi" deydi va misol qiymatlarni ko'rsatadi. Quyidagi
 * formulalar shu misollarga va 04-3d-pipeline §3 dagi diapazonga
 * (`0.0 → 1.0`, `0.5` — neytral) qarab tuzildi.
 *
 * Ular 3D modelning haqiqiy shape key'lari bilan solishtirilishi kerak:
 * `mt_height = 1.0` bo'lganda avatar necha santimetr bo'ladi — shuni
 * o'lchab, bu yerdagi chegaralar tuzatiladi. Hozircha bu **taxmin**.
 *
 * Formula serverda turgani muhim: model o'zgarganda ilovani yangilash
 * shart emas, faqat shu fayl tuzatiladi.
 */

export interface Measurements {
  height?: number;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  shoeSize?: number;
  shoeSizeSystem?: string;
}

export interface MorphTargets {
  height: number;
  weight: number;
  shoulderWidth: number;
  chest: number;
  waist: number;
  hips: number;
}

/** Neytral holat — o'lcham kiritilmaganda shu qaytadi. */
export const NEUTRAL: MorphTargets = {
  height: 0.5,
  weight: 0.5,
  shoulderWidth: 0.5,
  chest: 0.5,
  waist: 0.5,
  hips: 0.5,
};

/**
 * Yuz SHAKLI morflari — bosh mesh'idagi `fm_*` (021 migratsiya).
 *
 * ⚠️ NEYTRAL 0, mt_* DAN FARQLI (u 0.5). `export_bodies.py` fm_* ni 0 ga
 * qo'yadi: asos geometriya neytral yuz, morf uni chetga suradi. Ya'ni
 * qiymat qancha katta — xususiyat shuncha kuchli.
 */
export interface FaceMorphs {
  faceLength: number;
  faceWidth: number;
  jawWidth: number;
  chinShape: number;
  noseWidth: number;
  noseLength: number;
  eyeDistance: number;
  lipFullness: number;
}

/** Yuz neytral — barcha fm_* nol (asos yuz o'zgarmaydi). */
export const NEUTRAL_FACE: FaceMorphs = {
  faceLength: 0,
  faceWidth: 0,
  jawWidth: 0,
  chinShape: 0,
  noseWidth: 0,
  noseLength: 0,
  eyeDistance: 0,
  lipFullness: 0,
};

function hasFaceMorphs(value: unknown): value is FaceMorphs {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as FaceMorphs).faceWidth === 'number'
  );
}

/**
 * Avatar config uchun BIRLASHGAN morf map — tana + yuz bitta tekis
 * obyektda. Ilova `bakeForExpoGl` da morf nomining prefiksini olib
 * tashlab qidiradi: `mt_height` → `height`, `fm_faceWidth` → `faceWidth`.
 * Shuning uchun kalitlar prefikssiz.
 */
export function mergeMorphs(body: MorphTargets, face: FaceMorphs | null): Record<string, number> {
  return { ...body, ...(hasFaceMorphs(face) ? face : NEUTRAL_FACE) };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

/** `min`…`max` oralig'ini 0…1 ga o'girish. */
function normalize(value: number, min: number, max: number): number {
  return clamp01((value - min) / (max - min));
}

/**
 * Aylana o'lchamlari bo'yga nisbatan hisoblanadi: 100 sm ko'krak
 * 160 sm odamda va 195 sm odamda butunlay boshqa narsani anglatadi.
 */
function ratioMorph(
  circumference: number | undefined,
  height: number,
  typicalRatio: number,
  spread: number,
): number {
  if (circumference === undefined || circumference <= 0) return 0.5;
  const ratio = circumference / height;
  return normalize(ratio, typicalRatio - spread, typicalRatio + spread);
}

/** Jinsga qarab tipik nisbatlar. Ayol va erkak tanasi boshqacha taqsimlanadi. */
const RATIOS: Record<'male' | 'female', { chest: number; waist: number; hips: number }> = {
  male: { chest: 0.55, waist: 0.47, hips: 0.53 },
  female: { chest: 0.52, waist: 0.42, hips: 0.56 },
};

export function computeMorphTargets(
  measurements: Measurements,
  gender: Gender | null,
): MorphTargets {
  const height = measurements.height;

  // Bo'ysiz aylana o'lchamlarini talqin qilib bo'lmaydi
  if (height === undefined || height <= 0) return NEUTRAL;

  const ratios = RATIOS[gender === 'female' ? 'female' : 'male'];

  // 150–200 sm oralig'i: 0.5 ≈ 175 sm
  const heightMorph = normalize(height, 150, 200);

  // Vazn — BMI orqali. To'g'ridan-to'g'ri kilogramm bo'y bilan bog'liq
  // bo'lgani uchun ikki marta hisobga olinardi.
  const weightMorph =
    measurements.weight === undefined || measurements.weight <= 0
      ? 0.5
      : normalize(measurements.weight / (height / 100) ** 2, 16, 34);

  const chest = ratioMorph(measurements.chest, height, ratios.chest, 0.09);
  const waist = ratioMorph(measurements.waist, height, ratios.waist, 0.1);
  const hips = ratioMorph(measurements.hips, height, ratios.hips, 0.09);

  // Yelka kengligi alohida o'lchanmaydi — ko'krak va umumiy hajmdan chiqadi
  const shoulderWidth = clamp01(chest * 0.6 + weightMorph * 0.4);

  return { height: heightMorph, weight: weightMorph, shoulderWidth, chest, waist, hips };
}

/**
 * Qurilma bo'yicha sifat tavsiyasi (03-api-spec §6).
 * Ilova baribir FPS o'lchab o'zi tuzatadi — bu faqat boshlang'ich qiymat.
 */
export type QualityHint = 'low' | 'medium' | 'high';

export function suggestQuality(deviceModel: string | null, platform: string | null): QualityHint {
  // iOS qurilmalari bir xilroq va kuchli — ular uchun standart yuqoriroq
  if (platform === 'ios') return 'high';

  if (!deviceModel) return 'medium';

  const model = deviceModel.toLowerCase();

  // Arzon Android liniyalari: past sifatdan boshlanadi
  const lowEnd = ['redmi 9', 'redmi 8', 'galaxy a0', 'galaxy a1', 'galaxy j', 'nokia c'];
  if (lowEnd.some((name) => model.includes(name))) return 'low';

  const highEnd = ['pixel 8', 'pixel 9', 'galaxy s2', 'galaxy s9', 'oneplus 1'];
  if (highEnd.some((name) => model.includes(name))) return 'high';

  return 'medium';
}
