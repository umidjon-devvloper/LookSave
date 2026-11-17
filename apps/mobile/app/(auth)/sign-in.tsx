import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { explainError } from '../../src/api/explainError';
import { Icon } from '../../src/components/Icon';
import { goBack } from '../../src/navigation/back';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Kirish ekrani — Atelier editorial.
 *
 * Ilgari to'liq ekranli photo bg + dark glass fieldlar bor edi
 * (SaaS auth-screen klişesi). Atelier'da: krem fon, ozgina
 * tipografika, chiziqli maydonlar. Form moda jurnaldagi sahifa
 * oyoqligi (masthead) kabi tartib bilan joylashadi.
 */
export default function SignIn(): JSX.Element {
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);
  const t = useI18n((state) => state.t);
  const locale = useI18n((state) => state.locale);
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('+998');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<'phone' | 'password' | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await signIn(phone.replace(/\s/g, ''), password);
      const user = useAuthStore.getState().user;
      router.replace(user?.role === 'store_owner' ? '/seller' : '/(tabs)');
    } catch (err) {
      setError(explainError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.bg}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Yuqori: faqat orqaga tugma */}
          <View style={styles.topRow}>
            <Pressable
              style={styles.backBtn}
              onPress={() => goBack('/(tabs)')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Icon name="back" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Sarlavha */}
          <View style={styles.header}>
            <Text style={styles.title}>{t.auth.signIn}</Text>
          </View>

          {/* ── PHONE ── */}
          <Text style={styles.label}>{t.auth.phone}</Text>
          <View style={[styles.field, focused === 'phone' && styles.fieldOn]}>
            <Text style={styles.at}>+</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="998 90 123 45 67"
              placeholderTextColor={colors.textDim}
              onFocus={() => setFocused('phone')}
              onBlur={() => setFocused(null)}
            />
          </View>

          {/* ── PASSWORD ── */}
          <Text style={styles.label}>{t.auth.password}</Text>
          <View style={[styles.field, focused === 'password' && styles.fieldOn]}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoComplete="current-password"
              textContentType="password"
              placeholder={t.auth.passwordPlaceholder}
              placeholderTextColor={colors.textDim}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
            <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={10}>
              <Icon name={showPass ? 'eyeOff' : 'eye'} size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/*
            Parolni tiklash — yordam xizmati orqali (SMS kodi yo'q, API'da tiklash
            yo'li ham yo'q): tugma yordam sahifasini qurilma tilida ochadi.
            Ilgari bu tugmada `onPress` umuman yo'q edi — bosilsa hech narsa
            bo'lmasdi; App Review aynan shunday «o'lik» tugmalar uchun 2.1 bilan
            qaytaradi.
          */}
          <Pressable
            style={styles.forgotWrap}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => void Linking.openURL(`https://looksave.uz/${locale}/support`)}
          >
            <Text style={styles.forgotText}>{t.auth.forgotPassword}</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* ── Submit tugmasi — to'ldirilgan anor, gradient yo'q ── */}
          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && { backgroundColor: colors.primaryDim },
              busy && { opacity: 0.6 },
            ]}
            onPress={() => void submit()}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>
              {busy ? `${t.common.loading}…` : t.auth.signIn}
            </Text>
            <View style={styles.submitArrow}>
              <Icon name="next" size={18} color={colors.textOnPrimary} />
            </View>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xs },

  /* ── Yuqori qator ── */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  // Atelier: orqaga tugma — toza oq doira, ink ikonka, hair-thin chegara
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    ...text.eyebrow,
    color: colors.textMuted,
    textAlign: 'right',
    maxWidth: 220,
  },

  /* ── Sarlavha bloki ── */
  header: { marginTop: spacing.sm, marginBottom: spacing.lg },
  eyebrow: { ...text.eyebrow, color: colors.textMuted, marginBottom: spacing.sm },
  title: { ...text.hero, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...text.body, color: colors.textMuted, maxWidth: '92%' },

  /* ── Label ── (template ALL CAPS o'rniga italic serif) */
  label: {
    ...text.eyebrow,
    color: colors.textDim,
    marginTop: spacing.md,
    marginBottom: 6,
  },

  /* ── Field ── (cream fon, hair-thin chegara, fokusga anor) */
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 56,
    gap: spacing.sm,
  },
  fieldOn: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  at: { ...text.h3, color: colors.primary },
  input: {
    flex: 1,
    ...text.body,
    color: colors.text,
    paddingVertical: 0,
  },

  /* Forgot — italic serif link */
  forgotWrap: { alignSelf: 'flex-end', marginTop: spacing.sm },
  forgotText: { ...text.eyebrow, color: colors.primary },

  /* Error */
  error: { ...text.small, color: colors.danger, textAlign: 'center', marginTop: spacing.xs },

  /* ── Submit — to'ldirilgan anor pill, gradient yo'q ── */
  submitBtn: {
    height: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginTop: spacing.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  submitText: { ...text.bodyMed, color: colors.textOnPrimary, flex: 1, textAlign: 'center' },
  submitArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hint */
  hint: {
    ...text.small,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },

  /* ── Pastki qator ── Hairline rule + italic sloganlar */
  bottomRow: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  rule: { height: 1, backgroundColor: colors.border },
  badgesCol: { gap: 2 },
  sloganText: { ...text.eyebrow, color: colors.textDim },
});
