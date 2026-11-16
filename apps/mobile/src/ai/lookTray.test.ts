import { describe, expect, it } from 'vitest';

import {
  addItem,
  canWear,
  findTry,
  forgetTry,
  hasItem,
  migrateOutfit,
  packTray,
  packTries,
  preferredVariant,
  rememberTry,
  removeItem,
  resolveItem,
  selectedForTryon,
  toggleItem,
  TRAY_LIMIT,
  TRIES_LIMIT,
  tryKey,
  unpackTray,
  unpackTries,
  unresolved,
  wearOnly,
  type TrayInput,
  type TrayItem,
  type TryRecord,
} from './lookTray';

/** Bosh sahifa kartasidan — faqat mahsulot ma'lum. */
const card = (productId: string, slot: string | null = 'top'): TrayInput => ({
  productId,
  variantId: null,
  slot,
});

/** Mahsulot sahifasidan — rang ham tanlangan. */
const exact = (productId: string, variantId: string, slot = 'top'): TrayInput => ({
  productId,
  variantId,
  slot,
});

const on = (tray: readonly TrayItem[]): string[] =>
  tray.filter((item) => item.on).map((item) => item.productId ?? item.variantId ?? '?');

describe('savatga qo`shish', () => {
  it('yangi kiyim yoqiq holda qo`shiladi', () => {
    const tray = addItem([], card('p1'));
    expect(tray).toHaveLength(1);
    expect(tray[0]).toMatchObject({ productId: 'p1', variantId: null, on: true });
    expect(hasItem(tray, 'p1')).toBe(true);
  });

  it('turli tana qismlari birga yoqiq qoladi', () => {
    let tray = addItem([], card('shirt', 'top'));
    tray = addItem(tray, card('jeans', 'bottom'));
    tray = addItem(tray, card('coat', 'outer'));
    expect(on(tray)).toEqual(['shirt', 'jeans', 'coat']);
  });

  it('bir turdan ikkinchisi qo`shilsa birinchisi o`chadi, lekin savatda qoladi', () => {
    let tray = addItem([], card('shirt-a', 'top'));
    tray = addItem(tray, card('shirt-b', 'top'));
    expect(tray).toHaveLength(2);
    expect(on(tray)).toEqual(['shirt-b']);
  });

  it('bitta mahsulot ikki marta turmaydi — rang almashadi', () => {
    let tray = addItem([], exact('p1', 'red'));
    tray = addItem(tray, exact('p1', 'blue'));
    expect(tray).toHaveLength(1);
    expect(tray[0]?.variantId).toBe('blue');
  });

  it('kartadan qayta bosish tanlangan rangni o`chirmaydi', () => {
    let tray = addItem([], exact('p1', 'blue'));
    tray = toggleItem(tray, 'p1');
    tray = addItem(tray, card('p1'));
    expect(tray[0]).toMatchObject({ variantId: 'blue', on: true });
  });

  it('sig`imdan oshsa eng eskisi tushib qoladi', () => {
    let tray: TrayItem[] = [];
    for (let index = 0; index <= TRAY_LIMIT; index += 1) {
      tray = addItem(tray, card(`p${index}`, null));
    }
    expect(tray).toHaveLength(TRAY_LIMIT);
    expect(hasItem(tray, 'p0')).toBe(false);
    expect(hasItem(tray, `p${TRAY_LIMIT}`)).toBe(true);
  });
});

describe('yoqish va o`chirish', () => {
  it('o`chirilgan kiyim savatda qoladi', () => {
    const tray = toggleItem(addItem([], card('p1')), 'p1');
    expect(tray).toHaveLength(1);
    expect(tray[0]?.on).toBe(false);
  });

  it('eski kiyim qayta yoqilsa shu turdagi yangisi o`chadi', () => {
    let tray = addItem([], card('shirt-a', 'top'));
    tray = addItem(tray, card('shirt-b', 'top'));
    tray = toggleItem(tray, 'shirt-a');
    expect(on(tray)).toEqual(['shirt-a']);
  });

  it('olib tashlash faqat o`sha kiyimga tegadi', () => {
    let tray = addItem([], card('shirt', 'top'));
    tray = addItem(tray, card('jeans', 'bottom'));
    expect(removeItem(tray, 'shirt').map((item) => item.productId)).toEqual(['jeans']);
  });

  it('noma`lum havola hech narsani o`zgartirmaydi', () => {
    const tray = addItem([], card('p1'));
    expect(toggleItem(tray, 'yoq')).toEqual(tray);
    expect(removeItem(tray, 'yoq')).toEqual(tray);
  });
});

