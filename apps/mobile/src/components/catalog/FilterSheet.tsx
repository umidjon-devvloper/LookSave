import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../Icon';
import { Button } from '../ui';
import { useI18n } from '../../i18n';
import { colors, radius, spacing, text } from '../../theme/tokens';

/**
 * Katalog filtrlari — pastdan chiqadigan panel.
 *
 * ⚠️ NEGA ALOHIDA PANEL, CHIPLAR YETMAYDIMI. Chiplar qatori kategoriya va
 * tartibni beradi, lekin narx oralig'i va jins ular bilan sig'maydi:
 * narx ikkita kiritish maydonini talab qiladi. Filtr tugmasi ilgari
 * shunchaki «kiyib ko'rish mumkin» ni almashtirardi — foydalanuvchi uchun u
 * «ishlamayotgan» tugma bo'lib ko'rinardi.
 *
 * ⚠️ HAMMA FILTRNI API BOSHIDAN QO'LLAB-QUVVATLAGAN
 * (`productsQuerySchema`: `gender`, `priceMin`, `priceMax`, `onlyTryon`,
 * `limited`). Ilovada esa `ProductFilters` tipida ularning yarmi yo'q edi,
 * ya'ni hech qachon yuborilmasdi. Bu panel o'sha bo'shliqni yopadi.
 *
 * ⚠️ QIYMATLAR FAQAT «QO'LLASH» BOSILGANDA UZATILADI. Har harfda so'rov
 * yuborilsa, narxni terish paytida katalog bir necha marta qayta
 * yuklanardi.
 */

export interface CatalogFilters {
  gender?: 'male' | 'female';
  priceMin?: number;
  priceMax?: number;
  onlyTryon: boolean;
  limited: boolean;
  /** TZ 1-qism, filtr №2 — mamlakat. Backend `s.country` ustunini qoʻllab-quvvatlaydi (UZ/AE). */
  country?: 'UZ' | 'AE';
  /** TZ 1-qism, filtr №3 — shahar. Case-insensitive solishtiriladi. */
  city?: string;
  /** TZ 1-qism, filtr №4 — tuman. */
  district?: string;
}

export const EMPTY_FILTERS: CatalogFilters = { onlyTryon: false, limited: false };

/** Faol filtrlar soni — tugmadagi belgi uchun. */
export function countFilters(filters: CatalogFilters): number {
  return (
    (filters.gender ? 1 : 0) +
    (filters.priceMin !== undefined ? 1 : 0) +
    (filters.priceMax !== undefined ? 1 : 0) +
    (filters.onlyTryon ? 1 : 0) +
    (filters.limited ? 1 : 0) +
    (filters.country ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.district ? 1 : 0)
  );
}

/** Raqamli kiritish: faqat raqam qoldiriladi, bo'sh satr `undefined` bo'ladi. */
function toNumber(value: string): number | undefined {
  const digits = value.replace(/\D/g, '');
  return digits === '' ? undefined : Number(digits);
}

function Option({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]}>
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={styles.toggleRow}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.checkbox, active && styles.checkboxActive]}>
        {active ? <Icon name="premium" size={14} color={colors.text} /> : null}
      </View>
    </Pressable>
  );
}

