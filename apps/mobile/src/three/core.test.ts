import { describe, expect, it } from 'vitest';

import {
  CACHE_BUDGET_MB,
  FpsMonitor,
  ModelCache,
  SlotState,
  adjustQuality,
  nextIndex,
  pickModelUrl,
  prefetchTargets,
  type TryonItem,
} from './core';

function item(over: Partial<TryonItem> = {}): TryonItem {
  return {
    variantId: 'v1',
    productId: 'p1',
    title: 'Nike Air Max 90',
    colorHex: '#1a1a1a',
    colorName: 'Qora',
    price: '1250000.00',
    currency: 'UZS',
    thumbnail: null,
    textureUrl: null,
    glbUrl: 'https://cdn/base.glb',
    lodUrls: { lod0: 'https://cdn/0.glb', lod1: 'https://cdn/1.glb', lod2: 'https://cdn/2.glb' },
    fileSizeBytes: 1_180_000,
    hideBodyParts: [],
    hasMorphs: true,
    storeId: 's1',
    storeName: 'Yunusobod Style',
    ...over,
  };
}

describe('LOD tanlash', () => {
  it('sifatga qarab boshqa daraja', () => {
    expect(pickModelUrl(item(), 'high')).toBe('https://cdn/0.glb');
    expect(pickModelUrl(item(), 'medium')).toBe('https://cdn/1.glb');
    expect(pickModelUrl(item(), 'low')).toBe('https://cdn/2.glb');
  });

  it('prefetch bir pog`ona pastroq — hali ko`rinmaydi', () => {
    expect(pickModelUrl(item(), 'high', 'prefetch')).toBe('https://cdn/1.glb');
    expect(pickModelUrl(item(), 'medium', 'prefetch')).toBe('https://cdn/2.glb');
  });

  it('kerakli LOD yo`q bo`lsa boshqasi olinadi — model yuklanmay qolmaydi', () => {
    const only2 = item({ lodUrls: { lod2: 'https://cdn/2.glb' } });
    expect(pickModelUrl(only2, 'high')).toBe('https://cdn/2.glb');

    const only0 = item({ lodUrls: { lod0: 'https://cdn/0.glb' } });
    expect(pickModelUrl(only0, 'low')).toBe('https://cdn/0.glb');
  });

  it('LOD umuman yo`q bo`lsa asosiy GLB', () => {
    expect(pickModelUrl(item({ lodUrls: null }), 'medium')).toBe('https://cdn/base.glb');
    expect(pickModelUrl(item({ lodUrls: {}, glbUrl: null }), 'medium')).toBeNull();
  });
});

describe('sifatni tuzatish', () => {
  it('FPS pasaysa tushadi', () => {
    expect(adjustQuality('high', 20)).toBe('low');
    expect(adjustQuality('high', 35)).toBe('medium');
  });

  it('FPS yaxshi bo`lsa ko`tariladi, lekin sakrab emas', () => {
    expect(adjustQuality('low', 60)).toBe('medium');
    // `medium` dan `high` ga avtomatik ko'tarilmaydi — tebranishni oldini oladi
    expect(adjustQuality('medium', 60)).toBe('medium');
  });

  it('chegara ichida o`zgarmaydi', () => {
    expect(adjustQuality('medium', 45)).toBe('medium');
    expect(adjustQuality('low', 30)).toBe('low');
  });
});

describe('FpsMonitor', () => {
  it('yetarli kadr yig`ilmaguncha qaror qabul qilinmaydi', () => {
    const monitor = new FpsMonitor(60);
    for (let i = 0; i < 10; i += 1) monitor.push(1 / 60);
    expect(monitor.average()).toBeNull();
  });

  it('o`rtacha hisoblanadi', () => {
    const monitor = new FpsMonitor(10);
    for (let i = 0; i < 10; i += 1) monitor.push(1 / 30);
    expect(monitor.average()).toBe(30);
  });

  it('bitta sakrash natijani buzmaydi', () => {
    const monitor = new FpsMonitor(10);
    for (let i = 0; i < 9; i += 1) monitor.push(1 / 60);
    monitor.push(1 / 5); // bitta juda sekin kadr
    const average = monitor.average();
    expect(average).not.toBeNull();
    expect(average ?? 0).toBeGreaterThan(40);
  });

  it('noto`g`ri delta e`tiborga olinmaydi', () => {
    const monitor = new FpsMonitor(4);
    monitor.push(0);
    monitor.push(-1);
    expect(monitor.average()).toBeNull();
  });
});

