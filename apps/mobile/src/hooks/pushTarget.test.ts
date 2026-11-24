import { describe, expect, it } from 'vitest';

import { notificationTarget } from './pushTarget';

describe('notificationTarget', () => {
  it('mijoz buyurtmasi — buyurtma sahifasi', () => {
    expect(notificationTarget({ orderId: 'b7c1' })).toBe('/order/b7c1');
  });

  /*
   * ⚠️ Do'kon buyurtmasida ham `orderId` bor. Tur oldin tekshirilmasa,
   * sotuvchi o'ziga tegishli bo'lmagan mijoz sahifasiga tushardi.
   */
  it('do`kon buyurtmasi — sotuvchi paneli, orderId bo`lsa ham', () => {
    expect(notificationTarget({ type: 'store_order', orderId: 'b7c1' })).toBe('/seller');
  });

  it('avatar tayyor — kiyintirish', () => {
    expect(notificationTarget({ type: 'avatar_ready' })).toBe('/ai/fitting');
  });

  it('narx tushdi (bitta mahsulot) — mahsulot sahifasi', () => {
    expect(notificationTarget({ type: 'favorite_alert', productId: 'p1' })).toBe('/product/p1');
  });

  it('sevimlilarda bir nechta yangilik — sevimlilar sahifasi', () => {
    expect(notificationTarget({ type: 'favorite_alert' })).toBe('/favorites');
    expect(notificationTarget({ type: 'favorite_alert', productId: '' })).toBe('/favorites');
  });

  it('orderId turi noma`lum xabarda ham buyurtmani ochadi', () => {
    expect(notificationTarget({ type: 'order_status', orderId: 'b7c1' })).toBe('/order/b7c1');
  });

  it('mos kelmagan ma`lumotda hech narsa ochilmaydi', () => {
    const inputs: unknown[] = [
      undefined,
      null,
      {},
      { type: 'promo' },
      { orderId: 42 },
      { orderId: '' },
      'matn',
      7,
    ];

    for (const input of inputs) expect(notificationTarget(input)).toBeNull();
  });
});
