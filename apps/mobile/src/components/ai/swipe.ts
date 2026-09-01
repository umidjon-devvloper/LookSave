/**
 * Svayp qarori — barmoq qo'yib yuborilganda qaysi suratga o'tiladi.
 *
 * ⚠️ NEGA ALOHIDA FAYL. `PhotoSwipe.tsx` `expo-gl` ni import qiladi va u
 * sinov muhitida umuman ochilmaydi (paket JSX ni tayyor holda tarqatadi,
 * vitest uni ajrata olmaydi). Bu qaror esa oddiy sonlar ustidagi
 * funksiya — uni bog'liqliksiz faylga chiqarib sinaymiz. Aynan shu yo'l
 * `faceQuality.ts` da ham ishlatilgan.
 */

/** Ekranning necha qismini surganda keyingisiga o'tadi. */
export const SWITCH_RATIO = 0.22;

/** Tez harakat — masofa yetmasa ham o'tkazadi (piksel/ms). */
export const FLICK_VELOCITY = 0.4;

/**
 * @param current  Hozirgi indeks
 * @param moved    Surilgan masofa ekran kengligiga nisbatan (−1…+1)
 * @param velocity Qo'yib yuborishdagi tezlik (piksel/ms), chapga manfiy
 * @param count    Jami suratlar soni
 */
export function nextSwipeIndex(
  current: number,
  moved: number,
  velocity: number,
  count: number,
): number {
  /*
   * Ikki yo'l bilan o'tiladi: yetarlicha SURILSA yoki tez SILTALSA.
   * Faqat masofa bo'yicha qaror qilinsa, tez lekin qisqa harakat
   * e'tiborsiz qolardi — foydalanuvchi svayp qilgandek his qiladi,
   * ekran esa joyida turadi.
   */
  const flick = Math.abs(velocity) > FLICK_VELOCITY;

  let next = current;
  if (moved < -SWITCH_RATIO || (flick && velocity < 0)) next += 1;
  else if (moved > SWITCH_RATIO || (flick && velocity > 0)) next -= 1;

  // Chetdan chiqib ketmaydi — bo'sh joyga svayp qilib bo'lmaydi
  return Math.max(0, Math.min(Math.max(0, count - 1), next));
}
