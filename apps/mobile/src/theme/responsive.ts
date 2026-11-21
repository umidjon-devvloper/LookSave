import { useWindowDimensions } from 'react-native';

/**
 * iPad va boshqa keng ekranlar uchun markaziy maksimal kenglik.
 *
 * ⚠️ NEGA 520px (iPhone 17 Pro Max kengligidan 10px keng)?
 *
 *   iPhone layouti iPad'da 1:1 yoyilsa (820px kenglikda), har tipografik
 *   satr juda uzun (90+ belgi) — "The Elements of Typographic Style" dagi
 *   ≤80 belgi qoidasi buziladi va matn o'qish qiyinlashadi. Boshqa tomondan,
 *   iPhone kengligida (393–440px) ushlab qolsak, ekran chekkalari bo'sh
 *   krem polosalar bo'ladi.
 *
 *   520px — eng keng iPhone (17 Pro Max: 440pt) dan sal keng. Bu kenglikda
 *   kataloglardagi ikki ustunli grid kartalari ham, mahsulot sahifasi ham
 *   iPad'da "mobile-first" mantig'iga sodiq qoladi, lekin iPhone'dan biroz
 *   ko'proq nafas oladi.
 *
 *   iPad'da bu konteyner markazda joylashadi; chekkada ingichka krem hoshia
 *   qoladi — "frame" effekti, bo'shlik emas.
 */
export const APP_MAX_WIDTH = 520;

/** Tablet deb ataladigan kenglik chegarasi (iPad mini ham shundan keng) */
export const TABLET_BREAKPOINT = 600;

/**
 * Hozirgi oyna kengligi tablet deb hisoblanadimi?
 * Ekran o'lchami emas, oyna kengligi: iPad'da Split View'da ilova iPhone
 * kengligida ochilsa (`requireFullScreen` ni e'tiborsiz qoldiradigan eski
 * iOS'larda), false qaytaradi — va iPhone layout ishlaydi.
 */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}

/**
 * Tablet'da kontent kengligini cheklash uchun joylashuv stillari.
 *
 * ⚠️ `alignSelf: 'center'` + `width: '100%'` + `maxWidth: 520` — birgalikda
 * iPhone'da to'liq kenglikda, iPad'da esa 520px markazda.
 *
 * Ishlatish:
 *   <View style={[styles.wrap, centeredStyle]}>…</View>
 */
export const centeredStyle = {
  width: '100%' as const,
  maxWidth: APP_MAX_WIDTH,
  alignSelf: 'center' as const,
};

/**
 * Kataloglardagi grid uchun ustunlar soni.
 *
 * Mobil (≤600px): 2 ustun.
 * Tablet (>600px): APP_MAX_WIDTH ichida ham 2 ustun — bu "mobile-first"
 * qoidasiga sodiq qoladi. Agar kelajakda iPad uchun keng grid xohlansa
 * (3-ustun), shu funksiyani o'zgartiring.
 */
export function useGridColumns(): number {
  return 2;
}
