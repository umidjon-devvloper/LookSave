import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// @ts-expect-error — jpeg-js/lib/decoder tip e'lonisiz; qaytishi quyida tiplanadi
import decodeJpeg from 'jpeg-js/lib/decoder';
import { describe, expect, it } from 'vitest';

import { base64ToBytes } from './base64';

/**
 * ⚠️ NEGA BU TEST BOR. Mato suratlari qurilmada base64 → bayt → JPEG dekod
 * zanjiridan o'tadi va uning har bo'g'ini Hermes cheklovlari tufayli
 * qo'lda yozilgan (`atob` ham, `Buffer` ham yo'q). Zanjir uzilsa kod
 * jimgina protsedural teksturaga tushadi — xato ko'rinmaydi, shunchaki
 * mato skani hech qachon chiqmaydi. Simulyator esa 3D ni umuman
 * chizmaydi, ya'ni ko'z bilan ham tekshirib bo'lmaydi.
 *
 * Shu sabab zanjir HAQIQIY aktiv fayli ustida tekshiriladi.
 */

const TEXTURES = join(__dirname, '../../assets/textures');

describe('base64ToBytes', () => {
  it("malum satrni to'g'ri baytga aylantiradi", () => {
    // "Man" → base64 "TWFu" (klassik namuna, to'ldirishsiz)
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
  });

  it('yangi qator va toldirishni tashlab ketadi', () => {
    // `FileSystem.readAsStringAsync` qaytargan satrda ular uchraydi
    expect(Array.from(base64ToBytes('TW\nFu==')).slice(0, 3)).toEqual([77, 97, 110]);
  });
});

describe('mato suratlari', () => {
  const kinds = ['knit', 'denim', 'twill', 'smooth'];

  for (const kind of kinds) {
    for (const map of ['albedo', 'normal']) {
      it(`${kind}-${map} base64 orqali dekod bo'ladi`, () => {
        const file = join(TEXTURES, `${kind}-${map}.jpg`);
        const base64 = readFileSync(file).toString('base64');

        const bytes = base64ToBytes(base64);
        const decoded = decodeJpeg(bytes, { useTArray: true }) as {
          width: number;
          height: number;
          data: Uint8Array;
        };

        expect(decoded.width).toBe(256);
        expect(decoded.height).toBe(256);
        // RGBA — `DataTexture` aynan shu formatni kutadi
        expect(decoded.data.length).toBe(256 * 256 * 4);
      });
    }
  }

  it('albedo KULRANG — aks holda mahsulot rangi buziladi', () => {
    /*
     * Ilova albedo ni bazaviy rangga KO'PAYTIRADI. Rangli surat oq
     * futbolkani jigarrang qilib qo'yardi (sinab ko'rilgan).
     */
    const base64 = readFileSync(join(TEXTURES, 'knit-albedo.jpg')).toString('base64');
    const { data } = decodeJpeg(base64ToBytes(base64), { useTArray: true }) as {
      data: Uint8Array;
    };

    let maxSpread = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i] as number, data[i + 1] as number, data[i + 2] as number];
      maxSpread = Math.max(maxSpread, Math.max(r, g, b) - Math.min(r, g, b));
    }

    // JPEG siqilishi bir necha birlik og'ish qoldiradi — 12 shunga chidamli
    expect(maxSpread).toBeLessThan(12);
  });

  it('toqima YOQOLMAGAN — surat bir tekis rang emas', () => {
    /*
     * 1024→256 KICHRAYTIRISHDA mayda to'quv averaging'da yo'qolardi va
     * natija bir tekis rang bo'lib chiqardi (o'lchangan: spread ≈ 0).
     * Shuning uchun suratlar qirqib olingan. Bu test o'sha regressiyani
     * ushlaydi.
     */
    const base64 = readFileSync(join(TEXTURES, 'knit-albedo.jpg')).toString('base64');
    const { data } = decodeJpeg(base64ToBytes(base64), { useTArray: true }) as {
      data: Uint8Array;
    };

    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] as number;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    expect(max - min).toBeGreaterThan(20);
  });
});
