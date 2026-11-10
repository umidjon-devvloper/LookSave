import { registerSchema } from '@looksave/validation';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../src/api/client';
import { Icon } from '../../src/components/Icon';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Ro'yxatdan o'tish — 5 bosqich, Atelier editorial.
 *
 * ⚠️ Backend hozircha faqat `{ phone, fullName, password }` qabul qiladi.
 * Qolgan maydonlar (username, joylashuv, akkaunt turi) lokal `SecureStore`
 * ga yoziladi — keyingi qismda profilga biriktiriladi.
 */

type Step = 1 | 2 | 3 | 4 | 5;
type AccountType = 'buyer' | 'seller';
type LocationMode = 'auto' | 'manual' | null;
type Coords = { lat: number; lon: number } | null;

const EXTRAS_KEY = 'signup.extras.v1';

export default function SignUp(): JSX.Element {
  const router = useRouter();
  const signUp = useAuthStore((state) => state.signUp);
  const t = useI18n((state) => state.t);
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>(1);

  // 1-bosqich
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [username, setUsername] = useState('');

  // 2-bosqich
  const [phone, setPhone] = useState('+998');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // 3-bosqich
  const [locMode, setLocMode] = useState<LocationMode>(null);
  const [coords, setCoords] = useState<Coords>(null);
  const [locBusy, setLocBusy] = useState(false);

  // 4-bosqich
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  function next(): void {
    setFieldErr(null);
    setError(null);
    if (step === 1) {
      if (name.trim().length < 2) return setFieldErr(t.auth.errName);
      if (surname.trim().length < 2) return setFieldErr(t.auth.errSurname);
      if (username.trim().length > 0 && username.trim().length < 3) {
        return setFieldErr(t.auth.errUsername);
      }
    }
    if (step === 2) {
      if (phone.replace(/\D/g, '').length < 9) return setFieldErr(t.auth.errPhone);
      if (password.length < 8) return setFieldErr(t.auth.errPasswordShort);
    }
    if (step === 3) {
      if (!locMode) return setFieldErr(t.auth.errPickLocation);
    }
    if (step === 4) {
      if (!accountType) return setFieldErr(t.auth.errPickAccountType);
      void submit();
      return;
    }
    setStep((s) => (s < 5 ? ((s + 1) as Step) : s));
  }

  function back(): void {
    setFieldErr(null);
    setError(null);
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  async function detectLocation(): Promise<void> {
    setLocBusy(true);
    setFieldErr(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocMode('manual');
        setFieldErr(t.auth.errLocationDenied);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setLocMode('auto');
    } catch {
      setFieldErr(t.auth.errLocationFail);
    } finally {
      setLocBusy(false);
    }
  }

  async function submit(): Promise<void> {
    const fullName = `${name.trim()} ${surname.trim()}`.trim();
    const input = { phone: phone.replace(/\s/g, ''), fullName, password };
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first?.message ?? t.auth.errSignUpFailed);
      const key = first?.path[0];
      if (key === 'phone' || key === 'password') setStep(2);
      else setStep(1);
      return;
    }
    setBusy(true);
    try {
      await SecureStore.setItemAsync(
        EXTRAS_KEY,
        JSON.stringify({
          username: username.trim() || null,
          location: coords,
          locationMode: locMode,
          accountType,
        }),
      );
      await signUp(input);
      setStep(5);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'ALREADY_EXISTS'
          ? t.auth.errAlreadyExists
          : err instanceof ApiError
            ? err.message
            : t.auth.errSignUpFailed,
      );
      setStep(2);
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
          {/* Yuqori qator */}
          <View style={styles.topRow}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
              onPress={back}
              accessibilityRole="button"
            >
              <Icon name="back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.stepCounter}>{step} / 5</Text>
          </View>

          {/* Progress — ingichka chiziqchalar */}
          <View style={styles.dots}>
            {[1, 2, 3, 4, 5].map((n) => (
              <View
                key={n}
                style={[
                  styles.dot,
                  n === step && styles.dotOn,
                  n < step && styles.dotDone,
                ]}
              />
            ))}
          </View>

          {/* Eyebrow + sarlavha */}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{eyebrowFor(step)}</Text>
            <Text style={styles.title}>{titleFor(step, t)}</Text>
            {subtitleFor(step, t) ? (
              <Text style={styles.subtitle}>{subtitleFor(step, t)}</Text>
            ) : null}
          </View>

          {/* ====== BOSQICHLAR ====== */}

          {step === 1 && (
            <>
              <Text style={styles.label}>{t.auth.name}</Text>
              <View style={[styles.field, focused === 'name' && styles.fieldOn]}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  autoComplete="given-name"
                  placeholder="Umidjon"
                  placeholderTextColor={colors.textDim}
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <Text style={styles.label}>{t.auth.surname}</Text>
              <View style={[styles.field, focused === 'surname' && styles.fieldOn]}>
                <TextInput
                  style={styles.input}
                  value={surname}
                  onChangeText={setSurname}
                  autoComplete="family-name"
                  placeholder="G'afforov"
                  placeholderTextColor={colors.textDim}
                  onFocus={() => setFocused('surname')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <Text style={styles.label}>
                {t.auth.username} <Text style={styles.optional}>({t.auth.optional})</Text>
              </Text>
              <View style={[styles.field, focused === 'username' && styles.fieldOn]}>
                <Text style={styles.at}>@</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  autoCapitalize="none"
                  placeholder="umidjon"
                  placeholderTextColor={colors.textDim}
                  onFocus={() => setFocused('username')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.label}>{t.auth.phone}</Text>
              <View style={[styles.field, focused === 'phone' && styles.fieldOn]}>
                <Text style={styles.at}>+</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="998 90 123 45 67"
                  placeholderTextColor={colors.textDim}
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <Text style={styles.label}>{t.auth.password}</Text>
              <View style={[styles.field, focused === 'password' && styles.fieldOn]}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                  placeholder={t.auth.passwordMinPlaceholder}
                  placeholderTextColor={colors.textDim}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={10}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Pressable
                style={[styles.card, locMode === 'auto' && styles.cardOn]}
                onPress={() => void detectLocation()}
                disabled={locBusy}
              >
                <View style={styles.cardIco}>
                  <Icon name="location" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.auth.locAuto}</Text>
                  <Text style={styles.cardDesc}>
                    {locBusy
                      ? `${t.common.loading}…`
                      : coords
                        ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
                        : t.auth.locAutoDesc}
                  </Text>
                </View>
                {locMode === 'auto' && <Icon name="check" size={18} color={colors.primary} />}
              </Pressable>

              <Pressable
                style={[styles.card, locMode === 'manual' && styles.cardOn]}
                onPress={() => {
                  setLocMode('manual');
                  setCoords(null);
                }}
              >
                <View style={styles.cardIco}>
                  <Icon name="location" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.auth.locManual}</Text>
                  <Text style={styles.cardDesc}>{t.auth.locManualDesc}</Text>
                </View>
                {locMode === 'manual' && <Icon name="check" size={18} color={colors.primary} />}
              </Pressable>
            </>
          )}

          {step === 4 && (
            <>
              <Pressable
                style={[styles.card, accountType === 'buyer' && styles.cardOn]}
                onPress={() => setAccountType('buyer')}
              >
                <View style={styles.cardIco}>
                  <Icon name="profile" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.auth.roleBuyer}</Text>
                  <Text style={styles.cardDesc}>{t.auth.roleBuyerDesc}</Text>
                </View>
                {accountType === 'buyer' && <Icon name="check" size={18} color={colors.primary} />}
              </Pressable>

              <Pressable
                style={[styles.card, accountType === 'seller' && styles.cardOn]}
                onPress={() => setAccountType('seller')}
              >
                <View style={styles.cardIco}>
                  <Icon name="shop" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.auth.roleSeller}</Text>
                  <Text style={styles.cardDesc}>{t.auth.roleSellerDesc}</Text>
                </View>
                {accountType === 'seller' && <Icon name="check" size={18} color={colors.primary} />}
              </Pressable>
            </>
          )}

          {step === 5 && (
            <>
              <View style={styles.doneBox}>
                <View style={styles.doneCircle}>
                  <Icon name="check" size={36} color={colors.primary} />
                </View>
                <Text style={styles.doneTitle}>{t.auth.doneTitle}</Text>
                <Text style={styles.doneDesc}>
                  {accountType === 'seller' ? t.auth.doneSellerDesc : t.auth.doneBuyerDesc}
                </Text>
              </View>

              {accountType === 'seller' ? (
                <Pressable
                  style={[styles.card, styles.cardOn]}
                  onPress={() => router.replace('/seller/settings')}
                >
                  <View style={styles.cardIco}>
                    <Icon name="shop" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{t.auth.gotoSellerSetup}</Text>
                    <Text style={styles.cardDesc}>{t.auth.gotoSellerSetupDesc}</Text>
                  </View>
                  <Icon name="next" size={18} color={colors.primary} />
                </Pressable>
              ) : (
                <>
                  {/*
                    ⚠️ XARIDOR UCHUN FAQAT BIR TUGMA — YUZ, KEYIN BOZOR.
                    O'lchov va kiyintirish keyin ham qo'shiladi (profil
                    sahifasida). Yangi foydalanuvchi birinchi marta nima
                    uchun kelganini tezroq ko'rishi kerak.
                  */}
                  <Pressable
                    style={[styles.card, styles.cardOn]}
                    onPress={() => router.replace('/ai/avatar?signup=1')}
                  >
                    <View style={styles.cardIco}>
                      <Icon name="camera" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{t.auth.gotoFaceScan}</Text>
                      <Text style={styles.cardDesc}>{t.auth.gotoFaceScanDesc}</Text>
                    </View>
                    <Icon name="next" size={18} color={colors.primary} />
                  </Pressable>

                  <Pressable
                    onPress={() => router.replace('/(tabs)/marketplace')}
                    style={styles.skipLink}
                  >
                    <Text style={styles.skipText}>{t.auth.skipForNow}</Text>
                  </Pressable>
                </>
              )}
            </>
          )}

          {fieldErr ? <Text style={styles.fErr}>{fieldErr}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step !== 5 && (
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { backgroundColor: colors.primaryDim },
                busy && { opacity: 0.6 },
              ]}
              onPress={next}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.submitText}>
                {busy ? `${t.common.loading}…` : step === 4 ? t.auth.finish : t.auth.continueBtn}
              </Text>
              <View style={styles.submitArrow}>
                <Icon name="next" size={18} color={colors.textOnPrimary} />
              </View>
            </Pressable>
          )}

          {step === 1 && (
            <Pressable
              onPress={() => router.replace('/(auth)/sign-in')}
              style={styles.signinLink}
              accessibilityRole="button"
            >
              <Text style={styles.signinText}>
                {t.auth.haveAccountQ}{' '}
                <Text style={{ color: colors.primary }}>{t.auth.signIn}</Text>
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function titleFor(step: Step, t: ReturnType<typeof useI18n.getState>['t']): string {
  if (step === 1) return t.auth.stepPersonal;
  if (step === 2) return t.auth.stepContact;
  if (step === 3) return t.auth.stepLocation;
  if (step === 4) return t.auth.stepAccountType;
  return t.auth.doneTitle;
}

function subtitleFor(step: Step, t: ReturnType<typeof useI18n.getState>['t']): string {
  if (step === 1) return t.auth.stepPersonalSub;
  if (step === 2) return t.auth.stepContactSub;
  if (step === 3) return t.auth.stepLocationSub;
  if (step === 4) return t.auth.stepAccountTypeSub;
  return '';
}

function eyebrowFor(step: Step): string {
  if (step === 1) return 'Shaxs · Birinchi tanishuv';
  if (step === 2) return 'Aloqa · Kirish ma’lumotlari';
  if (step === 3) return 'Joylashuv · Yaqin do‘konlar';
  if (step === 4) return 'Rol · Xaridor yoki sotuvchi';
  return 'Tayyor';
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xs },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  // Orqaga: oq doira, ink ikonka, hair-thin chegara
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
  stepCounter: {
    ...text.eyebrow,
    color: colors.textMuted,
  },

  // Progress: besh ingichka chiziqcha. Faol anor, bajarilgan quyuq anor.
  dots: { flexDirection: 'row', gap: 6, marginTop: spacing.xs },
  dot: { flex: 1, height: 2, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.primary, height: 3 },
  dotDone: { backgroundColor: colors.primaryDim },

  /* ── Sarlavha bloki ── */
  header: { marginTop: spacing.lg, marginBottom: spacing.lg },
  eyebrow: { ...text.eyebrow, color: colors.textMuted, marginBottom: spacing.xs },
  title: { ...text.h1, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...text.body, color: colors.textMuted, maxWidth: '92%' },

  label: {
    ...text.eyebrow,
    color: colors.textDim,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  optional: { color: colors.textMuted },

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
  input: { flex: 1, ...text.body, color: colors.text, paddingVertical: 0 },
  hint: { ...text.small, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },

  /* ── Tanlov kartasi ── (cream, hair-thin; tanlanganda anor chegara) */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  cardOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cardIco: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { ...text.bodyMed, color: colors.text },
  cardDesc: { ...text.small, color: colors.textMuted, marginTop: 2 },

  /* ── Yakuniy "tayyor" bloki ── */
  doneBox: { alignItems: 'center', paddingVertical: spacing.xl },
  doneCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  doneTitle: { ...text.h1, color: colors.text, textAlign: 'center' },
  doneDesc: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  fErr: { ...text.small, color: colors.danger, marginTop: spacing.sm, textAlign: 'center' },
  error: { ...text.small, color: colors.danger, textAlign: 'center', marginTop: spacing.xs },

  /* ── Submit — to'ldirilgan anor pill ── */
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

  signinLink: { alignItems: 'center', paddingVertical: spacing.md },
  signinText: { ...text.small, color: colors.textMuted },

  skipLink: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  skipText: { ...text.small, color: colors.textMuted, textDecorationLine: 'underline' },
});
