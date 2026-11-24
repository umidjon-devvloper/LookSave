import { describe, expect, it } from 'vitest';

import { expandSearchQuery } from './uz-synonyms';

describe('expandSearchQuery', () => {
  it('bo`sh so`rov uchun bo`sh massiv qaytaradi', () => {
    expect(expandSearchQuery('')).toEqual([]);
    expect(expandSearchQuery('   ')).toEqual([]);
  });

  it('sinonim yo`q bo`lsa faqat asl so`rovni qaytaradi', () => {
    const result = expandSearchQuery('xyz123');
    expect(result).toEqual(['xyz123']);
  });

  it('"qovun ro`mol" → sariq va orange variantlarini qo`shadi', () => {
    const result = expandSearchQuery("qovun ro'mol");
    expect(result).toContain("qovun ro'mol");
    expect(result).toContain("sariq ro'mol");
    expect(result).toContain("orange ro'mol");
  });

  it('"pista yashil" ko`p so`zli kalit — olive variantiga aylanadi', () => {
    const result = expandSearchQuery('pista yashil shim');
    expect(result).toContain('pista yashil shim');
    expect(result).toContain('olive shim');
  });

  it('transliteratsiya — "nayk" → "nike"', () => {
    const result = expandSearchQuery('nayk krossovka');
    expect(result).toContain('nayk krossovka');
    expect(result).toContain('nike krossovka');
    // krossovka ham o'zining sinonimiga ega
    expect(result.some((v) => v.includes('sneakers'))).toBe(true);
  });

  it('ingliz rang → o`zbekcha (katalog ikki tilli)', () => {
    const result = expandSearchQuery('red dress');
    expect(result).toContain('red dress');
    expect(result).toContain('qizil dress');
    expect(result).toContain("red ko'ylak");
  });

  it('kattalik cheklovi — maxVariants ni buzmaydi', () => {
    const result = expandSearchQuery('qovun pista anor nok', 5);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result[0]).toBe('qovun pista anor nok');
  });

  it('bosh harf va bo`shliqlar normallashadi', () => {
    const result = expandSearchQuery('  QOVUN   Ro`mol  ');
    // ro`mol (backtick apostrof) sinonimda yo'q — ammo asl so'rov qaytishi kerak
    expect(result[0]).toBe('qovun ro`mol');
  });
});
