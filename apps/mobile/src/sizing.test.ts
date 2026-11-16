import { describe, expect, it } from 'vitest';

import { matchSize, missingMeasurementFor, normalizeSize, recommendSize } from '@looksave/validation';

/**
 * ⚠️ SINOV SHU YERDA, MODUL ESA `@looksave/validation` DA — sayt ham
 * shu jadvalni ishlatadi (BFF ro'yxatni o'lcham bo'yicha filtrlaydi).
 * Paketda sinov yugurtirgichi yo'q, shuning uchun sinov ilovada qoldi:
 * `npm run test` uni baribir ishga tushiradi.
 */

describe('recommendSize', () => {
  it('ko`krak aylanasidan ustki kiyim razmerini beradi', () => {
    expect(recommendSize('top', { chest: 80 })).toBe('XS');
    expect(recommendSize('top', { chest: 92 })).toBe('S');
    expect(recommendSize('top', { chest: 100 })).toBe('M');
    expect(recommendSize('top', { chest: 108 })).toBe('L');
    expect(recommendSize('top', { chest: 116 })).toBe('XL');
    expect(recommendSize('top', { chest: 130 })).toBe('XXL');
  });

  it('chegara qiymati pastki razmerga tegishli', () => {
    // 95 — "S gacha", 96 esa allaqachon M
    expect(recommendSize('top', { chest: 95 })).toBe('S');
    expect(recommendSize('top', { chest: 96 })).toBe('M');
  });

  it('ustki kiyim ko`krakdan, pastki kiyim beldan hisoblanadi', () => {
    const body = { chest: 100, waist: 80 };
    expect(recommendSize('outer', body)).toBe('M');
    expect(recommendSize('bottom', body)).toBe('M');
  });

  /*
   * ⚠️ «EU 42» EMAS, «42». Omborda razmer «42» bo'lib yoziladi va
   * `/tryon/garments?size=` aniq tenglik bilan solishtiradi — «EU»
   * prefiksi bilan oyoq kiyimi hech qachon topilmasdi.
   */
  it('oyoq kiyimida EU prefiksisiz raqam qaytadi', () => {
    expect(recommendSize('feet', { shoeSize: 42 })).toBe('42');
  });

  /*
   * Mijoz o'z razmerini bizdan yaxshi biladi: tanlangan razmer
   * ko'krak/bel aylanasidan hisoblangan taxmindan ustun turadi.
   */
  it('mijoz tanlagan razmer sm qiymatidan ustun', () => {
    expect(recommendSize('top', { chest: 100, topSize: 'L' })).toBe('L');
    expect(recommendSize('bottom', { waist: 80, bottomSize: 'XXXL' })).toBe('3XL');
  });

  it('kerakli o`lcham yo`q bo`lsa null — ekran buni ko`rsatishi kerak', () => {
    expect(recommendSize('top', {})).toBeNull();
    expect(recommendSize('bottom', { chest: 100 })).toBeNull();
    expect(recommendSize('feet', {})).toBeNull();
  });

  it('razmeri yagona slotlar uchun tavsiya berilmaydi', () => {
    expect(recommendSize('head', { chest: 100 })).toBeNull();
    expect(recommendSize('wrist', { chest: 100 })).toBeNull();
  });
});

describe('missingMeasurementFor', () => {
  it('qaysi o`lcham yetishmayotganini aytadi', () => {
    expect(missingMeasurementFor('top')).toBe('Ustki kiyim razmeri');
    expect(missingMeasurementFor('bottom')).toBe('Shim razmeri');
    expect(missingMeasurementFor('feet')).toBe("Oyoq o'lchami");
    expect(missingMeasurementFor('head')).toBeNull();
  });
});

/*
 * ⚠️ OMBORDAGI RAZMER ERKIN MATN. Do'kon panelidan tanlangan qiymat
 * («42», «XS») ham, qo'lda yoki import orqali kirgan «m», « M »,
 * «XXXL», «EU 42» ham uchraydi — solishtirish shu yerda tenglashadi.
 */
describe('normalizeSize', () => {
  it('bo`sh joy, kichik harf va EU prefiksini olib tashlaydi', () => {
    expect(normalizeSize(' m ')).toBe('M');
    expect(normalizeSize('EU 42')).toBe('42');
    expect(normalizeSize('eu42')).toBe('42');
  });

  it('bir xil razmerning turli yozilishini birlashtiradi', () => {
    expect(normalizeSize('XXXL')).toBe('3XL');
    expect(normalizeSize('2XL')).toBe('XXL');
  });
});

describe('matchSize', () => {
  it('OMBORDAGI yozuvni qaytaradi, normallashtirilganini emas', () => {
    // Savat va buyurtma `variant_stock.size` bilan aniq tenglikda ishlaydi
    expect(matchSize(['s', 'm', 'l'], 'M')).toBe('m');
    expect(matchSize(['EU 41', 'EU 42'], '42')).toBe('EU 42');
  });

  it('mos razmer bo`lmasa null', () => {
    expect(matchSize(['38', '39'], '42')).toBeNull();
    expect(matchSize(['M', 'L'], null)).toBeNull();
  });
});
