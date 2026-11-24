import { describe, expect, it } from 'vitest';

import { cartSize } from './cartSize';

/**
 * ⚠️ NIMANI QO'RIQLAYDI. Razmeri noma'lum foydalanuvchining savatiga
 * ro'yxatdagi birinchi o'lcham («3XL») so'ramasdan tushardi.
 */
describe('cartSize', () => {
  const SIZES = ['3XL', 'L', 'M', 'S'];

  it('tavsiya omborda bo`lsa — o`sha', () => {
    expect(cartSize(SIZES, 'top', { topSize: 'M' })).toBe('M');
  });

  it('o`lchovlar yo`q — taxmin qilinmaydi, foydalanuvchi tanlaydi', () => {
    expect(cartSize(SIZES, 'top', undefined)).toBeNull();
    expect(cartSize(SIZES, 'top', { height: 180, weight: 80 })).toBeNull();
  });

  it('tavsiya etilgan o`lcham omborda yo`q — boshqasi almashtirib qo`yilmaydi', () => {
    expect(cartSize(SIZES, 'top', { topSize: 'XS' })).toBeNull();
  });

  it('yagona o`lcham (sumka, kepka) — tanlov shart emas', () => {
    expect(cartSize(['ONE'], 'bag', undefined)).toBe('ONE');
  });

  it('omborda hech narsa yo`q — null', () => {
    expect(cartSize([], 'top', { topSize: 'M' })).toBeNull();
  });
});
