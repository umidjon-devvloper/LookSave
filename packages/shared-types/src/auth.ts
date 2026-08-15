import type { CountryCode, IsoDateTime, Locale, Uuid } from './api';

export type UserRole = 'customer' | 'store_owner' | 'admin';

export type Gender = 'male' | 'female';

/** Ilovaga qaytariladigan foydalanuvchi. `password_hash` hech qachon chiqmaydi. */
export interface AuthUser {
  id: Uuid;
  phone: string;
  fullName: string | null;
  role: UserRole;
  gender: Gender | null;
  locale: Locale;
  country: CountryCode | null;
  /** Profil surati (R2 havolasi). `null` — ilova ism bosh harflarini chizadi. */
  avatarUrl: string | null;
  createdAt: IsoDateTime;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  isNewUser: boolean;
  user: AuthUser;
}

/**
 * JWT payload (03-api-spec §2).
 * `storeIds` — `store_owner` va `staff` uchun; do'kon endpointlarida tekshiriladi.
 */
export interface AccessTokenPayload {
  sub: Uuid;
  role: UserRole;
  storeIds: Uuid[];
}
