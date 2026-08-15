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
  uniquePhone,
} from './helpers';

afterAll(closeConnections);
beforeEach(resetRateLimits);

describe('auth oqimi', () => {
  it('ro`yxatdan o`tish savat, ishonch balli va tasdiqlangan raqam yaratadi', async () => {
    const customer = await registerCustomer();

    const rows = await pool.query<{ carts: string; trust: string; via: string }>(
      `SELECT (SELECT COUNT(*) FROM carts WHERE user_id = $1)      AS carts,
              (SELECT COUNT(*) FROM user_trust WHERE user_id = $1) AS trust,
              (SELECT verified_via FROM verified_phones WHERE user_id = $1) AS via`,
      [customer.id],
    );

    expect(rows.rows[0]?.carts).toBe('1');
    expect(rows.rows[0]?.trust).toBe('1');
    // Faza 1: OTP yo'q — raqam shu belgi bilan yoziladi
    expect(rows.rows[0]?.via).toBe('password_signup');
  });

  it('bir raqam ikki marta ro`yxatdan o`tmaydi', async () => {
    const phone = uniquePhone();
    const body = { phone, fullName: 'Test Mijoz', password: 'parol12345' };

    const first = await request(app).post('/v1/auth/register').send(body);
    const second = await request(app).post('/v1/auth/register').send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_EXISTS');
  });

  it('noto`g`ri parol va mavjud bo`lmagan raqam bir xil javob beradi', async () => {
    const customer = await registerCustomer();

    const wrongPassword = await request(app)
      .post('/v1/auth/login')
      .send({ phone: customer.phone, password: 'notogriparol' });

    const unknownPhone = await request(app)
      .post('/v1/auth/login')
      .send({ phone: uniquePhone(), password: 'notogriparol' });

    // Raqam bor-yo'qligini oshkor qilmaydi
    expect(wrongPassword.status).toBe(401);
    expect(unknownPhone.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownPhone.body.error.message);
  });

  it('refresh rotatsiyasi: eski token qayta ishlatilsa sessiya bekor bo`ladi', async () => {
    const phone = uniquePhone();
    await request(app)
      .post('/v1/auth/register')
      .send({ phone, fullName: 'Test Mijoz', password: 'parol12345' });

    const login = await request(app).post('/v1/auth/login').send({ phone, password: 'parol12345' });
    const oldRefresh = login.body.data.refreshToken as string;

    const rotated = await request(app).post('/v1/auth/refresh').send({ refreshToken: oldRefresh });
    expect(rotated.status).toBe(200);
    const newRefresh = rotated.body.data.refreshToken as string;

    // O'g'irlangan token belgisi — butun oila bekor qilinadi
    const reused = await request(app).post('/v1/auth/refresh').send({ refreshToken: oldRefresh });
    expect(reused.status).toBe(401);

    const afterRevoke = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: newRefresh });
    expect(afterRevoke.status).toBe(401);
  });

  it('shahar raqami qabul qilinmaydi', async () => {
    const response = await request(app)
      .post('/v1/auth/register')
      .send({ phone: '+998712345678', fullName: 'Test Mijoz', password: 'parol12345' });

    expect(response.status).toBe(422);
    expect(response.body.error.details.fields[0].code).toBe('NOT_MOBILE');
  });

  it('tokensiz himoyalangan endpoint 401', async () => {
    const response = await request(app).get('/v1/profile');
    expect(response.status).toBe(401);
  });
});

