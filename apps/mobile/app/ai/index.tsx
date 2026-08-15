import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HologramFigure } from '../../src/components/ai/HologramFigure';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button } from '../../src/components/ui';
import {
  MOODS,
  OCCASIONS,
  STYLES,
  useAiFlowStore,
  type Mood,
  type Occasion,
  type StyleName,
} from '../../src/store/aiFlowStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * AI Designer — oqimning kirish ekrani.
 *
 * Uchta tanlov (holat, uslub, kayfiyat) shu yerda yig'iladi va
 * `aiFlowStore` da saqlanadi. Kartani bosish keyingi qiymatga o'tkazadi:
 * to'liq ro'yxat modal ochishdan ko'ra tezroq va bu yerda variantlar kam.
 *
 * ⚠️ Bu tanlovlar hozircha serverga yuborilmaydi — AI tavsiyasi uchun
 * endpoint yo'q. Ular kiyim tanlashda filtr sifatida ishlatiladi.
 */

/** Keyingi qiymatga aylantirib o'tadi — oxiridan boshiga qaytadi */
function cycle<T>(list: readonly T[], current: T): T {
  const index = list.indexOf(current);
  return list[(index + 1) % list.length] as T;
}

function ChoiceCard({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: IconName;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
    >
      <View style={styles.choiceText}>
        <Text style={styles.choiceLabel}>{label}</Text>
        <Text style={styles.choiceValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <View style={styles.choiceIcon}>
        <Icon name={icon} size={15} color={colors.accent} />
      </View>
    </Pressable>
  );
}

/** O'ng ustundagi bezak plitkalari — nima kiyintirish mumkinligini eslatadi */
const GARMENT_TILES: IconName[] = ['slotOuter', 'slotBottom', 'slotFeet', 'slotHead'];

const HOW_IT_WORKS: Array<{ icon: IconName; title: string }> = [
  { icon: 'looks', title: 'Tanlovingizni aytasiz' },
  { icon: 'tryon', title: 'AI komplekt yasaydi' },
  { icon: 'favorite', title: 'Yoqqanini tanlaysiz' },
];

export default function AiDesigner(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const occasion = useAiFlowStore((state) => state.occasion);
  const style = useAiFlowStore((state) => state.style);
  const mood = useAiFlowStore((state) => state.mood);
  const setOccasion = useAiFlowStore((state) => state.setOccasion);
  const setStyle = useAiFlowStore((state) => state.setStyle);
  const setMood = useAiFlowStore((state) => state.setMood);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.close}
        >
          <Icon name="close" size={20} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.title}>
          <Text style={styles.titleAccent}>AI</Text> DESIGNER
        </Text>
        <Text style={styles.subtitle}>Shaxsiy AI stilistingiz</Text>
        <Text style={styles.lead}>
          Uslubingiz, kayfiyatingiz yoki tadbir haqida ayting — AI siz uchun mos komplekt yasaydi.
        </Text>

        {/* Gologramma va uning ikki yonidagi kartalar */}
        <View style={styles.stage}>
          <View style={styles.choices}>
            <ChoiceCard
              label="TADBIR"
              value={occasion}
              icon="orders"
              onPress={() => setOccasion(cycle<Occasion>(OCCASIONS, occasion))}
            />
            <ChoiceCard
              label="USLUB"
              value={style}
              icon="dress"
              onPress={() => setStyle(cycle<StyleName>(STYLES, style))}
            />
            <ChoiceCard
              label="KAYFIYAT"
              value={mood}
              icon="premium"
              onPress={() => setMood(cycle<Mood>(MOODS, mood))}
            />
          </View>

          <View style={styles.figure}>
            <HologramFigure size={150} />
          </View>

          <View style={styles.tiles}>
            {GARMENT_TILES.map((icon) => (
              <View key={icon} style={styles.tile}>
                <Icon name={icon} size={22} color={colors.accent} />
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.hint}>Kartani bosib o‘zgartiring</Text>

        {/* Qanday ishlaydi */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>Qanday ishlaydi?</Text>
          <View style={styles.howRow}>
            {HOW_IT_WORKS.map((step, index) => (
              <View key={step.title} style={styles.howStep}>
                <View style={styles.howIcon}>
                  <Icon name={step.icon} size={18} color={colors.accent} />
                </View>
                <Text style={styles.howText}>
                  {index + 1}. {step.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.cta}>
          <Button title="AI komplekt yasasin" onPress={() => router.push('/ai/avatar')} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, gap: spacing.xs },
  close: { alignSelf: 'flex-start', padding: spacing.xs, marginBottom: spacing.xs },

  title: { ...text.h1, color: colors.text, textAlign: 'center', letterSpacing: 0.5 },
  titleAccent: { color: colors.accent },
  subtitle: { ...text.bodyMed, color: colors.textMuted, textAlign: 'center' },
  lead: {
    ...text.small,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  figure: { flex: 1, alignItems: 'center' },
  choices: { gap: spacing.sm, width: 104 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  choicePressed: { borderColor: colors.borderAccent, backgroundColor: colors.surface2 },
  choiceText: { flex: 1 },
  choiceLabel: { ...text.tiny, color: colors.textDim, letterSpacing: 0.8 },
  choiceValue: { ...text.small, color: colors.text },
  choiceIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tiles: { gap: spacing.sm, width: 52 },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hint: { ...text.tiny, color: colors.textDim, textAlign: 'center', marginTop: spacing.xs },

  howCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  howTitle: {
    ...text.h3,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  howRow: { flexDirection: 'row', gap: spacing.sm },
  howStep: { flex: 1, alignItems: 'center', gap: spacing.xs },
  howIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howText: { ...text.tiny, color: colors.textMuted, textAlign: 'center' },

  cta: { marginTop: spacing.lg },
});
