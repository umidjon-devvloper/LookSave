import { describe, expect, it } from 'vitest';

import { nextSwipeIndex } from './swipe';

/**
 * Svayp qarorining sinovlari.
 *
 * ⚠️ NEGA AYNAN BU FUNKSIYA. Svaypning qolgan qismi — GL chizish va
 * animatsiya — qurilmada ko'z bilan tekshiriladi. Lekin "barmoq qo'yib
 * yuborilganda qaysi suratga o'tadi" degan qaror ko'z bilan sezilmaydi:
 * chegara noto'g'ri bo'lsa ekran ba'zan o'tadi, ba'zan o'tmaydi va bu
 * "biroz g'alati" bo'lib qoladi, xato sifatida ko'rinmaydi.
 */
describe('svayp qarori', () => {
  it('yetarlicha surilsa keyingisiga o`tadi', () => {
    // Chapga surish — keyingi surat
    expect(nextSwipeIndex(2, -0.3, 0, 5)).toBe(3);
    // O'ngga surish — oldingisi
    expect(nextSwipeIndex(2, 0.3, 0, 5)).toBe(1);
  });

  it('oz surilsa joyida qoladi', () => {
    expect(nextSwipeIndex(2, -0.1, 0, 5)).toBe(2);
    expect(nextSwipeIndex(2, 0.1, 0, 5)).toBe(2);
  });

  it('tez siltashda masofa yetmasa ham o`tadi', () => {
    /*
     * Bu haqiqiy odat: foydalanuvchi tez «otib» yuboradi va barmoq
     * ekranning chorak qismini bosib ulgurmaydi. Faqat masofaga
     * qaralsa ekran javob bermay qolardi.
     */
    expect(nextSwipeIndex(2, -0.05, -0.9, 5)).toBe(3);
    expect(nextSwipeIndex(2, 0.05, 0.9, 5)).toBe(1);
  });

  it('sekin va qisqa harakat siltash hisoblanmaydi', () => {
    expect(nextSwipeIndex(2, -0.05, -0.2, 5)).toBe(2);
  });

  it('birinchi suratdan orqaga o`tmaydi', () => {
    expect(nextSwipeIndex(0, 0.9, 1.5, 5)).toBe(0);
  });

  it('oxirgi suratdan oldinga o`tmaydi', () => {
    expect(nextSwipeIndex(4, -0.9, -1.5, 5)).toBe(4);
  });

  it('ro`yxat bo`sh bo`lsa nolda qoladi', () => {
    // Kiyim topilmaganda ro'yxat bo'sh keladi — indeks manfiy bo'lmasin
    expect(nextSwipeIndex(0, -0.9, -1.5, 0)).toBe(0);
  });
});
