import type { AuthResult, CountryCode, Locale } from '@looksave/shared-types';
import {
  changePasswordSchema,
  deleteAccountSchema,
  loginSchema,
  localeSchema,
  refreshSchema,
  registerSchema,
  validateE164Phone,
} from '@looksave/validation';
import { Router } from 'express';
import type { Request } from 'express';

import {
  cancelDeletion,
  countOpenOrders,
  deletionState,
  ownsActiveStore,
  requestDeletion,
  scheduledDate,
} from '../auth/deletion';
import { hashPassword, verifyPassword } from '../auth/password';
import {
  consumeRefreshToken,
  issueTokens,
  revokeAllSessions,
  revokeRefreshToken,
} from '../auth/tokens';
import {
  createUser,
  findStoreIds,
  findUserById,
  findUserByPhone,
  recordLoginAttempt,
  toAuthUser,
  touchLastActive,
  updatePassword,
  upsertDevice,
  type UserRow,
} from '../auth/users';
import { ApiError } from '../http/api-error';
import { getAuth, requireAuth } from '../http/auth-middleware';
import { getClientIp } from '../http/client-ip';
import { rateLimit } from '../http/rate-limit';
import { sendData } from '../http/respond';
import { route } from '../http/validate';
import { logger } from '../logger';

export const authRouter: Router = Router();

function localeFrom(req: Request, explicit?: Locale): Locale {
  if (explicit) return explicit;
  const parsed = localeSchema.safeParse(req.get('Accept-Language')?.slice(0, 2));
  return parsed.success ? parsed.data : 'uz';
}

async function buildResult(user: UserRow, isNewUser: boolean): Promise<AuthResult> {
  const storeIds = user.role === 'customer' ? [] : await findStoreIds(user.id);
  const tokens = await issueTokens({ userId: user.id, role: user.role, storeIds });
  return { ...tokens, isNewUser, user: toAuthUser(user) };
}

async function saveDevice(
  userId: string,
  req: Request,
  device: { deviceId?: string | undefined; platform?: 'ios' | 'android' | 'web' | undefined },
): Promise<void> {
  if (!device.deviceId || !device.platform) return;
  try {
    await upsertDevice({
      userId,
      deviceId: device.deviceId,
      platform: device.platform,
      appVersion: req.get('X-App-Version') ?? null,
    });
  } catch (err) {
    // Qurilma yozilmasa ham kirish ishlashi kerak — push keyin ulanadi
    logger.warn({ err, userId }, 'qurilma saqlanmadi');
  }
}

/**
 * POST /v1/auth/register
 *
 * ⚠️ Faza 1: OTP YO'Q (mijoz qarori). Telefon raqami haqiqiyligi
 * TEKSHIRILMAYDI — faqat format va operator kodi. Batafsil izoh:
 * infra/migrations/009_auth.sql va docs/00-README.md K-15.
 */
authRouter.post(
  '/register',
  rateLimit({
    windowSec: 3600,
    max: 5,
    prefix: 'auth:register',
    message: 'Bir soatda 5 martadan ko`p ro`yxatdan o`tib bo`lmaydi',
  }),
  route({ body: registerSchema }, async (input, req, res) => {
    const { phone, fullName, password, locale } = input.body;

    const parsedPhone = validateE164Phone(phone);
    if (!parsedPhone.ok) {
      throw new ApiError('INVALID_PHONE', 'Telefon raqami noto`g`ri');
    }

    const existing = await findUserByPhone(parsedPhone.e164);
    if (existing) {
      throw new ApiError('ALREADY_EXISTS', 'Bu raqam bilan akkaunt mavjud. Kiring.');
    }

    const passwordHash = await hashPassword(password);

    let user: UserRow;
    try {
      user = await createUser({
        phone: parsedPhone.e164,
        fullName,
        passwordHash,
        country: parsedPhone.country as CountryCode,
        locale: localeFrom(req, locale),
      });
    } catch (err) {
      // Parallel so'rovda unique buzilishi mumkin (23505)
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
        throw new ApiError('ALREADY_EXISTS', 'Bu raqam bilan akkaunt mavjud. Kiring.');
      }
      throw err;
    }

    await saveDevice(user.id, req, input.body);
    sendData(res, await buildResult(user, true), 201);
  }),
);

