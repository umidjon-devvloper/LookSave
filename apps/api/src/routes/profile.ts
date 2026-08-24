import {
  profilePresignSchema,
  deviceRegisterSchema,
  idParamSchema,
  measurementsSchema,
  updateProfileSchema,
} from '@looksave/validation';
import { Router } from 'express';

import { claimPushToken, findUserById, toAuthUser, upsertDevice } from '../auth/users';
import { ApiError } from '../http/api-error';
import { getAuth, requireAuth } from '../http/auth-middleware';
import { rateLimit } from '../http/rate-limit';
import {
  deletePhone,
  getAvatarConfig,
  getProfileExtras,
  listPhones,
  updateMeasurements,
  updateProfile,
} from '../profile/profile';
import { presignUpload } from '../integrations/r2';
import { sendData, sendNoContent } from '../http/respond';
import { route } from '../http/validate';

export const profileRouter: Router = Router();

/** GET /v1/profile — token ishlayotganini tekshirish uchun ham xizmat qiladi. */
profileRouter.get('/profile', requireAuth, async (_req, res) => {
  const userId = getAuth(res).sub;
  const user = await findUserById(userId);
  if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');

  sendData(res, { ...toAuthUser(user), ...(await getProfileExtras(userId)) });
});

/** PATCH /v1/profile */
profileRouter.patch(
  '/profile',
  requireAuth,
  route({ body: updateProfileSchema }, async (input, _req, res) => {
    const userId = getAuth(res).sub;
    await updateProfile(userId, input.body);

    const user = await findUserById(userId);
    if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');
    sendData(res, { ...toAuthUser(user), ...(await getProfileExtras(userId)) });
  }),
);

/**
 * PATCH /v1/profile/measurements
 * `morphTargets` serverda hisoblanadi — model o'zgarsa ilovani
 * yangilash shart emas (03-api-spec §6).
 */
profileRouter.patch(
  '/profile/measurements',
  requireAuth,
  route({ body: measurementsSchema }, async (input, _req, res) => {
    sendData(res, await updateMeasurements(getAuth(res).sub, input.body));
  }),
);

/** GET /v1/avatar/config — Try-On ekrani ochilganda birinchi chaqiriladi. */
profileRouter.get('/avatar/config', requireAuth, async (req, res) => {
  sendData(
    res,
    await getAvatarConfig(
      getAuth(res).sub,
      req.get('X-Device-Model') ?? null,
      req.get('X-Platform') ?? null,
    ),
  );
});

/** GET /v1/phones */
profileRouter.get('/phones', requireAuth, async (_req, res) => {
  sendData(res, await listPhones(getAuth(res).sub));
});

/** DELETE /v1/phones/:id — asosiy raqamni o'chirib bo'lmaydi. */
profileRouter.delete(
  '/phones/:id',
  requireAuth,
  route({ params: idParamSchema }, async (input, _req, res) => {
    await deletePhone(getAuth(res).sub, input.params.id);
    sendNoContent(res);
  }),
);

/**
 * POST /v1/devices — qurilmani ro'yxatga olish va push tokenini saqlash.
 * Ilova har ochilganda chaqiradi: token vaqti-vaqti bilan yangilanadi.
 */
profileRouter.post(
  '/devices',
  requireAuth,
  route({ body: deviceRegisterSchema }, async (input, _req, res) => {
    const userId = getAuth(res).sub;
    const pushToken = input.body.pushToken ?? null;

    if (pushToken) await claimPushToken(userId, pushToken);

    await upsertDevice({
      userId,
      deviceId: input.body.deviceId,
      platform: input.body.platform,
      appVersion: input.body.appVersion ?? null,
      pushToken,
    });

    sendData(res, { registered: true });
  }),
);

/**
 * POST /v1/profile/uploads/presign
 *
 * Profil surati ham do'kon rasmlari kabi to'g'ridan-to'g'ri R2 ga yuklanadi —
 * server kanalini band qilmaydi (09-integrations §4.2). Do'kon marshrutidan
 * farqi: bu yerda `store_owner` roli talab qilinmaydi, har qanday
 * foydalanuvchi o'z suratini yuklay oladi.
 */
profileRouter.post(
  '/profile/uploads/presign',
  requireAuth,
  rateLimit({ windowSec: 60, max: 20, prefix: 'profile:presign' }),
  route({ body: profilePresignSchema }, async (input, _req, res) => {
    // Maqsad mijozdan keladi, lekin sxema uni shaxsiy to'plam bilan
    // cheklaydi — `product`/`store` bu marshrutdan o'tmaydi
    sendData(res, await presignUpload(input.body));
  }),
);
