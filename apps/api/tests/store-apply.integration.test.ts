import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { pool } from '../src/db/pool';
import { app, closeConnections, registerCustomer, request, resetRateLimits } from './helpers';

afterAll(closeConnections);
beforeEach(resetRateLimits);

const APPLICATION = {
  name: 'Chilonzor Fashion',
  phone: '+998901234567',
  address: 'Chilonzor 19, 5-uy',
  city: 'Toshkent',
  country: 'UZ' as const,
  location: { lat: 41.311081, lng: 69.279737 },
  currency: 'UZS' as const,
  deliveryEnabled: true,
  pickupEnabled: true,
};

describe('do`kon arizasi', () => {
  it('ariza do`kon, egalik va rolni bir vaqtda yaratadi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .post('/v1/stores/apply')
      .set(customer.headers)
      .send(APPLICATION);

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('pending');

    const storeId = response.body.data.id as string;

    const { rows } = await pool.query<{
      status: string;
      owner_id: string;
      role: string;
      user_role: string;
      lat: number;
    }>(
      `SELECT s.status, s.owner_id, m.role, u.role AS user_role,
              ST_Y(s.location::geometry) AS lat
         FROM stores s
         JOIN store_members m ON m.store_id = s.id AND m.user_id = s.owner_id
         JOIN users u ON u.id = s.owner_id
        WHERE s.id = $1`,
      [storeId],
    );

    const row = rows[0];
    expect(row?.status).toBe('pending');
    expect(row?.owner_id).toBe(customer.id);
    expect(row?.role).toBe('owner');
    // Rol ko'tarilmasa panelga kira olmaydi
    expect(row?.user_role).toBe('store_owner');
    expect(Number(row?.lat)).toBeCloseTo(41.311081, 5);
  });

  it('slug nomdan yasaladi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .post('/v1/stores/apply')
      .set(customer.headers)
      .send({ ...APPLICATION, name: 'Chilonzor Fashion' });

    expect(response.body.data.slug).toMatch(/^chilonzor-fashion(-\d+)?$/);
  });

  it('band slug takrorlanmaydi', async () => {
    const first = await registerCustomer();
    const second = await registerCustomer();
    const name = `Moda ${Date.now()}`;

    const one = await request(app)
      .post('/v1/stores/apply')
      .set(first.headers)
      .send({ ...APPLICATION, name });

    const two = await request(app)
      .post('/v1/stores/apply')
      .set(second.headers)
      .send({ ...APPLICATION, name });

    expect(two.status).toBe(201);
    expect(two.body.data.slug).not.toBe(one.body.data.slug as string);
  });

  it('kirill nom lotin slug beradi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .post('/v1/stores/apply')
      .set(customer.headers)
      .send({ ...APPLICATION, name: 'Мода Ташкент' });

    expect(response.body.data.slug).toMatch(/^moda-tashkent(-\d+)?$/);
  });

  it('lotin harfi chiqmasa zaxira slug ishlatiladi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .post('/v1/stores/apply')
      .set(customer.headers)
      .send({ ...APPLICATION, name: 'متجر الأزياء' });

    expect(response.status).toBe(201);
    expect(response.body.data.slug).toMatch(/^store-[a-z0-9]{6}$/);
  });

  it('ikkinchi ariza rad etiladi', async () => {
    const customer = await registerCustomer();

    await request(app).post('/v1/stores/apply').set(customer.headers).send(APPLICATION);

    const second = await request(app)
      .post('/v1/stores/apply')
      .set(customer.headers)
      .send({ ...APPLICATION, name: 'Ikkinchi do`kon' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_EXISTS');
  });

  it('rad etilgan ariza yangilanadi, yangi qator yaratilmaydi', async () => {
    const customer = await registerCustomer();

    const first = await request(app)
      .post('/v1/stores/apply')
      .set(customer.headers)
      .send(APPLICATION);
    const storeId = first.body.data.id as string;

    await pool.query(
      `UPDATE stores SET status = 'rejected', reject_reason = 'Manzil noaniq' WHERE id = $1`,
      [storeId],
    );

    const retry = await request(app)
      .post('/v1/stores/apply')
      .set(customer.headers)
      .send({ ...APPLICATION, address: 'Chilonzor 19, 5-uy, 2-qavat' });

    expect(retry.status).toBe(201);
    expect(retry.body.data.id).toBe(storeId);
    expect(retry.body.data.status).toBe('pending');

    const { rows } = await pool.query<{ count: string; reason: string | null }>(
      `SELECT COUNT(*) AS count,
              MAX(reject_reason) AS reason
         FROM stores WHERE owner_id = $1`,
      [customer.id],
    );
    expect(rows[0]?.count).toBe('1');
    // Qayta yuborilganda sabab tozalanadi
    expect(rows[0]?.reason).toBeNull();
  });

  it('pending do`kon katalogda ko`rinmaydi', async () => {
    const customer = await registerCustomer();

    await request(app).post('/v1/stores/apply').set(customer.headers).send(APPLICATION);

    const nearby = await request(app)
      .get('/v1/stores/nearby')
      .query({ lat: 41.311081, lng: 69.279737, radius: 5000 });

    const names = (nearby.body.data as Array<{ name: string }>).map((store) => store.name);
    expect(names).not.toContain(APPLICATION.name);
  });

  it('holat endpointi arizani qaytaradi', async () => {
    const customer = await registerCustomer();

    const before = await request(app).get('/v1/stores/my-application').set(customer.headers);
    expect(before.body.data.exists).toBe(false);

    await request(app).post('/v1/stores/apply').set(customer.headers).send(APPLICATION);

    const after = await request(app).get('/v1/stores/my-application').set(customer.headers);
    expect(after.body.data.exists).toBe(true);
    expect(after.body.data.status).toBe('pending');
  });

  it('`my-application` `:id` marshrutiga tushib ketmaydi', async () => {
    const customer = await registerCustomer();

    // Tartib buzilsa bu so'rov UUID validatsiyasida 422 bo'lardi
    const response = await request(app).get('/v1/stores/my-application').set(customer.headers);
    expect(response.status).toBe(200);
  });

  it('avtorizatsiyasiz ariza qabul qilinmaydi', async () => {
    const response = await request(app).post('/v1/stores/apply').send(APPLICATION);
    expect(response.status).toBe(401);
  });

  it('koordinata chegaradan chiqsa rad etiladi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .post('/v1/stores/apply')
      .set(customer.headers)
      .send({ ...APPLICATION, location: { lat: 91, lng: 69 } });

    expect(response.status).toBe(422);
  });
});
