import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../src/auth/password';
import { pool } from '../src/db/pool';
import {
  app,
  closeConnections,
  createStoreFixture,
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

describe('do`kon jamoasi', () => {
  it('xodim qo`shiladi va panelga kira oladi', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };
    const staff = await registerCustomer('Xodim');

    // Qo'shilishdan oldin kira olmaydi
    const before = await request(app)
      .get('/v1/store/dashboard')
      .set(staff.headers)
      .set('X-Store-Id', fixture.storeId);
    expect(before.status).toBe(403);

    const added = await request(app)
      .post('/v1/store/members')
      .set(headers)
      .send({ phone: staff.phone, role: 'staff' });
    expect(added.status).toBe(201);

    // Yangi token kerak: eski JWT da `role` va `storeIds` eski
    const login = await request(app)
      .post('/v1/auth/login')
      .send({ phone: staff.phone, password: 'parol12345' });

    const after = await request(app)
      .get('/v1/store/dashboard')
      .set({ Authorization: `Bearer ${login.body.data.accessToken}` })
      .set('X-Store-Id', fixture.storeId);
    expect(after.status).toBe(200);
  });

  it('ro`yxatdan o`tmagan raqam qo`shilmaydi', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);

    const response = await request(app)
      .post('/v1/store/members')
      .set({ ...owner, 'X-Store-Id': fixture.storeId })
      .send({ phone: uniquePhone(), role: 'staff' });

    expect(response.status).toBe(404);
  });

  it('bir odam ikki marta qo`shilmaydi', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };
    const staff = await registerCustomer('Xodim');

    await request(app).post('/v1/store/members').set(headers).send({ phone: staff.phone });
    const second = await request(app)
      .post('/v1/store/members')
      .set(headers)
      .send({ phone: staff.phone });

    expect(second.status).toBe(409);
  });

  it('do`kon egasini chiqarib bo`lmaydi', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };

    const members = await request(app).get('/v1/store/members').set(headers);
    const ownerMember = members.body.data.find(
      (item: { isStoreOwner: boolean }) => item.isStoreOwner,
    );

    expect(ownerMember).toBeDefined();

    const response = await request(app).delete(`/v1/store/members/${ownerMember.id}`).set(headers);

    expect(response.status).toBe(409);
  });

  it('chiqarilgan xodim panelga kira olmaydi', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };
    const staff = await registerCustomer('Xodim');

    const added = await request(app)
      .post('/v1/store/members')
      .set(headers)
      .send({ phone: staff.phone });

    const member = added.body.data.find((item: { phone: string }) => item.phone === staff.phone);

    await request(app).delete(`/v1/store/members/${member.id}`).set(headers);

    // Boshqa do'koni qolmagani uchun rol `customer` ga qaytariladi
    const role = await pool.query<{ role: string }>(`SELECT role FROM users WHERE phone = $1`, [
      staff.phone,
    ]);
    expect(role.rows[0]?.role).toBe('customer');
  });

  it('rolni o`zgartirish mumkin', async () => {
    const fixture = await createStoreFixture();
    const owner = await signInOwner(fixture.ownerId);
    const headers = { ...owner, 'X-Store-Id': fixture.storeId };
    const staff = await registerCustomer('Xodim');

    const added = await request(app)
      .post('/v1/store/members')
      .set(headers)
      .send({ phone: staff.phone, role: 'staff' });

    const member = added.body.data.find((item: { phone: string }) => item.phone === staff.phone);

    const updated = await request(app)
      .patch(`/v1/store/members/${member.id}`)
      .set(headers)
      .send({ role: 'manager' });

    expect(updated.status).toBe(200);
    const changed = updated.body.data.find((item: { phone: string }) => item.phone === staff.phone);
    expect(changed.role).toBe('manager');
  });
});
