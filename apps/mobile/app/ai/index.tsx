import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HologramFigure } from '../../src/components/ai/HologramFigure';
import { Icon, type IconName } from '../../src/components/Icon';
import { useI18n } from '../../src/i18n';
import { aiOptionLabel } from '../../src/i18n/aiOptions';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import {
  MOODS,
  OCCASIONS,
  STYLES,
  useAiFlowStore,
  type Mood,
  type Occasion,
  type StyleName,
} from '../../src/store/aiFlowStore';
import { goBack } from '../../src/navigation/back';

/**
 * AI Designer — oqimning kirish ekrani.
 *
 * ⚠️ EKRAN YORUG' (2026-11-17). Ilgari u ataylab qora edi («dark atelier»),
 * qolgan ilova esa oq — ikkita mavzu yonma-yon turib, ilova chala
 * ko'rinardi. Endi fon ham, kartalar ham umumiy tokenlardan.
 *
 * Yagona qora joy — gologramma «sahnasi»: rasmning o'z foni sof qora va
 * shaffof emas (`HologramFigure`), shuning uchun u yumaloq qora ramka ichida
 * turadi. Bosh sahifadagi qorong'i banner bilan bir xil usul: yorug' sahifa,
 * ichida ramkaga olingan qorong'i tasvir.
 *
 * Tanlov shu yerda — bosilgan sari keyingi qiymatga o'tadi.
 */

const HOW_ICONS: IconName[] = ['looks', 'tryon', 'favorite'];

/** Gologramma PNG'ining foni — ramka aynan shu rangda bo'lmasa chekkasi ko'rinadi */
const STAGE = '#000000';

function Choice<T extends Occasion | StyleName | Mood>({
  label,
  value,
  options,
  display,
  onPick,
}: {
  label: string;
  value: T;
  options: readonly T[];
  display: (value: T) => string;
  onPick: (value: T) => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${display(value)}`}
      onPress={() => {
        const next = options[(options.indexOf(value) + 1) % options.length];
        if (next) onPick(next);
      }}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
    >
      <Text style={styles.choiceLabel}>{label}</Text>
      <Text style={styles.choiceValue} numberOfLines={1}>
        {display(value)}
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

  const display = (value: Occasion | StyleName | Mood): string => aiOptionLabel(t, value);

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
          accessibilityLabel={t.fitting.back}
          onPress={() => goBack('/(tabs)')}
          hitSlop={10}
          style={({ pressed }) => [styles.close, pressed && styles.choicePressed]}
        >
          <Icon name="close" size={18} color={colors.text} />
        </Pressable>

        <Text style={styles.title}>{t.ai.title}</Text>
        <Text style={styles.lead}>{t.ai.lead}</Text>

        {/* Qora rasm — yumaloq ramkada; atrofi yorug' qoladi */}
        <View style={styles.stage}>
          <HologramFigure />
        </View>

        {/* Qanday ishlaydi — uch qadam */}
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
          <Choice
            label={t.ai.occasionLabel}
            value={occasion}
            options={OCCASIONS}
            display={display}
            onPick={setOccasion}
          />
          <Choice
            label={t.ai.styleLabel}
            value={style}
            options={STYLES}
            display={display}
            onPick={setStyle}
          />
          <Choice
            label={t.ai.moodLabel}
            value={mood}
            options={MOODS}
            display={display}
            onPick={setMood}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ai/look')}
          style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.primaryDim }]}
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
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.md, gap: spacing.xs },
  close: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },

  title: {
    ...text.h1,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  lead: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  // Rasm qolgan bo'sh joyni egallaydi; ramka uni ekran chetidan ajratib turadi
  stage: {
    flex: 1,
    marginTop: spacing.md,
    borderRadius: radius.xxl,
    backgroundColor: STAGE,
    overflow: 'hidden',
  },

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
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  howRow: { flexDirection: 'row', gap: spacing.sm },
  howStep: { flex: 1, alignItems: 'center', gap: spacing.xs },
  howIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howText: {
    ...text.tiny,
    color: colors.textMuted,
    textAlign: 'center',
  },

  choices: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  choice: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choicePressed: { backgroundColor: colors.surface2 },
  choiceLabel: {
    ...text.small,
    color: colors.textDim,
  },
  choiceValue: { ...text.bodyMed, color: colors.text },

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