/**
 * POST /v1/auth/login
 *
 * Xato javob raqam mavjudligini oshkor qilmaydi — "telefon yoki parol
 * noto'g'ri" ikkala holatda bir xil. Aks holda raqamlarni sanab chiqish mumkin.
 */
authRouter.post(
  '/login',
  rateLimit({
    windowSec: 900,
    max: 10,
    prefix: 'auth:login:ip',
    message: 'Juda ko`p urinish. 15 daqiqadan keyin qayta urinib ko`ring.',
  }),
  rateLimit({
    windowSec: 900,
    max: 5,
    prefix: 'auth:login:phone',
    key: (req) => {
      const body: unknown = req.body;
      if (typeof body === 'object' && body !== null && 'phone' in body) {
        const phone = (body as { phone: unknown }).phone;
        if (typeof phone === 'string') return phone;
      }
      return 'unknown';
    },
    message: 'Bu raqam uchun urinishlar tugadi. 15 daqiqadan keyin urinib ko`ring.',
  }),
  route({ body: loginSchema }, async (input, req, res) => {
    const { phone, password } = input.body;
    // Veb-saytdan kelgan urinishda `req.ip` — veb-serverniki. Audit
    // yozuvida mehmonning o'z IP'si turishi kerak (`http/client-ip.ts`).
    const ip = getClientIp(req, res);
    const userAgent = req.get('User-Agent') ?? null;

    const user = await findUserByPhone(phone);
    const ok = user?.password_hash
      ? await verifyPassword(password, user.password_hash)
      : // Vaqt hujumini qiyinlashtirish uchun raqam topilmasa ham hash hisoblanadi
        await verifyPassword(password, 'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');

    await recordLoginAttempt({ phone, ip, success: ok && user !== null, userAgent });

    if (!user || !ok) {
      throw ApiError.unauthorized('Telefon raqami yoki parol noto`g`ri');
    }

    if (!user.is_active) {
      throw new ApiError('BLOCKED', 'Akkaunt bloklangan');
    }

    await saveDevice(user.id, req, input.body);
    await touchLastActive(user.id);

    // Foydalanuvchi qaytdi — o'chirish so'rovi bekor bo'ladi (Apple
    // tavsiyasi: 30 kun ichida akkauntni tiklash yo'li bo'lsin).
    // Anonimlashtirilgan akkauntda `is_active = false`, u yuqorida
    // to'xtatilgan, shuning uchun bu yerga faqat kutayotganlar keladi.
    if (await cancelDeletion(user.id)) {
      logger.info({ userId: user.id }, 'o`chirish so`rovi kirish bilan bekor qilindi');
    }

    sendData(res, await buildResult(user, false));
  }),
);

/** POST /v1/auth/refresh — token rotatsiya qilinadi, eskisi darhol bekor bo'ladi. */
authRouter.post(
  '/refresh',
  rateLimit({ windowSec: 60, max: 30, prefix: 'auth:refresh' }),
  route({ body: refreshSchema }, async (input, _req, res) => {
    const { userId } = await consumeRefreshToken(input.body.refreshToken);

    const user = await findUserById(userId);
    if (!user || !user.is_active) {
      await revokeAllSessions(userId);
      throw new ApiError('TOKEN_INVALID', 'Qayta kirish talab qilinadi');
    }

    const storeIds = user.role === 'customer' ? [] : await findStoreIds(user.id);
    const tokens = await issueTokens({ userId: user.id, role: user.role, storeIds });
    sendData(res, tokens);
  }),
);

/** POST /v1/auth/logout — shu sessiyani bekor qiladi. */
authRouter.post(
  '/logout',
  route({ body: refreshSchema }, async (input, _req, res) => {
    await revokeRefreshToken(input.body.refreshToken);
    sendData(res, { loggedOut: true });
  }),
);

/** POST /v1/auth/logout-all — barcha qurilmalardan chiqish. */
authRouter.post('/logout-all', requireAuth, async (_req, res) => {
  await revokeAllSessions(getAuth(res).sub);
  sendData(res, { loggedOut: true });
});

