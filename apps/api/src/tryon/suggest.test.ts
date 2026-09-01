import { describe, expect, it } from 'vitest';

import { composeLooks, type LookItem, type SuggestInput } from './suggest';

/**
 * AI Designer komplekt yig'ishining sinovlari.
 *
 * ⚠️ NEGA AYNAN BULAR. Bu yerdagi xatolar EKRANDA KO'RINMAYDI —
 * foydalanuvchi uchta chiroyli komplekt ko'radi va ularning shimsiz yoki
 * byudjetdan qimmat ekanini faqat savatga qo'ygandan keyin biladi.
 * Shuning uchun sinov aynan shu uch shartni qulflaydi: to'liqlik,
 * byudjet va variantlarning bir-biridan farqi.
 */

function garment(slot: string, id: string, price: string): LookItem {
  return {
    variantId: id,
    productId: `p-${id}`,
    title: `${slot} ${id}`,
    slot,
    price,
    currency: 'UZS',
    image: 'https://example.test/a.jpg',
    colorHex: null,
    sizes: ['M'],
    store: { id: 's1', name: 'Do`kon' },
  };
}

const BASE: SuggestInput = {
  occasion: 'Kundalik',
  style: 'Smart Casual',
  gender: 'male',
  budget: null,
  count: 3,
};

describe('komplekt to`liqligi', () => {
  it('ustki va pastki bo`lmasa komplekt qaytmaydi', () => {
    // Faqat ustki bor — bu komplekt emas
    const looks = composeLooks([garment('top', 't1', '100000')], BASE);
    expect(looks).toEqual([]);
  });

  it('ustki va pastki bo`lsa komplekt yig`iladi', () => {
    const looks = composeLooks(
      [garment('top', 't1', '100000'), garment('bottom', 'b1', '200000')],
      BASE,
    );

    expect(looks.length).toBe(1);
    expect(looks[0]?.items.map((item) => item.slot).sort()).toEqual(['bottom', 'top']);
  });

  it('ixtiyoriy slotlar bor bo`lsa qo`shiladi', () => {
    const looks = composeLooks(
      [
        garment('top', 't1', '100000'),
        garment('bottom', 'b1', '200000'),
        garment('feet', 'f1', '300000'),
      ],
      BASE,
    );

    expect(looks[0]?.items.some((item) => item.slot === 'feet')).toBe(true);
  });
});

describe('byudjet', () => {
  it('chegaradan qimmat komplekt taklif qilinmaydi', () => {
    /*
     * Foydalanuvchi chegara bergan bo'lsa, undan qimmatini ko'rsatish
     * uni hurmat qilmaslik — va savatda kutilmagan summa chiqaradi.
     */
    const looks = composeLooks(
      [garment('top', 't1', '500000'), garment('bottom', 'b1', '600000')],
      { ...BASE, budget: 1_000_000 },
    );

    expect(looks).toEqual([]);
  });

  it('chegaraga sig`sa taklif qilinadi', () => {
    const looks = composeLooks(
      [garment('top', 't1', '400000'), garment('bottom', 'b1', '500000')],
      { ...BASE, budget: 1_000_000 },
    );

    expect(looks.length).toBe(1);
    expect(Number(looks[0]?.total)).toBeLessThanOrEqual(1_000_000);
  });

  it('chegara berilmasa hech narsa chiqarilmaydi', () => {
    const looks = composeLooks(
      [garment('top', 't1', '9000000'), garment('bottom', 'b1', '9000000')],
      BASE,
    );

    expect(looks.length).toBe(1);
  });
});

describe('variantlar bir-biridan farq qiladi', () => {
  it('har komplekt boshqa mahsulotlarni oladi', () => {
    const looks = composeLooks(
      [
        garment('top', 't1', '100000'),
        garment('top', 't2', '100000'),
        garment('top', 't3', '100000'),
        garment('bottom', 'b1', '200000'),
        garment('bottom', 'b2', '200000'),
        garment('bottom', 'b3', '200000'),
      ],
      BASE,
    );

    expect(looks.length).toBe(3);

    /*
     * Uchalasi ham bir xil bo'lsa «AI uchta variant yasadi» degan
     * va'da yolg'on bo'lardi — foydalanuvchi tanlashga hech nima
     * qolmaydi.
     */
    const keys = new Set(looks.map((look) => look.key));
    expect(keys.size).toBe(3);
  });

  it('nomzod kam bo`lsa takror qaytarmaydi', () => {
    // Bittadan nomzod: aylantirish baribir bir xil to'plamga qaytadi
    const looks = composeLooks(
      [garment('top', 't1', '100000'), garment('bottom', 'b1', '200000')],
      BASE,
    );

    expect(looks.length).toBe(1);
  });
});

describe('umumiy narx', () => {
  it('buyumlar narxi qo`shiladi', () => {
    const looks = composeLooks(
      [garment('top', 't1', '149000'), garment('bottom', 'b1', '299000')],
      BASE,
    );

    expect(looks[0]?.total).toBe('448000.00');
  });
});
