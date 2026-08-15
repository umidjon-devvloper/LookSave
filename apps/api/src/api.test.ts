import { ERROR_CODES } from '@looksave/shared-types';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadEnv } from './config/env';
import { ApiError } from './http/api-error';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { requestId } from './http/request-id';
import { sendData } from './http/respond';
import { route } from './http/validate';

const BASE_ENV = {
  DATABASE_URL: 'postgres://looksave@localhost:5432/looksave',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
};

describe('loadEnv', () => {
  it('DATABASE_URL yo`q bo`lsa yiqiladi', () => {
    const { DATABASE_URL: _omit, ...rest } = BASE_ENV;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('JWT sirlari bir xil bo`lsa yiqiladi', () => {
    expect(() => loadEnv({ ...BASE_ENV, JWT_REFRESH_SECRET: BASE_ENV.JWT_ACCESS_SECRET })).toThrow(
      /bir xil/,
    );
  });

  it('JWT siri qisqa bo`lsa yiqiladi', () => {
    expect(() => loadEnv({ ...BASE_ENV, JWT_ACCESS_SECRET: 'qisqa' })).toThrow(/32/);
  });

  it('JWT TTL standart qiymatlari', () => {
    const env = loadEnv({ ...BASE_ENV });
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.JWT_REFRESH_TTL).toBe('30d');
  });

  it('standart qiymatlarni qo`yadi', () => {
    const env = loadEnv({ ...BASE_ENV });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_TAG).toBe('dev');
  });

  it('CORS_ORIGINS ni massivga o`giradi va bo`shlarni tashlaydi', () => {
    const env = loadEnv({ ...BASE_ENV, CORS_ORIGINS: 'https://a.uz, https://b.ae ,' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.uz', 'https://b.ae']);
  });

  it('CORS_ORIGINS ko`rsatilmasa bo`sh massiv (CORS yopiq)', () => {
    expect(loadEnv({ ...BASE_ENV }).CORS_ORIGINS).toEqual([]);
  });

  it('PORT ni raqamga o`giradi, chegaradan chiqsa yiqiladi', () => {
    expect(loadEnv({ ...BASE_ENV, PORT: '3010' }).PORT).toBe(3010);
    expect(() => loadEnv({ ...BASE_ENV, PORT: '99999' })).toThrow();
  });
});

describe('ApiError', () => {
  it('HTTP statusni kod jadvalidan oladi', () => {
    expect(ApiError.notFound().status).toBe(404);
    expect(ApiError.validation([]).status).toBe(422);
    expect(new ApiError('OUT_OF_STOCK', 'x').status).toBe(409);
    expect(new ApiError('RATE_LIMITED', 'x').status).toBe(429);
    expect(new ApiError('SERVICE_UNAVAILABLE', 'x').status).toBe(503);
  });

  it('har bir kod uchun status mavjud', () => {
    for (const [code, status] of Object.entries(ERROR_CODES)) {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
      expect(code).toBe(code.toUpperCase());
    }
  });
});

function testApp(): express.Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());

  app.get(
    '/echo',
    route(
      { query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }) },
      (input, _req, res) => {
        sendData(res, { limit: input.query.limit });
      },
    ),
  );

  app.post(
    '/order',
    route(
      {
        body: z.object({
          contactName: z.string().min(2, 'Ism kamida 2 harf bo`lishi kerak'),
          address: z.object({ lat: z.number(), lng: z.number() }),
        }),
      },
      (_input, _req, res) => {
        sendData(res, { ok: true }, 201);
      },
    ),
  );

  app.get('/boom', () => {
    throw new Error('kutilmagan xato');
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('javob qobig`i', () => {
  it('muvaffaqiyat: { data, meta.requestId }', async () => {
    const res = await request(testApp()).get('/echo');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ limit: 20 });
    expect(res.body.meta.requestId).toMatch(/^req_/);
    expect(res.headers['x-request-id']).toBe(res.body.meta.requestId);
  });

  it('kiruvchi X-Request-Id saqlanadi', async () => {
    const res = await request(testApp()).get('/echo').set('X-Request-Id', 'req_abc');
    expect(res.body.meta.requestId).toBe('req_abc');
  });

  it('noma`lum manzil → 404 NOT_FOUND', async () => {
    const res = await request(testApp()).get('/yoq');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.meta.requestId).toBeTruthy();
  });

  it('kutilmagan xato → 500 INTERNAL_ERROR, ichki tafsilot chiqmaydi', async () => {
    const res = await request(testApp()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('kutilmagan xato');
  });

  it('buzuq JSON → 400 BAD_REQUEST', async () => {
    const res = await request(testApp())
      .post('/order')
      .set('Content-Type', 'application/json')
      .send('{buzuq');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('validatsiya', () => {
  it('query chegarasi buzilsa 422 va field yo`li `query.` bilan', async () => {
    const res = await request(testApp()).get('/echo?limit=99');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields[0]).toMatchObject({
      field: 'query.limit',
      code: 'OUT_OF_RANGE',
    });
  });

  it('yetishmayotgan maydon → REQUIRED, qisqa matn → TOO_SHORT', async () => {
    const res = await request(testApp()).post('/order').send({ contactName: 'A' });
    expect(res.status).toBe(422);

    const fields = res.body.error.details.fields as Array<{ field: string; code: string }>;
    const byField = new Map(fields.map((f) => [f.field, f.code]));

    expect(byField.get('contactName')).toBe('TOO_SHORT');
    expect(byField.get('address')).toBe('REQUIRED');
  });

  it('ichma-ich maydon yo`li nuqta bilan beriladi', async () => {
    const res = await request(testApp())
      .post('/order')
      .send({ contactName: 'Aziz', address: { lat: 41.3 } });

    const fields = res.body.error.details.fields as Array<{ field: string; code: string }>;
    expect(fields.some((f) => f.field === 'address.lng' && f.code === 'REQUIRED')).toBe(true);
  });

  it('to`g`ri so`rov o`tadi', async () => {
    const res = await request(testApp())
      .post('/order')
      .send({ contactName: 'Aziz Karimov', address: { lat: 41.3, lng: 69.2 } });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ ok: true });
  });
});
