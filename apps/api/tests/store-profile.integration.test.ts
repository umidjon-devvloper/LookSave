import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../src/auth/password';
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

async function ownerHeaders(fixture: { ownerId: string; storeId: string }) {
  const phone = uniquePhone();
  await pool.query(
    `UPDATE users SET phone = $2, password_hash = $3, password_set_at = now() WHERE id = $1`,
    [fixture.ownerId, phone, await hashPassword('parol12345')],
  );
  const login = await request(app).post('/v1/auth/login').send({ phone, password: 'parol12345' });
  return {
    Authorization: `Bearer ${login.body.data.accessToken}`,
    'X-Store-Id': fixture.storeId,
  };
}

describe('do`kon sozlamalari', () => {
  it('ish vaqti o`zgarsa katalogdagi isOpen ham o`zgaradi', async () => {
    const fixture = await createStoreFixture();
    const headers = await ownerHeaders(fixture);

    // Hamma kun yopiq
    const closed = await request(app)
      .patch('/v1/store/profile')
      .set(headers)
      .send({
        workingHours: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
          day,
          open: '10:00',
          close: '20:00',
          closed: true,
        })),
      });

    expect(closed.status).toBe(200);
    expect(closed.body.data.isOpen).toBe(false);

    const nearbyClosed = await request(app).get(
      '/v1/stores/nearby?lat=41.3111&lng=69.2797&radius=5000&openNow=true',
    );
    expect(nearbyClosed.body.data.map((item: { id: string }) => item.id)).not.toContain(
      fixture.storeId,
    );

    // Sutka bo'yi ochiq
    await request(app)
      .patch('/v1/store/profile')
      .set(headers)
      .send({
        workingHours: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
          day,
          open: '00:00',
          close: '00:00',
          closed: false,
        })),
      });

    const nearbyOpen = await request(app).get(
      '/v1/stores/nearby?lat=41.3111&lng=69.2797&radius=5000&openNow=true',
    );
    expect(nearbyOpen.body.data.map((item: { id: string }) => item.id)).toContain(fixture.storeId);
  });

  it('joylashuv o`zgarsa yetkazish radiusi ham siljiydi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const headers = await ownerHeaders(fixture);

    const address = { text: 'Chilonzor 9-kvartal 24-uy', lat: 41.3111, lng: 69.2797 };

    // Do'konni Dubayga ko'chiramiz
    await request(app)
      .patch('/v1/store/profile')
      .set(headers)
      .send({ location: { lat: 25.1972, lng: 55.2796 } });

    const rejected = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'delivery',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        address,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
      });

    expect(rejected.body.error.code).toBe('OUT_OF_RANGE');

    // Toshkentga qaytaramiz
    await request(app)
      .patch('/v1/store/profile')
      .set(headers)
      .send({ location: { lat: 41.3111, lng: 69.2797 } });

    const accepted = await request(app)
      .post('/v1/orders')
      .set(customer.headers)
      .set('Idempotency-Key', idempotencyKey())
      .send({
        storeId: fixture.storeId,
        deliveryType: 'delivery',
        contactName: 'Test Mijoz',
        contactPhone: customer.phone,
        address,
        items: [{ variantId: fixture.variantId, size: 'M', qty: 1 }],
      });

    expect(accepted.status).toBe(201);
  });

  it('ikkala usulni ham o`chirib bo`lmaydi', async () => {
    const fixture = await createStoreFixture();
    const headers = await ownerHeaders(fixture);

    const response = await request(app)
      .patch('/v1/store/profile')
      .set(headers)
      .send({ deliveryEnabled: false, pickupEnabled: false });

    expect(response.status).toBe(422);
  });

  it('bir kun ikki marta ko`rsatilsa rad etiladi', async () => {
    const fixture = await createStoreFixture();
    const headers = await ownerHeaders(fixture);

    const response = await request(app)
      .patch('/v1/store/profile')
      .set(headers)
      .send({
        workingHours: [
          { day: 1, open: '09:00', close: '18:00' },
          { day: 1, open: '19:00', close: '22:00' },
        ],
      });

    expect(response.status).toBe(422);
  });

  it('tashqi rasm havolasi rad etiladi', async () => {
    const fixture = await createStoreFixture();
    const headers = await ownerHeaders(fixture);

    const response = await request(app)
      .patch('/v1/store/profile')
      .set(headers)
      .send({ logoUrl: 'https://example.com/logo.webp' });

    expect(response.status).toBe(400);
  });

  it('yetkazish narxi va bepul chegara saqlanadi', async () => {
    const fixture = await createStoreFixture();
    const headers = await ownerHeaders(fixture);

    const response = await request(app)
      .patch('/v1/store/profile')
      .set(headers)
      .send({ deliveryFee: '25000.00', freeDeliveryFrom: '500000.00', deliveryRadiusM: 8000 });

    expect(response.body.data.delivery).toMatchObject({
      fee: '25000.00',
      freeFrom: '500000.00',
      radiusM: 8000,
    });
    // Pul string bo'lib qoladi
    expect(typeof response.body.data.delivery.fee).toBe('string');
  });
});
