import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { create } from 'zustand';

/**
 * Splash animatsiyasining "qo'nish maydoni".
 *
 * NEGA KERAK: `AnimatedSplash` markazdagi logotipni ilova ichidagi haqiqiy
 * logotip ustiga uchirib qo'ndiradi (shared element). Buning uchun u nishonning
 * ekrandagi aniq koordinatasini bilishi shart, lekin ikkalasi butunlay boshqa
 * daraxtlarda turadi — shuning uchun oradagi bog' shu do'kon.
 *
 * Qaysi ekran ochilgan bo'lsa (uy yoki `welcome`), o'sha o'z logotipini
 * `useSplashLanding()` orqali ro'yxatdan o'tkazadi. Splash qatlami hali ustda
 * turgan paytda ekran allaqachon montaj qilingan bo'ladi, shuning uchun o'lchov
 * o'z vaqtida yetib keladi.
 *
 * Nishon topilmasa (o'lchov kechiksa yoki ekranda logotip bo'lmasa) — splash
 * oddiy "erib yo'qolish" bilan yopiladi, ya'ni hech narsa buzilmaydi.
 */

export interface SplashLanding {
  /** Ekran koordinatalarida — `measureInWindow` bergani */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SplashTargetState {
  landing: SplashLanding | null;
  setLanding: (landing: SplashLanding | null) => void;
}

export const useSplashTargetStore = create<SplashTargetState>((set) => ({
  landing: null,
  setLanding: (landing) => set({ landing }),
}));

/**
 * Logotipni splash uchun qo'nish maydoni sifatida ro'yxatdan o'tkazadi.
 * Qaytgan `ref` va `onLayout` ni logotipni o'rab turgan `View` ga bering:
 *
 * ```tsx
 * const landing = useSplashLanding();
 * <View ref={landing.ref} onLayout={landing.onLayout} collapsable={false}>
 *   <Image source={images.logoMark} style={styles.logo} resizeMode="contain" />
 * </View>
 * ```
 *
 * ⚠️ `collapsable={false}` shart: Androidda bolasi bitta bo'lgan View layout
 * daraxtidan olib tashlanadi va o'lchab bo'lmay qoladi.
 */
export function useSplashLanding(): {
  ref: React.RefObject<View>;
  onLayout: () => void;
} {
  const ref = useRef<View>(null);
  const setLanding = useSplashTargetStore((state) => state.setLanding);

  const onLayout = useCallback(() => {
    // `onLayout` paytida native ko'rinish hali joylashib ulgurmagan bo'lishi
    // mumkin — keyingi kadrda o'lchaymiz, aks holda nol qiymat keladi.
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) setLanding({ x, y, width, height });
      });
    });
  }, [setLanding]);

  // Ekran yopilganda eskirgan koordinata qolib ketmasin
  useEffect(() => () => setLanding(null), [setLanding]);

  return { ref, onLayout };
}
