import type { TextStyle } from 'react-native';

/**
 * Dizayn tokenlari — docs/06-dizayn.md §2-4.
 * Manba: LookSave pitch deck (13 slayd). Panel varianti bilan bir manba.
 *
 * ⚠️ Qiymatlarni bu yerda o'zgartirsangiz, 06-dizayn.md ni ham yangilang —
 * ikkisi bir-biriga mos turishi shart.
 */
export const colors = {
  // ── Fon qatlamlari ──
  bg: '#0A0A0F', // eng past qatlam, ekran foni
  bgElevated: '#0F0D16', // modal, bottom sheet
  surface: '#14121C', // karta
  surface2: '#1C1928', // karta ustidagi element (chip, input)
  surface3: '#252036', // hover / bosilgan holat

  // ── Chegaralar ──
  border: '#241F33', // oddiy ajratgich
  borderStrong: '#332B4A', // ta'kidlangan
  borderAccent: '#7C3AED', // faol / tanlangan

  // ── Binafsha shkala ──
  primary: '#8B5CF6', // asosiy tugma, faol holat
  primaryDim: '#6D3FD9', // bosilgan
  primaryDark: '#4C2A9E', // fon to'ldirish
  primarySoft: 'rgba(139,92,246,0.14)', // yumshoq fon
  accent: '#C084FC', // yorqin urg'u, ikonka
  accentGlow: 'rgba(139,92,246,0.45)', // nurlanish

  // ── Matn ──
  text: '#FFFFFF',
  textMuted: '#9B96AE',
  textDim: '#635D78',
  textOnPrimary: '#FFFFFF',

  // ── Semantik ──
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  limited: '#F5C518', // Limited drops — oltin

  // ── Status (buyurtma) ──
  statusWaiting: '#F59E0B',
  statusConfirmed: '#22C55E',
  statusRejected: '#EF4444',
  statusDone: '#635D78',
} as const;

/**
 * `pill` — chip va kichik tugma uchun. `full` eski nom, `pill` bilan bir xil:
 * kod bazasida 14 joyda ishlatilgani uchun saqlab qolingan.
 */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999, full: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/**
 * Tipografika — 06-dizayn.md §3. Deckdagi qalin grotesk o'rniga Inter.
 * Shrift `app/_layout.tsx` da yuklanadi; yuklanmaguncha tizim shrifti ishlaydi.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const text = {
  hero: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMed: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },

  // Deckdagi "TOP BRANDS", "TRENDING NOW" uslubi
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  // Logotip: "L O O K   S A V E" — logotip belgisi yonida turgani uchun qalin
  wordmark: {
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 4.5,
    textTransform: 'uppercase',
  },

  price: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  priceOld: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'line-through',
  },
} satisfies Record<string, TextStyle>;
