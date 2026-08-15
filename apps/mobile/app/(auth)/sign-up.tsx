import { registerSchema } from '@looksave/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { ApiError } from '../../src/api/client';
import { Button, Field } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, spacing, text } from '../../src/theme/tokens';

/**
 * Validatsiya `@looksave/validation` dan — server bilan AYNAN bir xil sxema.
 * Shunda "server rad etdi, lekin ilova o'tkazib yubordi" holati bo'lmaydi.
 */
export default function SignUp(): JSX.Element {
  const router = useRouter();
  const signUp = useAuthStore((state) => state.signUp);
  const t = useI18n((state) => state.t);

  const [phone, setPhone] = useState('+998');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setError(null);

    const input = { phone: phone.replace(/\s/g, ''), fullName: fullName.trim(), password };
    const parsed = registerSchema.safeParse(input);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setBusy(true);

    try {
      await signUp(input);
      router.replace('/(tabs)');
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'ALREADY_EXISTS'
          ? 'Bu raqam bilan akkaunt bor. Kirish sahifasiga o`ting.'
          : err instanceof ApiError
            ? err.message
            : "Ro'yxatdan o'tib bo'lmadi",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t.auth.signUp}</Text>
        <Text style={styles.subtitle}>
          Telefon raqami buyurtmalar uchun ishlatiladi — sotuvchi shu raqamga qo'ng'iroq qiladi.
        </Text>

        <Field
          label={t.auth.phone}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="+998901234567"
          error={fieldErrors['phone'] ?? null}
        />

        <Field
          label={t.auth.fullName}
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          placeholder="Aziz Karimov"
          error={fieldErrors['fullName'] ?? null}
        />

        <Field
          label={t.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="Kamida 8 belgi"
          error={fieldErrors['password'] ?? null}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title={t.auth.start} onPress={() => void submit()} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  title: { ...text.h2, color: colors.text },
  subtitle: {
    ...text.small,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  error: { ...text.small, color: colors.danger, marginBottom: spacing.sm },
});
