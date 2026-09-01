import { describe, expect, it } from 'vitest';

import { base64ToBytes } from './base64';

/**
 * ⚠️ NEGA BU TEST BOR. Suratlar qurilmada base64 → bayt → JPEG dekod
 * zanjiridan o'tadi va uning birinchi bo'g'ini QO'LDA yozilgan: Hermes'da
 * na `atob`, na `Buffer` bor. Zanjir uzilsa kod jimgina zaxira yo'liga
 * tushadi — xato ko'rinmaydi, shunchaki surat chiqmaydi.
 *
 * ⚠️ MATO SURATLARI SINOVI OLIB TASHLANDI. U `assets/textures` dagi
 * haqiqiy fayllarni tekshirardi — ular 3D kiyim modellari bilan birga
 * o'chirildi. Dekoderning o'zi qoldi va u hozir ikki joyda ishlatiladi:
 * `photoTexture.ts` (svayp suratlari) va `brightness.ts` (selfi
 * yorug'ligi).
 */
describe('base64ToBytes', () => {
  it("ma'lum satrni to'g'ri baytga aylantiradi", () => {
    // "Man" → base64 "TWFu" (klassik namuna, to'ldirishsiz)
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
  });

  it("yangi qator va to'ldirishni tashlab ketadi", () => {
    // `FileSystem.readAsStringAsync` qaytargan satrda ular uchraydi
    expect(Array.from(base64ToBytes('TW\nFu==')).slice(0, 3)).toEqual([77, 97, 110]);
  });

  it("bo'sh satrdan bo'sh massiv qaytaradi", () => {
    expect(base64ToBytes('').length).toBe(0);
  });

  it("uzunlik to'ldirishga qarab hisoblanadi", () => {
    /*
     * Base64 da har 4 belgi 3 baytga aylanadi; `=` esa oxirgi baytlarni
     * chiqarib tashlaydi. Bu hisob noto'g'ri bo'lsa massiv oxirida ortiqcha
     * nollar qolardi va JPEG dekoder «buzuq fayl» deb xato berardi.
     */
    expect(base64ToBytes('TWE=').length).toBe(2); // "Ma"
    expect(base64ToBytes('TQ==').length).toBe(1); // "M"
  });
});
