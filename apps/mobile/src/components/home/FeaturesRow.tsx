import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useI18n, type Dictionary } from '../../i18n';
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
  /** Matn lug'atdan (`t.home.*`) — ilgari o'zbekcha qattiq yozilgan edi */
  label: keyof Dictionary['home'];
  accent: string;
  tint: string;
  href: Href;
}

/*
 * 2026-11-24, egasining qarori: «olib tashla, bitta AI stil qolsin». Qolgan
 * sakkizta kartochka (Komplekt, Garderob, Rasmdan, Brendlar, Bayramlar,
 * Sovg'a, QR chegirma, Ballar) bosh sahifadan olindi; sahifalarning o'zi
 * (`app/outfit-builder.tsx` va h.k.) joyida — qaytarish uchun shu ro'yxatga
 * qatorini qo'shish yetadi. So'ramasdan qaytarma.
 */
const FEATURES: Feature[] = [
  { key: 'stylist',   icon: 'stylist',       label: 'featureStylist', accent: '#6E2CD5', tint: '#F3EEFE', href: '/stylist' },
];

export function FeaturesRow(): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);

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
          onPress={() => router.push(f.href)}
          accessibilityRole="button"
          accessibilityLabel={t.home[f.label]}
        >
          <View style={[styles.square, { backgroundColor: f.tint }]}>
            <Icon name={f.icon} size={26} color={f.accent} />
          </View>
          <Text style={styles.label} numberOfLines={1}>{t.home[f.label]}</Text>
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
