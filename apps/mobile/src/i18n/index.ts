import type { Locale } from '@looksave/shared-types';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';

import { setApiLanguage } from '../api/client';
import { dictionaries, type Dictionary } from './dictionaries';

const SUPPORTED: Locale[] = ['uz', 'ru', 'en', 'ar'];

/** Qurilma tili qo'llab-quvvatlansa o'sha, aks holda o'zbekcha. */
function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return SUPPORTED.find((locale) => locale === code) ?? 'uz';
}

interface I18nState {
  locale: Locale;
  t: Dictionary;
  /** Arabcha o'ngdan chapga o'qiladi — tartib ko'zguga solingandek almashadi. */
  isRTL: boolean;
  setLocale: (locale: Locale) => void;
}

const rtl = (locale: Locale): boolean => locale === 'ar';

export const useI18n = create<I18nState>((set) => {
  const locale = deviceLocale();
  setApiLanguage(locale);

  return {
    locale,
    t: dictionaries[locale],
    isRTL: rtl(locale),
    setLocale: (next) => {
      setApiLanguage(next);
      set({ locale: next, t: dictionaries[next], isRTL: rtl(next) });
    },
  };
});

/** Komponentdan tashqarida kerak bo'lganda (masalan xato matnlari). */
export function translations(): Dictionary {
  return useI18n.getState().t;
}

export function currentLocale(): Locale {
  return useI18n.getState().locale;
}

/**
 * Ko'zgu tartib uchun uslub yordamchilari.
 *
 * NEGA `I18nManager.forceRTL` EMAS: u faqat ilova qayta ishga tushgandan
 * keyin kuch oladi, ya'ni til almashtirilganda foydalanuvchi ilovani qo'lda
 * yopib ochishi kerak bo'lardi. Bu yerdagi usul darhol ishlaydi.
 */
export const rtlStyles = {
  /** Matn qaysi chetdan boshlanadi */
  text: (isRTL: boolean) =>
    ({ textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }) as const,
  /** Qator elementlari tartibi */
  row: (isRTL: boolean) => ({ flexDirection: isRTL ? 'row-reverse' : 'row' }) as const,
  /** Blok qaysi chetga tekislanadi */
  align: (isRTL: boolean) => ({ alignItems: isRTL ? 'flex-end' : 'flex-start' }) as const,
};
