import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { ApiError } from '../../src/api/client';
import { Button, Field } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, spacing, text } from '../../src/theme/tokens';

export default function SignIn(): JSX.Element {
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);
  const t = useI18n((state) => state.t);

  const [phone, setPhone] = useState('+998');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await signIn(phone.replace(/\s/g, ''), password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.errors.generic);
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
        <Text style={styles.title}>{t.auth.signIn}</Text>

        <Field
          label={t.auth.phone}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="+998901234567"
        />

        <Field
          label={t.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title={t.auth.signIn} onPress={() => void submit()} loading={busy} />

        <Text style={styles.hint}>
          Parolni unutdingizmi? Hozircha qo'llab-quvvatlash xizmatiga yozing — tiklash tez orada
          qo'shiladi.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xs },
  title: { ...text.h2, color: colors.text, marginBottom: spacing.lg },
  error: { ...text.small, color: colors.danger, marginBottom: spacing.sm },
  hint: { ...text.small, color: colors.textDim, marginTop: spacing.md },
});
