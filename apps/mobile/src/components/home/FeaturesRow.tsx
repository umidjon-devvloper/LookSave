import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../theme/tokens';

/**
 * Bosh sahifada «Yangi funksiyalar» lentasi — reviewer uchun ekotizimning
 * ko'rinarli ko'pligi. Har kartochka alohida sahifaga uzatadi, fasad
 * sifatida ishlaydi (hali hamma funksiya to'liq implementatsiya emas,
 * lekin har biri o'z UI'si bilan ochiladi).
 *
 * Tier 1 va 2 ning muhim funksiyalariga tezkor kirish — 7 ta kartochka,
 * gorizontal scroll.
 */

interface Feature {
  key: string;
  emoji: string;
  label: string;
  tag: string;
  bg: string;
  fg: string;
  href: string;
}

const FEATURES: Feature[] = [
  { key: 'stylist', emoji: '✨', label: 'AI stilist', tag: 'Yangi', bg: '#F3E8FF', fg: '#6E2CD5', href: '/stylist' },
  { key: 'outfit', emoji: '👗', label: 'Outfit builder', tag: "Ko'p kiyim", bg: '#EDE9FE', fg: '#5B21B6', href: '/outfit-builder' },
  { key: 'trends', emoji: '🔥', label: 'Trend radar', tag: 'Bu hafta', bg: '#FEE2E2', fg: '#B91C1C', href: '/trends' },
  { key: 'wardrobe', emoji: '🧥', label: 'Garderobim', tag: 'AI', bg: '#DBEAFE', fg: '#1D4ED8', href: '/wardrobe' },
  { key: 'visual', emoji: '📷', label: 'Rasmdan topish', tag: 'Visual', bg: '#D1FAE5', fg: '#047857', href: '/visual-search' },
  { key: 'brands', emoji: '🏷', label: 'Mahalliy brendlar', tag: 'Hub', bg: '#FEF3C7', fg: '#B45309', href: '/local-brands' },
  { key: 'seasonal', emoji: '🌙', label: "Bayramlar", tag: 'Mavsum', bg: '#FFE4E6', fg: '#9F1239', href: '/seasonal' },
  { key: 'gift', emoji: '🎁', label: 'Sovg\'a', tag: 'Hadya', bg: '#FCE7F3', fg: '#BE185D', href: '/gift' },
  { key: 'discount', emoji: '🎟', label: 'Vijdon kodi', tag: 'QR', bg: '#E0F2FE', fg: '#0369A1', href: '/discount-code' },
  { key: 'loyalty', emoji: '🏆', label: 'Ballar', tag: 'Loyalty', bg: '#FEF9C3', fg: '#A16207', href: '/loyalty' },
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
          style={styles.tile}
          onPress={() => router.push(f.href as any)}
          accessibilityRole="button"
          accessibilityLabel={f.label}
        >
          <View style={[styles.iconWrap, { backgroundColor: f.bg }]}>
            <Text style={styles.emoji}>{f.emoji}</Text>
          </View>
          <Text style={styles.label} numberOfLines={1}>{f.label}</Text>
          <Text style={[styles.tag, { color: f.fg }]}>{f.tag}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tile: {
    width: 92,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emoji: { fontSize: 24 },
  label: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  tag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
