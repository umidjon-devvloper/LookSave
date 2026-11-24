import { matchSize, recommendSize, type BodyMeasurements } from '@looksave/validation';

/**
 * Primerkadan savatga qaysi o'lcham tushadi.
 *
 * ⚠️ TAXMIN QILMAYMIZ (2026-11-24). Ilgari tavsiya bo'lmasa yoki tavsiya
 * etilgan o'lcham omborda bo'lmasa, ro'yxatdagi BIRINCHI o'lcham olinardi.
 * Server o'lchamlarni matn tartibida beradi, ya'ni «3XL», «L», «M» —
 * birinchisi ko'pincha 3XL. Avatar sehrgari esa ustki/pastki razmerni
 * so'ramaydi (faqat bo'y, vazn, oyoq), shuning uchun yangi foydalanuvchining
 * savatiga so'ramasdan noto'g'ri razmer tushardi.
 *
 * Qoida:
 *  - tavsiya bor va omborda bor → o'sha;
 *  - o'lcham bitta (sumka, kepka — «ONE») → o'sha, tanlaydigan narsa yo'q;
 *  - aks holda `null` — foydalanuvchi o'zi tanlaydi (`SizeChooser`).
 *
 * Sof modul — `cartSize.test.ts`.
 */
export function cartSize(
  sizes: readonly string[],
  slot: string,
  measurements: BodyMeasurements | null | undefined,
): string | null {
  if (sizes.length === 0) return null;

  const wanted = measurements ? recommendSize(slot, measurements) : null;
  const matched = matchSize(sizes, wanted);
  if (matched) return matched;

  return sizes.length === 1 ? (sizes[0] ?? null) : null;
}
