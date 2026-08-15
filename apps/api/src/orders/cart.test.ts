import { describe, expect, it } from 'vitest';

import { buildCart, type CartRow } from './cart';

function row(over: Partial<CartRow> = {}): CartRow {
  return {
    item_id: 'i1',
    variant_id: 'v1',
    product_id: 'p1',
    title: 'Nike Air Max 90',
    color_name: { uz: 'Qora', ru: 'Черный', en: 'Black' },
    product_images: ['https://cdn/p1.webp'],
    variant_images: [],
    size: '42',
    qty: 1,
    base_price: '250000.00',
    price_delta: '0.00',
    currency: 'UZS',
    stock: 10,
    reserved: 0,
    store_id: 's1',
    store_name: 'Yunusobod Style',
    store_currency: 'UZS',
    delivery_fee: '15000.00',
    free_delivery_from: '300000.00',
    product_status: 'active',
    store_status: 'active',
    ...over,
  };
}

describe('buildCart', () => {
  it('savatni do`konlar bo`yicha ajratadi', () => {
    const cart = buildCart(
      [
        row(),
        row({ item_id: 'i2', store_id: 's2', store_name: 'Chilonzor Fashion', variant_id: 'v2' }),
      ],
      'uz',
    );

    expect(cart.stores).toHaveLength(2);
    expect(cart.itemCount).toBe(2);
    expect(cart.stores.map((store) => store.store.name).sort()).toEqual([
      'Chilonzor Fashion',
      'Yunusobod Style',
    ]);
  });

  it('narxni price_delta bilan qo`shadi va miqdorga ko`paytiradi', () => {
    const cart = buildCart([row({ qty: 3, price_delta: '50000.00' })], 'uz');
    const item = cart.stores[0]?.items[0];

    expect(item?.unitPrice).toBe('300000.00');
    expect(item?.totalPrice).toBe('900000.00');
    // Pul — string, hech qachon number
    expect(typeof item?.unitPrice).toBe('string');
  });

  it('bepul yetkazish chegarasidan oshsa dostavka 0', () => {
    const cheap = buildCart([row({ qty: 1 })], 'uz'); // 250 000 < 300 000
    expect(cheap.stores[0]?.deliveryFee).toBe('15000.00');
    expect(cheap.stores[0]?.total).toBe('265000.00');

    const rich = buildCart([row({ qty: 2 })], 'uz'); // 500 000 >= 300 000
    expect(rich.stores[0]?.deliveryFee).toBe('0.00');
    expect(rich.stores[0]?.total).toBe('500000.00');
  });

  it('chegara yo`q bo`lsa dostavka doim olinadi', () => {
    const cart = buildCart([row({ qty: 5, free_delivery_from: null })], 'uz');
    expect(cart.stores[0]?.deliveryFee).toBe('15000.00');
  });

  it('ombor yetmasa `available: false`', () => {
    const cart = buildCart([row({ qty: 5, stock: 6, reserved: 4 })], 'uz');
    const item = cart.stores[0]?.items[0];

    expect(item?.available).toBe(false);
    expect(item?.stock).toBe(2);
  });

  it('mahsulot arxivlansa yoki do`kon to`xtasa mavjud emas', () => {
    expect(
      buildCart([row({ product_status: 'archived' })], 'uz').stores[0]?.items[0]?.available,
    ).toBe(false);
    expect(
      buildCart([row({ store_status: 'suspended' })], 'uz').stores[0]?.items[0]?.available,
    ).toBe(false);
  });

  it('rang nomi tilga qarab tanlanadi', () => {
    expect(buildCart([row()], 'ru').stores[0]?.items[0]?.colorName).toBe('Черный');
    expect(buildCart([row()], 'en').stores[0]?.items[0]?.colorName).toBe('Black');
  });

  it('rasm variantdan, bo`lmasa mahsulotdan olinadi', () => {
    expect(buildCart([row()], 'uz').stores[0]?.items[0]?.image).toBe('https://cdn/p1.webp');
    expect(
      buildCart([row({ variant_images: ['https://cdn/v1.webp'] })], 'uz').stores[0]?.items[0]
        ?.image,
    ).toBe('https://cdn/v1.webp');
  });

  it('bo`sh savat', () => {
    expect(buildCart([], 'uz')).toEqual({ stores: [], itemCount: 0 });
  });
});
