import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { anonymizeDueAccounts } from '../src/auth/deletion';
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

afterAll(closeConnections);
beforeEach(resetRateLimits);

const PASSWORD = 'parol12345';

/** So'rov sanasini orqaga surish — 30 kunni kutib o'tirmaslik uchun. */
async function backdateRequest(userId: string, days: number): Promise<void> {
  await pool.query(
    `UPDATE users SET deletion_requested_at = now() - make_interval(days => $2) WHERE id = $1`,
    [userId, days],
  );
}

describe('akkauntni o`chirish', () => {
  it('parol to`g`ri bo`lsa so`rov yoziladi va sana qaytadi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    expect(response.status).toBe(200);
    expect(response.body.data.scheduledFor).toBeTruthy();

    const scheduled = new Date(response.body.data.scheduledFor as string);
    const requested = new Date(response.body.data.deletionRequestedAt as string);
    const days = Math.round((scheduled.getTime() - requested.getTime()) / 86_400_000);
    expect(days).toBe(30);
  });

  it('parol noto`g`ri bo`lsa rad etiladi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: 'boshqaparol', confirm: 'DELETE' });

    expect(response.status).toBe(401);

    const { rows } = await pool.query<{ deletion_requested_at: Date | null }>(
      `SELECT deletion_requested_at FROM users WHERE id = $1`,
      [customer.id],
    );
    expect(rows[0]?.deletion_requested_at).toBeNull();
  });

  it('`confirm` maydonisiz so`rov o`tmaydi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD });

    expect(response.status).toBe(422);
  });

  it('takroriy so`rov muddatni uzaytirmaydi', async () => {
    const customer = await registerCustomer();

    const first = await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    // Sessiyalar yopildi — yangi token kerak
    const login = await request(app)
      .post('/v1/auth/login')
      .send({ phone: customer.phone, password: PASSWORD });

    // Kirish o'chirishni bekor qiladi, shuning uchun qayta so'raymiz
    const headers = { Authorization: `Bearer ${login.body.data.accessToken as string}` };

    const second = await request(app)
      .delete('/v1/auth/account')
      .set(headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    expect(second.status).toBe(200);
    // Kirish bekor qilgani uchun sana yangi bo'ladi — bu kutilgan xatti-harakat
    expect(second.body.data.deletionRequestedAt).not.toBe(
      first.body.data.deletionRequestedAt as string,
    );
  });

  it('kirish o`chirish so`rovini bekor qiladi', async () => {
    const customer = await registerCustomer();

    await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    await request(app).post('/v1/auth/login').send({ phone: customer.phone, password: PASSWORD });

    const { rows } = await pool.query<{ deletion_requested_at: Date | null }>(
      `SELECT deletion_requested_at FROM users WHERE id = $1`,
      [customer.id],
    );
    expect(rows[0]?.deletion_requested_at).toBeNull();
  });

  it('`restore` bekor qiladi va holat endpointi buni ko`rsatadi', async () => {
    const customer = await registerCustomer();

    await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    const login = await request(app)
      .post('/v1/auth/login')
      .send({ phone: customer.phone, password: PASSWORD });
    const headers = { Authorization: `Bearer ${login.body.data.accessToken as string}` };

    // Kirish allaqachon bekor qildi — ikkinchi marta bekor qilib bo'lmaydi
    const restore = await request(app).post('/v1/auth/account/restore').set(headers).send({});
    expect(restore.status).toBe(409);

    const status = await request(app).get('/v1/auth/account/deletion').set(headers);
    expect(status.body.data.pending).toBe(false);
  });

  it('yakunlanmagan buyurtma bo`lsa o`chirilmaydi', async () => {
    const fixture = await createStoreFixture();
    const customer = await registerCustomer();

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

    expect(order.status).toBe(201);

    const response = await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE');
  });
});

