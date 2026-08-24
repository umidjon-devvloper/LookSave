import { describe, expect, it } from 'vitest';

import { NEUTRAL, NEUTRAL_FACE, computeMorphTargets, mergeMorphs, suggestQuality } from './morphs';

describe('morph targets', () => {
  it("o'lchamsiz neytral qaytadi — bo'sh avatar ko'rsatilmaydi", () => {
    expect(computeMorphTargets({}, 'male')).toEqual(NEUTRAL);
    expect(computeMorphTargets({ weight: 80 }, 'male')).toEqual(NEUTRAL);
  });

  it('barcha qiymatlar 0…1 oralig`ida', () => {
    const extremes = [
      { height: 120, weight: 30, chest: 50, waist: 40, hips: 50 },
      { height: 220, weight: 200, chest: 180, waist: 180, hips: 180 },
    ];

    for (const measurements of extremes) {
      for (const value of Object.values(computeMorphTargets(measurements, 'male'))) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('175 sm — bo`y bo`yicha o`rtacha (0.5)', () => {
    expect(computeMorphTargets({ height: 175 }, 'male').height).toBe(0.5);
  });

  it('baland bo`y kattaroq qiymat beradi', () => {
    const short = computeMorphTargets({ height: 160 }, 'male').height;
    const tall = computeMorphTargets({ height: 195 }, 'male').height;
    expect(tall).toBeGreaterThan(short);
  });

  it('vazn BMI orqali: bir xil kg baland odamda kichikroq qiymat', () => {
    const heavy = computeMorphTargets({ height: 160, weight: 85 }, 'male').weight;
    const light = computeMorphTargets({ height: 195, weight: 85 }, 'male').weight;
    expect(heavy).toBeGreaterThan(light);
  });

  it('aylana bo`yga nisbatan hisoblanadi', () => {
    // 100 sm ko'krak 160 sm odamda kengroq ko'rinadi
    const small = computeMorphTargets({ height: 160, chest: 100 }, 'male').chest;
    const large = computeMorphTargets({ height: 195, chest: 100 }, 'male').chest;
    expect(small).toBeGreaterThan(large);
  });

  it('jins natijaga ta`sir qiladi — tipik nisbatlar boshqacha', () => {
    const measurements = { height: 170, weight: 65, chest: 90, waist: 70, hips: 95 };
    const male = computeMorphTargets(measurements, 'male');
    const female = computeMorphTargets(measurements, 'female');
    expect(male.waist).not.toBe(female.waist);
  });

  it('qiymatlar ikki xonagacha yaxlitlanadi', () => {
    for (const value of Object.values(
      computeMorphTargets({ height: 183, weight: 77, chest: 97 }, 'male'),
    )) {
      expect(value).toBe(Math.round(value * 100) / 100);
    }
  });
});

describe('sifat tavsiyasi', () => {
  it('iOS uchun yuqori', () => {
    expect(suggestQuality(null, 'ios')).toBe('high');
  });

  it('arzon Android uchun past', () => {
    expect(suggestQuality('Redmi 9A', 'android')).toBe('low');
  });

  it('noma`lum qurilma uchun o`rtacha', () => {
    expect(suggestQuality('SomePhone X', 'android')).toBe('medium');
    expect(suggestQuality(null, null)).toBe('medium');
  });
});

describe('mergeMorphs — tana + yuz', () => {
  it("tana va yuz morflarini bitta tekis map'ga birlashtiradi", () => {
    const merged = mergeMorphs(NEUTRAL, {
      faceWidth: 0.7,
      faceLength: 0.3,
      jawWidth: 0.6,
      chinShape: 0.4,
      noseWidth: 0.5,
      noseLength: 0.5,
      eyeDistance: 0.5,
      lipFullness: 0.6,
    });
    // Tana neytrali 0.5, yuz qiymatlari o'z holida
    expect(merged.height).toBe(0.5);
    expect(merged.faceWidth).toBe(0.7);
    expect(merged.jawWidth).toBe(0.6);
  });

  /*
   * ⚠️ YUZ YO'Q BO'LSA NEYTRAL 0, TANA 0.5. Ikki xil neytral — sabab:
   * export_bodies.py mt_* ni 0.5 ga, fm_* ni 0 ga qo'yadi. Aralashsa
   * yuz buziladi.
   */
  it('yuz berilmasa fm_* nol bo`ladi (neytral yuz)', () => {
    const merged = mergeMorphs(NEUTRAL, null);
    expect(merged.faceWidth).toBe(0);
    expect(merged.jawWidth).toBe(0);
    expect(merged.height).toBe(0.5);
  });

  it('NEUTRAL_FACE barcha qiymati nol', () => {
    expect(Object.values(NEUTRAL_FACE).every((v) => v === 0)).toBe(true);
  });
});
