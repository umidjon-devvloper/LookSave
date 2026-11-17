import { CLOTHING_SIZES, SHOE_SIZES, type SizeLabel } from '@looksave/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../src/api/client';
import {
  getFullProfile,
  updateMeasurements,
  type Measurements,
  type MorphTargets,
} from '../../src/api/endpoints';
import { ErrorView, Loading, Screen } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import {
  ChestIcon,
  FitIcon,
  HeightIcon,
  ShoeIcon,
  TapeIcon,
  WaistIcon,
  WeightIcon,
} from '../../src/components/MeasureIcons';
import { SignInRequired } from '../../src/components/SignInRequired';
import { SizeChips } from '../../src/components/SizeChips';
import { useI18n, type Dictionary } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * O'lchamlar 3D avatarning shaklini belgilaydi. Server ularni
 * blendshape qiymatlariga o'giradi (`morphTargets`) — formula serverda,
 * shuning uchun model o'zgarganda ilovani yangilash shart emas.
 */
type Glyph = (props: { size?: number; color?: string }) => JSX.Element;

/*
 * ⚠️ RAQAM FAQAT BO'Y VA VAZN (2026-09-25). Ko'krak, bel va son aylanasi
 * (sm) olib tashlandi — xaridor ularni o'lchay olmaydi. Ularning o'rnida
 * razmer chiplari (`SIZE_GROUPS`). Bo'y va vazn esa avatar gavdasi uchun
 * shart (`missingForAvatar`).
 */
const FIELDS: Array<{
  key: 'height' | 'weight';
  labelKey: keyof Dictionary['measurements'];
  hint: string;
  unitKey: keyof Dictionary['measurements'];
  icon: Glyph;
}> = [
  { key: 'height', labelKey: 'heightLabel', hint: '120–220', unitKey: 'unitCm', icon: HeightIcon },
  { key: 'weight', labelKey: 'weightLabel', hint: '30–200', unitKey: 'unitKg', icon: WeightIcon },
];

interface Sizes {
  topSize: SizeLabel | null;
  bottomSize: SizeLabel | null;
  shoeSize: number | null;
}

const EMPTY_SIZES: Sizes = { topSize: null, bottomSize: null, shoeSize: null };

function asSize(value: unknown): SizeLabel | null {
  return typeof value === 'string' && (CLOTHING_SIZES as readonly string[]).includes(value)
    ? (value as SizeLabel)
    : null;
}

/** Blendshape qiymati 0…1 — foydalanuvchiga chiziq sifatida ko'rsatiladi. */
function MorphBar({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <View style={styles.morphRow}>
      <Text style={styles.morphLabel}>{label}</Text>
      <View style={styles.morphTrack}>
        <View style={[styles.morphFill, { width: `${Math.round(value * 100)}%` }]} />
      </View>
    </View>
  );
}

const MORPH_LABELS: Array<{ key: keyof MorphTargets; labelKey: keyof Dictionary['measurements'] }> = [
  { key: 'height', labelKey: 'morphHeight' },
  { key: 'weight', labelKey: 'morphVolume' },
  { key: 'shoulderWidth', labelKey: 'morphShoulder' },
  { key: 'chest', labelKey: 'morphChest' },
  { key: 'waist', labelKey: 'morphWaist' },
  { key: 'hips', labelKey: 'morphHips' },
];

