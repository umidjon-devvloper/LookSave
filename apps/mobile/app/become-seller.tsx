import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyForStore, type StoreApplicationInput } from '../src/api/endpoints';
import { refreshSession } from '../src/api/client';
import { explainError } from '../src/api/explainError';
import { Icon, type IconName } from '../src/components/Icon';
import { SignInRequired } from '../src/components/SignInRequired';
import { Screen } from '../src/components/ui';
import { useI18n } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { useLocationStore } from '../src/store/locationStore';
import { colors, fonts, radius, spacing, text } from '../src/theme/tokens';
import { goBack } from '../src/navigation/back';

/**
 * Do'kon arizasi — sotuvchi bo'lish.
 *
 * ⚠️ TASDIQLASH KUTILMAYDI. Ariza yuborilishi bilan foydalanuvchi
 * `store_owner` bo'ladi va panelga kira oladi. Do'kon esa `pending`
 * holatda qoladi, ya'ni katalogda KO'RINMAYDI. Shu bilan sotuvchi
 * kutish paytida mahsulotlarini tayyorlab qo'yadi va tasdiqlangan
 * kuni do'kon to'liq tayyor ishga tushadi.
 *
 * ⚠️ JOYLASHUV XARITADAN EMAS, QURILMADAN olinadi. Ariza bosqichida
 * xarita tanlagichi ortiqcha: manzil matn bilan yoziladi va aniq nuqta
 * keyinchalik panelda to'g'rilanadi. Xarita qo'shilsa ariza uzayadi va
 * ko'p sotuvchi shu yerda to'xtaydi.
 *
 * Kuniga 3 tadan ko'p ariza yuborib bo'lmaydi — server cheklaydi.
 */

interface FormState {
  name: string;
  description: string;
  phone: string;
  address: string;
  landmark: string;
  city: string;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  phone: '+998',
  address: '',
  landmark: '',
  city: '',
};

const STORE_ART = require('../assets/seller-apply-store-v1.png');

