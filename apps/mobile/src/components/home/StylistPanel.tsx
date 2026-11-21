import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../theme/tokens';

/**
 * Bosh sahifadagi AI stilist panelcha — artifact mockup'idan. Reviewer
 * uchun birinchi ekranda noyob funksiya belgisi: «AI stilist bilan
 * suhbatni boshlash».
 *
 * Bosilganda `/stylist` sahifasiga uzatadi va chip (kategoriya) ni
 * query param sifatida yuboradi, chat avtomatik shu savolni so'raydi.
 */

const CHIPS = ["To'yga", 'Ish uchun', 'Kundalik', 'Sport'];

export function StylistPanel(): JSX.Element {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#6E4CE8', '#4B2BC7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.panel}
      >
        <View style={styles.glow} />
        <View style={styles.row}>
          <View style={styles.pulse} />
          <Text style={styles.tag}>AI STILIST · ONLINE</Text>
        </View>
        <Text style={styles.q}>Bugun nima kiyinmoqchisiz?</Text>
        <View style={styles.chips}>
          {CHIPS.map((c) => (
            <Pressable
              key={c}
              style={styles.chip}
              onPress={() => router.push(`/stylist?prompt=${encodeURIComponent(c)}` as any)}
            >
              <Text style={styles.chipText}>{c}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.chip, styles.chipMore]}
            onPress={() => router.push('/stylist' as any)}
          >
            <Text style={styles.chipText}>Yoziq…</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  panel: {
    padding: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4FD39B',
  },
  tag: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  q: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
  },
  chipMore: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  chipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
