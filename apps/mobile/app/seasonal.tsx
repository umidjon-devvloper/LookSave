import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Mavsumiy va bayram kolleksiyalari. Navro'z, Hayit, Ramazon, Yangi yil
 * — har biri alohida bo'lim. Tier 2 funksiyasi #16.
 */

interface Season {
  key: string;
  name: string;
  tagline: string;
  gradient: [string, string];
  emoji: string;
  active?: boolean;
  weeksAway?: number;
}

const SEASONS: Season[] = [
  { key: 'winter', name: "Qish 2026", tagline: "Jun palto, kardigan, charm botinka", gradient: ['#1E3A8A', '#60A5FA'], emoji: '❄️', active: true },
  { key: 'newyear', name: 'Yangi yil', tagline: "Bayram libosi, aksessuarlar", gradient: ['#991B1B', '#EF4444'], emoji: '🎄', weeksAway: 5 },
  { key: 'navruz', name: "Navro'z", tagline: 'Milliy liboslar, chapanlar, do\'ppi', gradient: ['#0F766E', '#5EEAD4'], emoji: '🌷', weeksAway: 17 },
  { key: 'ramadan', name: 'Ramazon', tagline: "Lson, hijob, oilaviy sovg'alar", gradient: ['#7C2D12', '#FB923C'], emoji: '🌙', weeksAway: 22 },
  { key: 'hayit', name: "Hayit", tagline: "Bayram ko'ylaklari, bolalar liboslari", gradient: ['#6D28D9', '#C4B5FD'], emoji: '🎁', weeksAway: 26 },
  { key: 'summer', name: "Yoz 2027", tagline: "Linen, shortiklar, sandal", gradient: ['#92400E', '#FBBF24'], emoji: '☀️', weeksAway: 34 },
];

export default function Seasonal(): JSX.Element {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Mavsumiy kolleksiyalar</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {SEASONS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.card, { backgroundColor: s.gradient[0] }]}
            onPress={() => router.push(`/catalog?season=${s.key}` as any)}
          >
            <View style={[styles.sideStripe, { backgroundColor: s.gradient[1] }]} />
            <View style={styles.cardBody}>
              <View style={styles.cardHead}>
                <Text style={styles.emoji}>{s.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{s.name}</Text>
                  <Text style={styles.cardTagline}>{s.tagline}</Text>
                </View>
                {s.active ? (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>JONLI</Text>
                  </View>
                ) : (
                  <Text style={styles.weeks}>{s.weeksAway}h</Text>
                )}
              </View>
            </View>
          </Pressable>
        ))}

        <Text style={styles.footnote}>
          Sotuvchilar har mavsum uchun o'z kolleksiyalarini yaratishadi. Bayrom
          2 oy oldin ochiladi, tayyorlanishga vaqt bo'lsin.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...text.h3, color: colors.text },
  body: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 90,
  },
  sideStripe: { width: 6 },
  cardBody: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emoji: { fontSize: 32 },
  cardName: { fontSize: 18, color: '#FFFFFF', fontWeight: '700', marginBottom: 2 },
  cardTagline: { fontSize: 13, color: 'rgba(255,255,255,0.86)' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  liveText: { fontSize: 9, color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.6 },
  weeks: { fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: '600' },
  footnote: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
