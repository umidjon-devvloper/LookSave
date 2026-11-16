import { randomUUID } from 'node:crypto';

import sharp from 'sharp';

import { uploadObject } from '../integrations/r2';
import type { AvatarAngle } from './avatar-prompt';

/**
 * Uch burchakli «turnaround» varaqni bo'laklarga ajratish
 * (`buildTryonSheetPrompt` → operator → shu yer).
 *
 * Rasm chapdan o'ngga OLD · YON · ORQA.
 *
 * ⚠️ TENG UCHGA BO'LMAYDI, SHAFFOF BO'SHLIQ BO'YICHA KESADI (2026-09-25).
 * Ilgari kenglik uchga teng bo'linardi; AI figuralarni har doim aynan
 * markazga qo'ymaydi va natijada yon ko'rinishga qo'shni paneldan bo'lak
 * qo'shilib qolardi. Endi alfa kanali orqali har figuraning ustunlari
 * topiladi va kesish figuralar ORASIDAGI bo'sh (shaffof) joyning
 * o'rtasidan o'tadi — hech qaysi figura kesilmaydi.
 */

export const SHEET_ORDER: readonly AvatarAngle[] = ['front', 'side', 'back'];

/** Ustun tahlili uchun rasm shu enga kichraytiriladi (tezlik uchun). */
const SCAN_WIDTH = 360;
/**
 * Bo'lakning eng katta balandligi (piksel). Mobilga LTE orqali katta PNG
 * uzoq keladi; WebP + kichraytirish hajmni bir necha barobar kamaytiradi.
 */
const PANEL_MAX_HEIGHT = 1000;
/** Ustun «to'la» hisoblanishi uchun shaffof bo'lmagan piksel ulushi. */
const COLUMN_MIN = 0.02;
/** Shovqin: shundan tor ustun-to'plami figura emas (enning ulushi). */
const NOISE_MIN = 0.04;

/**
 * Rasm uch panelli varaqmi.
 *
 * ⚠️ NISBAT BILAN: bitta pozali avatar TIK (1024×1536), varaq LANDSHAFT
 * (3:2). 1.2 chegarasi kvadrat/tik suratni xato uchga bo'lishdan saqlaydi.
 */
export function isAvatarSheet(width: number, height: number): boolean {
  return width >= height * 1.2;
}

/** Har ustunda shaffof bo'lmagan piksel ulushi (0..1). */
async function columnCoverage(input: Buffer): Promise<number[]> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .resize({ width: SCAN_WIDTH })
    .extractChannel(3) // alfa kanali (ensureAlpha'dan keyin 4-chi)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const coverage = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x]! > 24) coverage[x] = coverage[x]! + 1;
    }
  }
  return coverage.map((count) => count / height);
}

/** Figuralarni (uzluksiz to'la ustunlar) topadi. Har biri [boshi, oxiri]. */
function findFigures(coverage: number[]): Array<[number, number]> {
  const width = coverage.length;
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let x = 0; x < width; x += 1) {
    const on = coverage[x]! > COLUMN_MIN;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      runs.push([start, x - 1]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, width - 1]);

  // Mayda shovqinni tashlaymiz
  const figures = runs.filter(([a, b]) => b - a + 1 >= width * NOISE_MIN);

  // Uchdan ko'p bo'lsa (figura ikki bo'lakka bo'linib ketgan) — eng tor
  // bo'shliqdagilarni birlashtira boramiz
  while (figures.length > 3) {
    let bestIndex = 0;
    let bestGap = Infinity;
    for (let i = 0; i < figures.length - 1; i += 1) {
      const gap = figures[i + 1]![0] - figures[i]![1];
      if (gap < bestGap) {
        bestGap = gap;
        bestIndex = i;
      }
    }
    figures[bestIndex] = [figures[bestIndex]![0], figures[bestIndex + 1]![1]];
    figures.splice(bestIndex + 1, 1);
  }

  return figures;
}

/** Varaqni uchta PNG buferga ajratadi. Varaq bo'lmasa — `null`. */
export async function splitAvatarSheet(
  input: Buffer,
): Promise<Record<AvatarAngle, Buffer> | null> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height || !isAvatarSheet(width, height)) return null;

  const figures = findFigures(await columnCoverage(input));

  /*
   * Kesish nuqtalari (asl kenglikda). Uchta figura aniq topilsa — kesish
   * figuralar ORASIDAGI bo'shliq o'rtasidan; aks holda teng uchga (zaxira).
   */
  let cuts: number[];
  if (figures.length === 3) {
    const mid = (i: number): number =>
      Math.round((((figures[i]![1] + figures[i + 1]![0]) / 2) / SCAN_WIDTH) * width);
    cuts = [0, mid(0), mid(1), width];
  } else {
    const panel = Math.floor(width / 3);
    cuts = [0, panel, panel * 2, width];
  }

  const parts = await Promise.all(
    [0, 1, 2].map((i) =>
      sharp(input)
        .extract({ left: cuts[i]!, top: 0, width: Math.max(1, cuts[i + 1]! - cuts[i]!), height })
        /*
         * ⚠️ WEBP, SHAFFOFLIK BILAN (so'rovga ko'ra). `ensureAlpha` +
         * `webp({ alphaQuality })` — orqa fon YO'Q holida saqlanadi, PNG
         * emas WebP: mobilga bir necha barobar tez keladi, sifat deyarli
         * o'zgarmaydi. Balandlik 1000 px bilan cheklanadi (kattasi
         * kichraytiriladi, kichigi kattalashtirilmaydi).
         */
        .ensureAlpha()
        .resize({ height: PANEL_MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, alphaQuality: 100, effort: 4 })
        .toBuffer(),
    ),
  );

  return { front: parts[0]!, side: parts[1]!, back: parts[2]! };
}

/**
 * Varaqni yuklab oladi, ajratadi va bo'laklarni R2 ga qo'yadi.
 *
 * Varaq bo'lmasa `null` qaytaradi — chaqiruvchi rasmni avvalgidek bitta
 * (old) surat sifatida ishlatadi. Ya'ni eski oqim buzilmaydi.
 */
export async function storeAvatarSheet(url: string): Promise<Record<AvatarAngle, string> | null> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Natija yuklab olinmadi (${response.status})`);

  const parts = await splitAvatarSheet(Buffer.from(await response.arrayBuffer()));
  if (!parts) return null;

  const urls = await Promise.all(
    SHEET_ORDER.map((angle) =>
      uploadObject({
        key: `avatar/${randomUUID()}.webp`,
        body: parts[angle],
        contentType: 'image/webp',
      }),
    ),
  );

  return { front: urls[0]!, side: urls[1]!, back: urls[2]! };
}
