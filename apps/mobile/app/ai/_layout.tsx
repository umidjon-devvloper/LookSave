import { Stack } from 'expo-router';

import { colors } from '../../src/theme/tokens';

/**
 * AI Designer oqimi.
 *
 * NEGA `(tabs)` DAN TASHQARIDA: oqim to'liq ekranni egallashi kerak — tab
 * qatori ko'rinib turmasligi shart. Bu marshrut ildiz `Stack` ining bolasi
 * bo'lgani uchun tab qatori ustidan ochiladi va o'z-o'zidan yashiradi.
 *
 * ⚠️ FON KREM — qolgan Atelier bilan bir xil. Faqat kirish ekrani
 * (`ai/index.tsx`) qora, chunki hologramma PNG'i qora fonda. Qolgan AI
 * ekranlari (kamera, kiyintirish) kremda ishlaydi: kamera preview'ining
 * o'zi qorong'i, undan ichkariga "photo booth" effekti chiqadi.
 */
export default function AiLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