describe('serverdan aniqlash', () => {
  it('variant va slot to`ldiriladi', () => {
    const tray = resolveItem(addItem([], card('p1', null)), 'p1', {
      productId: 'p1',
      variantId: 'v1',
      slot: 'top',
      title: 'Futbolka',
    });
    expect(tray[0]).toMatchObject({ variantId: 'v1', slot: 'top', title: 'Futbolka', on: true });
    expect(unresolved(tray)).toHaveLength(0);
    expect(selectedForTryon(tray).map((item) => item.variantId)).toEqual(['v1']);
  });

  it('aniqlanmagan kiyim so`rovga kirmaydi', () => {
    const tray = addItem([], card('p1'));
    expect(selectedForTryon(tray)).toHaveLength(0);
    expect(unresolved(tray)).toHaveLength(1);
  });

  it('slot keyin bilinib to`qnashsa, keyin qo`shilgani qoladi', () => {
    let tray = addItem([], card('a', null));
    tray = addItem(tray, card('b', null));
    tray = resolveItem(tray, 'a', { productId: 'a', variantId: 'va', slot: 'top' });
    tray = resolveItem(tray, 'b', { productId: 'b', variantId: 'vb', slot: 'top' });
    expect(on(tray)).toEqual(['b']);
  });

  it('kartadan va komplektdan kelgan bitta kiyim birlashadi', () => {
    let tray = addItem([], card('p1', null));
    tray = addItem(tray, { productId: null, variantId: 'v1', slot: null });
    expect(tray).toHaveLength(2);

    tray = resolveItem(tray, 'v1', { productId: 'p1', variantId: 'v1', slot: 'top' });
    expect(tray).toHaveLength(1);
    expect(tray[0]).toMatchObject({ productId: 'p1', variantId: 'v1', on: true });
  });

  it('do`kondan olib tashlangan kiyim o`chadi va kiyib bo`lmaydi', () => {
    const tray = resolveItem(addItem([], card('p1')), 'p1', null);
    expect(tray[0]).toMatchObject({ gone: true, on: false });
    expect(canWear(tray[0]!)).toBe(false);
    expect(toggleItem(tray, 'p1')[0]?.on).toBe(false);
  });

  it('AI kiydira olmaydigan narsa (soat) yoqilmaydi', () => {
    const tray = resolveItem(addItem([], card('watch', null)), 'watch', {
      productId: 'watch',
      variantId: 'vw',
      slot: 'wrist',
    });
    expect(tray[0]?.on).toBe(false);
    expect(selectedForTryon(tray)).toHaveLength(0);
  });
});

describe('saqlangan komplektni kiyish', () => {
  it('komplekt yoqiladi, yig`ilgan qolganlari o`chadi, lekin yo`qolmaydi', () => {
    let tray = addItem([], exact('old-shirt', 'vo', 'top'));
    tray = addItem(tray, exact('old-shoes', 'vs', 'feet'));

    tray = wearOnly(tray, [
      { productId: null, variantId: 'look-shirt', slot: 'top' },
      { productId: null, variantId: 'look-jeans', slot: 'bottom' },
    ]);

    expect(tray).toHaveLength(4);
    expect(on(tray)).toEqual(['look-shirt', 'look-jeans']);
  });
});

describe('mahsulot uchun rang tanlash', () => {
  const row = {
    variantId: 'v-random',
    colors: [{ variantId: 'v-first' }, { variantId: 'v-random' }],
  };

  it('mahsulot so`ralganda tartibdagi birinchi rang olinadi', () => {
    expect(preferredVariant('product-id', row)).toBe('v-first');
  });

  it('aniq variant so`ralganda tanlovga tegilmaydi', () => {
    expect(preferredVariant('v-random', row)).toBe('v-random');
  });

  it('omborda rang qolmagan bo`lsa server qaytargani olinadi', () => {
    expect(preferredVariant('product-id', { variantId: 'v-only', colors: [] })).toBe('v-only');
  });
});

