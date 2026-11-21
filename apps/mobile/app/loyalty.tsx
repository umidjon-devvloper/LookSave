import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Loyalty — ballar va darajalar. Tier 3 funksiyasi #21.
 *
 * Mock ma'lumotlar. Keyingi bosqich: `GET /v1/loyalty/me` → foydalanuvchi
 * balansi va keyingi darajagacha qolgan ballar.
 */

interface Tier {
  name: string;
  min: number;
  perks: string[];
  color: string;
}

const TIERS: Tier[] = [
  { name: 'Bronza', min: 0, color: '#C47850', perks: ['Har xaridan 1% qaytadi', 'Sovg\'alar va bayram tanlovlari'] },
  { name: 'Kumush', min: 500, color: '#9CA3AF', perks: ['Har xaridan 2%', 'Bepul yetkazib berish 300k so\'mdan', 'Erta kirish — yangi kolleksiyalar'] },
  { name: 'Oltin', min: 2000, color: '#D97706', perks: ['Har xaridan 3.5%', 'Shaxsiy stilist', 'Mahsulot narxidan 10% chegirma bayramda'] },
  { name: 'Platinum', min: 5000, color: '#6E2CD5', perks: ['5% ballar', 'Birinchi ko\'rish — barcha kolleksiyalar', 'Exclusive events'] },
];

const CURRENT_POINTS = 320;
const CURRENT_TIER_INDEX = 0;

export default function Loyalty(): JSX.Element {
  const router = useRouter();
  const tier = TIERS[CURRENT_TIER_INDEX]!;
  const next = TIERS[CURRENT_TIER_INDEX + 1];
  const toNext = next ? next.min - CURRENT_POINTS : 0;
  const progress = next ? (CURRENT_POINTS - tier.min) / (next.min - tier.min) : 1;

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Ballar</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.heroCard, { backgroundColor: tier.color }]}>
          <Text style={styles.heroTier}>{tier.name}</Text>
          <Text style={styles.heroPoints}>{CURRENT_POINTS.toLocaleString('uz-UZ')}</Text>
          <Text style={styles.heroLabel}>ball</Text>

          {next ? (
            <View style={styles.progressBlock}>
              <Text style={styles.progressText}>
                {next.name}'gacha {toNext.toLocaleString('uz-UZ')} ball
              </Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.max(2, progress * 100)}%` }]} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.tiers}>
          {TIERS.map((t, i) => (
            <View key={t.name} style={[styles.tierCard, i === CURRENT_TIER_INDEX && styles.tierCardActive]}>
              <View style={styles.tierHead}>
                <View style={[styles.tierDot, { backgroundColor: t.color }]} />
                <Text style={styles.tierName}>{t.name}</Text>
                <Text style={styles.tierMin}>{t.min === 0 ? "Boshlang'ich" : `${t.min}+ ball`}</Text>
              </View>
              {t.perks.map((p) => (
                <View key={p} style={styles.perkRow}>
                  <Text style={styles.perkBullet}>✓</Text>
                  <Text style={styles.perkText}>{p}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.earnCard}>
          <Text style={styles.earnLabel}>Ball qanday to'planadi</Text>
          <Text style={styles.earnRow}>• Har 10 000 so'm xarid uchun 10 ball</Text>
          <Text style={styles.earnRow}>• Birinchi try-on: +50 ball</Text>
          <Text style={styles.earnRow}>• Do'stni taklif qilish: +200 ball</Text>
          <Text style={styles.earnRow}>• Haftalik qidiruv faolligi: +20 ball</Text>
        </View>
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
  body: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  heroCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  heroTier: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.86)',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  heroPoints: { fontSize: 56, color: '#FFFFFF', fontWeight: '800', lineHeight: 60 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 2 },
  progressBlock: { alignSelf: 'stretch', marginTop: spacing.lg },
  progressText: { fontSize: 12, color: 'rgba(255,255,255,0.86)', marginBottom: 6 },
  bar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 4 },
  tiers: { gap: spacing.sm },
  tierCard: {
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  tierCardActive: { borderColor: colors.primary, borderWidth: 2 },
  tierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  tierDot: { width: 12, height: 12, borderRadius: 6 },
  tierName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  tierMin: { fontSize: 11, color: colors.textMuted },
  perkRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  perkBullet: { color: colors.success, fontSize: 13, fontWeight: '700' },
  perkText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  earnCard: {
    padding: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
  },
  earnLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  earnRow: { fontSize: 13, color: colors.text, marginBottom: 4 },
});
