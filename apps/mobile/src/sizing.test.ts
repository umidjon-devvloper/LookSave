import { describe, expect, it } from 'vitest';

import { missingMeasurementFor, recommendSize } from './sizing';

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

  it('oyoq kiyimida EU raqami qaytadi', () => {
    expect(recommendSize('feet', { shoeSize: 42 })).toBe('EU 42');
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
    expect(missingMeasurementFor('top')).toBe("Ko'krak");
    expect(missingMeasurementFor('bottom')).toBe('Bel');
    expect(missingMeasurementFor('feet')).toBe("Oyoq o'lchami");
    expect(missingMeasurementFor('head')).toBeNull();
  });
});
