import { randomUUID } from 'node:crypto';

import type { AccessTokenPayload, TokenPair, UserRole, Uuid } from '@looksave/shared-types';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

import { env } from '../config/env';
import { redis } from '../db/redis';
import { ApiError } from '../http/api-error';

const ISSUER = 'looksave';
const AUDIENCE = 'looksave-app';

function secret(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** `15m`, `30d`, `900s` → soniya. */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) throw new Error(`TTL formati noto'g'ri: ${ttl}`);

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86_400;
  return amount * multiplier;
}

interface RefreshClaims extends JWTPayload {
  jti: string;
  sub: string;
}

const refreshKey = (jti: string): string => `refresh:${jti}`;
const userSessionsKey = (userId: string): string => `refresh:user:${userId}`;

export interface IssueInput {
  userId: Uuid;
  role: UserRole;
  storeIds: Uuid[];
}

export async function issueTokens(input: IssueInput): Promise<TokenPair> {
  const accessTtl = ttlToSeconds(env().JWT_ACCESS_TTL);
  const refreshTtl = ttlToSeconds(env().JWT_REFRESH_TTL);
  const jti = randomUUID();

  const accessToken = await new SignJWT({ role: input.role, storeIds: input.storeIds })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${accessTtl}s`)
    .sign(secret(env().JWT_ACCESS_SECRET));

  const refreshToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${refreshTtl}s`)
    .sign(secret(env().JWT_REFRESH_SECRET));

  // Sessiya Redis'da: jti → userId. Token bekor qilinsa kalit o'chadi.
  await redis
    .multi()
    .set(refreshKey(jti), input.userId, 'EX', refreshTtl)
    .sadd(userSessionsKey(input.userId), jti)
    .expire(userSessionsKey(input.userId), refreshTtl)
    .exec();

  return { accessToken, refreshToken };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret(env().JWT_ACCESS_SECRET), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const sub = payload.sub;
    const role = payload['role'];
    const storeIds = payload['storeIds'];

    if (typeof sub !== 'string' || typeof role !== 'string') {
      throw new ApiError('TOKEN_INVALID', 'Token buzilgan');
    }

    return {
      sub,
      role: role as UserRole,
      storeIds: Array.isArray(storeIds) ? (storeIds as Uuid[]) : [],
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // jose muddati tugagan token uchun alohida kod beradi — ilova refresh qiladi
    const code =
      err instanceof Error && err.name === 'JWTExpired' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    throw new ApiError(code, code === 'TOKEN_EXPIRED' ? 'Token muddati tugadi' : 'Token yaroqsiz');
  }
}

/**
 * Refresh rotatsiyasi. Eski token darhol bekor bo'ladi.
 *
 * O'g'irlangan token qayta ishlatilsa (jti Redis'da yo'q, lekin imzo to'g'ri) —
 * shu foydalanuvchining BARCHA sessiyalari bekor qilinadi (03-api-spec §5).
 */
export async function consumeRefreshToken(token: string): Promise<{ userId: string }> {
  let claims: RefreshClaims;

  try {
    const { payload } = await jwtVerify(token, secret(env().JWT_REFRESH_SECRET), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.jti !== 'string' || typeof payload.sub !== 'string') {
      throw new ApiError('TOKEN_INVALID', 'Token buzilgan');
    }
    claims = payload as RefreshClaims;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('TOKEN_INVALID', 'Qayta kirish talab qilinadi');
  }

  // Atomik: kalit bor bo'lsa o'chiriladi va eski qiymat qaytadi
  const storedUserId = await redis.getdel(refreshKey(claims.jti));

  if (storedUserId === null) {
    await revokeAllSessions(claims.sub);
    throw new ApiError('TOKEN_INVALID', 'Sessiya bekor qilindi, qaytadan kiring');
  }

  await redis.srem(userSessionsKey(claims.sub), claims.jti);
  return { userId: storedUserId };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const { payload } = await jwtVerify(token, secret(env().JWT_REFRESH_SECRET), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.jti === 'string' && typeof payload.sub === 'string') {
      await redis.del(refreshKey(payload.jti));
      await redis.srem(userSessionsKey(payload.sub), payload.jti);
    }
  } catch {
    // Yaroqsiz token bilan chiqish ham muvaffaqiyatli hisoblanadi —
    // ilova baribir lokal tokenlarni o'chiradi.
  }
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const jtis = await redis.smembers(userSessionsKey(userId));
  const pipeline = redis.multi();
  for (const jti of jtis) pipeline.del(refreshKey(jti));
  pipeline.del(userSessionsKey(userId));
  await pipeline.exec();
}
