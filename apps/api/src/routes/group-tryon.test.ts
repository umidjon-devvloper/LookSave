import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { errorHandler, notFoundHandler } from '../http/error-handler';
import { requestId } from '../http/request-id';

import { groupTryonRouter } from './group-tryon';

/**
 * Guruhli kiyintirish — sessiya yaratish TOKEN TALAB QILADI.
 *
 * ⚠️ NIMANI QO'RIQLAYDI. Marshrutda `requireAuth` yo'q edi: tokensiz yoki
 * muddati o'tgan token bilan so'rov 500 qaytarardi. Mobil mijoz faqat 401
 * da tokenni yangilaydi — 500 da esa foydalanuvchi shunchaki «xato» ko'rardi.
 * Bu so'rovlar bazaga yetib bormaydi (auth undan oldin to'xtatadi).
 */
function app(): express.Express {
  const a = express();
  a.use(requestId);
  a.use(express.json());
  a.use('/v1', groupTryonRouter);
  a.use(notFoundHandler);
  a.use(errorHandler);
  return a;
}

const BODY = { renderId: '00000000-0000-4000-8000-000000000000' };

describe('POST /v1/group-tryon', () => {
  it('tokensiz — 401, 500 emas', async () => {
    const res = await request(app()).post('/v1/group-tryon').send(BODY);
    expect(res.status).toBe(401);
  });

  it('yaroqsiz token — 401 (mijoz tokenni yangilay oladi)', async () => {
    const res = await request(app())
      .post('/v1/group-tryon')
      .set('Authorization', 'Bearer buzuq.token.qiymat')
      .send(BODY);
    expect(res.status).toBe(401);
  });
});
