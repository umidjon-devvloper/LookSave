import type { TextStyle } from 'react-native';

/**
 * LookSave premium marketplace identity.
 * Oq va qora asos, binafsha aksent, yumshoq lavanda qatlamlar.
 *
 * ⚠️ RANGLARNI O'ZGARTIRSANGIZ: 06-dizayn.md ni ham yangilang.
 * ⚠️ DARK THEME SIFATIDA ISHLATMANG. Bu palette atayin yorug'. Aksent
 * (anor) oq fonga qarshi chizilgan; dark fonda u qonga o'xshaydi.
 */
export const colors = {
  // ── Fon qatlamlari ── (krem asos, karta oq, bosilgan holat sal to'q)
  bg: '#FBFAFF',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#F4F0FF',
  surface3: '#ECE5FF',

  // ── Chegaralar ── (ingichka, kontrastsiz)
  border: '#E9E4F2',
  borderStrong: '#D8CDEB',
  borderAccent: '#8B2CF5',

  // ── Anor (ikat) ── Yagona aksent, Chanel qoidasi — bitta jasur rang.
  primary: '#8B2CF5',
  primaryDim: '#6414D8',
  primaryDark: '#3D087F',
  primarySoft: 'rgba(139,44,245,0.10)',
  accent: '#B936F4',
  accentGlow: 'rgba(139,44,245,0.34)',

  // ── Matn ── (chernila, ko'mir emas)
  text: '#15131E',
  textMuted: '#615D70',
  textDim: '#9691A5',
  textOnPrimary: '#FFFFFF',

  // ── Semantik ── Neon emas; moda palitrasi (sage, oxra, anor)
  success: '#16A66A',
  warning: '#F59E0B',
  danger: '#E8475F',
  limited: '#F5A524',

  // ── Buyurtma status ──
  statusWaiting: '#F59E0B',
  statusConfirmed: '#16A66A',
  statusRejected: '#E8475F',
  statusDone: '#9691A5',
} as const;

/**
 * Radius — Atelier kichik va aniq. Yumaloq SaaS card-kit emas.
 * `pill` chip va kichik tugma uchun; `full` eski alias.
 */
export const radius = { sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, pill: 999, full: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/**
 * Tipografika — Fraunces (editorial serif, display) + Inter (humanist sans, body).
 * Ikkisi aniq rolda: serif katta sarlavha va narx; sans — barcha o'qish matni.
 *
 * ⚠️ Shriftlar `app/_layout.tsx` da yuklanadi. Yangi oila qo'shsangiz
 * o'sha yerda `useFonts` ga ham qo'shing.
 */
export const fonts = {
  // Body — Inter (saqlanadi, texnik matn uchun eng yaxshi oilashuvchi)
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',

  // Display — Fraunces (editorial serif, "moda jurnali tili")
  display: 'Inter_700Bold',
  displayItalic: 'Inter_600SemiBold',
  displaySemibold: 'Inter_700Bold',
} as const;

/**
 * Tip shkalasi — Fraunces hero/h1/h2 va narx uchun; qolgani Inter.
 * Serif qalin ko'rinadi, shuning uchun weight 500 (700 emas).
 */
export const text = {
  hero: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: 0,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 0,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0,
  },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24 },
  bodyMed: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 24 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  tiny: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15 },

  /**
   * Eyebrow — ALL CAPS o'rniga italic Fraunces. Bu moda jurnali uslubi,
   * template "LABEL — fragment" klişesini butunlay sindiradi.
   */
  eyebrow: {
    fontFamily: fonts.displayItalic,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },

  /**
   * `label` — eski kod bazasida ko'p ishlatiladi (tab, filtr nomi,
   * form yorligi, section head). Ilgari ALL CAPS tracked-out edi — aynan
   * shu klişe Apple "spam" deydigan belgi. Endi eyebrow bilan bir xil:
   * italic serif, kichik. Barcha callsite avtomat Atelier tilida gapiradi.
   */
  label: {
    fontFamily: fonts.displayItalic,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },

  // Logotip — Fraunces display, ingichkaroq tracking
  wordmark: {
    fontFamily: fonts.displaySemibold,
    fontSize: 16,
    letterSpacing: 0,
  },

  // Narx serifda — mahsulot kartasida eng muhim fakt
  price: { fontFamily: fonts.displaySemibold, fontSize: 20, lineHeight: 26 },
  priceOld: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'line-through',
  },
} satisfies Record<string, TextStyle>;