describe('anonimlashtirish', () => {
  it('30 kun to`lmagan akkaunt tegilmaydi', async () => {
    const customer = await registerCustomer();

    await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    await backdateRequest(customer.id, 10);
    await anonymizeDueAccounts();

    const { rows } = await pool.query<{ phone: string; anonymized_at: Date | null }>(
      `SELECT phone, anonymized_at FROM users WHERE id = $1`,
      [customer.id],
    );

    expect(rows[0]?.phone).toBe(customer.phone);
    expect(rows[0]?.anonymized_at).toBeNull();
  });

  it('30 kundan oshgan akkauntning shaxsiy ma`lumoti o`chadi', async () => {
    const customer = await registerCustomer();

    // Profil va sevimlilar to'ldiriladi — ular ham tozalanishi kerak
    await request(app)
      .patch('/v1/profile/measurements')
      .set(customer.headers)
      .send({ height: 180, weight: 80 });

    const fixture = await createStoreFixture();
    await request(app).put(`/v1/favorites/${fixture.productId}`).set(customer.headers).send({});

    await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    await backdateRequest(customer.id, 31);
    const count = await anonymizeDueAccounts();
    expect(count).toBeGreaterThanOrEqual(1);

    const user = await pool.query<{
      phone: string;
      full_name: string | null;
      password_hash: string | null;
      is_active: boolean;
      anonymized_at: Date | null;
    }>(
      `SELECT phone, full_name, password_hash, is_active, anonymized_at
         FROM users WHERE id = $1`,
      [customer.id],
    );

    const row = user.rows[0];
    expect(row?.phone).toBe(`deleted:${customer.id}`);
    expect(row?.full_name).toBeNull();
    expect(row?.password_hash).toBeNull();
    expect(row?.is_active).toBe(false);
    expect(row?.anonymized_at).not.toBeNull();

    // Bog'liq jadvallar
    const related = await pool.query<{
      phones: string;
      favorites: string;
      devices: string;
      measurements: string;
    }>(
      `SELECT (SELECT COUNT(*) FROM verified_phones WHERE user_id = $1) AS phones,
              (SELECT COUNT(*) FROM favorites WHERE user_id = $1)       AS favorites,
              (SELECT COUNT(*) FROM devices WHERE user_id = $1)         AS devices,
              (SELECT measurements::text FROM profiles WHERE user_id = $1) AS measurements`,
      [customer.id],
    );

    expect(related.rows[0]?.phones).toBe('0');
    expect(related.rows[0]?.favorites).toBe('0');
    expect(related.rows[0]?.devices).toBe('0');
    expect(related.rows[0]?.measurements).toBe('{}');
  });

  it('buyurtma tarixi do`kon uchun saqlanadi', async () => {
    const fixture = await createStoreFixture();
    const customer = await registerCustomer();

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

    const orderId = order.body.data.id as string;

    // Buyurtma yopiladi, aks holda o'chirish rad etiladi
    await pool.query(`UPDATE orders SET status = 'completed', completed_at = now() WHERE id = $1`, [
      orderId,
    ]);

    await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    await backdateRequest(customer.id, 31);
    await anonymizeDueAccounts();

    // Bu asosiy shart: qator o'chirilsa do'konning hisob-kitobi buzilardi
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM orders WHERE id = $1`,
      [orderId],
    );
    expect(rows[0]?.count).toBe('1');
  });

  it('anonimlashtirilgan raqam bilan qayta ro`yxatdan o`tish mumkin', async () => {
    const customer = await registerCustomer();

    await request(app)
      .delete('/v1/auth/account')
      .set(customer.headers)
      .send({ password: PASSWORD, confirm: 'DELETE' });

    await backdateRequest(customer.id, 31);
    await anonymizeDueAccounts();

    const response = await request(app)
      .post('/v1/auth/register')
      .send({ phone: customer.phone, fullName: 'Yangi Mijoz', password: PASSWORD });

    expect(response.status).toBe(201);
    expect(response.body.data.user.id).not.toBe(customer.id);
  });
});