/** POST /v1/auth/change-password — barcha sessiyalar bekor qilinadi. */
authRouter.post(
  '/change-password',
  requireAuth,
  rateLimit({ windowSec: 3600, max: 5, prefix: 'auth:chpwd' }),
  route({ body: changePasswordSchema }, async (input, _req, res) => {
    const auth = getAuth(res);
    const user = await findUserById(auth.sub);

    if (!user?.password_hash) {
      throw ApiError.unauthorized('Parol o`rnatilmagan');
    }

    const ok = await verifyPassword(input.body.currentPassword, user.password_hash);
    if (!ok) {
      throw ApiError.unauthorized('Joriy parol noto`g`ri');
    }

    await updatePassword(user.id, await hashPassword(input.body.newPassword));
    // Parol o'zgarganda barcha eski sessiyalar yopiladi — o'g'irlangan
    // token bo'lsa, shu yerda kesiladi.
    await revokeAllSessions(user.id);

    const storeIds = user.role === 'customer' ? [] : await findStoreIds(user.id);
    sendData(res, await issueTokens({ userId: user.id, role: user.role, storeIds }));
  }),
);

/**
 * DELETE /v1/auth/account — akkauntni o'chirish (App Store talabi).
 *
 * Parol tasdiqlanadi: bu qaytarib bo'lmaydigan amal va o'g'irlangan
 * qurilmada bir bosishda bajarilmasligi kerak.
 *
 * Darhol o'chirilmaydi — 30 kun kutiladi (03-api-spec §5). Shu davrda
 * qayta kirish so'rovni bekor qiladi.
 */
authRouter.delete(
  '/account',
  requireAuth,
  rateLimit({ windowSec: 3600, max: 5, prefix: 'auth:del' }),
  route({ body: deleteAccountSchema }, async (input, _req, res) => {
    const auth = getAuth(res);
    const user = await findUserById(auth.sub);

    if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');

    if (!user.password_hash) {
      throw ApiError.unauthorized('Parol o`rnatilmagan');
    }

    const ok = await verifyPassword(input.body.password, user.password_hash);
    if (!ok) {
      throw ApiError.unauthorized('Parol noto`g`ri');
    }

    // Ochiq buyurtma — do'kon oldidagi majburiyat (deletion.ts dagi izoh)
    const openOrders = await countOpenOrders(user.id);
    if (openOrders > 0) {
      throw new ApiError(
        'INVALID_STATE',
        `Sizda ${openOrders} ta yakunlanmagan buyurtma bor. Avval ularni yakunlang yoki bekor qiling.`,
      );
    }

    if (await ownsActiveStore(user.id)) {
      throw new ApiError(
        'INVALID_STATE',
        'Do`kon egasi akkauntni o`chira olmaydi. Avval qo`llab-quvvatlashga murojaat qilib do`konni yoping.',
      );
    }

    const requestedAt = await requestDeletion(user.id);

    // Barcha qurilmalardan chiqariladi: akkaunt o'chirilyapti, sessiya
    // ochiq qolishi mantiqsiz
    await revokeAllSessions(user.id);

    logger.info({ userId: user.id }, 'akkaunt o`chirish so`raldi');

    sendData(res, {
      deletionRequestedAt: requestedAt.toISOString(),
      scheduledFor: scheduledDate(requestedAt).toISOString(),
    });
  }),
);

/** GET /v1/auth/account/deletion — holat (ilova profil ekranida ko'rsatadi). */
authRouter.get('/account/deletion', requireAuth, async (_req, res) => {
  const state = await deletionState(getAuth(res).sub);

  sendData(res, {
    pending: state.requestedAt !== null && state.anonymizedAt === null,
    requestedAt: state.requestedAt?.toISOString() ?? null,
    scheduledFor: state.scheduledFor?.toISOString() ?? null,
  });
});

/** POST /v1/auth/account/restore — 30 kun ichida bekor qilish. */
authRouter.post('/account/restore', requireAuth, async (_req, res) => {
  const restored = await cancelDeletion(getAuth(res).sub);

  if (!restored) {
    throw new ApiError('INVALID_STATE', 'O`chirish so`rovi topilmadi');
  }

  sendData(res, { restored: true });
});
