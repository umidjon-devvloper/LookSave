import { personNameSchema } from '@looksave/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { explainError } from '../../src/api/explainError';
import { getFullProfile, updateProfile } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { AvatarPicker } from '../../src/components/profile/AvatarPicker';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button, ErrorView, Field, Loading } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { goBack } from '../../src/navigation/back';
import { useAuthStore } from '../../src/store/authStore';
import { phone as formatPhone } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

type Gender = 'male' | 'female';

/**
 * Profilni tahrirlash — surat, ism va jins.
 *
 * ⚠️ TELEFON O'ZGARTIRILMAYDI. U akkauntning kaliti (kirish, buyurtma
 * aloqasi, do'kon bilan bog'lanish) va tasdiqlangan raqam sifatida
 * saqlanadi. Almashtirish SMS tasdig'ini talab qiladi — u alohida oqim.
 *
 * ⚠️ SURAT DARHOL SAQLANADI, ism va jins esa «Saqlash» bilan. Surat
 * yuklash o'zi bir necha soniya oladi va profil sahifasida ham xuddi
 * shunday ishlaydi — ikki joyda ikki xil xatti-harakat chalkashtirardi.
 *
 * ⚠️ JINS AVATARGA TA'SIR QILADI. AI avatar tavsifi shundan quriladi
 * (`avatar-prompt.ts` → personWord). Shuning uchun u shu yerda turadi.
 */
export default function EditProfile(): JSX.Element {
  const t = useI18n((state) => state.t);
  const status = useAuthStore((state) => state.status);
  const setUser = useAuthStore((state) => state.setUser);
  // Profil sahifasi bilan bir xil zaxira: surat avval auth store'ga tushadi
  const storedAvatar = useAuthStore((state) => state.user?.avatarUrl ?? null);
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: getFullProfile,
    enabled: status === 'signedIn',
  });

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Forma serverdagi qiymat bilan to'ldiriladi — bir marta, keyin foydalanuvchiniki
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !profile.data) return;
    setFullName(profile.data.fullName ?? '');
    setGender(profile.data.gender);
    setSeeded(true);
  }, [profile.data, seeded]);

  const syncUser = (updated: Awaited<ReturnType<typeof updateProfile>>): void => {
    queryClient.setQueryData(['profile'], updated);
    // Ism va surat boshqa ekranlarda auth store'dan o'qiladi
    setUser({
      id: updated.id,
      phone: updated.phone,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
      gender: updated.gender,
      locale: updated.locale,
      country: updated.country,
      avatarUrl: updated.avatarUrl,
      createdAt: updated.createdAt,
    });
  };

  const saveAvatar = useMutation({
    mutationFn: (avatarUrl: string) => updateProfile({ avatarUrl }),
    onSuccess: syncUser,
  });

  const save = useMutation({
    mutationFn: (input: { fullName: string; gender?: Gender }) => updateProfile(input),
    onSuccess: (updated) => {
      syncUser(updated);
      goBack('/profile');
    },
    onError: (err: unknown) => {
      // Serverning matni o'zbekcha — ekranga kod bo'yicha tarjima chiqadi
      setError(explainError(err, t));
    },
  });

  if (status !== 'signedIn') {
    return <SignInRequired title={t.profile.editProfile} hint={t.auth.requiredHint} />;
  }
  if (profile.isLoading) return <Loading />;
  if (profile.isError || !profile.data) {
    return <ErrorView error={profile.error} onRetry={() => void profile.refetch()} />;
  }

  const data = profile.data;
  const trimmed = fullName.trim();
  const changed = trimmed !== (data.fullName ?? '') || gender !== data.gender;

  const submit = (): void => {
    setError(null);
    // Server bilan bir xil qoida — xato so'rovsiz, maydon ostida ko'rinadi
    const parsed = personNameSchema.safeParse(trimmed);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? t.errors.generic);
      return;
    }
    setNameError(null);
    save.mutate({ fullName: parsed.data, ...(gender ? { gender } : {}) });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarBlock}>
          <AvatarPicker
            url={data.avatarUrl ?? storedAvatar}
            name={trimmed || data.fullName}
            onChange={async (url) => {
              await saveAvatar.mutateAsync(url);
            }}
            labels={{
              change: t.profile.changePhoto,
              permission: t.profile.photoPermission,
              failed: t.profile.photoFailed,
            }}
          />
          <Text style={styles.avatarHint}>{t.profile.changePhoto}</Text>
        </View>

        <Field
          label={t.auth.fullName}
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            if (nameError) setNameError(null);
          }}
          error={nameError}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={64}
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        <Text style={styles.label}>{t.catalog.gender}</Text>
        <View style={styles.genderRow}>
          {(['male', 'female'] as const).map((option) => {
            const active = gender === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setGender(option)}
                style={[styles.genderOption, active && styles.genderOptionActive]}
              >
                <Text style={[styles.genderText, active && styles.genderTextActive]}>
                  {option === 'male' ? t.profile.male : t.profile.female}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t.auth.phone}</Text>
        <View style={styles.phoneBox}>
          <Text style={styles.phoneText}>{formatPhone(data.phone)}</Text>
          <Icon name="lock" size={16} color={colors.textDim} />
        </View>
        <Text style={styles.hint}>{t.profile.phoneLocked}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            title={t.profile.save}
            icon="check"
            loading={save.isPending}
            disabled={!changed || saveAvatar.isPending}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { padding: spacing.md, paddingBottom: spacing.xxl },

  avatarBlock: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  avatarHint: { ...text.small, color: colors.textMuted },

  label: { ...text.label, color: colors.textDim, marginBottom: spacing.sm },

  genderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  genderOption: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderOptionActive: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  genderText: { ...text.bodyMed, color: colors.textMuted },
  genderTextActive: { color: colors.text },

  phoneBox: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneText: { ...text.body, color: colors.textMuted },
  hint: { ...text.small, color: colors.textDim, marginTop: spacing.xs },

  error: { ...text.small, color: colors.danger, marginTop: spacing.md },
  actions: { marginTop: spacing.xl },
});
