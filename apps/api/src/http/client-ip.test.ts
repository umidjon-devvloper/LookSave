import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CLIENT_IP_HEADER, SERVICE_KEY_HEADER, getClientIp, trustedClientIp } from './client-ip';

/**
 * S-4: mehmon IP'si BFF dan keladi (15-sayt-dizayn.md).
 *
 * Bu yerda ikki narsa tekshiriladi va ikkinchisi muhimroq:
 *   1. Kalit to'g'ri bo'lsa cheklov mehmon bo'yicha hisoblanadi;
 *   2. Kalitsiz HECH KIM o'z IP'sini ayta olmaydi — aks holda cheklov
 *      umuman ma'nosiz bo'lardi.
 */

const KEY = 'x'.repeat(44);

// `env()` modul darajasida keshlanadi — testda uni almashtiramiz
let serviceKey = KEY;
vi.mock('../config/env', () => ({
  env: () => ({ INTERNAL_SERVICE_KEY: serviceKey }),
}));
vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeApp(): Express {
  const app = express();
  // Prod bilan bir xil: Caddy — yagona ishonchli proksi
  app.set('trust proxy', 1);
  app.use(trustedClientIp);
  app.get('/who', (req, res) => {
    res.json({ ip: getClientIp(req, res) });
  });
  return app;
}

beforeEach(() => {
  serviceKey = KEY;
});

describe('trustedClientIp', () => {
  it('kalit to`g`ri bo`lsa mehmon IP`sini oladi', async () => {
    const res = await request(makeApp())
      .get('/who')
      .set(SERVICE_KEY_HEADER, KEY)
      .set(CLIENT_IP_HEADER, '203.0.113.9');

    expect(res.body.ip).toBe('203.0.113.9');
  });

  it('IPv6 ham qabul qilinadi', async () => {
    const res = await request(makeApp())
      .get('/who')
      .set(SERVICE_KEY_HEADER, KEY)
      .set(CLIENT_IP_HEADER, '2001:db8::42');

    expect(res.body.ip).toBe('2001:db8::42');
  });

  it('KALITSIZ sarlavha e`tiborsiz qoladi', async () => {
    const res = await request(makeApp()).get('/who').set(CLIENT_IP_HEADER, '203.0.113.9');

    expect(res.body.ip).not.toBe('203.0.113.9');
  });

  it('KALIT NOTO`G`RI bo`lsa sarlavha e`tiborsiz qoladi', async () => {
    const res = await request(makeApp())
      .get('/who')
      .set(SERVICE_KEY_HEADER, 'y'.repeat(44))
      .set(CLIENT_IP_HEADER, '203.0.113.9');

    expect(res.body.ip).not.toBe('203.0.113.9');
  });

  it('kalit uzunligi boshqacha bo`lsa ham yiqilmaydi (timingSafeEqual)', async () => {
    const res = await request(makeApp())
      .get('/who')
      .set(SERVICE_KEY_HEADER, 'qisqa')
      .set(CLIENT_IP_HEADER, '203.0.113.9');

    expect(res.status).toBe(200);
    expect(res.body.ip).not.toBe('203.0.113.9');
  });

  it('sozlanmagan bo`lsa (bo`sh kalit) imkoniyat o`chiq', async () => {
    serviceKey = '';
    const res = await request(makeApp())
      .get('/who')
      .set(SERVICE_KEY_HEADER, KEY)
      .set(CLIENT_IP_HEADER, '203.0.113.9');

    expect(res.body.ip).not.toBe('203.0.113.9');
  });

  it('IP bo`lmagan matn Redis kalitiga tushmaydi', async () => {
    const res = await request(makeApp())
      .get('/who')
      .set(SERVICE_KEY_HEADER, KEY)
      .set(CLIENT_IP_HEADER, 'rl:g:anon:*');

    expect(res.body.ip).not.toBe('rl:g:anon:*');
  });

  it('mehmon IP`si `X-Forwarded-For` dan USTUN turadi', async () => {
    /*
     * Prod'da Caddy XFF ni o'zi to'ldiradi va u BFF ning IP'sini
     * ko'rsatadi. Mehmon IP'si aynan shuning uchun alohida keladi.
     */
    const res = await request(makeApp())
      .get('/who')
      .set('X-Forwarded-For', '198.51.100.1')
      .set(SERVICE_KEY_HEADER, KEY)
      .set(CLIENT_IP_HEADER, '203.0.113.9');

    expect(res.body.ip).toBe('203.0.113.9');
  });
});

describe('getClientIp', () => {
  it('ishonchli IP bo`lmasa `req.ip` ga qaytadi', async () => {
    const res = await request(makeApp()).get('/who').set('X-Forwarded-For', '198.51.100.1');

    // `trust proxy 1` — XFF ning oxirgi qiymati
    expect(res.body.ip).toBe('198.51.100.1');
  });
});
