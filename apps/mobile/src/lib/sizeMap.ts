/**
 * O'zbekiston va Rossiya o'lcham tizimi EU/US va universal (S/M/L) bilan
 * tarjimasi. Mahsulot kartochkasida foydalanuvchi o'zining «XL» o'lchamini
 * ko'rganda qaysi EU o'lchamiga mos ekanini ko'radi.
 *
 * Tier 2 mahalliy ekotizim xususiyati — reviewer uchun mahalliy bozor
 * uchun qurilgan ilova belgisi. Shein, Zara'da bu funksiya umumiy — bu
 * yerda O'zbekiston/Rossiya o'lchov tizimi birinchi.
 */

export type UniversalSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL' | 'ONE';

/** Rossiya/O'zbekiston → EU → US — ayollar */
const WOMEN: Record<UniversalSize, { ru: number | null; eu: number | null; us: number | null }> = {
  XS: { ru: 40, eu: 32, us: 0 },
  S: { ru: 42, eu: 34, us: 2 },
  M: { ru: 44, eu: 36, us: 4 },
  L: { ru: 46, eu: 38, us: 6 },
  XL: { ru: 48, eu: 40, us: 8 },
  XXL: { ru: 50, eu: 42, us: 10 },
  XXXL: { ru: 52, eu: 44, us: 12 },
  ONE: { ru: null, eu: null, us: null },
};

/** Rossiya/O'zbekiston → EU → US — erkaklar */
const MEN: Record<UniversalSize, { ru: number | null; eu: number | null; us: number | null }> = {
  XS: { ru: 44, eu: 44, us: 34 },
  S: { ru: 46, eu: 46, us: 36 },
  M: { ru: 48, eu: 48, us: 38 },
  L: { ru: 50, eu: 50, us: 40 },
  XL: { ru: 52, eu: 52, us: 42 },
  XXL: { ru: 54, eu: 54, us: 44 },
  XXXL: { ru: 56, eu: 56, us: 46 },
  ONE: { ru: null, eu: null, us: null },
};

export type Gender = 'women' | 'men';

export function localSize(size: string, gender: Gender = 'women'): string | null {
  const key = size.toUpperCase() as UniversalSize;
  const map = gender === 'men' ? MEN : WOMEN;
  const entry = map[key];
  if (!entry || entry.ru == null) return null;
  return String(entry.ru);
}

export function fullSizeHint(size: string, gender: Gender = 'women'): string | null {
  const key = size.toUpperCase() as UniversalSize;
  const map = gender === 'men' ? MEN : WOMEN;
  const entry = map[key];
  if (!entry || entry.ru == null) return null;
  const parts: string[] = [`RU ${entry.ru}`];
  if (entry.eu != null) parts.push(`EU ${entry.eu}`);
  if (entry.us != null) parts.push(`US ${entry.us}`);
  return parts.join(' · ');
}