export default function MeasurementsScreen(): JSX.Element {
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useI18n((state) => state.t);

  /*
   * ⚠️ QOROVUL BARCHA HOOKLARDAN KEYIN QAYTARADI, lekin holat SHU YERDA
   * o'qiladi: erta `return` hooklar tartibini buzadi va React qulaydi.
   */
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: getFullProfile,
    enabled: signedIn,
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [sizes, setSizes] = useState<Sizes>(EMPTY_SIZES);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    const initial: Record<string, string> = {};
    for (const field of FIELDS) {
      const value = profile.data.measurements[field.key];
      if (typeof value === 'number') initial[field.key] = String(value);
    }
    setValues(initial);
    const saved = profile.data.measurements;
    setSizes({
      topSize: asSize(saved.topSize),
      bottomSize: asSize(saved.bottomSize),
      shoeSize: typeof saved.shoeSize === 'number' ? saved.shoeSize : null,
    });
  }, [profile.data]);

  const pickSize = <K extends keyof Sizes>(key: K, next: Sizes[K]): void => {
    setSaved(false);
    setError(null);
    setSizes((prev) => ({ ...prev, [key]: next }));
  };

  const save = useMutation({
    mutationFn: () => {
      const input: Measurements = {};
      for (const field of FIELDS) {
        const raw = values[field.key];
        if (raw === undefined || raw.trim() === '') continue;

        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) continue;

        if (field.key === 'height') input.height = parsed;
        else input.weight = parsed;
      }
      if (sizes.topSize) input.topSize = sizes.topSize;
      if (sizes.bottomSize) input.bottomSize = sizes.bottomSize;
      if (sizes.shoeSize !== null) input.shoeSize = sizes.shoeSize;
      return updateMeasurements(input);
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError && err.code === 'VALIDATION_ERROR'
          ? t.measurements.validationError
          : t.measurements.saveFailed,
      );
    },
  });

  // Kirmagan foydalanuvchiga xato emas, sabab ko'rsatiladi
  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired />
      </Screen>
    );
  }

  if (profile.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorView message={t.measurements.profileLoadError} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }

  const morphs = save.data?.morphTargets ?? profile.data.morphTargets;
  const isNeutral = Object.values(morphs).every((value) => value === 0.5);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            onPress={() => goBack('/profile')}
            style={styles.roundButton}
          >
            <Icon name="back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>{t.profile.myMeasurements}</Text>
          {/* O'ng tomonda muvozanat uchun bo'sh joy — sarlavha markazda tursin */}
          <View style={styles.roundButtonGhost} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Nima uchun kerakligini tushuntiruvchi blok */}
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <TapeIcon size={30} color={colors.accent} />
            </View>
            <Text style={styles.introText}>{t.measurements.intro}</Text>
          </View>

          {FIELDS.map((field) => {
            const Glyph = field.icon;
            return (
              <View key={field.key} style={styles.fieldCard}>
                <View style={styles.fieldIcon}>
                  <Glyph size={26} color={colors.accent} />
                </View>

                <View style={styles.fieldBody}>
                  <View style={styles.fieldHead}>
                    <Text style={styles.fieldLabel} numberOfLines={1}>
                      {t.measurements[field.labelKey]} ({t.measurements[field.unitKey]})
                    </Text>
                    <Text style={styles.fieldRange}>{field.hint}</Text>
                  </View>

                  <View style={styles.inputRow}>
                    <TextInput
                      value={values[field.key] ?? ''}
                      onChangeText={(next) => {
                        setSaved(false);
                        setError(null);
                        setValues((prev) => ({
                          ...prev,
                          [field.key]: next.replace(/[^\d]/g, ''),
                        }));
                      }}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor={colors.textDim}
                      style={styles.input}
                    />
                    <View style={styles.unit}>
                      <Text style={styles.unitText}>{t.measurements[field.unitKey]}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.fieldCard}>
            <View style={styles.fieldIcon}>
              <ChestIcon size={26} color={colors.accent} />
            </View>
            <View style={styles.fieldBody}>
              <Text style={styles.fieldLabel}>{t.measurements.topSizeLabel}</Text>
              <Text style={styles.sizeHint}>{t.measurements.topSizeHint}</Text>
              <SizeChips
                options={CLOTHING_SIZES}
                value={sizes.topSize}
                onChange={(next) => pickSize('topSize', next)}
                accessibilityLabel={t.measurements.topSizeLabel}
              />
            </View>
          </View>

          <View style={styles.fieldCard}>
            <View style={styles.fieldIcon}>
              <WaistIcon size={26} color={colors.accent} />
            </View>
            <View style={styles.fieldBody}>
              <Text style={styles.fieldLabel}>{t.measurements.bottomSizeLabel}</Text>
              <Text style={styles.sizeHint}>{t.measurements.bottomSizeHint}</Text>
              <SizeChips
                options={CLOTHING_SIZES}
                value={sizes.bottomSize}
                onChange={(next) => pickSize('bottomSize', next)}
                accessibilityLabel={t.measurements.bottomSizeLabel}
              />
            </View>
          </View>

          <View style={styles.fieldCard}>
            <View style={styles.fieldIcon}>
              <ShoeIcon size={26} color={colors.accent} />
            </View>
            <View style={styles.fieldBody}>
              <Text style={styles.fieldLabel}>{t.measurements.shoeSizeLabel}</Text>
              <Text style={styles.sizeHint}>{t.measurements.shoeSizeHint}</Text>
              <SizeChips
                options={SHOE_SIZES}
                value={sizes.shoeSize as (typeof SHOE_SIZES)[number] | null}
                onChange={(next) => pickSize('shoeSize', next)}
                accessibilityLabel={t.measurements.shoeSizeLabel}
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={save.isPending}
            onPress={() => {
              setError(null);
              save.mutate();
            }}
          >
            <LinearGradient
              colors={[colors.accent, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.saveButton, save.isPending && { opacity: 0.6 }]}
            >
              <Icon name="tryon" size={18} color={colors.textOnPrimary} />
              <Text style={styles.saveText}>
                {saved ? t.measurements.saved : t.measurements.save}
              </Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.morphs}>
            <View style={styles.morphHead}>
              <Text style={styles.morphTitle}>{t.measurements.avatarShape}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/tryon')}
                style={styles.morphLink}
              >
                <Text style={styles.morphLinkText}>{t.measurements.view}</Text>
                <Icon name="next" size={14} color={colors.accent} />
              </Pressable>
            </View>

            <View style={styles.morphIntro}>
              <View style={styles.morphAvatar}>
                <FitIcon size={26} color={colors.text} />
              </View>
              <Text style={styles.hint}>
                {isNeutral ? t.measurements.neutralHint : t.measurements.shapeHint}
              </Text>
            </View>

            {MORPH_LABELS.map((morph) => (
              <MorphBar
                key={morph.key}
                label={t.measurements[morph.labelKey]}
                value={morphs[morph.key]}
              />
            ))}
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  sizeHint: { ...text.small, color: colors.textDim, marginTop: 2, marginBottom: spacing.sm },
  topTitle: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
  },
  // Sarlavhani markazda ushlab turadigan ko'rinmas muvozanat
  roundButtonGhost: { width: 44, height: 44 },

  content: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xxl, gap: spacing.sm },

  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  introIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  introText: { ...text.small, color: colors.textMuted, flex: 1 },

  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySoft,
  },
  fieldBody: { flex: 1, gap: spacing.xs },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  fieldLabel: { ...text.tiny, color: colors.textMuted, letterSpacing: 1, flexShrink: 1 },
  fieldRange: { ...text.tiny, color: colors.accent, fontWeight: '700' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  input: { ...text.h3, color: colors.text, flex: 1, padding: 0, paddingVertical: spacing.xs },
  unit: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  unitText: { ...text.tiny, color: colors.textMuted, fontWeight: '600' },

  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    // iOS'da rangli soya nurlanish beradi (06-dizayn.md §5)
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  saveText: { ...text.bodyMed, color: colors.textOnPrimary, fontWeight: '700' },

  error: { ...text.small, color: colors.danger },
  hint: { ...text.small, color: colors.textDim, flex: 1 },

  morphs: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  morphHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  morphLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  morphLinkText: { ...text.small, color: colors.accent, fontWeight: '600' },
  morphIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  morphAvatar: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  morphTitle: { ...text.label, color: colors.accent },
  morphRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  morphLabel: { ...text.small, color: colors.textMuted, width: 70 },
  morphTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  morphFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
});
