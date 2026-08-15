import { Stack } from 'expo-router';

import { colors } from '../../src/theme/tokens';

/**
 * AI Designer oqimi.
 *
 * NEGA `(tabs)` DAN TASHQARIDA: oqim to'liq ekranni egallashi kerak — tab
 * qatori ko'rinib turmasligi shart. Bu marshrut ildiz `Stack` ining bolasi
 * bo'lgani uchun tab qatori ustidan ochiladi va o'z-o'zidan yashiradi.
 * Alohida "tabBarStyle: none" hiylasi kerak emas.
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
