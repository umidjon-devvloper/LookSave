import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../src/auth/password';
import { pool } from '../src/db/pool';
import { expireStaleOrders, remindSilentStores, updateStoreStats } from '../src/jobs/scheduler';
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

/** Admin foydalanuvchi bazada qo'lda belgilanadi — ro'yxatdan o'tib bo'lmaydi. */
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

describe('admin moderatsiyasi', () => {
  it('do`kon tasdiqlanmaguncha katalogda ko`rinmaydi', async () => {
    const fixture = await createStoreFixture();
    const admin = await signInAdmin();

    await pool.query(`UPDATE stores SET status = 'pending' WHERE id = $1`, [fixture.storeId]);

    const hidden = await request(app).get('/v1/stores/nearby?lat=41.3111&lng=69.2797&radius=5000');
    expect(hidden.body.data.map((item: { id: string }) => item.id)).not.toContain(fixture.storeId);

    const approved = await request(app)
      .post(`/v1/admin/stores/${fixture.storeId}/approve`)
      .set(admin)
      .send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('active');

    const visible = await request(app).get('/v1/stores/nearby?lat=41.3111&lng=69.2797&radius=5000');
    expect(visible.body.data.map((item: { id: string }) => item.id)).toContain(fixture.storeId);
  });

  it('faol do`konni qayta tasdiqlab bo`lmaydi', async () => {
    const fixture = await createStoreFixture();
    const admin = await signInAdmin();

    const response = await request(app)
      .post(`/v1/admin/stores/${fixture.storeId}/approve`)
      .set(admin)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE');
  });

  it('rad etish va to`xtatishda sabab majburiy', async () => {
    const fixture = await createStoreFixture();
    const admin = await signInAdmin();

    const noReason = await request(app)
      .post(`/v1/admin/stores/${fixture.storeId}/suspend`)
      .set(admin)
      .send({});
    expect(noReason.status).toBe(422);

    const withReason = await request(app)
      .post(`/v1/admin/stores/${fixture.storeId}/suspend`)
      .set(admin)
      .send({ reason: 'Manzil topilmadi' });
    expect(withReason.status).toBe(200);
  });

  it('mahsulot moderatsiyadan o`tgach katalogda paydo bo`ladi', async () => {
    const fixture = await createStoreFixture();
    const admin = await signInAdmin();

    await pool.query(`UPDATE products SET status = 'pending' WHERE id = $1`, [fixture.productId]);

    const queue = await request(app).get('/v1/admin/products/moderation?status=pending').set(admin);
    expect(queue.body.data.map((item: { id: string }) => item.id)).toContain(fixture.productId);

    await request(app).post(`/v1/admin/products/${fixture.productId}/approve`).set(admin).send({});

    const catalog = await request(app).get('/v1/products?limit=50');
    expect(catalog.body.data.map((item: { id: string }) => item.id)).toContain(fixture.productId);
  });

  it('3D nashr qilish uchun GLB va QA majburiy', async () => {
    const fixture = await createStoreFixture();
    const admin = await signInAdmin();

    const asset = await pool.query<{ id: string }>(
      `INSERT INTO assets_3d (variant_id, status, requested_at)
       VALUES ($1, 'queued', now()) RETURNING id`,
      [fixture.variantId],
    );
    const assetId = asset.rows[0]?.id ?? '';

    const noQa = await request(app)
      .patch(`/v1/admin/3d-queue/${assetId}`)
      .set(admin)
      .send({ status: 'ready', glbUrl: 'https://cdn.looksave.app/m.glb' });
    expect(noQa.status).toBe(422);

    const unchecked = await request(app)
      .patch(`/v1/admin/3d-queue/${assetId}`)
      .set(admin)
      .send({
        status: 'ready',
        glbUrl: 'https://cdn.looksave.app/m.glb',
        qaResult: {
          fpsHighEnd: 60,
          fpsMidRange: 38,
          fpsLowEnd: 27,
          loadMs: 640,
          ramMb: 42,
          checklistPassed: false,
        },
      });
    expect(unchecked.status).toBe(422);

    const published = await request(app)
      .patch(`/v1/admin/3d-queue/${assetId}`)
      .set(admin)
      .send({
        status: 'ready',
        glbUrl: 'https://cdn.looksave.app/m.glb',
        hideBodyParts: ['body_torso'],
        hasMorphs: true,
        qaResult: {
          fpsHighEnd: 60,
          fpsMidRange: 38,
          fpsLowEnd: 27,
          loadMs: 640,
          ramMb: 42,
          checklistPassed: true,
        },
      });
    expect(published.status).toBe(200);

    // 007_functions.sql dagi trigger
    const product = await pool.query<{ has_3d: boolean }>(
      `SELECT has_3d FROM products WHERE id = $1`,
      [fixture.productId],
    );
    expect(product.rows[0]?.has_3d).toBe(true);

    // Mijoz tomonida ko'rinadi
    const asset3d = await request(app).get(`/v1/variants/${fixture.variantId}/asset3d`);
    expect(asset3d.status).toBe(200);
    expect(asset3d.body.data.hideBodyParts).toEqual(['body_torso']);
  });

  it('mijoz admin endpointiga kira olmaydi', async () => {
    const customer = await registerCustomer();
    const response = await request(app).get('/v1/admin/overview').set(customer.headers);
    expect(response.status).toBe(403);
  });
});

