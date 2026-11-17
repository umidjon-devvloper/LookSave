import { Stack } from 'expo-router';

import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { colors } from '../../src/theme/tokens';

/**
 * AI Designer oqimi.
 *
 * NEGA `(tabs)` DAN TASHQARIDA: oqim to'liq ekranni egallashi kerak — tab
 * qatori ko'rinib turmasligi shart. Bu marshrut ildiz `Stack` ining bolasi
 * bo'lgani uchun tab qatori ustidan ochiladi va o'z-o'zidan yashiradi.
 *
 * ⚠️ FON YORUG' — ilovaning qolgan qismi bilan bir xil, kirish ekrani
 * (`ai/index.tsx`) ham. U yerda faqat gologramma rasmi qora ramkada turadi,
 * chunki PNG'ning o'z foni qora. Kamera preview'ining o'zi qorong'i, undan
 * ichkariga "photo booth" effekti chiqadi.
 */
export default function AiLayout(): JSX.Element {
  return (
    <Stack
      // Har ekran o'z xato chegarasida: chizishdagi xato ilovani yopmaydi (`ScreenErrorBoundary`)
      screenLayout={withScreenErrorBoundary}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
