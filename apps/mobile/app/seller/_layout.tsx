import { Stack } from 'expo-router';

import { colors } from '../../src/theme/tokens';

/**
 * Sotuvchi paneli.
 *
 * `(tabs)` dan tashqarida: bu mijoz oqimi emas va tab qatori bu yerda
 * chalg'itadi — sotuvchi buyurtmaga javob berayotganda savat yoki
 * sevimlilarga o'tishi kerak emas.
 */
export default function SellerLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