describe('Try-On', () => {
  it('faqat tayyor 3D modellar svayp ro`yxatiga tushadi', async () => {
    const fixture = await createStoreFixture();

    const empty = await request(app).get('/v1/tryon/slot/top');
    expect(empty.body.data.map((item: { variantId: string }) => item.variantId)).not.toContain(
      fixture.variantId,
    );

    await pool.query(
      `INSERT INTO assets_3d (variant_id, status, glb_url, has_morphs)
       VALUES ($1, 'ready', 'https://cdn.looksave.app/m.glb', true)`,
      [fixture.variantId],
    );

    const ready = await request(app).get('/v1/tryon/slot/top');
    const found = ready.body.data.find(
      (item: { variantId: string }) => item.variantId === fixture.variantId,
    );

    expect(found).toBeDefined();
    expect(found.glbUrl).toBe('https://cdn.looksave.app/m.glb');
    // Pul string bo'lib qoladi
    expect(found.price).toBe('100000.00');
  });

  it('tryon event mehmondan ham qabul qilinadi va sanoqni oshiradi', async () => {
    const fixture = await createStoreFixture();

    const response = await request(app)
      .post('/v1/tryon/event')
      .send({ variantId: fixture.variantId, durationMs: 4200 });

    expect(response.status).toBe(204);

    const product = await pool.query<{ tryon_count: number }>(
      `SELECT tryon_count FROM products WHERE id = $1`,
      [fixture.productId],
    );
    expect(product.rows[0]?.tryon_count).toBe(1);
  });

  it('komplekt: bir slotda bitta mahsulot', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    const ok = await request(app)
      .post('/v1/looks')
      .set(customer.headers)
      .send({ name: 'Kechki kiyim', items: [{ slot: 'top', variantId: fixture.variantId }] });
    expect(ok.status).toBe(201);

    const duplicate = await request(app)
      .post('/v1/looks')
      .set(customer.headers)
      .send({
        items: [
          { slot: 'top', variantId: fixture.variantId },
          { slot: 'top', variantId: fixture.variantId },
        ],
      });
    expect(duplicate.status).toBe(422);

    const list = await request(app).get('/v1/looks').set(customer.headers);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].items[0].price).toBe('100000.00');
  });

  it('sevimlilar qo`shiladi va olib tashlanadi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    await request(app).put(`/v1/favorites/${fixture.productId}`).set(customer.headers).send({});

    const product = await request(app)
      .get(`/v1/products/${fixture.productId}`)
      .set(customer.headers);
    expect(product.body.data.isFavorite).toBe(true);

    await request(app).delete(`/v1/favorites/${fixture.productId}`).set(customer.headers);

    const list = await request(app).get('/v1/favorites').set(customer.headers);
    expect(list.body.data).toHaveLength(0);
  });
});

describe('profil va o`lchamlar', () => {
  it('o`lchamlar morph qiymatlariga aylanadi', async () => {
    const customer = await registerCustomer();

    const neutral = await request(app).get('/v1/profile').set(customer.headers);
    expect(neutral.body.data.morphTargets.height).toBe(0.5);

    const updated = await request(app)
      .patch('/v1/profile/measurements')
      .set(customer.headers)
      .send({ height: 195, weight: 90 });

    expect(updated.status).toBe(200);
    expect(updated.body.data.morphTargets.height).toBeGreaterThan(0.5);

    // Qisman yangilash eskisini o'chirmaydi
    const partial = await request(app)
      .patch('/v1/profile/measurements')
      .set(customer.headers)
      .send({ chest: 100 });

    expect(partial.body.data.measurements.height).toBe(195);
  });

  it('chegaradan chiqqan o`lcham rad etiladi', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .patch('/v1/profile/measurements')
      .set(customer.headers)
      .send({ height: 300 });

    expect(response.status).toBe(422);
  });

  it('avatar konfiguratsiyasi jinsga qarab boshqa model beradi', async () => {
    const customer = await registerCustomer();

    await request(app).patch('/v1/profile').set(customer.headers).send({ gender: 'female' });

    const config = await request(app).get('/v1/avatar/config').set(customer.headers);
    expect(config.body.data.bodyGlbUrl).toContain('female');
    expect(config.body.data.animations).toHaveProperty('idle');
  });

  it('asosiy raqamni o`chirib bo`lmaydi', async () => {
    const customer = await registerCustomer();

    const phones = await request(app).get('/v1/phones').set(customer.headers);
    expect(phones.body.data[0].isPrimary).toBe(true);

    const response = await request(app)
      .delete(`/v1/phones/${phones.body.data[0].id}`)
      .set(customer.headers);

    expect(response.status).toBe(409);
  });
});

