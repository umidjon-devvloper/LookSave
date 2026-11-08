import * as FileSystem from 'expo-file-system';
import { create } from 'zustand';

/**
 * Ilk ochilish onboarding'i ko'rilganmi — qurilmada saqlanadi.
 *
 * ⚠️ NEGA KERAK. App Store 4.3(b) «nega bu ilova boshqalardan farq qiladi?»
 * degan savolga javob kutadi. Onboarding aynan shu javob: ilk ochilishda uch
 * ekran LookSave'ning uchta o'ziga xosligini aytadi. Lekin u FAQAT BIR MARTA
 * ko'rinishi kerak — ko'rgan odam har ochganda qayta ko'rsa bezor bo'ladi.
 *
 * ⚠️ NEGA FILESYSTEM, SECURE STORE EMAS. Ilgari `expo-secure-store` ishlatilar
 * edi — lekin iOS Keychain app o'chirilganda HAM saqlanadi. Qayta o'rnatganда
 * bayroq keychain'da qolib, onboarding ko'rinmasdi — reviewer'ga «ilk
 * ochilish» ekrani ishlamayotgandek tuyulardi. FileSystem document directory
 * uninstall'da yo'q bo'ladi, shuning uchun har haqiqiy «ilk ochilish» yangi
 * foydalanuvchi uchun onboarding'ni ko'rsatadi.
 *
 * ⚠️ `seen === null` — HALI O'QILMAGAN. Splash shu holatda ushlab turiladi
 * (`app/_layout.tsx` — `appReady`), aks holda kirish nuqtasi onboarding'ni
 * ko'rsatish kerakmi-yo'qmi bilmasdan `(tabs)` ga sakrab, keyin onboarding
 * uning ustidan ochilib, miltillash bo'lardi.
 */
const SEEN_FILE = (FileSystem.documentDirectory ?? '') + 'onboarding-seen.flag';

interface OnboardingState {
  /** `null` — hali o'qilmagan; `true`/`false` — ko'rilgan/ko'rilmagan */
  seen: boolean | null;
  /** Ilova ochilganда bayroqni qurilmadan tiklaydi */
  restore: () => Promise<void>;
  /** Onboarding tugadi (yoki o'tkazib yuborildi) — qayta ko'rsatilmaydi */
  complete: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  seen: null,

  restore: async () => {
    if (!SEEN_FILE) {
      // documentDirectory yo'q — SSR/test muhiti. Onboarding ko'rsatmaymiz.
      set({ seen: true });
      return;
    }
    try {
      const info = await FileSystem.getInfoAsync(SEEN_FILE);
      set({ seen: info.exists });
    } catch (err) {
      /*
       * O'qib bo'lmasa onboarding'ni KO'RSATMAYMIZ (`seen: true`). Sabab:
       * o'qish xatosi kamdan-kam va u takrorlansa, foydalanuvchi har
       * ochishda onboarding'ni qayta ko'rardi — bu haqiqiy ilk-ochilishdan
       * yomonroq.
       */
      console.warn('[onboarding] bayroq o`qilmadi', err);
      set({ seen: true });
    }
  },

  complete: () => {
    // Avval holatni o'zgartiramiz — navigatsiya darhol ishlasin; yozuv fonda.
    set({ seen: true });
    if (!SEEN_FILE) return;
    void FileSystem.writeAsStringAsync(SEEN_FILE, '1').catch((err: unknown) => {
      console.warn('[onboarding] bayroq saqlanmadi', err);
    });
  },
}));
