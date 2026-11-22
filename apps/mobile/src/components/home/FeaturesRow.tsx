import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../Icon';
import { colors, spacing } from '../../theme/tokens';

/**
 * Bosh sahifa «Yangi funksiyalar» lentasi — 73-build.
 *
 * Dizayn: luxury marketplace tuyg'usi. Oq surface + 1px nozik chegaraga
 * ega yumshoq squircle, ichida Lucide stroke ikon (1.75 chiziq eni).
 * Har funksiya o'z akcenti bilan ajraladi, lekin fonlar monochrome qoladi
 * — emoji emas, haqiqiy ilova ko'rinishi.
 */

interface Feature {
  key: string;
  icon: IconName;
  label: string;
  accent: string;
  tint: string;
  href: string;
}

const FEATURES: Feature[] = [
  { key: 'stylist',   icon: 'stylist',       label: 'AI stilist',  accent: '#6E2CD5', tint: '#F3EEFE', href: '/stylist' },
  { key: 'outfit',    icon: 'dress',         label: 'Komplekt',    accent: '#5B21B6', tint: '#EFE9FD', href: '/outfit-builder' },
  { key: 'wardrobe',  icon: 'wardrobe',      label: 'Garderob',    accent: '#1D4ED8', tint: '#E8EEFC', href: '/wardrobe' },
  { key: 'visual',    icon: 'visualSearch',  label: 'Rasmdan',     accent: '#047857', tint: '#E3F5EC', href: '/visual-search' },
  { key: 'brands',    icon: 'brands',        label: 'Brendlar',    accent: '#B45309', tint: '#FBEFDC', href: '/local-brands' },
  { key: 'seasonal',  icon: 'seasonal',      label: 'Bayramlar',   accent: '#9F1239', tint: '#FDE7EC', href: '/seasonal' },
  { key: 'gift',      icon: 'gift',          label: "Sovg'a",      accent: '#BE185D', tint: '#FCE4ED', href: '/gift' },
  { key: 'discount',  icon: 'discountCode',  label: 'QR chegirma', accent: '#0369A1', tint: '#E0F0F9', href: '/discount-code' },
  { key: 'loyalty',   icon: 'loyalty',       label: 'Ballar',      accent: '#A16207', tint: '#FBF2D7', href: '/loyalty' },
];

export function FeaturesRow(): JSX.Element {
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FEATURES.map((f) => (
        <Pressable
          key={f.key}
          style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          onPress={() => router.push(f.href as any)}
          accessibilityRole="button"
          accessibilityLabel={f.label}
        >
          <View style={[styles.square, { backgroundColor: f.tint }]}>
            <Icon name={f.icon} size={26} color={f.accent} />
          </View>
          <Text style={styles.label} numberOfLines={1}>{f.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 10,
  },
  tile: {
    width: 68,
    alignItems: 'center',
  },
  tilePressed: {
    opacity: 0.75,
  },
  square: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(21,19,30,0.06)',
    marginBottom: 8,
    // iOS subtle shadow — luxury marketplace tuyg'usi
    shadowColor: '#15131E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  label: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});