describe('do`kon paneli', () => {
  /** Do'kon egasiga parol beramiz — fixture uni parolsiz yaratadi. */
  async function signInOwner(ownerId: string): Promise<Record<string, string>> {
    const phone = uniquePhone();
    const { hashPassword } = await import('../src/auth/password');

    await pool.query(
      `UPDATE users SET phone = $2, password_hash = $3, password_set_at = now() WHERE id = $1`,
      [ownerId, phone, await hashPassword('parol12345')],
    );

    const login = await request(app).post('/v1/auth/login').send({ phone, password: 'parol12345' });
    return { Authorization: `Bearer ${login.body.data.accessToken}` };
  }

  it('status o`tishlari tartib bilan bajariladi va ombor yangilanadi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture({ stock: 5 });
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };

    const order = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'pickup',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 2 }],
      });

    const orderId = order.body.data.id as string;

    // Panelda ko'rinadi
    const list = await request(app).get('/v1/store/orders?status=new').set(headers);
    expect(list.body.data.map((item: { id: string }) => item.id)).toContain(orderId);
    expect(list.body.data[0].customerTrust).toBeDefined();

    for (const action of ['seen', 'confirm', 'ready', 'complete']) {
      const response = await request(app)
        .post(`/v1/store/orders/${orderId}/${action}`)
        .set(headers)
        .send({});
      expect(response.status).toBe(200);
    }

    const stock = await pool.query<{ stock: number; reserved: number }>(
      `SELECT stock, reserved FROM variant_stock WHERE variant_id = $1`,
      [fixture.variantId],
    );

    // `completed` → tovar sotildi: ham ombor, ham rezerv kamayadi
    expect(stock.rows[0]).toEqual({ stock: 3, reserved: 0 });
  });

  it('noto`g`ri tartibdagi amal rad etiladi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };

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

    // `new` dan to'g'ridan-to'g'ri `ready` ga o'tib bo'lmaydi
    const response = await request(app)
      .post(`/v1/store/orders/${order.body.data.id}/ready`)
      .set(headers)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE');
  });

  it('soxta buyurtma deb rad etilsa raqam bloklanadi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };

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
      .post(`/v1/store/orders/${order.body.data.id}/reject`)
      .set(headers)
      .send({ reason: 'fake_order' });

    const blocked = await request(app)
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

    expect(blocked.body.error.code).toBe('BLOCKED');
  });

  it('mijoz do`kon paneliga kira olmaydi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    const response = await request(app)
      .get('/v1/store/dashboard')
      .set(customer.headers)
      .set('X-Store-Id', fixture.storeId);

    expect(response.status).toBe(403);
  });

  it('begona do`kon ma`lumotini ko`rib bo`lmaydi', async () => {
    const mine = await createStoreFixture();
    const other = await createStoreFixture();
    const owner = await signInOwner(mine.ownerId);

    const response = await request(app)
      .get('/v1/store/dashboard')
      .set(owner)
      .set('X-Store-Id', other.storeId);

    expect(response.status).toBe(403);
  });
});

describe('katalog', () => {
  it('faol mahsulot katalogda ko`rinadi, arxivlangani yo`q', async () => {
    const fixture = await createStoreFixture();

    const visible = await request(app).get('/v1/products?limit=50');
    expect(visible.body.data.map((item: { id: string }) => item.id)).toContain(fixture.productId);

    await pool.query(`UPDATE products SET status = 'archived' WHERE id = $1`, [fixture.productId]);

    const hidden = await request(app).get('/v1/products?limit=50');
    expect(hidden.body.data.map((item: { id: string }) => item.id)).not.toContain(
      fixture.productId,
    );
  });

  it('yaqin do`konlar masofa bilan qaytadi', async () => {
    const fixture = await createStoreFixture();

    const response = await request(app).get(
      '/v1/stores/nearby?lat=41.3111&lng=69.2797&radius=5000',
    );
    const store = response.body.data.find((item: { id: string }) => item.id === fixture.storeId);

    expect(store).toBeDefined();
    expect(store.distanceM).toBeLessThan(100);
    expect(store).toHaveProperty('isOpen');
  });

  it('radiusdan tashqaridagi do`kon chiqmaydi', async () => {
    const fixture = await createStoreFixture();

    // Dubay koordinatasi
    const response = await request(app).get('/v1/stores/nearby?lat=25.08&lng=55.14&radius=5000');

    expect(response.body.data.map((item: { id: string }) => item.id)).not.toContain(
      fixture.storeId,
    );
  });
});
