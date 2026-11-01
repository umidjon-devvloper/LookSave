import { registerSchema } from '@looksave/validation';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  Image,
  ImageBackground,
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
import { LinearGradient } from 'expo-linear-gradient';

import { ApiError } from '../../src/api/client';
import { Icon } from '../../src/components/Icon';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

const IMG_HERO = require('../../assets/signup-hero-icon.png');
const IMG_BG = require('../../assets/auth-bg.jpg');

/**
 * Ro'yxatdan o'tish — 5 bosqich (TZ 1-qism).
 *
 * ⚠️ Backend hozircha faqat `{ phone, fullName, password }` qabul qiladi.
 * Qolgan maydonlar (username, joylashuv, akkaunt turi) lokal `SecureStore`
 * ga yoziladi — keyingi qismda profilga biriktiriladi. Shu bois backend
 * shartnomasi o'zgarmaydi, migratsiya kerak emas.
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

  function next(): void {
    setFieldErr(null);
    setError(null);
    if (step === 1) {
      if (name.trim().length < 2) return setFieldErr(t.auth.errName);
      if (surname.trim().length < 2) return setFieldErr(t.auth.errSurname);
      // Username ixtiyoriy — bo'sh bo'lsa ham o'tadi
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
      // Xato maydoniga qaytaramiz
      const key = first?.path[0];
      if (key === 'phone' || key === 'password') setStep(2);
      else setStep(1);
      return;
    }
    setBusy(true);
    try {
      // Qo'shimcha maydonlar — backend keyingi qismda qabul qilgach yuboriladi
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
      // Keyingi qadamni foydalanuvchi o'zi tanlaydi — avtomatik sakrash yo'q.
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
    <ImageBackground source={IMG_BG} style={styles.bg} resizeMode="cover">
      <StatusBar style="light" translucent />
      <LinearGradient
        colors={['rgba(10,10,15,0.08)', 'rgba(10,10,15,0.6)', 'rgba(10,10,15,0.97)']}
        locations={[0, 0.38, 0.78]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 4, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Yuqori qator — orqa va hero */}
          <View style={styles.topRow}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
              onPress={back}
              accessibilityRole="button"
            >
              <Icon name="back" size={20} color={colors.text} />
            </Pressable>
            <Image source={IMG_HERO} style={styles.heroImg} resizeMode="contain" />
          </View>

          {/* Progress — 5 ta nuqta */}
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
          <Text style={styles.stepCounter}>{step} / 5</Text>

          {/* Sarlavha — bosqichga qarab */}
          <Text style={styles.titleWhite}>{titleFor(step, t)}</Text>
          <Text style={styles.subtitle}>{subtitleFor(step, t)}</Text>

          {/* ====== BOSQICHLAR ====== */}

          {step === 1 && (
            <>
              <Text style={styles.label}>{t.auth.name}</Text>
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  autoComplete="given-name"
                  placeholder="Umidjon"
                  placeholderTextColor={colors.textDim}
                />
              </View>

              <Text style={styles.label}>{t.auth.surname}</Text>
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  value={surname}
                  onChangeText={setSurname}
                  autoComplete="family-name"
                  placeholder="G'afforov"
                  placeholderTextColor={colors.textDim}
                />
              </View>

              <Text style={styles.label}>
                {t.auth.username} <Text style={styles.optional}>({t.auth.optional})</Text>
              </Text>
              <View style={styles.field}>
                <Text style={styles.at}>@</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  autoCapitalize="none"
                  placeholder="umidjon"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.label}>{t.auth.phone}</Text>
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="+998"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <Text style={styles.hint}>{t.auth.noSmsHint}</Text>

              <Text style={styles.label}>{t.auth.password}</Text>
              <View style={styles.field}>
                <View style={styles.lockBox}>
                  <Icon name="authentic" size={18} color={colors.accent} />
                </View>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                  placeholder={t.auth.passwordMinPlaceholder}
                  placeholderTextColor={colors.textDim}
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
                  <Icon name="location" size={22} color={colors.accent} />
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
                {locMode === 'auto' && <Icon name="check" size={20} color={colors.accent} />}
              </Pressable>

              <Pressable
                style={[styles.card, locMode === 'manual' && styles.cardOn]}
                onPress={() => {
                  setLocMode('manual');
                  setCoords(null);
                }}
              >
                <View style={styles.cardIco}>
                  <Icon name="location" size={22} color={colors.accent} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.auth.locManual}</Text>
                  <Text style={styles.cardDesc}>{t.auth.locManualDesc}</Text>
                </View>
                {locMode === 'manual' && <Icon name="check" size={20} color={colors.accent} />}
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
                  <Icon name="profile" size={22} color={colors.accent} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.auth.roleBuyer}</Text>
                  <Text style={styles.cardDesc}>{t.auth.roleBuyerDesc}</Text>
                </View>
                {accountType === 'buyer' && <Icon name="check" size={20} color={colors.accent} />}
              </Pressable>

              <Pressable
                style={[styles.card, accountType === 'seller' && styles.cardOn]}
                onPress={() => setAccountType('seller')}
              >
                <View style={styles.cardIco}>
                  <Icon name="shop" size={22} color={colors.accent} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.auth.roleSeller}</Text>
                  <Text style={styles.cardDesc}>{t.auth.roleSellerDesc}</Text>
                </View>
                {accountType === 'seller' && <Icon name="check" size={20} color={colors.accent} />}
              </Pressable>
            </>
          )}

          {step === 5 && (
            <>
              <View style={styles.doneBox}>
                <View style={styles.doneCircle}>
                  <Icon name="check" size={44} color={colors.accent} />
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
                    <Icon name="shop" size={22} color={colors.accent} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{t.auth.gotoSellerSetup}</Text>
                    <Text style={styles.cardDesc}>{t.auth.gotoSellerSetupDesc}</Text>
                  </View>
                  <Icon name="next" size={20} color={colors.accent} />
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={[styles.card, styles.cardOn]}
                    /*
                     * ⚠️ TO'G'RIDAN-TO'G'RI KIYINTIRISHGA — asosiy mahsulot shu.
                     * Avatar yo'q bo'lsa `FittingExperience` o'zi `/ai/avatar`
                     * ga qaytaradi (`Redirect`). Ya'ni avatarsiz foydalanuvchi
                     * baribir yuz skaneriga tushadi, lekin yakuniy manzil —
                     * kiyintirish paneli, va u ro'yxatdan o'tgach darhol
                     * nimaga keganini ko'radi.
                     */
                    onPress={() => router.replace('/ai/fitting')}
                  >
                    <View style={styles.cardIco}>
                      <Icon name="tryon" size={22} color={colors.accent} />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{t.auth.gotoFitting}</Text>
                      <Text style={styles.cardDesc}>{t.auth.gotoFittingDesc}</Text>
                    </View>
                    <Icon name="next" size={20} color={colors.accent} />
                  </Pressable>

                  <Pressable
                    style={styles.card}
                    onPress={() => router.replace('/settings/measurements')}
                  >
                    <View style={styles.cardIco}>
                      <Icon name="check" size={22} color={colors.accent} />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{t.auth.gotoBody}</Text>
                      <Text style={styles.cardDesc}>{t.auth.gotoBodyDesc}</Text>
                    </View>
                    <Icon name="next" size={20} color={colors.textMuted} />
                  </Pressable>

                  <Pressable
                    onPress={() => router.replace('/(tabs)')}
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
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88 }]}
              onPress={next}
              disabled={busy}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDim]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.submitText}>
                {busy ? `${t.common.loading}…` : step === 4 ? t.auth.finish : t.auth.continueBtn}
              </Text>
              <View style={styles.submitArrow}>
                <Icon name="next" size={18} color={colors.text} />
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
                {t.auth.haveAccountQ} <Text style={{ color: colors.accent }}>{t.auth.signIn}</Text>
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
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

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xs },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(36,31,51,0.82)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImg: { width: 100, height: 100, transform: [{ rotate: '-10deg' }] },

  dots: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  dotOn: { backgroundColor: colors.accent },
  dotDone: { backgroundColor: colors.primary },
  stepCounter: {
    ...text.tiny,
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginTop: 6,
  },

  titleWhite: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
  },
  subtitle: { ...text.small, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },

  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textDim,
    marginTop: spacing.md,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  optional: { color: colors.textMuted, fontWeight: '500' },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,18,28,0.84)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    height: 58,
    gap: spacing.sm,
  },
  at: {
    ...text.body,
    color: colors.accent,
    fontWeight: '700',
    paddingLeft: spacing.xs,
  },
  lockBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, ...text.body, color: colors.text, paddingVertical: 0 },
  hint: { ...text.tiny, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(20,18,28,0.84)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  cardOn: { borderColor: colors.accent, backgroundColor: 'rgba(168,85,247,0.08)' },
  cardIco: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { ...text.bodyMed, color: colors.text },
  cardDesc: { ...text.tiny, color: colors.textMuted, marginTop: 2 },

  doneBox: { alignItems: 'center', paddingVertical: spacing.xl },
  doneCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  doneTitle: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  doneDesc: {
    ...text.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: spacing.md,
  },

  fErr: { ...text.tiny, color: colors.danger, marginTop: 8, textAlign: 'center' },
  error: { ...text.small, color: colors.danger, textAlign: 'center', marginTop: spacing.xs },

  submitBtn: {
    height: 58,
    borderRadius: radius.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: spacing.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  submitText: { ...text.bodyMed, color: colors.text, flex: 1, textAlign: 'center' },
  submitArrow: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  signinLink: { alignItems: 'center', paddingVertical: spacing.md },
  signinText: { ...text.small, color: colors.textMuted },

  skipLink: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  skipText: { ...text.small, color: colors.textMuted, textDecorationLine: 'underline' },
});
