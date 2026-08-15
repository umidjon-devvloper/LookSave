import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../src/auth/password';
import { pool } from '../src/db/pool';
import { createMonthlyInvoices } from '../src/jobs/scheduler';
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

async function signInOwner(ownerId: string): Promise<Record<string, string>> {
  const phone = uniquePhone();
  await pool.query(
    `UPDATE users SET phone = $2, password_hash = $3, password_set_at = now() WHERE id = $1`,
    [ownerId, phone, await hashPassword('parol12345')],
  );
  const login = await request(app).post('/v1/auth/login').send({ phone, password: 'parol12345' });
  return { Authorization: `Bearer ${login.body.data.accessToken}` };
}

async function signInAdmin(): Promise<Record<string, string>> {
  const phone = uniquePhone();
  await pool.query(
    `INSERT INTO users (phone, full_name, role, country, password_hash, password_set_at)
     VALUES ($1, 'Admin', 'admin', 'UZ', $2, now())`,
    [phone, await hashPassword('parol12345')],
  );
  const login = await request(app).post('/v1/auth/login').send({ phone, password: 'parol12345' });
  return { Authorization: `Bearer ${login.body.data.accessToken}` };
}

describe('do`kon statistikasi', () => {
  it('buyurtma va Try-On sanoqlari qaytadi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };

    await request(app).post('/v1/tryon/event').send({ variantId: fixture.variantId });
    await request(app).post('/v1/tryon/event').send({ variantId: fixture.variantId });

    await request(app)
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

    const response = await request(app).get('/v1/store/analytics?days=30').set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data.totals.orders).toBe(1);
    expect(response.body.data.totals.tryons).toBe(2);
    // 1 buyurtma / 2 try-on = 50%
    expect(response.body.data.totals.conversion).toBe(50);
    expect(response.body.data.daily).toHaveLength(30);
  });

  it('noto`g`ri davr rad etiladi', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);

    const response = await request(app)
      .get('/v1/store/analytics?days=45')
      .set({ ...owner, 'X-Store-Id': fixture.storeId });

    expect(response.status).toBe(422);
  });

  it('Try-On bo`lmasa konversiya null — nolga bo`linmaydi', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);

    const response = await request(app)
      .get('/v1/store/analytics')
      .set({ ...owner, 'X-Store-Id': fixture.storeId });

    expect(response.body.data.totals.conversion).toBeNull();
  });
});

describe('komissiya hisoblari', () => {
  it('cron yaratgan hisob panelda ko`rinadi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);

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

    // O'tgan oyda yakunlangan qilib ko'rsatamiz
    await pool.query(
      `UPDATE orders
          SET status = 'completed',
              completed_at = date_trunc('month', now()) - interval '5 days',
              created_at = date_trunc('month', now()) - interval '6 days'
        WHERE id = $1`,
      [order.body.data.id],
    );

    await createMonthlyInvoices();

    const response = await request(app)
      .get('/v1/store/invoices')
      .set({ ...owner, 'X-Store-Id': fixture.storeId });

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);

    const invoice = response.body.data[0];
    expect(invoice.ordersCount).toBeGreaterThanOrEqual(1);
    // K-12: Faza 1-2 da komissiya 0
    expect(Number(invoice.commission)).toBe(0);
    expect(invoice.isFree).toBe(true);
    // Pul string bo'lib qoladi
    expect(typeof invoice.grossAmount).toBe('string');
  });
});

describe('admin buyurtmalari', () => {
  it('barcha do`konlar buyurtmalari ko`rinadi va raqam bo`yicha topiladi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const admin = await signInAdmin();

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

    const orderNumber = order.body.data.orderNumber as string;

    const byNumber = await request(app).get(`/v1/admin/orders?q=${orderNumber}`).set(admin);

    expect(byNumber.body.data).toHaveLength(1);
    expect(byNumber.body.data[0].store.name).toBeDefined();
    expect(byNumber.body.data[0].customer.phone).toBe(customer.phone);

    const byPhone = await request(app)
      .get(`/v1/admin/orders?q=${customer.phone.slice(-7)}`)
      .set(admin);
    expect(byPhone.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('status tarixi to`liq qaytadi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const admin = await signInAdmin();

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
      .send({ reason: 'Fikrimdan qaytdim' });

    const events = await request(app)
      .get(`/v1/admin/orders/${order.body.data.id}/events`)
      .set(admin);

    expect(events.body.data).toHaveLength(2);
    expect(events.body.data[1]).toMatchObject({ toStatus: 'cancelled', actorType: 'customer' });
  });

  it('do`kon egasi admin buyurtmalariga kira olmaydi', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);

    const response = await request(app).get('/v1/admin/orders').set(owner);
    expect(response.status).toBe(403);
  });
});
