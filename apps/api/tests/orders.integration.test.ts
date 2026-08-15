import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { pool } from '../src/db/pool';
import {
  app,
  closeConnections,
  createStoreFixture,
  idempotencyKey,
  registerCustomer,
  request,
  resetRateLimits,
} from './helpers';

/**
 * Buyurtma oqimi — tizimning eng muhim qismi (03-api-spec §12).
 * Bu yerda haqiqiy baza, triggerlar va tranzaksiyalar ishlaydi.
 */

afterAll(closeConnections);
beforeEach(resetRateLimits);

describe('buyurtma yaratish', () => {
  it('savatdan buyurtmagacha to`liq yo`l', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    // 1. Savatga qo'shish
    const cart = await request(app)
      .post('/v1/cart/items')
      .set(customer.headers)
      .send({ variantId: fixture.variantId, size: 'M', qty: 2 });

    expect(cart.status).toBe(201);
    expect(cart.body.data.itemCount).toBe(2);
    expect(cart.body.data.stores).toHaveLength(1);
    // Pul string bo'lib qoladi
    expect(cart.body.data.stores[0].subtotal).toBe('200000.00');

    // 2. Buyurtma
    const order = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'delivery',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        address: { text: 'Chilonzor 9-kvartal 24-uy', lat: 41.3111, lng: 69.2797 },
        items: [{ variantId: fixture.variantId, size: 'M', qty: 2 }],
      });

    expect(order.status).toBe(201);
    expect(order.body.data.orderNumber).toMatch(/^LS-\d{6}-\d{4}$/);
    expect(order.body.data.total).toBe('215000.00');
    expect(order.body.data.paymentMethod).toBe('cash');

    // 3. Ombor rezerv qilindi
    const stock = await pool.query<{ reserved: number }>(
      `SELECT reserved FROM variant_stock WHERE variant_id = $1 AND size = 'M'`,
      [fixture.variantId],
    );
    expect(stock.rows[0]?.reserved).toBe(2);

    // 4. Savat shu do'kon uchun tozalandi
    const emptyCart = await request(app).get('/v1/cart').set(customer.headers);
    expect(emptyCart.body.data.itemCount).toBe(0);

    // 5. Jurnalda mijoz aktori
    const events = await request(app)
      .get(`/v1/orders/${order.body.data.id}/events`)
      .set(customer.headers);

    expect(events.body.data).toHaveLength(1);
    expect(events.body.data[0]).toMatchObject({ toStatus: 'new', actorType: 'customer' });
  });

  it('Idempotency-Key takroriy so`rovda yangi buyurtma yaratmaydi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const key = idempotencyKey();

    const body = {
      storeId: fixture.storeId,
      deliveryType: 'pickup' as const,
      contactName: 'Test Mijoz',
      contactPhone: customer.phone,
      items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
    };

    const first = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', key)
      .send(body);

    const second = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', key)
      .send(body);

    expect(first.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);

    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM orders WHERE user_id = $1`,
      [customer.id],
    );
    expect(Number(count.rows[0]?.count)).toBe(1);
  });

  it('bir xil kalit boshqa tana bilan rad etiladi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const key = idempotencyKey();

    const base = {
      storeId: fixture.storeId,
      contactName: 'Test Mijoz',
      contactPhone: customer.phone,
      items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
    };

    await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', key)
      .send({ ...base, deliveryType: 'pickup' });

    const changed = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', key)
      .send({ ...base, deliveryType: 'pickup', note: 'boshqa' });

    expect(changed.status).toBe(422);
  });

  it('Idempotency-Key`siz rad etiladi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    const response = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .send({
        storeId: fixture.storeId,
        deliveryType: 'pickup',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
      });

    expect(response.status).toBe(400);
  });
});

describe('buyurtma tekshiruvlari', () => {
  it('tasdiqlanmagan raqam bilan bo`lmaydi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    const response = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'pickup',
        contactName: 'Test Mijoz',
        contactPhone: '+998909998877',
        items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PHONE_NOT_VERIFIED');
  });

  it('yetkazish hududidan tashqarida rad etiladi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    const response = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'delivery',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        // Dubay — Toshkent do'konidan uzoq
        address: { text: 'Dubai Marina Tower 12', lat: 25.08, lng: 55.14 },
        items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('OUT_OF_RANGE');
  });

  it('omborda yetarli bo`lmasa rad etiladi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture({ stock: 1 });

    const response = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'pickup',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 5 }],
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('OUT_OF_STOCK');
  });

  it('qora ro`yxatdagi raqam bloklanadi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    await pool.query(
      `INSERT INTO order_blocklist (store_id, phone, reason, created_by)
       VALUES ($1, $2, 'test', 'store')`,
      [fixture.storeId, customer.phone],
    );

    const response = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'pickup',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('BLOCKED');
  });

  it('oxirgi dona uchun parallel so`rovdan faqat bittasi o`tadi', async () => {
    const fixture = await createStoreFixture({ stock: 1 });
    const customers = await Promise.all([
      registerCustomer('Birinchi'),
      registerCustomer('Ikkinchi'),
      registerCustomer('Uchinchi'),
    ]);

    const responses = await Promise.all(
      customers.map((customer) =>
        request(app)
          .post('/v1/orders')
          .set(customer.headers)
          .set('Idempotency-Key', idempotencyKey())
          .send({
            storeId: fixture.storeId,
            deliveryType: 'pickup',
            contactName: 'Test Mijoz',
            contactPhone: customer.phone,
            items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
          }),
      ),
    );

    const created = responses.filter((response) => response.status === 201);
    const rejected = responses.filter((response) => response.body.error?.code === 'OUT_OF_STOCK');

    // `SELECT ... FOR UPDATE` bo'lmasa uchalasi ham o'tib ketardi
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(2);
  });
});

describe('bekor qilish va rezerv', () => {
  it('bekor qilinganda rezerv qaytadi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    const order = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'pickup',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 3 }],
      });

    const before = await pool.query<{ reserved: number }>(
      `SELECT reserved FROM variant_stock WHERE variant_id = $1`,
      [fixture.variantId],
    );
    expect(before.rows[0]?.reserved).toBe(3);

    const cancelled = await request(app)
      .post(`/v1/orders/${order.body.data.id}/cancel`)
      .set(customer.headers)
      .send({ reason: 'Fikrimdan qaytdim' });

    expect(cancelled.status).toBe(200);

    const after = await pool.query<{ reserved: number }>(
      `SELECT reserved FROM variant_stock WHERE variant_id = $1`,
      [fixture.variantId],
    );
    // 010_orders_flow.sql dagi trigger
    expect(after.rows[0]?.reserved).toBe(0);
  });

  it('ikkinchi marta bekor qilib bo`lmaydi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    const order = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'pickup',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
      });

    await request(app)
      .post(`/v1/orders/${order.body.data.id}/cancel`)
      .set(customer.headers)
      .send({});

    const second = await request(app)
      .post(`/v1/orders/${order.body.data.id}/cancel`)
      .set(customer.headers)
      .send({});

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_STATE');
  });

  it('begona buyurtmani ko`rib bo`lmaydi', async () => {
    const owner = await registerCustomer('Egasi');
    const stranger = await registerCustomer('Begona');
    const fixture = await createStoreFixture();

    const order = await request(app)
      .post('/v1/orders')
      .set(owner.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'pickup',
        contactName: 'Egasi',
        contactPhone: owner.phone,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
      });

    const response = await request(app)
      .get(`/v1/orders/${order.body.data.id}`)
      .set(stranger.headers);

    expect(response.status).toBe(404);
  });
});
