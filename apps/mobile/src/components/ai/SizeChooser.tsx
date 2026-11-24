import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n';
import { colors, radius, spacing, text } from '../../theme/tokens';
import { Button } from '../ui';

/**
 * O'lcham tanlash varag'i — primerkadan savatga qo'shishdan oldin.
 *
 * Faqat ilova o'lchamni ANIQ bilmagan kiyimlar uchun ochiladi
 * (`ai/cartSize.ts` → `null`): tavsiya yo'q yoki tavsiya etilgan o'lcham
 * omborda tugagan. Hamma kiyimga o'lcham tanlanmaguncha tasdiqlab bo'lmaydi.
 */
export interface SizeQuestion {
  variantId: string;
  title: string;
  sizes: string[];
}

interface Props {
  questions: SizeQuestion[] | null;
  onCancel: () => void;
  onConfirm: (picked: Record<string, string>) => void;
}

export function SizeChooser({ questions, onCancel, onConfirm }: Props): JSX.Element {
  const t = useI18n((state) => state.t);
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<Record<string, string>>({});

  // Har ochilganda toza boshlanadi — oldingi tanlov boshqa kiyimlarniki
  useEffect(() => {
    if (questions) setPicked({});
  }, [questions]);

  const list = questions ?? [];
  const complete = list.length > 0 && list.every((q) => picked[q.variantId] !== undefined);

  return (
    <Modal
      visible={questions !== null}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
          onPress={onCancel}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t.tryon.chooseSizeTitle}</Text>
          <Text style={styles.hint}>{t.tryon.chooseSizeHint}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {list.map((question) => (
              <View key={question.variantId} style={styles.block}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {question.title}
                </Text>
                <View style={styles.chips}>
                  {question.sizes.map((size) => {
                    const on = picked[question.variantId] === size;
                    return (
                      <Pressable
                        key={size}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${question.title} ${size}`}
                        onPress={() => setPicked((prev) => ({ ...prev, [question.variantId]: size }))}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{size}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <Button
            title={t.tryon.chooseSizeConfirm}
            icon="bag"
            pill
            disabled={!complete}
            onPress={() => onConfirm(picked)}
          />
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
            <Text style={styles.cancelText}>{t.common.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(21,19,30,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '80%',
    gap: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.xs,
  },
  title: { ...text.h3, color: colors.text },
  hint: { ...text.small, color: colors.textMuted },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: spacing.md, paddingVertical: spacing.sm },
  block: { gap: spacing.sm },
  itemTitle: { ...text.bodyMed, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { ...text.bodyMed, color: colors.text },
  chipTextOn: { color: colors.textOnPrimary },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { ...text.body, color: colors.textMuted },
});
