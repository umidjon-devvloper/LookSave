import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '../../src/api/client';
import {
  getFullProfile,
  updateMeasurements,
  type Measurements,
  type MorphTargets,
} from '../../src/api/endpoints';
import { Button, ErrorView, Field, Loading, Screen } from '../../src/components/ui';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * O'lchamlar 3D avatarning shaklini belgilaydi. Server ularni
 * blendshape qiymatlariga o'giradi (`morphTargets`) — formula serverda,
 * shuning uchun model o'zgarganda ilovani yangilash shart emas.
 */
const FIELDS: Array<{ key: keyof Measurements; label: string; hint: string }> = [
  { key: 'height', label: "Bo'y (sm)", hint: '120–220' },
  { key: 'weight', label: 'Vazn (kg)', hint: '30–200' },
  { key: 'chest', label: "Ko'krak (sm)", hint: 'eng keng joyi' },
  { key: 'waist', label: 'Bel (sm)', hint: 'eng ingichka joyi' },
  { key: 'hips', label: 'Son (sm)', hint: 'eng keng joyi' },
  { key: 'shoeSize', label: "Oyoq o'lchami (EU)", hint: '30–50' },
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
  const profile = useQuery({ queryKey: ['profile'], queryFn: getFullProfile });

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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            O'lchamlar avatar shaklini belgilaydi — kiyim qanday o'tirishini yaqinroq ko'rasiz. Bo'y
            majburiy, qolganlari ixtiyoriy.
          </Text>

          {FIELDS.map((field) => (
            <Field
              key={field.key}
              label={`${field.label} · ${field.hint}`}
              value={values[field.key] ?? ''}
              onChangeText={(next) => {
                setSaved(false);
                setError(null);
                setValues((prev) => ({ ...prev, [field.key]: next.replace(/[^\d]/g, '') }));
              }}
              keyboardType="number-pad"
              placeholder="—"
            />
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={saved ? 'Saqlandi' : 'Saqlash'}
            loading={save.isPending}
            onPress={() => {
              setError(null);
              save.mutate();
            }}
          />

          <View style={styles.morphs}>
            <Text style={styles.morphTitle}>Avatar shakli</Text>
            {isNeutral ? (
              <Text style={styles.hint}>
                Bo'y kiritilmagan — standart shakl ko'rsatiladi. Aylana o'lchamlarini bo'ysiz
                hisoblab bo'lmaydi.
              </Text>
            ) : null}
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
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...text.small, color: colors.textMuted, marginBottom: spacing.lg },
  error: { ...text.small, color: colors.danger, marginBottom: spacing.sm },
  hint: { ...text.small, color: colors.textDim, marginBottom: spacing.sm },
  morphs: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  morphTitle: { ...text.label, color: colors.textDim, marginBottom: spacing.xs },
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
