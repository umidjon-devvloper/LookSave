import type { AuthUser } from '@looksave/shared-types';
import { create } from 'zustand';

import { ApiError, clearTokens, getRefreshToken } from '../api/client';
import { getProfile, login as apiLogin, register as apiRegister } from '../api/endpoints';

type Status = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  restore: () => Promise<void>;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (input: { phone: string; fullName: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Profil tahrirlangach chaqiriladi. Ism va surat ko'p ekranda shu
   * store'dan o'qiladi — yangilanmasa eski ism qolib ketardi.
   */
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  /**
   * Ilova ochilganda chaqiriladi. Refresh token bo'lsa profil olinadi —
   * `api()` o'zi access token'ni yangilaydi.
   *
   * ⚠️ HAR XATO USHLANADI — ILOVA "ochilmayapti" BO'LMASIN
   * (Google Play 2026-11-03 policy xati). SecureStore ba'zi OEM
   * qurilmalarda (eski Xiaomi/Huawei) va emulyatorda xato tashlaydi:
   * ushlanmasa, `restore` yiqilib, status 'loading' da qotib qolardi va
   * splash to'xtab qolardi. Endi har holatda statusga qiymat yoziladi.
   */
  restore: async () => {
    let refreshToken: string | null = null;
    try {
      refreshToken = await getRefreshToken();
    } catch (err) {
      console.warn('[auth] refresh token o`qilmadi', err);
    }

    if (!refreshToken) {
      set({ status: 'signedOut', user: null });
      return;
    }

    try {
      const user = await getProfile();
      set({ status: 'signedIn', user });
    } catch (err) {
      /*
       * ⚠️ FAQAT HAQIQIY AUTH XATOLARIDA CHIQARAMIZ (2026-11-04).
       *
       * Ilgari har xato (tarmoq uzilishi, server timeouti, 500) ham
       * foydalanuvchini `signedOut` qilib qo'yardi — ilovaga qaytganida
       * yana login so'rardi. Natija: internet zaif bo'lsa, foydalanuvchi
       * "ilova o'zi chiqarib yuboryapti" deb shikoyat qilardi.
       *
       * Endi faqat 401/403 (yaroqsiz yoki muddati o'tgan token) yoki
       * aniq auth kodlari signedOut qiladi. Boshqa xatolarda: foydalanuvchini
       * signedIn qolidradik, user ma'lumoti keyinroq (tarmoq tiklanganda)
       * yangilanadi. Token yaroqsiz bo'lsa client o'zi refresh qilgan va
       * endi muvaffaqiyatsiz bo'lsa — tokenlar tozalangan.
       */
      if (
        err instanceof ApiError &&
        (err.status === 401 ||
          err.status === 403 ||
          err.code === 'UNAUTHORIZED' ||
          err.code === 'TOKEN_EXPIRED' ||
          err.code === 'TOKEN_INVALID')
      ) {
        set({ status: 'signedOut', user: null });
      } else {
        // Tarmoq/server xatosi — token saqlanadi, user keyinroq yangilanadi
        set({ status: 'signedIn', user: null });
      }
    }
  },

  signIn: async (phone, password) => {
    const user = await apiLogin(phone, password);
    set({ status: 'signedIn', user });
  },

  signUp: async (input) => {
    const user = await apiRegister(input);
    set({ status: 'signedIn', user });
  },

  signOut: async () => {
    await clearTokens();
    set({ status: 'signedOut', user: null });
  },

  setUser: (user) => set({ user }),
}));
