import { describe, expect, it } from 'vitest';

import {
  dedupeTitles,
  pickByRules,
  planFromRules,
  resolvePicks,
  type OutfitItem,
} from './stylist';

describe('planFromRules', () => {
  it("to'y uchun pidjak+shim+tufli komplekt beradi", () => {
    const plan = planFromRules("To'y uchun");
    expect(plan.picks.map((p) => p.slot)).toEqual(
      expect.arrayContaining(['top', 'bottom', 'feet']),
    );
    expect(plan.answer).toMatch(/to'y/i);
  });

  it('ish so`zi ofis komplektini keltiradi', () => {
    const plan = planFromRules('Ish uchun');
    expect(plan.picks[0]?.slot).toBe('top');
    expect(plan.picks.find((p) => p.slot === 'bottom')?.search).toBe('shim');
  });

  it("sport so'zi krasovka taklif qiladi", () => {
    const plan = planFromRules('sport zaliga');
    expect(plan.picks.find((p) => p.slot === 'feet')?.search).toBe('krasovka');
  });

  it('noma`lum so`rov ham umumiy komplekt qaytaradi', () => {
    const plan = planFromRules('xxxxxxxx');
    expect(plan.picks.length).toBeGreaterThan(0);
    expect(plan.answer).toContain('xxxxxxxx');
  });

  it('bo`sh matn ham xavfsiz ishlaydi', () => {
    const plan = planFromRules('');
    expect(plan.picks.length).toBeGreaterThan(0);
  });
});

const item = (id: string, slot: string, title: string, storeId = 's1'): OutfitItem => ({
  id,
  title,
  price: '100000.00',
  currency: 'UZS',
  image: `https://cdn/${id}.jpg`,
  slot,
  storeId,
  storeName: storeId,
});

// Jonli katalogga o'xshash: faqat krossovka, sumka, kepka (2026-11-24 holati)
const LIVE_LIKE: OutfitItem[] = [
  item('b1', 'bag', 'Barsetka №23', 's1'),
  item('f1', 'feet', 'Krasovka Open Walk', 's2'),
  item('f2', 'feet', 'Krasovka Hermes Bouncing — qora', 's1'),
  item('h1', 'head', "Kepka — ko'k, nakishli", 's3'),
];

describe('resolvePicks', () => {
  it('GPT raqamlarini (1 dan) mahsulotga aylantiradi', () => {
    expect(resolvePicks([2, 4], LIVE_LIKE).map((p) => p.id)).toEqual(['f1', 'h1']);
  });

  it('bir slotdan bittasini oladi, qolganini tashlaydi', () => {
    expect(resolvePicks([2, 3, 1], LIVE_LIKE).map((p) => p.id)).toEqual(['f1', 'b1']);
  });

  it('2 tadan kam qolsa takroriy slot bilan to`ldiradi', () => {
    expect(resolvePicks([2, 3], LIVE_LIKE).map((p) => p.id)).toEqual(['f1', 'f2']);
  });

  it('ro`yxatda yo`q raqamlar tashlanadi', () => {
    expect(resolvePicks([0, 99, 1], LIVE_LIKE).map((p) => p.id)).toEqual(['b1']);
  });
});

describe('pickByRules', () => {
  it("katalogda ko'ylak/shim yo'q bo'lsa ham bo'sh qaytmaydi", () => {
    const products = pickByRules(planFromRules('Ish uchun'), LIVE_LIKE);
    expect(products.length).toBe(3);
    expect(new Set(products.map((p) => p.slot)).size).toBe(3);
  });

  it("sport → so'z bo'yicha krossovka birinchi", () => {
    const products = pickByRules(planFromRules('Sport'), LIVE_LIKE);
    expect(products[0]?.slot).toBe('feet');
    expect(products[0]?.title.toLowerCase()).toContain('krasovka');
  });

  it('bo`sh katalog — bo`sh natija, xato emas', () => {
    expect(pickByRules(planFromRules('Ish uchun'), [])).toEqual([]);
  });
});

describe('dedupeTitles', () => {
  it('faqat raqami farq qiladigan nomlardan bittasi qoladi', () => {
    const out = dedupeTitles([
      item('a', 'bag', 'Barsetka №23'),
      item('b', 'bag', 'Barsetka №24'),
      item('c', 'bag', 'Barsetka — qora'),
    ]);
    expect(out.map((p) => p.id)).toEqual(['a', 'c']);
  });
});
