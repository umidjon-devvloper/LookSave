import { describe, expect, it } from 'vitest';

import { slugify, SLUG_MAX, transliterate, uniqueSlug } from './slug';

describe('transliterate', () => {
  it('kirilldan lotinga o`giradi', () => {
    expect(transliterate('Чилонзор')).toBe('chilonzor');
    expect(transliterate('Магазин')).toBe('magazin');
  });

  it('ikki harfli mosliklar buzilmaydi', () => {
    // "щ" → "sh" bo'lib qolsa "borshch" o'rniga "borsh" chiqardi
    expect(transliterate('щи')).toBe('shchi');
    expect(transliterate('Жанна')).toBe('janna');
  });

  it('o`zbek apostroflarini tushiradi', () => {
    expect(transliterate("Do'kon")).toBe('dokon');
    expect(transliterate('Toshkent o‘rda')).toBe('toshkent orda');
  });

  it('lotin matnga tegmaydi', () => {
    expect(transliterate('Fashion Store')).toBe('fashion store');
  });
});

describe('slugify', () => {
  it('oddiy nomdan slug', () => {
    expect(slugify('Chilonzor Fashion')).toBe('chilonzor-fashion');
  });

  it('kirill nom ham ishlaydi', () => {
    expect(slugify('Чилонзор Мода')).toBe('chilonzor-moda');
  });

  it('ortiqcha belgilar bitta tirega aylanadi', () => {
    expect(slugify('  Style   &&&   Co.  ')).toBe('style-co');
  });

  it('uzun nom kesiladi va tire bilan tugamaydi', () => {
    const slug = slugify('a'.repeat(80) + ' fashion');
    expect(slug).not.toBeNull();
    expect(slug?.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug?.endsWith('-')).toBe(false);
  });

  it('lotin harfi chiqmasa null', () => {
    // Arabcha nom — zaxira nom kerak bo'ladi
    expect(slugify('متجر الأزياء')).toBeNull();
    expect(slugify('!!!')).toBeNull();
    expect(slugify('')).toBeNull();
  });

  it('bitta harfli nom ham null — juda qisqa slug foydasiz', () => {
    expect(slugify('A')).toBeNull();
  });
});

describe('uniqueSlug', () => {
  it('bo`sh bo`lsa o`zini qaytaradi', () => {
    expect(uniqueSlug('moda', new Set())).toBe('moda');
  });

  it('band bo`lsa raqam qo`shadi', () => {
    expect(uniqueSlug('moda', new Set(['moda']))).toBe('moda-2');
    expect(uniqueSlug('moda', new Set(['moda', 'moda-2']))).toBe('moda-3');
  });

  it('raqam bilan ham uzunlik chegarasi saqlanadi', () => {
    const base = 'a'.repeat(SLUG_MAX);
    const result = uniqueSlug(base, new Set([base]));
    expect(result).not.toBeNull();
    expect(result?.length).toBeLessThanOrEqual(SLUG_MAX);
  });

  it('hammasi band bo`lsa null', () => {
    const taken = new Set(['moda']);
    for (let index = 2; index <= 50; index += 1) taken.add(`moda-${index}`);
    expect(uniqueSlug('moda', taken)).toBeNull();
  });
});