describe('SlotState', () => {
  it('bir slotda bitta mahsulot, eskisi qaytadi', () => {
    const state = new SlotState();
    expect(state.equip('top', item({ variantId: 'a' }))).toBeNull();

    const replaced = state.equip('top', item({ variantId: 'b' }));
    expect(replaced?.variantId).toBe('a');
    expect(state.get('top')?.variantId).toBe('b');
    expect(state.list()).toHaveLength(1);
  });

  it('yashiriladigan tana qismlari birlashtiriladi', () => {
    const state = new SlotState();
    state.equip('feet', item({ hideBodyParts: ['body_foot_L', 'body_foot_R'] }));
    state.equip('top', item({ hideBodyParts: ['body_torso', 'body_foot_L'] }));

    expect(state.hiddenBodyParts().sort()).toEqual(['body_foot_L', 'body_foot_R', 'body_torso']);
  });

  it('yechilganda mahsulot qaytadi — uni tozalash kerak', () => {
    const state = new SlotState();
    state.equip('top', item({ variantId: 'a' }));
    expect(state.unequip('top')?.variantId).toBe('a');
    expect(state.get('top')).toBeNull();
    expect(state.unequip('top')).toBeNull();
  });
});

describe('ModelCache', () => {
  const MB = 1024 * 1024;

  it('byudjetdan oshsa eskisini chiqaradi', () => {
    const cache = new ModelCache<string>(10);
    cache.set('a', 'A', 4 * MB);
    cache.set('b', 'B', 4 * MB);
    const removed = cache.set('c', 'C', 4 * MB);

    expect(removed.map((entry) => entry.key)).toEqual(['a']);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('kiyilgan model chiqarilmaydi', () => {
    const cache = new ModelCache<string>(10);
    cache.set('worn', 'W', 4 * MB);
    cache.pin('worn');
    cache.set('b', 'B', 4 * MB);
    const removed = cache.set('c', 'C', 4 * MB);

    expect(removed.map((entry) => entry.key)).toEqual(['b']);
    expect(cache.has('worn')).toBe(true);
  });

  it('ishlatilgan model oxiriga suriladi (LRU)', () => {
    const cache = new ModelCache<string>(10);
    cache.set('a', 'A', 4 * MB);
    cache.set('b', 'B', 4 * MB);
    cache.get('a'); // `a` yaqinda ishlatildi
    const removed = cache.set('c', 'C', 4 * MB);

    expect(removed.map((entry) => entry.key)).toEqual(['b']);
    expect(cache.has('a')).toBe(true);
  });

  it('xotira kam signalida kiyilmaganlar tozalanadi', () => {
    const cache = new ModelCache<string>(100);
    cache.set('worn', 'W', MB);
    cache.pin('worn');
    cache.set('a', 'A', MB);
    cache.set('b', 'B', MB);

    const removed = cache.purgeUnpinned();
    expect(removed).toHaveLength(2);
    expect(cache.size()).toBe(1);
  });

  it('byudjet sifatga bog`liq', () => {
    expect(CACHE_BUDGET_MB.low).toBeLessThan(CACHE_BUDGET_MB.high);
  });
});

describe('svayp va prefetch', () => {
  const list = ['a', 'b', 'c', 'd', 'e'];

  it('indeks aylanma', () => {
    expect(nextIndex(4, 1, 5)).toBe(0);
    expect(nextIndex(0, -1, 5)).toBe(4);
    expect(nextIndex(0, 1, 0)).toBe(0);
  });

  it('joriy elementdan ikki tomonga ±2', () => {
    const targets = prefetchTargets(list, 2);
    expect(targets.sort()).toEqual(['a', 'b', 'd', 'e']);
    expect(targets).not.toContain('c');
  });

  it('ro`yxat oxirida boshiga o`tadi', () => {
    expect(prefetchTargets(list, 4).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('bitta element bo`lsa prefetch yo`q', () => {
    expect(prefetchTargets(['a'], 0)).toEqual([]);
    expect(prefetchTargets([], 0)).toEqual([]);
  });
});
