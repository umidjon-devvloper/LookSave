import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { Button, Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Shaxsiy garderob — foydalanuvchining uyidagi kiyimlari. Rasm bilan
 * qo'shadi, AI mos yangi mahsulotlarni taklif qiladi. «Shu shim bilan
 * qaysi ko'ylak?» Tier 1 funksiyasi #08.
 *
 * Hozir boshlang'ich UI — kiyim qo'shish qulayligi va «AI stilist taklif
 * qiladi» kartochkasi. Keyingi bosqich: shaxsiy matching API.
 */
export default function Wardrobe(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Screen>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Shaxsiy garderob</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lede}>
          Uyingizdagi kiyimlarni qo'shing — AI ularga mos keladigan yangi mahsulotlarni
          katalogdan topib beradi.
        </Text>

        <Pressable style={styles.addTile} onPress={() => router.push('/visual-search' as any)}>
          <View style={styles.addCircle}>
            <Text style={styles.plus}>+</Text>
          </View>
          <Text style={styles.addLabel}>Kiyim qo'shish</Text>
          <Text style={styles.addHint}>Rasm olish yoki galereyadan tanlash</Text>
        </Pressable>

        <View style={styles.sectionLabelWrap}>
          <Text style={styles.sectionLabel}>Kategoriyalar</Text>
        </View>

        <View style={styles.grid}>
          {CATEGORIES.map((c) => (
            <View key={c.name} style={styles.catTile}>
              <View style={[styles.catIcon, { backgroundColor: c.bg }]}>
                <Text style={styles.catEmoji}>{c.emoji}</Text>
              </View>
              <Text style={styles.catName}>{c.name}</Text>
              <Text style={styles.catCount}>0 ta</Text>
            </View>
          ))}
        </View>

        <View style={styles.aiCard}>
          <Text style={styles.aiTag}>AI stilist</Text>
          <Text style={styles.aiTitle}>
            «Garderobingizni to'ldirganingizda AI taklif beradi»
          </Text>
          <Text style={styles.aiHint}>
            Masalan: paxta oq ko'ylak bor — AI beige brog'alar va qora loafer taklif qiladi.
          </Text>
          <View style={{ height: spacing.sm }} />
          <Button title="AI stilistga savol berish" onPress={() => router.push('/stylist' as any)} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const CATEGORIES: Array<{ name: string; emoji: string; bg: string }> = [
  { name: "Ko'ylak", emoji: '👕', bg: 'rgba(139,44,245,0.08)' },
  { name: 'Shim', emoji: '👖', bg: 'rgba(22,166,106,0.08)' },
  { name: 'Ustki', emoji: '🧥', bg: 'rgba(245,158,11,0.08)' },
  { name: 'Poyafzal', emoji: '👟', bg: 'rgba(232,71,95,0.08)' },
  { name: 'Aksessuar', emoji: '👜', bg: 'rgba(107,89,217,0.08)' },
  { name: 'Ichki', emoji: '🩲', bg: 'rgba(59,130,246,0.08)' },
];

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
  body: { padding: spacing.md, paddingBottom: spacing.xl },
  lede: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  addTile: {
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  addCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  plus: { fontSize: 32, color: colors.textOnPrimary, fontWeight: '700', lineHeight: 36 },
  addLabel: { fontSize: 15, color: colors.text, fontWeight: '600' },
  addHint: { fontSize: 12, color: colors.textMuted },
  sectionLabelWrap: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catTile: {
    width: '31%',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  catIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  catEmoji: { fontSize: 24 },
  catName: { fontSize: 12, color: colors.text, fontWeight: '600' },
  catCount: { fontSize: 11, color: colors.textMuted },
  aiCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiTag: {
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  aiTitle: { fontSize: 15, color: colors.text, fontWeight: '600', lineHeight: 22 },
  aiHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 4 },
});
