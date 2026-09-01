/**
 * Yuz skaneri sifat chegarasi.
 *
 * ⚠️ NEGA ALOHIDA FAYL. Chegara `brightness.ts` ichida edi, lekin u
 * `expo-file-system` va `jpeg-js` ni import qiladi — test muhitida
 * (vitest, RN'siz) ular yuklanmaydi va butun modul parse xatosi bilan
 * yiqiladi. Dinamik import ham yaramadi: mobil `tsconfig` da `module`
 * flagi uni qo'llab-quvvatlamaydi.
 *
 * Chegara esa shunchaki son — u hech qanday bog'liqliksiz o'qilishi va
 * test bilan qulflanishi kerak.
 */

/**
 * Yetarli yorug'lik chegarasi (0…255).
 *
 * ⚠️ O'LCHOVGA ASOSLANGAN, o'ylab topilgan emas. Bazadagi ikki sinov
 * selfisi o'lchandi:
 *
 *   ishlagan selfi      30/255  (faqat serverdagi `normalise()` dan keyin tanildi)
 *   ishlamagan selfi     3/255  (deyarli qora, yuz umuman yo'q)
 *
 * 45 ikkalasidan yuqori: bundan past surat serverda ham qiynaladi,
 * hatto yorqinlashtirishdan keyin ham.
 */
export const MIN_BRIGHTNESS = 45;
