import { Pressable, StyleSheet, Text, View } from 'react-native';

import { openDirections } from '../lib/openDirections';
import { colors, radius, spacing } from '../theme/tokens';

/**
 * «Yo'nalish ol» tugmasi. Apple Maps → Yandex Navi → Google Maps ketma-ketligi
 * bilan tashqi xaritaga uzatadi (deep link). Marketplace emas, geo-first
 * mahalliy ekotizim xususiyati — mahsulotlar sahifasida va yaqin do'konlar
 * lentasida ko'rinadi.
 */
interface Props {
  lat: number;
  lng: number;
  name?: string;
  variant?: 'solid' | 'outline' | 'ghost';
  distanceM?: number | null;
}

function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function DirectionsButton({ lat, lng, name, variant = 'solid', distanceM }: Props): JSX.Element {
  const onPress = (): void => {
    void openDirections({ lat, lng, name });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        variant === 'solid' && styles.solid,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Yo'nalish ${name ?? ''}`}
    >
      <View style={styles.arrow}>
        <Text style={[styles.arrowGlyph, variant === 'solid' && { color: colors.textOnPrimary }]}>↗</Text>
      </View>
      <Text style={[styles.label, variant === 'solid' && { color: colors.textOnPrimary }]}>
        Yo'nalish{distanceM != null ? ` · ${fmtDistance(distanceM)}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  solid: {
    backgroundColor: colors.primary,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: colors.bgElevated,
  },
  arrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
