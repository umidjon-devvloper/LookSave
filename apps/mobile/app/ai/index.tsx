import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HologramFigure } from '../../src/components/ai/HologramFigure';
import { Icon, type IconName } from '../../src/components/Icon';
import { useI18n } from '../../src/i18n';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { MOODS, OCCASIONS, STYLES, useAiFlowStore } from '../../src/store/aiFlowStore';
import { goBack } from '../../src/navigation/back';

/**
 * AI Designer — oqimning kirish ekrani.
 *
 * ⚠️ BU EKRAN DARK ATELIER. Qolgan ilova krem; AI oqimi esa moda
 * studiyasining "chiroqlar o'chdi, oyna nurlanmoqda" momenti. Hologramma
 * PNG'i qora fonda, uning atrofida ham qora kerak — brend foni emas.
 *
 * Tanlov endi bu yerda — bosilgan sari keyingi qiymatga o'tadi.
 */

const HOW_ICONS: IconName[] = ['looks', 'tryon', 'favorite'];

// AI sub-oqimidagi iliq qora palette — brend foni (#0A0A0F) va PNG (#000000)
// o'rtasida. Qora-qoraga aralashadi, lekin cream matn ustida iliqroq.
const INK = '#000000';
const INK_WARM = '#0A0906';
const INK_LINE = 'rgba(247,242,234,0.12)';
const INK_SOFT = 'rgba(247,242,234,0.06)';

function Choice<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onPick: (value: T) => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => {
        const next = options[(options.indexOf(value) + 1) % options.length];
        if (next) onPick(next);
      }}
      style={styles.choice}
    >
      <Text style={styles.choiceLabel}>{label}</Text>
      <Text style={styles.choiceValue} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

export default function AiDesigner(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useI18n((state) => state.t);

  const howItWorks: Array<{ icon: IconName; title: string }> = [
    { icon: HOW_ICONS[0]!, title: t.ai.how1 },
    { icon: HOW_ICONS[1]!, title: t.ai.how2 },
    { icon: HOW_ICONS[2]!, title: t.ai.how3 },
  ];

  const occasion = useAiFlowStore((state) => state.occasion);
  const style = useAiFlowStore((state) => state.style);
  const mood = useAiFlowStore((state) => state.mood);
  const setOccasion = useAiFlowStore((state) => state.setOccasion);
  const setStyle = useAiFlowStore((state) => state.setStyle);
  const setMood = useAiFlowStore((state) => state.setMood);

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          onPress={() => goBack('/(tabs)')}
          hitSlop={10}
          style={styles.close}
        >
          <Icon name="close" size={18} color={colors.textOnPrimary} />
        </Pressable>

        {/* Eyebrow (italic serif) + sarlavha (Fraunces hero). "AI DESIGNER"
            ALL CAPS o'rniga — editorial moda jurnali boshi. */}
        <Text style={styles.eyebrow}>Atelye · AI Mirror</Text>
        <Text style={styles.title}>Kiyinish kechasi</Text>
        <Text style={styles.subtitle}>{t.ai.subtitle}</Text>

        <Text style={styles.lead}>{t.ai.lead}</Text>

        <View style={styles.figure}>
          <HologramFigure />
        </View>

        {/* Qanday ishlaydi — ingichka chiziqli uch qadam */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>{t.ai.howTitle}</Text>
          <View style={styles.howRow}>
            {howItWorks.map((step, index) => (
              <View key={step.title} style={styles.howStep}>
                <View style={styles.howIcon}>
                  <Icon name={step.icon} size={16} color={colors.primary} />
                </View>
                <Text style={styles.howText}>
                  {index + 1}. {step.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.choices}>
          <Choice label={t.ai.occasionLabel} value={occasion} options={OCCASIONS} onPick={setOccasion} />
          <Choice label={t.ai.styleLabel} value={style} options={STYLES} onPick={setStyle} />
          <Choice label={t.ai.moodLabel} value={mood} options={MOODS} onPick={setMood} />
        </View>

        {/* Solid anor pill — AI oqimi uchun ham bir xil CTA uslubi */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ai/look')}
          style={({ pressed }) => [
            styles.cta,
            pressed && { backgroundColor: colors.primaryDim },
          ]}
        >
          <Text style={styles.ctaText}>{t.ai.makeOutfit}</Text>
          <View style={styles.ctaArrow}>
            <Icon name="next" size={18} color={colors.textOnPrimary} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Qora — hologramma PNG'ining aynan foniga mos
  root: { flex: 1, backgroundColor: INK },
  content: { flex: 1, paddingHorizontal: spacing.md, gap: spacing.xs },
  close: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: INK_LINE,
    backgroundColor: INK_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },

  eyebrow: {
    ...text.eyebrow,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Sarlavha — Fraunces hero, cream ustida qora (chunki fon qora)
  title: {
    ...text.hero,
    color: colors.textOnPrimary,
    textAlign: 'center',
    marginTop: 2,
  },
  subtitle: {
    ...text.body,
    color: 'rgba(247,242,234,0.65)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  lead: {
    ...text.small,
    color: 'rgba(247,242,234,0.45)',
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  figure: {
    flex: 1,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginHorizontal: -spacing.md,
  },

  // Dark Atelier karta — hair-thin cream chegara, shaffof ichki fon
  howCard: {
    backgroundColor: INK_SOFT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: INK_LINE,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  howTitle: {
    ...text.eyebrow,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  howRow: { flexDirection: 'row', gap: spacing.sm },
  howStep: { flex: 1, alignItems: 'center', gap: spacing.xs },
  howIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: INK_WARM,
    borderWidth: 1,
    borderColor: INK_LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howText: {
    ...text.tiny,
    color: 'rgba(247,242,234,0.7)',
    textAlign: 'center',
  },

  choices: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 0,
    marginTop: spacing.md,
  },
  choice: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: INK_LINE,
    backgroundColor: INK_SOFT,
  },
  choiceLabel: {
    ...text.eyebrow,
    color: 'rgba(247,242,234,0.5)',
  },
  choiceValue: { ...text.bodyMed, color: colors.textOnPrimary },

  cta: {
    height: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginTop: spacing.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  ctaText: { ...text.bodyMed, color: colors.textOnPrimary, flex: 1, textAlign: 'center' },
  ctaArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
