import { describe, expect, it } from 'vitest';

import { dictionaries } from './dictionaries';

/**
 * Lug'atlar tuzilishi bir xil bo'lishi TypeScript bilan kafolatlanadi,
 * lekin bo'sh satr yoki tarjima qilinmagan matn tipdan o'tib ketadi.
 */
const LOCALES = ['uz', 'ru', 'en', 'ar'] as const;

function flatten(dictionary: Record<string, Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [section, entries] of Object.entries(dictionary)) {
    for (const [key, value] of Object.entries(entries)) {
      result[`${section}.${key}`] = value;
    }
  }
  return result;
}

describe('tarjimalar', () => {
  const base = flatten(dictionaries.uz);

  it('to`rt til ham mavjud', () => {
    for (const locale of LOCALES) {
      expect(dictionaries[locale]).toBeDefined();
    }
  });

  it('har bir tilda kalitlar to`plami bir xil', () => {
    const expected = Object.keys(base).sort();

    for (const locale of LOCALES) {
      const keys = Object.keys(flatten(dictionaries[locale])).sort();
      expect(keys, `${locale} da kalitlar farq qiladi`).toEqual(expected);
    }
  });

  it('bo`sh matn yo`q', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(flatten(dictionaries[locale]))) {
        expect(value.trim().length, `${locale}.${key} bo'sh`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Ataylab tarjima qilinmaydigan kalitlar.
   *
   * Brend nomlari va ular bilan bir qatorga qo'yilgan so'zlar har tilda bir
   * xil yoziladi — "Marketplace" ni "Маркетплейс" deb yozish deckdagi
   * lotincha yozuvni buzadi. Ro'yxatga QO'SHISHDAN OLDIN o'ylang: haqiqatan
   * tarjimasi yo'qmi yoki shunchaki unutilganmi?
   */
  const INTENTIONALLY_SAME = new Set([
    'marketplace.title', // brend yozuvi — deckda lotincha
    'marketplace.limited', // "Limited drops" — brend atamasi
    'home.marketplace', // hero ustidagi lotincha yozuv
    'home.badgeAuthentic', // "100%" — raqam, tarjimasi yo'q
    'home.badgeBrands', // "PREMIUM" — inglizchada ham shu so'z
  ]);

  it('ruscha va inglizcha matnlar o`zbekchadan farq qiladi', () => {
    /*
     * Barcha tillar bir yo'la tekshiriladi. Ilgari har til uchun alohida
     * `expect` bor edi va birinchisi yiqilganda qolganlari umuman
     * bajarilmasdi — bitta kalit tuzatilgach darhol keyingisi chiqib,
     * muammo bo'lakma-bo'lak ko'rinardi.
     */
    const missing: string[] = [];

    for (const locale of ['ru', 'en'] as const) {
      const translated = flatten(dictionaries[locale]);
      for (const key of Object.keys(base)) {
        if (INTENTIONALLY_SAME.has(key)) continue;
        if ((base[key]?.length ?? 0) <= 3) continue;
        if (base[key] === translated[key]) missing.push(`${locale}.${key}`);
      }
    }

    expect(missing, `tarjima qilinmagan: ${missing.join(', ')}`).toEqual([]);
  });

  it('ataylab tarjima qilinmaydigan kalitlar haqiqatan mavjud', () => {
    // Kalit o'chirilsa ro'yxat eskirib qoladi va tekshiruvni jimgina kengaytiradi
    for (const key of INTENTIONALLY_SAME) {
      expect(base[key], `${key} lug'atda yo'q — ro'yxatdan olib tashlang`).toBeDefined();
    }
  });
});
