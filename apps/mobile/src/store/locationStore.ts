import * as Location from 'expo-location';
import { create } from 'zustand';

/** Toshkent markazi — ruxsat berilmagan holatda zaxira nuqta. */
const FALLBACK = { lat: 41.3111, lng: 69.2797 };

type Permission = 'unknown' | 'granted' | 'denied';

interface LocationState {
  coords: { lat: number; lng: number };
  permission: Permission;
  isFallback: boolean;
  request: () => Promise<void>;
}

export const useLocationStore = create<LocationState>((set) => ({
  coords: FALLBACK,
  permission: 'unknown',
  isFallback: true,

  /**
   * Joylashuv — ilovaning birinchi ekrani shunga bog'liq.
   * Ruxsat berilmasa Toshkent markazi ishlatiladi va foydalanuvchiga
   * shu haqda aytiladi: bo'sh ekran ko'rsatishdan ko'ra yaxshi.
   */
  request: async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      set({ permission: 'denied', coords: FALLBACK, isFallback: true });
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      set({
        permission: 'granted',
        coords: { lat: position.coords.latitude, lng: position.coords.longitude },
        isFallback: false,
      });
    } catch {
      // GPS o'chiq yoki signal yo'q
      set({ permission: 'granted', coords: FALLBACK, isFallback: true });
    }
  },
}));
