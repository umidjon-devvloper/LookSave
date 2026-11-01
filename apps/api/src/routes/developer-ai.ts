import {
  developerAiPresignSchema,
  dressResultSchema,
  idParamSchema,
  taskFailSchema,
  taskQuerySchema,
  taskResultSchema,
  variantParamSchema,
} from '@looksave/validation';
import { Router } from 'express';

import { listDressBoard, submitDress } from '../developer-ai/dress';
import {
  claimTask,
  completeTask,
  failTask,
  heartbeatTask,
  listTasks,
  releaseTask,
  taskCustomer,
} from '../developer-ai/tasks';
import { presignUpload } from '../integrations/r2';
import { getAuth, requireAuth, requireRole } from '../http/auth-middleware';
import { sendData } from '../http/respond';
import { route } from '../http/validate';

/**
 * `developer_ai` paneli — operator navbati.
 *
 * ⚠️ HOZIRCHA `admin` ROLI ISHLATILADI. Alohida `operator` roli
 * mantiqiyroq bo'lardi, lekin u JWT, migratsiya va kirish oqimiga
 * tegadi. Panel ichki bo'lgani uchun buni keyinga qoldirdim — rol
 * qo'shilganda faqat shu qator o'zgaradi.
 */
export const developerAiRouter: Router = Router();

developerAiRouter.use('/developer-ai', requireAuth, requireRole('admin'));

/** GET /v1/developer-ai/tasks?status=open — navbat */
developerAiRouter.get(
  '/developer-ai/tasks',
  route({ query: taskQuerySchema }, async (input, _req, res) => {
    sendData(res, await listTasks(input.query.status, input.query.limit));
  }),
);

/**
 * POST /v1/developer-ai/tasks/:id/claim — ishni band qilish.
 *
 * Ikki operator bir vaqtda bossa faqat bittasi oladi, ikkinchisiga
 * `ALREADY_EXISTS` qaytadi (shart `UPDATE` ning ichida).
 */
developerAiRouter.post(
  '/developer-ai/tasks/:id/claim',
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await claimTask(input.params.id, getAuth(res).sub));
  }),
);

/**
 * POST /v1/developer-ai/tasks/:id/heartbeat — «men hali ishlayapman».
 *
 * ⚠️ BIR NECHTA KENGAYTMA BITTA NAVBATDAN ISHLAYDI. Biri qotib qolsa
 * yoki brauzeri yopilsa, ish uning nomida abadiy qolardi. Tirik belgisi
 * yangilanmay qolgach, supuruvchi uni navbatga qaytaradi va ikkinchi
 * kengaytma davom ettiradi.
 */
developerAiRouter.post(
  '/developer-ai/tasks/:id/heartbeat',
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await heartbeatTask(input.params.id, getAuth(res).sub));
  }),
);

/** POST /v1/developer-ai/tasks/:id/result — natijani topshirish */
developerAiRouter.post(
  '/developer-ai/tasks/:id/result',
  route({ params: idParamSchema, body: taskResultSchema }, async (input, _req, res) => {
    sendData(res, await completeTask(input.params.id, getAuth(res).sub, input.body.resultUrl));
  }),
);

/** POST /v1/developer-ai/tasks/:id/fail — bajara olmadim */
developerAiRouter.post(
  '/developer-ai/tasks/:id/fail',
  route({ params: idParamSchema, body: taskFailSchema }, async (input, _req, res) => {
    sendData(res, await failTask(input.params.id, getAuth(res).sub, input.body.reason));
  }),
);

/**
 * POST /v1/developer-ai/tasks/:id/release — ishni navbatga qaytarish.
 * Operator ketib qolsa yoki xato band qilgan bo'lsa.
 */
developerAiRouter.post(
  '/developer-ai/tasks/:id/release',
  route({ params: idParamSchema }, async (input, _req, res) => {
    sendData(res, await releaseTask(input.params.id, getAuth(res).sub));
  }),
);

/**
 * POST /v1/developer-ai/uploads/presign — natija suratini yuklash.
 *
 * Operator suratni avval shu yerdan olgan manzilga yuklaydi, keyin
 * `publicUrl` ni `/result` ga beradi. Tashqi havola `/result` da rad
 * etiladi (`isOwnCdnUrl`).
 */
developerAiRouter.post(
  '/developer-ai/uploads/presign',
  route({ body: developerAiPresignSchema }, async (input, _req, res) => {
    sendData(res, await presignUpload(input.body));
  }),
);

/**
 * GET /v1/developer-ai/tasks/:id/garments — shu avatarga kiydiriladigan
 * do'kon kiyimlari (grid). Operator har birini yuklaydi.
 */
developerAiRouter.get(
  '/developer-ai/tasks/:id/garments',
  route({ params: idParamSchema }, async (input, _req, res) => {
    const { userId, storeId } = await taskCustomer(input.params.id);
    sendData(res, await listDressBoard(userId, storeId));
  }),
);

/**
 * POST /v1/developer-ai/tasks/:id/garments/:variantId — bitta kiyim
 * kiydirildi. Natija mijozning renderiga yoziladi.
 */
developerAiRouter.post(
  '/developer-ai/tasks/:id/garments/:variantId',
  route({ params: variantParamSchema, body: dressResultSchema }, async (input, _req, res) => {
    const { userId } = await taskCustomer(input.params.id);
    sendData(res, await submitDress(userId, input.params.variantId, input.body.resultUrl));
  }),
);