export function FilterSheet({
  visible,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: CatalogFilters;
  onClose: () => void;
  onApply: (next: CatalogFilters) => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const insets = useSafeAreaInsets();

  /* Panel ichidagi qoralama — «Qo'llash» bosilmaguncha tashqariga chiqmaydi */
  const [draft, setDraft] = useState<CatalogFilters>(value);
  const [minText, setMinText] = useState(value.priceMin?.toString() ?? '');
  const [maxText, setMaxText] = useState(value.priceMax?.toString() ?? '');
  const [cityText, setCityText] = useState(value.city ?? '');
  const [districtText, setDistrictText] = useState(value.district ?? '');

  /* Panel har ochilganda tashqi holatdan qayta to'ldiriladi */
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setMinText(value.priceMin?.toString() ?? '');
    setMaxText(value.priceMax?.toString() ?? '');
    setCityText(value.city ?? '');
    setDistrictText(value.district ?? '');
  }, [visible, value]);

  /*
   * ⚠️ `animationType="slide"` EMAS. U butun Modal'ni — qora fonni ham —
   * pastdan surib chiqarardi: fon panel bilan birga «ko'tarilib» kelardi.
   * Bu yerda fon joyida eriydi, panel esa eriy turib yumshoq ko'tariladi.
   *
   * Modal `visible=false` bo'lganda darhol yo'qoladi, ya'ni yopilish
   * animatsiyasi ko'rinmasdi. Shuning uchun u `mounted` bilan animatsiya
   * tugaguncha ochiq ushlab turiladi.
   */
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => anim.stop();
  }, [progress, visible]);

  const sheetShift = progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  const apply = (): void => {
    const cityTrimmed = cityText.trim();
    const districtTrimmed = districtText.trim();
    onApply({
      ...draft,
      priceMin: toNumber(minText),
      priceMax: toNumber(maxText),
      city: cityTrimmed === '' ? undefined : cityTrimmed,
      district: districtTrimmed === '' ? undefined : districtTrimmed,
    });
    onClose();
  };

  const reset = (): void => {
    setDraft(EMPTY_FILTERS);
    setMinText('');
    setMaxText('');
    setCityText('');
    setDistrictText('');
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* Fon bosilsa yopiladi — panel ichidagi bosish o'tmaydi */}
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + spacing.md,
            opacity: progress,
            transform: [{ translateY: sheetShift }],
          },
        ]}
      >
        <View style={styles.grabber} />

        <View style={styles.head}>
          <Text style={styles.title}>{t.catalog.filters}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            onPress={onClose}
            hitSlop={10}
          >
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>{t.catalog.gender}</Text>
          <View style={styles.options}>
            <Option
              label={t.catalog.genderAll}
              active={draft.gender === undefined}
              onPress={() => setDraft((d) => ({ ...d, gender: undefined }))}
            />
            <Option
              label={t.catalog.genderMale}
              active={draft.gender === 'male'}
              onPress={() => setDraft((d) => ({ ...d, gender: 'male' }))}
            />
            <Option
              label={t.catalog.genderFemale}
              active={draft.gender === 'female'}
              onPress={() => setDraft((d) => ({ ...d, gender: 'female' }))}
            />
          </View>

          <Text style={styles.section}>{t.catalog.country}</Text>
          <View style={styles.options}>
            <Option
              label={t.catalog.countryAll}
              active={draft.country === undefined}
              onPress={() => setDraft((d) => ({ ...d, country: undefined }))}
            />
            <Option
              label={t.catalog.countryUz}
              active={draft.country === 'UZ'}
              onPress={() => setDraft((d) => ({ ...d, country: 'UZ' }))}
            />
            <Option
              label={t.catalog.countryAe}
              active={draft.country === 'AE'}
              onPress={() => setDraft((d) => ({ ...d, country: 'AE' }))}
            />
          </View>

          <Text style={styles.section}>{t.catalog.city}</Text>
          <TextInput
            value={cityText}
            onChangeText={setCityText}
            placeholder={t.catalog.cityPlaceholder}
            placeholderTextColor={colors.textDim}
            style={styles.cityInput}
            autoCapitalize="words"
          />

          <Text style={styles.section}>{t.catalog.district}</Text>
          <TextInput
            value={districtText}
            onChangeText={setDistrictText}
            placeholder={t.catalog.districtPlaceholder}
            placeholderTextColor={colors.textDim}
            style={styles.cityInput}
            autoCapitalize="words"
          />

          <Text style={styles.section}>{t.catalog.price}</Text>
          <View style={styles.priceRow}>
            <View style={styles.priceField}>
              <Text style={styles.priceCaption}>{t.catalog.priceFrom}</Text>
              <TextInput
                value={minText}
                onChangeText={setMinText}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textDim}
                style={styles.priceInput}
              />
            </View>
            <View style={styles.priceField}>
              <Text style={styles.priceCaption}>{t.catalog.priceTo}</Text>
              <TextInput
                value={maxText}
                onChangeText={setMaxText}
                keyboardType="number-pad"
                placeholder="∞"
                placeholderTextColor={colors.textDim}
                style={styles.priceInput}
              />
            </View>
          </View>

          <View style={styles.toggles}>
            <Toggle
              label={t.product.tryOn}
              active={draft.onlyTryon}
              onPress={() => setDraft((d) => ({ ...d, onlyTryon: !d.onlyTryon }))}
            />
            <Toggle
              label={t.catalog.onlyLimited}
              active={draft.limited}
              onPress={() => setDraft((d) => ({ ...d, limited: !d.limited }))}
            />
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button title={t.catalog.reset} variant="ghost" onPress={reset} />
          </View>
          <View style={styles.actionButton}>
            <Button title={t.catalog.apply} onPress={apply} />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,4,9,0.6)' },
  // Atelier: pastki panel kichikroq yumaloq burchak bilan
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '76%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { ...text.h3, color: colors.text },

  section: {
    ...text.label,
    color: colors.textDim,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  options: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { ...text.small, color: colors.textMuted },
  optionTextActive: { color: colors.text, fontWeight: '600' },

  priceRow: { flexDirection: 'row', gap: spacing.sm },
  priceField: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  priceCaption: { ...text.tiny, color: colors.textDim },
  priceInput: { ...text.body, color: colors.text, padding: 0, marginTop: 2 },
  cityInput: {
    ...text.body,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: 8,
  },

  toggles: { marginTop: spacing.md, gap: spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleLabel: { ...text.body, color: colors.text },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1 },
});
