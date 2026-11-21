import { StyleSheet, Text, View } from 'react-native';

import { fullSizeHint, type Gender } from '../lib/sizeMap';
import { colors, radius, spacing } from '../theme/tokens';

/**
 * Mahsulot kartochkasidagi tanlangan universal o'lchamning mahalliy
 * (RU/O'zbekiston) ekvivalenti. Masalan «XL» tanlangan bo'lsa pastda
 * «RU 48 · EU 40 · US 8» chiqadi.
 *
 * Tier 2 funksiyasi #13 — mahalliy o'lcham xaritasi.
 */
interface Props {
  size: string;
  gender?: Gender;
}

export function LocalSizeHint({ size, gender = 'women' }: Props): JSX.Element | null {
  if (!size || size === 'ONE') return null;
  const hint = fullSizeHint(size, gender);
  if (!hint) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{size}</Text>
      <Text style={styles.dot}>→</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  dot: {
    fontSize: 11,
    color: colors.textDim,
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: 0.3,
  },
});