export default function StoreApply(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';
  const refreshUser = useAuthStore((state) => state.restore);
  const coords = useLocationStore((state) => state.coords);

  const [form, setForm] = useState<FormState>(EMPTY);
  // Do'kon jinsi — Market'da «Erkaklar»/«Ayollar» bo'limida filtrlanadi.
  // `null` = hali tanlanmagan; yuborishdan oldin majburiy.
  const [audience, setAudience] = useState<'men' | 'women' | 'both' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: (input: StoreApplicationInput) => applyForStore(input),
    onSuccess: async () => {
      /*
       * ⚠️ TARTIB MUHIM: avval TOKEN, keyin profil.
       *
       * Rol va do'kon ro'yxati access token ichida yozilgan. Ariza
       * qabul qilingach bazada `store_owner` bo'ladi, lekin qo'ldagi
       * token hali `customer` deb turadi va panel so'rovlari 403
       * qaytaradi. Buni sinovda tekshirdim: ariza 200, dashboard 403.
       *
       * Tokenni yangilagach yangi rol ham, `storeIds` ham keladi.
       */
      await refreshSession();
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.replace('/seller');
    },
    onError: (err) => {
      setError(explainError(err, t));
    },
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint={t.seller.applySignInHint} />
      </Screen>
    );
  }

  const set = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (): void => {
    setError(null);

    // Serverdagi sxemaga mos eng kam talablar — xatoni so'rovsiz ushlaymiz
    if (form.name.trim().length < 2) return setError(t.seller.errName);
    if (!/^\+998\d{9}$/.test(form.phone.trim())) return setError(t.seller.errPhone);
    if (form.address.trim().length < 5) return setError(t.seller.errAddress);
    if (form.city.trim().length < 2) return setError(t.seller.errCity);
    if (audience === null) return setError(t.seller.errAudience);

    apply.mutate({
      name: form.name.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      phone: form.phone.trim(),
      address: form.address.trim(),
      ...(form.landmark.trim() ? { landmark: form.landmark.trim() } : {}),
      city: form.city.trim(),
      country: 'UZ',
      location: coords,
      currency: 'UZS',
      audience,
      deliveryEnabled: true,
      pickupEnabled: true,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
          <LinearGradient
            colors={['#0C0920', '#1B1239', '#28134C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 10 }]}
          >
            <View style={styles.heroGlow} />
            <Image source={STORE_ART} style={styles.heroArt} resizeMode="contain" />

            <View style={styles.heroBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Orqaga"
                onPress={() => goBack('/profile')}
                style={styles.backButton}
              >
                <Icon name="back" size={28} color="#D86BFF" />
              </Pressable>
              <Text style={styles.wordmark}>
                LOOK<Text style={styles.wordmarkAccent}>SAVE</Text> · SELLER
              </Text>
              <View style={styles.heroSpacer} />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                Do‘kon <Text style={styles.heroTitleAccent}>oching</Text>
              </Text>
              <Text style={styles.heroSubtitle}>Sotuvchi bo‘lish arizasi</Text>
            </View>
          </LinearGradient>

          <View style={styles.sheet}>
            <View style={styles.howCard}>
              <LinearGradient colors={['#A94CFF', '#6730C9']} style={styles.howIcon}>
                <Icon name="shop" size={26} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.howText}>
                <Text style={styles.howTitle}>Qanday ishlaydi?</Text>
                <Text style={styles.howDescription}>
                  Ariza → panelga kirish → mahsulotlarni tayyorlash → tasdiq → katalogda chiqish.
                </Text>
              </View>
              <Icon name="next" size={24} color={colors.primary} />
            </View>

            <View style={styles.form}>
            <FormField
              icon="shop"
              label={t.seller.fieldName}
              value={form.name}
              onChangeText={set('name')}
              placeholder={t.seller.phName}
              autoCapitalize="words"
              valid={form.name.trim().length >= 2}
            />
            <FormField
              icon="phone"
              label={t.auth.phone}
              value={form.phone}
              onChangeText={set('phone')}
              keyboardType="phone-pad"
              placeholder={t.seller.phPhone}
            />
            <FormField
              icon="stores"
              label={t.seller.fieldCity}
              value={form.city}
              onChangeText={set('city')}
              placeholder={t.seller.phCity}
              autoCapitalize="words"
              trailing={<Icon name="next" size={18} color={colors.textMuted} />}
            />
            <FormField
              icon="location"
              label={t.checkout.address}
              value={form.address}
              onChangeText={set('address')}
              placeholder={t.seller.phAddress}
            />
            <FormField
              icon="locate"
              label={t.checkout.landmark}
              value={form.landmark}
              onChangeText={set('landmark')}
              placeholder={t.seller.phLandmark}
            />
            <FormField
              icon="edit"
              label={t.seller.fieldDescription}
              value={form.description}
              onChangeText={set('description')}
              placeholder={t.seller.phDescription}
              multiline
              maxLength={160}
            />
            <Text style={styles.counter}>{form.description.length} / 160</Text>

            <View style={styles.audienceBlock}>
              <Text style={styles.audienceLabel}>{t.seller.audienceLabel}</Text>
              <View style={styles.audienceRow}>
                {(['men', 'women', 'both'] as const).map((value) => {
                  const active = audience === value;
                  const label =
                    value === 'men'
                      ? t.seller.audienceMen
                      : value === 'women'
                        ? t.seller.audienceWomen
                        : t.seller.audienceBoth;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setAudience(value)}
                      style={[styles.audienceChip, active && styles.audienceChipActive]}
                    >
                      <Text style={[styles.audienceChipText, active && styles.audienceChipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: apply.isPending }}
            disabled={apply.isPending}
            onPress={submit}
            style={({ pressed }) => [styles.submitWrap, pressed && styles.submitPressed]}
          >
            <LinearGradient
              colors={['#A53CFF', '#6722D5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submit}
            >
              {apply.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="shop" size={24} color="#FFFFFF" />
                  <Text style={styles.submitText}>{t.seller.applySubmit}</Text>
                  <Icon name="next" size={24} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </Pressable>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField({
  icon,
  label,
  valid = false,
  trailing,
  multiline,
  ...props
}: TextInputProps & {
  icon: IconName;
  label: string;
  valid?: boolean;
  trailing?: ReactNode;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Icon name={icon} size={18} color={focused ? colors.primary : '#68459B'} />
        <Text style={[styles.fieldLabel, focused && styles.fieldLabelFocused]}>{label}</Text>
        <Text style={styles.required}>*</Text>
      </View>
      <Pressable
        accessibilityRole="none"
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          multiline && styles.inputShellMultiline,
        ]}
      >
        <View pointerEvents="none">
          <Icon name={icon} size={19} color="#77708E" />
        </View>
        <TextInput
          ref={inputRef}
          {...props}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholderTextColor="#8E88A4"
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {valid ? (
          <View style={styles.validIcon} pointerEvents="none">
            <Icon name="check" size={16} color="#FFFFFF" />
          </View>
        ) : trailing ? (
          <View pointerEvents="none">{trailing}</View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 128, backgroundColor: '#F8F5FF' },
  hero: { minHeight: 250, overflow: 'hidden', paddingHorizontal: spacing.md },
  heroGlow: {
    position: 'absolute',
    right: -70,
    bottom: -120,
    width: 330,
    height: 330,
    borderRadius: 165,
    borderWidth: 1,
    borderColor: 'rgba(175,77,255,0.28)',
  },
  heroArt: { position: 'absolute', width: 230, height: 190, right: -18, bottom: -4 },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    backgroundColor: 'rgba(20,15,42,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { ...text.wordmark, fontSize: 12, letterSpacing: 3.2, color: '#FFFFFF' },
  wordmarkAccent: { color: '#D762FF' },
  heroSpacer: { width: 48 },
  heroCopy: { marginTop: 34, width: '64%' },
  heroTitle: { ...text.h1, fontSize: 38, lineHeight: 44, color: '#FFFFFF' },
  heroTitleAccent: { color: '#D35BFF' },
  heroSubtitle: { ...text.body, fontSize: 17, color: '#D8D0E8', marginTop: 4 },
  sheet: {
    marginTop: -18,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FBF9FF',
  },
  howCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7D7FA',
    backgroundColor: '#F2E9FF',
    marginBottom: spacing.lg,
  },
  howIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  howText: { flex: 1 },
  howTitle: { ...text.h3, fontSize: 17, color: '#181126' },
  howDescription: { ...text.small, color: '#6C6282', lineHeight: 20, marginTop: 2 },
  form: { gap: spacing.md },
  fieldGroup: { gap: 7 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 2 },
  fieldLabel: { ...text.label, fontSize: 15, color: '#21172F' },
  fieldLabelFocused: { color: colors.primary },
  required: { ...text.label, color: '#B832E5' },
  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 17,
    borderWidth: 1.25,
    borderColor: '#CEC3E3',
    backgroundColor: '#FFFFFF',
  },
  inputShellFocused: { borderColor: '#9238F4', shadowColor: '#9238F4', shadowOpacity: 0.12, shadowRadius: 8 },
  inputShellMultiline: { minHeight: 108, alignItems: 'flex-start', paddingTop: 15 },
  input: { flex: 1, minWidth: 0, paddingVertical: 0, ...text.body, color: '#191326' },
  inputMultiline: { minHeight: 78, lineHeight: 22 },
  validIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#36BE65', alignItems: 'center', justifyContent: 'center' },
  counter: { ...text.tiny, color: '#716783', textAlign: 'right', marginTop: -8 },

  audienceBlock: { gap: spacing.sm, marginTop: spacing.xs },
  audienceLabel: { ...text.small, color: colors.textMuted },
  audienceRow: { flexDirection: 'row', gap: spacing.sm },
  audienceChip: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(139,44,245,0.08)' },
  audienceChipText: { ...text.bodyMed, color: colors.textMuted },
  audienceChipTextActive: { color: colors.primary },
  error: { ...text.small, color: colors.danger, marginTop: spacing.sm, textAlign: 'center' },
  submitWrap: { marginTop: spacing.lg },
  submitPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  submit: {
    height: 60,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    shadowColor: '#7B29E8',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  submitText: { ...text.h3, color: '#FFFFFF', fontFamily: fonts.bold },
});
