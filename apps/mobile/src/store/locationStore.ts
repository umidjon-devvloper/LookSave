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
        /*
         * ⚠️ ANDROID: TIZIM OYNASI O'ZI CHIQMASIN. Sukut bo'yicha `true` —
         * qurilmada «Location Accuracy» o'chiq bo'lsa, Google Play xizmatlari
         * «For a better experience, your device will need to use Location
         * Accuracy» oynasini ko'rsatadi. Bu so'rov ilova OCHILISHIDA, odam
         * hech narsa so'ramasdan ketadi, shuning uchun «No thanks» bosilsa
         * ham oyna HAR OCHILISHDA qaytib chiqardi (2026-11-18, Android 16
         * emulyatori). Endi sozlama mos kelmasa jim o'tib, pastdagi zaxira
         * yo'lga tushamiz. iOS bu parametrni e'tiborsiz qoldiradi.
         */
        mayShowUserSettingsDialog: false,
      });
      set({
        permission: 'granted',
        coords: { lat: position.coords.latitude, lng: position.coords.longitude },
        isFallback: false,
      });
    } catch {
      // GPS o'chiq, signal yo'q yoki qurilma sozlamasi mos emas — oxirgi ma'lum joy bo'lsa shuni olamiz
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          set({
            permission: 'granted',
            coords: { lat: last.coords.latitude, lng: last.coords.longitude },
            isFallback: false,
          });
          return;
        }
      } catch {
        // Oxirgi joy ham yo'q — zaxira nuqta
      }
      set({ permission: 'granted', coords: FALLBACK, isFallback: true });
    }
  },
}));
