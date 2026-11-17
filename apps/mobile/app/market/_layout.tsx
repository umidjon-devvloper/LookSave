import { Stack } from 'expo-router';

import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { colors } from '../../src/theme/tokens';

/**
 * Market ichma-ich oqimi (do'konlar → kategoriyalar). Ekranlar o'z
 * sarlavhalarini chizadi — ildiz Stack sarlavha qo'ymasin.
 */
export default function MarketLayout(): JSX.Element {
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
