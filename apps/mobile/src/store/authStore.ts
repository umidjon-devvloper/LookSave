import type { AuthUser } from '@looksave/shared-types';
import { create } from 'zustand';

import { clearTokens, getRefreshToken } from '../api/client';
import { getProfile, login as apiLogin, register as apiRegister } from '../api/endpoints';

type Status = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  restore: () => Promise<void>;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (input: { phone: string; fullName: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  /**
   * Ilova ochilganda chaqiriladi. Refresh token bo'lsa profil olinadi —
   * `api()` o'zi access token'ni yangilaydi.
   */
  restore: async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      set({ status: 'signedOut', user: null });
      return;
    }

    try {
      const user = await getProfile();
      set({ status: 'signedIn', user });
    } catch {
      // Tarmoq yo'q bo'lsa ham chiqarib yubormaymiz — foydalanuvchi
      // qayta urinishi mumkin. Token yaroqsiz bo'lsa client o'zi tozalagan.
      const stillHasToken = await getRefreshToken();
      set({ status: stillHasToken ? 'signedOut' : 'signedOut', user: null });
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
}));