describe('urinishlar', () => {
  const record = (ids: string[], renderId: string, at = 1): TryRecord => ({
    key: tryKey(ids),
    variantIds: [...ids].sort(),
    renderId,
    at,
  });

  it('kalit tartibga bog`liq emas', () => {
    expect(tryKey(['b', 'a', 'c'])).toBe(tryKey(['c', 'b', 'a']));
    expect(tryKey(['a'])).not.toBe(tryKey(['a', 'b']));
  });

  it('bir to`plamning yangi urinishi eskisini almashtiradi', () => {
    let tries = rememberTry([], record(['a', 'b'], 'r1'));
    tries = rememberTry(tries, record(['b', 'a'], 'r2'));
    expect(tries).toHaveLength(1);
    expect(findTry(tries, tryKey(['a', 'b']))?.renderId).toBe('r2');
  });

  it('eng yangilari saqlanadi', () => {
    let tries: TryRecord[] = [];
    for (let index = 0; index <= TRIES_LIMIT; index += 1) {
      tries = rememberTry(tries, record([`v${index}`], `r${index}`));
    }
    expect(tries).toHaveLength(TRIES_LIMIT);
    expect(tries[0]?.renderId).toBe(`r${TRIES_LIMIT}`);
    expect(findTry(tries, tryKey(['v0']))).toBeNull();
  });

  it('unutish faqat o`sha to`plamga tegadi', () => {
    let tries = rememberTry([], record(['a'], 'r1'));
    tries = rememberTry(tries, record(['b'], 'r2'));
    expect(forgetTry(tries, tryKey(['a'])).map((item) => item.renderId)).toEqual(['r2']);
  });
});

describe('qurilmaga yozish', () => {
  it('savat yozilib qayta o`qiladi — nom va suratsiz', () => {
    let tray = addItem([], {
      ...exact('p1', 'v1', 'top'),
      title: 'Futbolka',
      image: 'https://x/y.jpg',
    });
    tray = addItem(tray, card('p2', 'bottom'));
    tray = toggleItem(tray, 'p2');

    const packed = packTray(tray);
    expect(packed).not.toContain('Futbolka');

    expect(unpackTray(packed)).toEqual([
      { productId: 'p1', variantId: 'v1', slot: 'top', on: true },
      { productId: 'p2', variantId: null, slot: 'bottom', on: false },
    ]);
  });

  it('to`la savat ham 2 KB ga sig`adi', () => {
    const uuid = (index: number): string =>
      `${String(index).padStart(8, '0')}-aaaa-4bbb-8ccc-dddddddddddd`;

    let tray: TrayItem[] = [];
    for (let index = 0; index < TRAY_LIMIT; index += 1) {
      tray = addItem(tray, exact(uuid(index), uuid(100 + index), 'bottom'));
    }
    expect(packTray(tray).length).toBeLessThan(2048);

    let tries: TryRecord[] = [];
    for (let index = 0; index < TRIES_LIMIT; index += 1) {
      const ids = [uuid(index), uuid(20 + index), uuid(40 + index), uuid(60 + index)];
      tries = rememberTry(tries, {
        key: tryKey(ids),
        variantIds: ids,
        renderId: uuid(80 + index),
        at: 1_794_000_000_000,
      });
    }
    expect(packTries(tries).length).toBeLessThan(2048);
  });

  it('buzuq yozuv ilovani yiqitmaydi', () => {
    expect(unpackTray(null)).toEqual([]);
    expect(unpackTray('{oops')).toEqual([]);
    expect(unpackTray('{"a":1}')).toEqual([]);
    expect(unpackTray('[[null,null,"top",1],"x",[1,2]]')).toEqual([]);
    expect(unpackTries('nope')).toEqual([]);
    expect(unpackTries('[[[],"r",1],[["a"],5,1],[["a"],"r","t"]]')).toEqual([]);
  });

  it('urinishlar yozilib qayta o`qiladi', () => {
    const tries = rememberTry([], {
      key: tryKey(['b', 'a']),
      variantIds: ['a', 'b'],
      renderId: 'r1',
      at: 42,
    });
    expect(unpackTries(packTries(tries))).toEqual(tries);
  });

  it('eski `ai.outfit` yozuvi savatga ko`chadi', () => {
    const old = JSON.stringify([
      { category: 'pick:product-1', variantId: 'product-1' },
      { category: 'top', variantId: 'variant-9' },
      { category: 42, variantId: 'x' },
      'axlat',
    ]);

    expect(migrateOutfit(old)).toEqual([
      { productId: 'product-1', variantId: null, slot: null, on: true },
      { productId: null, variantId: 'variant-9', slot: null, on: true },
    ]);
    expect(migrateOutfit('buzuq')).toEqual([]);
  });
});
