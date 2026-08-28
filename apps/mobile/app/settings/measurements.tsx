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
  HipsIcon,
  ShoeIcon,
  TapeIcon,
  WaistIcon,
  WeightIcon,
} from '../../src/components/MeasureIcons';
import { SignInRequired } from '../../src/components/SignInRequired';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * O'lchamlar 3D avatarning shaklini belgilaydi. Server ularni
 * blendshape qiymatlariga o'giradi (`morphTargets`) — formula serverda,
 * shuning uchun model o'zgarganda ilovani yangilash shart emas.
 */
type Glyph = (props: { size?: number; color?: string }) => JSX.Element;

const FIELDS: Array<{
  key: keyof Measurements;
  label: string;
  hint: string;
  unit: string;
  icon: Glyph;
}> = [
  { key: 'height', label: "BO'Y", hint: '120–220', unit: 'sm', icon: HeightIcon },
  { key: 'weight', label: 'VAZN', hint: '30–200', unit: 'kg', icon: WeightIcon },
  { key: 'chest', label: "KO'KRAK · ENG KENG JOYI", hint: '30–250', unit: 'sm', icon: ChestIcon },
  { key: 'waist', label: 'BEL · ENG INGICHKA JOYI', hint: '30–250', unit: 'sm', icon: WaistIcon },
  { key: 'hips', label: 'SON · ENG KENG JOYI', hint: '30–250', unit: 'sm', icon: HipsIcon },
  { key: 'shoeSize', label: "OYOQ O'LCHAMI", hint: '30–50', unit: 'EU', icon: ShoeIcon },
];

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

const MORPH_LABELS: Array<{ key: keyof MorphTargets; label: string }> = [
  { key: 'height', label: "Bo'y" },
  { key: 'weight', label: 'Hajm' },
  { key: 'shoulderWidth', label: 'Yelka' },
  { key: 'chest', label: "Ko'krak" },
  { key: 'waist', label: 'Bel' },
  { key: 'hips', label: 'Son' },
];

export default function MeasurementsScreen(): JSX.Element {
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => {
      // `shoeSizeSystem` matn, qolganlari son — shuning uchun alohida yig'iladi
      const input: Measurements = {};
      for (const field of FIELDS) {
        const raw = values[field.key];
        if (raw === undefined || raw.trim() === '') continue;

        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) continue;

        switch (field.key) {
          case 'height':
            input.height = parsed;
            break;
          case 'weight':
            input.weight = parsed;
            break;
          case 'chest':
            input.chest = parsed;
            break;
          case 'waist':
            input.waist = parsed;
            break;
          case 'hips':
            input.hips = parsed;
            break;
          case 'shoeSize':
            input.shoeSize = parsed;
            break;
          default:
            break;
        }
      }
      return updateMeasurements(input);
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError && err.code === 'VALIDATION_ERROR'
          ? "O'lchamlardan biri chegaradan chiqdi. Qiymatlarni tekshiring."
          : "Saqlab bo'lmadi",
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

  if (profile.isLoading) return <Loading />;
  if (profile.isError || !profile.data) {
    return <ErrorView message="Profilni yuklab bo'lmadi" onRetry={() => void profile.refetch()} />;
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
            accessibilityLabel="O'lchamlarim"
            onPress={() => router.back()}
            style={styles.roundButton}
          >
            <Icon name="back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>O'lchamlarim</Text>
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
            <Text style={styles.introText}>
              O'lchamlar avatar shaklini belgilaydi — kiyim qanday o'tirishini yaqinroq ko'rasiz.
              Bo'y majburiy, qolganlari ixtiyoriy.
            </Text>
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
                      {field.label} ({field.unit})
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
                      <Text style={styles.unitText}>{field.unit}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

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
              <Icon name="tryon" size={18} color={colors.text} />
              <Text style={styles.saveText}>{saved ? 'Saqlandi' : 'Saqlash'}</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.morphs}>
            <View style={styles.morphHead}>
              <Text style={styles.morphTitle}>Avatar shakli</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/tryon')}
                style={styles.morphLink}
              >
                <Text style={styles.morphLinkText}>Ko'rish</Text>
                <Icon name="next" size={14} color={colors.accent} />
              </Pressable>
            </View>

            <View style={styles.morphIntro}>
              <View style={styles.morphAvatar}>
                <FitIcon size={26} color={colors.text} />
              </View>
              <Text style={styles.hint}>
                {isNeutral
                  ? "Bo'y kiritilmagan — standart shakl ko'rsatiladi. Aylana o'lchamlarini bo'ysiz hisoblab bo'lmaydi."
                  : "Sizning o'lchamlaringiz asosida avatar shaklingiz yangilanadi."}
              </Text>
            </View>

            {MORPH_LABELS.map((morph) => (
              <MorphBar key={morph.key} label={morph.label} value={morphs[morph.key]} />
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
  saveText: { ...text.bodyMed, color: colors.text, fontWeight: '700' },

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