describe('Telegram webhook', () => {
  const secret = process.env['TELEGRAM_WEBHOOK_SECRET'] ?? '';

  it('sirsiz so`rov rad etiladi', async () => {
    const response = await request(app).post('/v1/telegram/webhook').send({});
    expect(response.status).toBe(403);
  });

  it('noto`g`ri sir rad etiladi', async () => {
    const response = await request(app)
      .post('/v1/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', 'yolgon')
      .send({});
    expect(response.status).toBe(403);
  });

  it('tugma bosilishi buyurtma statusini o`zgartiradi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();
    const chatId = -1_001_234_567_890;

    await pool.query(`UPDATE stores SET telegram_chat_id = $2 WHERE id = $1`, [
      fixture.storeId,
      chatId,
    ]);

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

    const webhook = await request(app)
      .post('/v1/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', secret)
      .send({
        callback_query: {
          id: `cb-${Date.now()}`,
          from: { id: chatId },
          message: { message_id: 5, chat: { id: chatId } },
          data: `o:c:${orderId}`,
        },
      });

    // Telegram 5 soniya kutadi — darhol 200, ishlov keyin
    expect(webhook.status).toBe(200);

    // Ishlov fon rejimida — biroz kutamiz
    await new Promise((resolve) => setTimeout(resolve, 800));

    const status = await pool.query<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [
      orderId,
    ]);
    expect(status.rows[0]?.status).toBe('confirmed');

    const event = await pool.query<{ channel: string }>(
      `SELECT channel FROM order_events WHERE order_id = $1 AND to_status = 'confirmed'`,
      [orderId],
    );
    expect(event.rows[0]?.channel).toBe('telegram');
  });

  it('begona chatdan kelgan tugma ishlamaydi', async () => {
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
      .post('/v1/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', secret)
      .send({
        callback_query: {
          id: `cb-stranger-${Date.now()}`,
          from: { id: 999_999 },
          message: { message_id: 5, chat: { id: 999_999 } },
          data: `o:c:${order.body.data.id}`,
        },
      });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const status = await pool.query<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [
      order.body.data.id,
    ]);
    expect(status.rows[0]?.status).toBe('new');
  });
});

describe('avtomatik jarayonlar', () => {
  it('muddati o`tgan buyurtma yopiladi va rezerv qaytadi', async () => {
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
        items: [{ variantId: fixture.variantId, size: 'M', qty: 2 }],
      });

    const orderId = order.body.data.id as string;
    await pool.query(`UPDATE orders SET expires_at = now() - interval '1 hour' WHERE id = $1`, [
      orderId,
    ]);

    const closed = await expireStaleOrders();
    expect(closed).toBeGreaterThanOrEqual(1);

    const result = await pool.query<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [
      orderId,
    ]);
    expect(result.rows[0]?.status).toBe('expired');

    const stock = await pool.query<{ reserved: number }>(
      `SELECT reserved FROM variant_stock WHERE variant_id = $1`,
      [fixture.variantId],
    );
    expect(stock.rows[0]?.reserved).toBe(0);

    const events = await pool.query<{ actor_type: string; channel: string }>(
      `SELECT actor_type, channel FROM order_events
        WHERE order_id = $1 AND to_status = 'expired'`,
      [orderId],
    );
    expect(events.rows[0]).toMatchObject({ actor_type: 'system', channel: 'cron' });
  });

  it('javobsiz buyurtma uchun eslatma bir marta yuboriladi', async () => {
    const customer = await registerCustomer();
    const fixture = await createStoreFixture();

    await pool.query(`UPDATE stores SET telegram_chat_id = -100123 WHERE id = $1`, [
      fixture.storeId,
    ]);

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

    await pool.query(`UPDATE orders SET created_at = now() - interval '20 minutes' WHERE id = $1`, [
      order.body.data.id,
    ]);

    const first = await remindSilentStores();
    const second = await remindSilentStores();

    expect(first).toBeGreaterThanOrEqual(1);
    // Redis qulfi takroriy eslatmani to'xtatadi
    expect(second).toBe(0);
  });

  it('do`kon javob tezligi hisoblanadi', async () => {
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

    await pool.query(
      `UPDATE orders SET status = 'seen', seen_at = created_at + interval '10 minutes'
        WHERE id = $1`,
      [order.body.data.id],
    );

    await updateStoreStats();

    const store = await pool.query<{ avg_response_min: number | null }>(
      `SELECT avg_response_min FROM stores WHERE id = $1`,
      [fixture.storeId],
    );
    expect(store.rows[0]?.avg_response_min).toBe(10);
  });
});
