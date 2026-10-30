import { CLOTHING_SIZES, SHOE_SIZES, type SizeLabel } from '@looksave/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getAllStoreMarkers,
  getAvatar,
  getFullProfile,
  getNearbyStores,
  requestAvatar,
  updateMeasurements,
  updateProfile,
  uploadAvatar,
  type Measurements,
  type UserAvatar,
} from '../../src/api/endpoints';
import { explainError } from '../../src/api/explainError';
import { AvatarBuilding } from '../../src/components/ai/AvatarBuilding';
import { AvatarQueued } from '../../src/components/ai/AvatarQueued';
import { Icon, type IconName } from '../../src/components/Icon';
import { SizeChips } from '../../src/components/SizeChips';
import { distanceMeters } from '../../src/map/distance';
import { averageBrightness, MIN_BRIGHTNESS } from '../../src/photo/brightness';
import { Button, ErrorView, Field, Loading } from '../../src/components/ui';
import { useI18n, type Dictionary } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { SignInRequired } from '../../src/components/SignInRequired';
import { useAiFlowStore } from '../../src/store/aiFlowStore';
import { useLocationStore } from '../../src/store/locationStore';
import { colors, fonts, radius, spacing, text } from '../../src/theme/tokens';
import { goBack as leaveWizard } from '../../src/navigation/back';

/**
 * Avatar yasash oqimi — bitta ekran, ichida qadamlar.
 *
 * NEGA BITTA EKRAN: har qadam alohida marshrut bo'lsa oraliq holat
 * navigatsiya parametrlariga chiqadi, orqaga qaytish tartibi chalkashadi va
 * "3-qadamdan 1-qadamga" sakrash uchun `replace` zanjiri kerak bo'ladi.
 * Bu yerda qadam — oddiy `useState`, tepadagi ko'rsatkich esa uni chizadi.
 *
 * Har qadam TUGAGANDA serverga yoziladi (jins → `PATCH /profile`,
 * o'lchamlar → `PATCH /profile/measurements`). Ya'ni foydalanuvchi oqimni
 * yarmida tashlab ketsa ham kiritilgani yo'qolmaydi.
 *
 * ⚠️ YUZ SKANERI: rasm olinadi va R2 ga yuklanadi, lekin undan 3D yuz
 * teksturasi YASALMAYDI — buning uchun serverda quvur yo'q (`faceTextureUrl`
 * bo'sh qolaveradi). Hozircha rasm profil suratiga tushadi.
 */

type StepKey = 'gender' | 'body' | 'store' | 'face' | 'done';

/**
 * Qadam tartibi.
 *
 * ⚠️ YUZ SKANERI BIRINCHI — MAKETDAGIDEK. Ilgari u OXIRIDA edi va sabab
 * yozib qo'yilgan edi: oqim boshida kamera so'ralsa, foydalanuvchi ilova
 * nima qilishini tushunmasdan ruxsat berishi kerak bo'ladi va rad etish
 * ehtimoli yuqori.
 *
 * Bu xavf yo'qolgani yo'q — u ochiq qabul qilindi. Sabab: yuz skaneri
 * butun oqimning MA'NOSI. Foydalanuvchi «o'zini kiyintirish» uchun kelgan
 * va birinchi ko'radigan narsa aynan shu bo'lishi kerak. O'lchamlardan
 * boshlansa oqim so'rovnomaga o'xshab qoladi.
 *
 * Xavfni yumshatish uchun `FaceStep` ichida kamera so'ralishidan OLDIN
 * nima uchun kerakligi tushuntiriladi (`FACE_CONSENT`) — ya'ni ruxsat
 * so'rovi baribir izohsiz kelmaydi.
 */
/*
 * TZ 1-qism (D-56): tana ma'lumotlari uchun faqat bo'y, vazn, oyoq
 * kiyim o'lchami so'raladi — ko'krak/bel/ustki/pastki razmer chiqarildi.
 * Shu bois 'body' va 'shoe' bitta qadamga birlashtirildi.
 */
const STEPS: Array<{ key: StepKey; icon: IconName }> = [
  { key: 'face', icon: 'camera' },
  { key: 'gender', icon: 'profile' },
  { key: 'body', icon: 'slotTop' },
  { key: 'store', icon: 'stores' },
  { key: 'done', icon: 'authentic' },
];

/** Qadam yorlig'i — i18n (`t.avatar`) dan. */
const STEP_LABEL: Record<StepKey, keyof Dictionary['avatar']> = {
  face: 'stepFace',
  gender: 'stepGender',
  body: 'stepBody',
  store: 'stepStore',
  done: 'stepDone',
};

/**
 * Faqat sonli o'lchamlar. `Measurements` da `shoeSizeSystem` (matn) ham bor —
 * uni bu ro'yxatga qo'shib bo'lmaydi, aks holda songa tayinlash tipni buzadi.
 */
type MeasureKey = 'height' | 'weight' | 'chest' | 'waist' | 'hips' | 'shoeSize';

/** `packages/validation/src/auth.ts` dagi chegaralar bilan bir xil */
const LIMITS: Record<MeasureKey, { min: number; max: number }> = {
  height: { min: 120, max: 220 },
  weight: { min: 30, max: 200 },
  chest: { min: 50, max: 180 },
  waist: { min: 40, max: 180 },
  hips: { min: 50, max: 180 },
  shoeSize: { min: 30, max: 50 },
};

/** O'lcham yorlig'i — i18n (`t.avatar`) dan. */
function measureLabel(t: Dictionary, key: MeasureKey): string {
  const map: Record<MeasureKey, string> = {
    height: t.avatar.heightLabel,
    weight: t.avatar.weightLabel,
    chest: t.avatar.chestLabel,
    waist: t.avatar.waistLabel,
    hips: t.avatar.hipsLabel,
    shoeSize: t.avatar.shoeLabel,
  };
  return map[key];
}

/** O'lcham izohi — raqamli oraliq qotiq, matnli qism i18n'dan. */
function measureHint(t: Dictionary, key: MeasureKey): string {
  const map: Record<MeasureKey, string> = {
    height: '120–220',
    weight: '30–200',
    chest: t.avatar.chestHint,
    waist: t.avatar.waistHint,
    hips: t.avatar.hipsHint,
    shoeSize: '30–50',
  };
  return map[key];
}

/**
 * Qadam allaqachon bajarilganmi.
 *
 * ⚠️ SEHRGAR ENDI TAKRORLAMAYDI. Ilgari u har safar `face` dan
 * boshlanardi va oltita qadamdan o'tishni talab qilardi — hatto hamma
 * ma'lumot serverda turgan bo'lsa ham. Foydalanuvchi uchun bu «ilova
 * meni eslamaydi» degani edi va AI bo'limiga har kirishda yuz skaneri
 * qaytadan chiqardi.
 *
 * ⚠️ TEKSHIRUV MANBASI — SERVER, sehrgarning ichki holati emas.
 * `values` da foydalanuvchi shu seansda yozganlari bor; bu funksiya esa
 * «kirishda nimadan boshlanadi» degan savolga javob beradi va u faqat
 * saqlangan ma'lumotga tayanishi kerak.
 */
function isStepDone(
  step: StepKey,
  profile: { gender?: string | null; faceTextureUrl: string | null; measurements: Measurements },
  storeId: string | null,
): boolean {
  switch (step) {
    case 'face':
      return Boolean(profile.faceTextureUrl);

    case 'gender':
      return profile.gender === 'male' || profile.gender === 'female';

    /*
     * ⚠️ KO'KRAK VA BEL HAM SHART. Ilgari faqat bo'y va vazn tekshirilardi.
     * Lekin kiyim o'lchami aynan ko'krak (ustki) va bel (pastki)
     * aylanasidan hisoblanadi (`@looksave/validation` · `sizing.ts`) — ularsiz «sizga mos
     * o'lchamdagi kiyimlar» filtri umuman ishlamaydi va ro'yxat oddiy
     * katalogga aylanadi.
     */
    /*
     * ⚠️ RAZMER TANLOVI (2026-09-25). Ko'krak/bel (sm) o'rniga mijoz
     * razmerni tanlaydi. Eski profillarda sm qiymati bo'lsa ham qadam
     * bajarilgan hisoblanadi — `recommendSize` ularni zaxira sifatida
     * razmerga aylantiradi.
     */
    /*
     * TZ 1-qism — faqat bo'y, vazn, oyoq kiyim o'lchami majburiy.
     * Ko'krak/bel/ustki/pastki razmer olib tashlandi (D-56).
     */
    case 'body':
      return (
        typeof profile.measurements.height === 'number' &&
        typeof profile.measurements.weight === 'number' &&
        typeof profile.measurements.shoeSize === 'number'
      );

    case 'store':
      return Boolean(storeId);

    // Yakuniy qadam «bajarilgan» bo'lmaydi — u har doim ko'rsatiladi
    case 'done':
      return false;
  }
}

/** Bo'sh matn — kiritilmagan, noto'g'ri son — xato. Ikkisi boshqa holat. */
function parseField(raw: string, key: MeasureKey): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const value = Number(trimmed.replace(',', '.'));
  const limit = LIMITS[key];
  if (!Number.isFinite(value) || !limit) return 'invalid';
  if (value < limit.min || value > limit.max) return 'invalid';
  return value;
}

/**
 * Qadam ko'rsatkichi.
 *
 * NEGA CHIZIQ BILAN: alohida turgan doiralar "nechta qadam qoldi" degan
 * savolga javob bermaydi — ular ro'yxatga o'xshaydi. Ularni bog'lovchi
 * chiziq va uning to'lgan qismi jarayonni ko'rsatadi: qayerdan
 * boshlanganini, qayerda turganini va qancha qolganini.
 *
 * Faol nuqta atrofidagi halqa — diqqatni tortadi va "hozir shu yerdasiz"
 * degan yagona urg'u bo'lib qoladi.
 */
function StepBar({ current }: { current: StepKey }): JSX.Element {
  const t = useI18n((state) => state.t);
  const activeIndex = STEPS.findIndex((step) => step.key === current);
  // Chiziq faol qadamning MARKAZIgacha to'ladi
  const progress = STEPS.length > 1 ? activeIndex / (STEPS.length - 1) : 0;

  return (
    <View style={styles.stepBar}>
      {/* Orqa yo'lak va uning to'lgan qismi — nuqtalar ostidan o'tadi */}
      <View style={styles.stepTrack} />
      <View style={[styles.stepTrackFill, { width: `${progress * 100}%` }]} />

      {STEPS.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;

        return (
          <View key={step.key} style={styles.stepItem}>
            <View style={active ? styles.stepHalo : undefined}>
              <View
                style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}
              >
                <Icon
                  name={done ? 'authentic' : step.icon}
                  size={active ? 16 : 14}
                  color={active || done ? colors.textOnPrimary : colors.textDim}
                />
              </View>
            </View>
            <Text
              style={[
                styles.stepLabel,
                active && styles.stepLabelActive,
                done && styles.stepLabelDone,
              ]}
              numberOfLines={1}
            >
              {t.avatar[STEP_LABEL[step.key]]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AvatarFlow(): JSX.Element {
  /*
   * ⚠️ ENG BIRINCHI TEKSHIRUV. Ilova endi kirish so'ramasdan ochiladi, lekin
   * bu ekran shaxsiy ma'lumotga tayanadi. Tekshiruv boshqa hook'lardan
   * keyin turmasligi kerak — quyida shartli `return` lar bor va hook'lar
   * ular ortida qolib ketsa React qoidasi buziladi.
   */
  const authStatus = useAuthStore((state) => state.status);
  const t = useI18n((state) => state.t);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const coords = useLocationStore((state) => state.coords);
  const setStore = useAiFlowStore((state) => state.setStore);
  const storeId = useAiFlowStore((state) => state.storeId);

  const [step, setStep] = useState<StepKey>('face');
  /*
   * Boshlang'ich qadam bir marta aniqlanadi.
   *
   * ⚠️ REF SHART. Profil so'rovi qayta yangilanadi (masalan o'lchamlar
   * saqlangach) va usiz effekt foydalanuvchini o'zi turgan qadamdan
   * oldinga sakratib yuborardi — ya'ni yozayotgan joyi ostidan
   * ekran o'zgarardi.
   */
  const startResolved = useRef(false);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [topSize, setTopSize] = useState<SizeLabel | null>(null);
  const [bottomSize, setBottomSize] = useState<SizeLabel | null>(null);
  const [shoeSize, setShoeSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const profile = useQuery({ queryKey: ['profile', 'full'], queryFn: getFullProfile });

  /*
   * ⚠️ BAJARILGAN QADAMLAR O'TKAZIB YUBORILADI. Foydalanuvchi
   * o'lchamlarini bir marta kiritgan bo'lsa, ikkinchi safar sehrgar
   * to'g'ridan-to'g'ri qolgan qadamga tushadi — ko'pincha bu «do'kon»
   * yoki «tayyor» bo'ladi.
   */
  useEffect(() => {
    if (startResolved.current || !profile.data) return;
    startResolved.current = true;

    const first = STEPS.find((item) => !isStepDone(item.key, profile.data, storeId));
    setStep(first?.key ?? 'done');
  }, [profile.data, storeId]);

  // Serverdagi qiymatlar bilan to'ldiramiz — oqim ikkinchi marta ochilsa
  // hamma narsani qaytadan kiritish shart emas
  useEffect(() => {
    const data = profile.data;
    if (!data) return;

    if (data.gender === 'male' || data.gender === 'female') setGender(data.gender);

    const filled: Record<string, string> = {};
    for (const key of Object.keys(LIMITS) as MeasureKey[]) {
      const value = data.measurements[key];
      if (typeof value === 'number') filled[key] = String(value);
    }
    setValues((current) => ({ ...filled, ...current }));

    const saved = data.measurements;
    const asSize = (value: unknown): SizeLabel | null =>
      typeof value === 'string' && (CLOTHING_SIZES as readonly string[]).includes(value)
        ? (value as SizeLabel)
        : null;
    setTopSize((current) => current ?? asSize(saved.topSize));
    setBottomSize((current) => current ?? asSize(saved.bottomSize));
    setShoeSize(
      (current) => current ?? (typeof saved.shoeSize === 'number' ? saved.shoeSize : null),
    );
  }, [profile.data]);

  const saveGender = useMutation({
    mutationFn: (value: 'male' | 'female') => updateProfile({ gender: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const saveMeasurements = useMutation({
    mutationFn: (input: Measurements) => updateMeasurements(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      // Avatar shakli o'lchamlardan hisoblanadi — eski konfiguratsiya eskiradi
      void queryClient.invalidateQueries({ queryKey: ['avatar', 'config'] });
    },
  });

  if (authStatus !== 'signedIn') {
    return <SignInRequired title="AI Designer" hint={t.avatar.signInHint} />;
  }

  if (profile.isLoading) return <Loading />;
  if (profile.isError) {
    return <ErrorView message={t.avatar.profileLoadError} onRetry={() => void profile.refetch()} />;
  }

  /*
   * ⚠️ IKKI XIL «ORQAGA». Bu funksiya sehrgar QADAMLARI bo'ylab
   * orqaga yuradi; birinchi qadamda esa ekranning o'zidan chiqadi.
   * Ikkinchisi `leaveWizard` — u tarix bo'sh bo'lsa bosh sahifaga
   * o'tadi (ilova deep link bilan ochilgan bo'lishi mumkin).
   */
  const goBack = (): void => {
    const index = STEPS.findIndex((item) => item.key === step);
    setError(null);
    if (index <= 0) {
      leaveWizard('/(tabs)');
      return;
    }
    setStep(STEPS[index - 1]?.key ?? 'face');
  };

  /*
   * ⚠️ KEYINGI QADAM — BAJARILMAGAN BIRINCHISI, shunchaki «+1» emas.
   * Foydalanuvchi yuzni skaner qilganda jinsi va o'lchamlari allaqachon
   * saqlangan bo'lishi mumkin; u payt uni o'sha oynalardan qaytadan
   * o'tkazish ma'nosiz.
   */
  const goNext = (): void => {
    const index = STEPS.findIndex((item) => item.key === step);
    setError(null);

    const rest = STEPS.slice(index + 1);
    const next = profile.data
      ? rest.find((item) => !isStepDone(item.key, profile.data, storeId))
      : rest[0];

    setStep(next?.key ?? 'done');
  };

  /** Kiritilgan o'lchamlarni tekshirib serverga yozadi */
  const submitMeasurements = async (
    keys: MeasureKey[],
    picked: Partial<Pick<Measurements, 'topSize' | 'bottomSize' | 'shoeSize'>> = {},
    requiredPicks: Array<{ ok: boolean; label: string }> = [],
  ): Promise<boolean> => {
    const input: Measurements = { ...picked };
    const missing: string[] = [];

    const unpicked = requiredPicks.filter((item) => !item.ok).map((item) => item.label);
    if (unpicked.length > 0) {
      setError(
        `${unpicked.join(', ')} tanlanishi shart — do'kondan sizga mos kiyim shu bilan topiladi`,
      );
      return false;
    }

    for (const key of keys) {
      const parsed = parseField(values[key] ?? '', key);
      if (parsed === 'invalid') {
        setError(
          t.avatar.rangeError
            .replace('{label}', measureLabel(t, key))
            .replace('{hint}', measureHint(t, key)),
        );
        return false;
      }
      if (parsed === null) missing.push(measureLabel(t, key));
      else input[key] = parsed;
    }

    // Bo'y va vazn — avatar shakli shulardan hisoblanadi, ularsiz kiyim
    // o'lchami ma'nosiz bo'lib qoladi
    /*
     * ⚠️ KO'KRAK VA BEL QO'SHILDI. Kiyim o'lchami aynan shulardan
     * hisoblanadi (`@looksave/validation` · `sizing.ts`); ularsiz kiyintirish ekranidagi
     * «menga mos o'lchamdagi kiyimlar» filtri o'chib qoladi va
     * foydalanuvchi o'ziga to'g'ri kelmaydigan kiyimni kiyintiradi.
     */
    const required = keys.filter((key) => key === 'height' || key === 'weight');
    const blocking = required.filter((key) => parseField(values[key] ?? '', key) === null);

    if (blocking.length > 0) {
      setError(
        t.avatar.requiredError.replace(
          '{fields}',
          blocking.map((key) => measureLabel(t, key)).join(', '),
        ),
      );
      return false;
    }

    if (Object.keys(input).length === 0) return false;

    setBusy(true);
    try {
      await saveMeasurements.mutateAsync(input);
      return true;
    } catch (saveError) {
      console.warn('[ai-flow] o`lchamlarni saqlab bo`lmadi', saveError);
      setError(t.avatar.saveError);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          onPress={goBack}
          hitSlop={10}
          style={styles.backButton}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t.avatar.title}</Text>
          <Text style={styles.headerHint}>{t.avatar.subtitle}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <StepBar current={step} />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 'gender' ? (
          <GenderStep
            value={gender}
            busy={busy}
            onSelect={async (value) => {
              setGender(value);
              setBusy(true);
              try {
                await saveGender.mutateAsync(value);
                goNext();
              } catch (saveError) {
                console.warn('[ai-flow] jinsni saqlab bo`lmadi', saveError);
                setError(t.avatar.saveError);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}

        {step === 'face' ? <FaceStep onDone={goNext} onError={setError} /> : null}

        {step === 'body' ? (
          <MeasureStep
            title="Bo'y, vazn va oyoq o'lchami"
            hint="Shu uch ma'lumot avatar gavdasi va oyoq kiyim razmerini belgilaydi. Boshqa tana o'lchamlari so'ralmaydi."
            keys={['height', 'weight']}
            values={values}
            busy={busy}
            onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
            onNext={async () => {
              const ok = await submitMeasurements(
                ['height', 'weight'],
                shoeSize !== null ? { shoeSize } : {},
                [{ ok: shoeSize !== null, label: 'Oyoq kiyim razmeri' }],
              );
              if (ok) goNext();
            }}
          >
            <Text style={styles.chipsLabel}>Oyoq kiyim razmeri (EU)</Text>
            <SizeChips
              options={SHOE_SIZES}
              value={shoeSize as (typeof SHOE_SIZES)[number] | null}
              onChange={setShoeSize}
              accessibilityLabel="Oyoq kiyim razmeri"
            />
          </MeasureStep>
        ) : null}

        {step === 'store' ? (
          <StoreStep
            lat={coords.lat}
            lng={coords.lng}
            selectedId={storeId}
            onSelect={(id, name) => setStore(id, name)}
            onNext={() => {
              if (!storeId) {
                setError(t.avatar.pickStoreError);
                return;
              }
              goNext();
            }}
          />
        ) : null}

        {step === 'done' ? (
          <DoneStep
            // Kiyintirish qadamlariga o'tamiz. `replace` — avatar yasash
            // tugagan, unga orqaga qaytishning ma'nosi yo'q
            onStart={() => router.replace('/ai/fitting')}
            onRescan={() => setStep('face')}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Qadamlar ──

/**
 * Jins tanlash.
 *
 * NEGA KATTA KARTALAR: bu oqimning birinchi va eng muhim qarori — tana
 * modeli, kiyim kesimi va o'lcham jadvali shunga bog'liq. Kichik chip yoki
 * ro'yxat uni ikkinchi darajali ko'rsatardi.
 *
 * Tanlangan karta gradient va nur bilan ajratiladi: to'q fonda faqat
 * chegara rangini o'zgartirish yetarli emas — u sezilmay qoladi.
 */
function GenderStep({
  value,
  busy,
  onSelect,
}: {
  value: 'male' | 'female' | null;
  busy: boolean;
  onSelect: (value: 'male' | 'female') => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const options: Array<{ key: 'male' | 'female'; label: string; hint: string; icon: IconName }> = [
    { key: 'male', label: t.avatar.male, hint: t.avatar.maleHint, icon: 'slotTop' },
    { key: 'female', label: t.avatar.female, hint: t.avatar.femaleHint, icon: 'dress' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t.avatar.genderTitle}</Text>
      <Text style={styles.cardHint}>{t.avatar.genderHint}</Text>

      <View style={styles.genderRow}>
        {options.map((option) => {
          const selected = value === option.key;

          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={busy}
              onPress={() => onSelect(option.key)}
              style={[styles.genderCard, selected && styles.genderCardActive]}
            >
              <LinearGradient
                colors={
                  selected
                    ? ['rgba(139,92,246,0.28)', 'rgba(139,92,246,0.04)']
                    : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']
                }
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <View style={[styles.genderIcon, selected && styles.genderIconActive]}>
                <Icon
                  name={option.icon}
                  size={30}
                  color={selected ? colors.accent : colors.textMuted}
                />
              </View>

              <Text style={[styles.genderLabel, selected && styles.genderLabelActive]}>
                {option.label}
              </Text>
              <Text style={styles.genderHint}>{option.hint}</Text>

              {selected ? (
                <View style={styles.genderCheck}>
                  <Icon name="authentic" size={14} color={colors.textOnPrimary} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {busy ? <ActivityIndicator color={colors.primary} /> : null}
    </View>
  );
}

/** Chap ustundagi holat ko'rsatkichlari — matni i18n (`t.avatar`) dan */
const FACE_GUIDES: Array<{ icon: IconName; key: keyof Dictionary['avatar'] }> = [
  { icon: 'limited', key: 'guideLight' },
  { icon: 'profile', key: 'guideCenter' },
  { icon: 'reset', key: 'guideStraight' },
];

/** Pastdagi maslahatlar kartasi — matni i18n dan */
const FACE_TIPS: Array<{ icon: IconName; key: keyof Dictionary['avatar'] }> = [
  { icon: 'limited', key: 'tipLight' },
  { icon: 'profile', key: 'tipFaceShoulder' },
  { icon: 'camera', key: 'tipLookStraight' },
  { icon: 'close', key: 'tipNoGlasses' },
];

/** Ramkaning to'rt burchagidagi qavs — kamera "vizyor" bo'lib ko'rinadi */
function FrameCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }): JSX.Element {
  return <View style={[styles.corner, styles[`corner_${position}`]]} />;
}

/**
 * Yuz surati bilan NIMA BO'LISHI — bandma-band.
 *
 * ⚠️ BU MATN ANIQ BO'LISHI SHART. Ilgari bu yerda "surat faqat sizning
 * profilingizga saqlanadi va boshqa hech kimga ko'rinmaydi" deb yozilgan
 * edi va u IKKI JIHATDAN NOTO'G'RI edi: surat tashqi AI xizmatiga
 * yuboriladi va ochiq manzilda saqlanadi. Ya'ni foydalanuvchiga yolg'on
 * aytilardi (12-tz.md D-42).
 *
 * Qoida: bu yerda faqat BIZ TEKSHIRA OLADIGAN narsa yoziladi. Tashqi
 * xizmat suratni qancha saqlashini biz nazorat qilmaymiz — shuning
 * uchun u haqda va'da berilmaydi, faqat fakt aytiladi.
 */
const FACE_CONSENT: Array<{
  icon: IconName;
  titleKey: keyof Dictionary['avatar'];
  hintKey: keyof Dictionary['avatar'];
}> = [
  { icon: 'profile', titleKey: 'consent1Title', hintKey: 'consent1Hint' },
  { icon: 'premium', titleKey: 'consent2Title', hintKey: 'consent2Hint' },
  { icon: 'looks', titleKey: 'consent3Title', hintKey: 'consent3Hint' },
  { icon: 'trash', titleKey: 'consent4Title', hintKey: 'consent4Hint' },
];

function FaceStep({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (message: string) => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  /*
   * ⚠️ KAMERA RUXSATI ROZILIK EMAS. Tizim so'rovi "kameraga kirishga
   * ruxsatmi?" deb so'raydi — "suratni tashqi xizmatga yuborishga
   * rozimisiz?" deb emas. Ikkinchisi alohida va OLDIN so'raladi.
   */
  const [consented, setConsented] = useState(false);
  const camera = useRef<CameraView>(null);

  if (!consented) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.avatar.scannerTitle}</Text>
        <Text style={styles.cardHint}>{t.avatar.consentIntro}</Text>

        <View style={styles.consentList}>
          {FACE_CONSENT.map((item) => (
            <View key={item.titleKey} style={styles.consentRow}>
              <View style={styles.consentIcon}>
                <Icon name={item.icon} size={16} color={colors.accent} />
              </View>
              <View style={styles.consentText}>
                <Text style={styles.consentTitle}>{t.avatar[item.titleKey]}</Text>
                <Text style={styles.consentHint}>{t.avatar[item.hintKey]}</Text>
              </View>
            </View>
          ))}
        </View>

        <Button title={t.avatar.consentCta} onPress={() => setConsented(true)} />

        {/*
          ⚠️ O'TKAZIB YUBORISH HAR DOIM OCHIQ. Yuz surati majburiy emas:
          usiz ham avatar yasaladi (o'lchovlardan) va kiyintirish ishlaydi.
          Rad etgan odam ilovadan chiqib ketmasligi kerak.
        */}
        <Pressable onPress={onDone} style={styles.skip}>
          <Text style={styles.skipText}>{t.avatar.skipFace}</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) return <Loading />;

  if (!permission.granted) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.avatar.scannerTitle}</Text>
        <Text style={styles.cardHint}>{t.avatar.permissionHint}</Text>
        <Button title={t.avatar.allowCamera} onPress={() => void requestPermission()} />
        <Pressable onPress={onDone} style={styles.skip}>
          <Text style={styles.skipText}>{t.avatar.skipForNow}</Text>
        </Pressable>
      </View>
    );
  }

  const scan = async (): Promise<void> => {
    setScanning(true);

    /*
     * Uch bosqichning har biri alohida yiqilishi mumkin va sabablari
     * butunlay boshqa: kamera tayyor emas, tarmoq yo'q, sessiya eskirgan.
     * Bitta `catch` ularni bir xil xabarga aylantirsa, tuzatib bo'lmaydi —
     * shuning uchun qaysi bosqich ekani logga yoziladi.
     */
    let stage = 'kamera';
    try {
      // quality 0.5 — baribir keyin kichraytirib qayta siqiladi, tez olinsin
      const photo = await camera.current?.takePictureAsync({ quality: 0.5 });
      if (!photo?.uri) throw new Error('takePictureAsync rasm qaytarmadi');

      /*
       * ⚠️ BURILISHNI PIKSELGA SINGDIRISH — SHARTLI EMAS, MAJBURIY.
       *
       * Kamera suratni sensor yo'nalishida saqlaydi va to'g'ri tomonni
       * EXIF belgisida ko'rsatadi. Telefon uni to'g'ri ko'rsatadi, chunki
       * belgini o'qiydi. Lekin R2 ga yuklanganda va AI provayderiga
       * berilganda o'sha belgi hisobga OLINMAYDI — natijada yuz 90 gradus
       * yonboshlab ketadi.
       *
       * Bu jim xato edi va aynan shuning uchun avatarda foydalanuvchining
       * yuzi chiqmasdi: model yonboshlagan suratdan yuzni tanimaydi va
       * o'rniga umumiy odam yasab qo'yadi.
       *
       * `manipulateAsync` hech qanday amal bermasa ham suratni qayta
       * kodlaydi va burilishni PIKSELLARGA singdiradi — shundan keyin
       * EXIF belgisi umuman kerak emas.
       */
      stage = 'burilishni to`g`rilash';
      // Burilishni singdiramiz VA kichraytiramiz — yuklash tez bo'lsin
      // (yuz uchun 1280px yetarli, server baribir 1024 ga tushiradi)
      const upright = await manipulateAsync(photo.uri, [{ resize: { width: 1280 } }], {
        compress: 0.85,
        format: SaveFormat.JPEG,
      });

      /*
       * ⚠️ YORUG'LIK TEKSHIRUVI — YUKLASHDAN OLDIN.
       *
       * Server yuz nuqtalarini qorong'i suratdan topa olmaydi: bazadagi
       * ikki sinov selfisi o'lchandi, biri 30/255, ikkinchisi 3/255 —
       * ikkinchisida yuz umuman ko'rinmaydi. Bunday surat jimgina
       * yuklanadi, `face_morphs` bo'sh qoladi va foydalanuvchi
       * skanerlaganini ko'rgani uchun avatar o'zgarishini kutadi.
       *
       * Bu yerda u darhol qayta suratga oladi.
       */
      stage = 'yorug`likni tekshirish';
      const brightness = await averageBrightness(upright.uri);

      if (brightness !== null && brightness < MIN_BRIGHTNESS) {
        onError(t.avatar.tooDark);
        setScanning(false);
        return;
      }

      stage = 'yuklash';
      // ⚠️ `face` — shaxsiy kesh. `avatar` bo'lsa surat ochiq va bir yil
      // keshlanadigan qoidada saqlanardi (12-tz.md D-43)
      const url = await uploadAvatar(upright.uri, 'face');

      stage = 'profilni saqlash';
      /*
       * Bitta surat ikki joyga: profil surati (ro'yxatlarda ko'rinadi) va
       * yuz teksturasi (3D avatar boshiga tushadi). Ular alohida maydon,
       * chunki foydalanuvchi profil suratini almashtirsa avatar yuzi
       * o'zgarmasligi kerak.
       */
      await updateProfile({ avatarUrl: url, faceTextureUrl: url });
      onDone();
    } catch (error) {
      console.warn(`[face-scan] "${stage}" bosqichida yiqildi`, error);
      onError(t.avatar.scanFailed);
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.faceWrap}>
      {/* Kamera vizyori */}
      <View style={styles.viewfinder}>
        <FrameCorner position="tl" />
        <FrameCorner position="tr" />
        <FrameCorner position="bl" />
        <FrameCorner position="br" />

        <Text style={styles.faceTitle}>{t.avatar.scannerTitle}</Text>
        <Text style={styles.faceSubtitle}>{t.avatar.faceSubtitle}</Text>

        <View style={styles.scanRow}>
          <View style={styles.guides}>
            {FACE_GUIDES.map((guide) => (
              <View key={guide.key} style={styles.guide}>
                <View style={styles.guideIcon}>
                  <Icon name={guide.icon} size={16} color={colors.accent} />
                </View>
                <Text style={styles.guideText}>{t.avatar[guide.key]}</Text>
              </View>
            ))}
          </View>

          <View style={styles.ovalWrap}>
            <View style={styles.oval}>
              <CameraView ref={camera} facing="front" style={StyleSheet.absoluteFill} />
            </View>
            {/* Ikki halqa: tashqisi uzluksiz, ichkisi punktir — rasmdagidek */}
            <View pointerEvents="none" style={styles.ovalRing} />
            <View pointerEvents="none" style={styles.ovalRingInner} />
          </View>
        </View>

        <View style={styles.facePill}>
          <Text style={styles.facePillText}>{t.avatar.facePill}</Text>
        </View>
      </View>

      {/* Maslahatlar */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>{t.avatar.tipsTitle}</Text>
        <View style={styles.tipsRow}>
          {FACE_TIPS.map((tip) => (
            <View key={tip.key} style={styles.tip}>
              <View style={styles.tipIcon}>
                <Icon name={tip.icon} size={16} color={colors.textMuted} />
              </View>
              <Text style={styles.tipText}>{t.avatar[tip.key]}</Text>
            </View>
          ))}
        </View>
      </View>

      <Button
        title={scanning ? t.avatar.scanning : t.avatar.scanStart}
        onPress={() => void scan()}
        loading={scanning}
      />

      <Pressable onPress={onDone} style={styles.skip}>
        <Text style={styles.skipText}>{t.avatar.skipForNow}</Text>
      </Pressable>
    </View>
  );
}

function MeasureStep({
  title,
  hint,
  keys,
  values,
  busy,
  onChange,
  onNext,
  children,
}: {
  title: string;
  hint: string;
  keys: MeasureKey[];
  values: Record<string, string>;
  busy: boolean;
  onChange: (key: MeasureKey, value: string) => void;
  onNext: () => void;
  /** Razmer chiplari — maydonlardan keyin, tugmadan oldin */
  children?: ReactNode;
}): JSX.Element {
  const t = useI18n((state) => state.t);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardHint}>{hint}</Text>

      {keys.map((key) => (
        <Field
          key={key}
          label={measureLabel(t, key)}
          placeholder={measureHint(t, key)}
          value={values[key] ?? ''}
          onChangeText={(value) => onChange(key, value)}
          keyboardType="numeric"
        />
      ))}

      {children ? <View style={styles.chips}>{children}</View> : null}

      <Button title="Davom etish" onPress={onNext} loading={busy} />
    </View>
  );
}

/** Ro'yxatdagi bitta qator — yaqin va uzoq do'konlar uchun bir xil ko'rinish */
function StoreRow({
  name,
  meta,
  selected,
  onPress,
}: {
  name: string;
  meta: string;
  selected: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.storeRow, selected && styles.storeRowActive]}
    >
      <View style={styles.storeIcon}>
        <Icon name="stores" size={18} color={colors.accent} />
      </View>
      <View style={styles.storeText}>
        <Text style={styles.storeName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.storeMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {selected ? <Icon name="authentic" size={18} color={colors.success} /> : null}
    </Pressable>
  );
}

/**
 * Do'kon tanlash.
 *
 * IKKITA MANBA: `nearby` yaqin atrofdagilarni boy ma'lumot bilan beradi
 * (manzil, reyting, nechta 3D model), lekin radiusi eng ko'pi 50 km.
 * Boshqa viloyatdagi do'kon unga umuman tushmaydi — foydalanuvchi esa
 * ularni ham ko'rishi kerak. Shuning uchun ikkinchi ro'yxat xarita
 * endpointidan olinadi va yaqinlarnikidan keyin qo'shiladi.
 */
function StoreStep({
  lat,
  lng,
  selectedId,
  onSelect,
  onNext,
}: {
  lat: number;
  lng: number;
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  onNext: () => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const nearby = useQuery({
    queryKey: ['stores', 'nearby', lat, lng],
    queryFn: () => getNearbyStores(lat, lng, { radius: 50_000 }),
  });

  const all = useQuery({ queryKey: ['stores', 'all'], queryFn: getAllStoreMarkers });

  /** Yaqindagilar ro'yxatida bo'lmaganlari, masofasi bo'yicha tartiblangan */
  const others = useMemo(() => {
    const seen = new Set((nearby.data ?? []).map((store) => store.id));
    return (all.data ?? [])
      .filter((marker) => !seen.has(marker.id))
      .map((marker) => ({
        ...marker,
        distanceM: distanceMeters({ lat, lng }, { lat: marker.lat, lng: marker.lng }),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
  }, [all.data, nearby.data, lat, lng]);

  const nearbyList = nearby.data ?? [];
  const loading = nearby.isLoading || all.isLoading;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t.avatar.storeTitle}</Text>
      <Text style={styles.cardHint}>{t.avatar.storeHint}</Text>

      {loading ? <Loading /> : null}

      {/* Ikkala so'rov ham yiqilgandagina xato ko'rsatamiz — bittasi ishlasa
          ro'yxat baribir to'ladi */}
      {nearby.isError && all.isError ? (
        <ErrorView
          message={t.avatar.storesLoadError}
          onRetry={() => {
            void nearby.refetch();
            void all.refetch();
          }}
        />
      ) : null}

      {nearbyList.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{t.avatar.nearby}</Text>
          {nearbyList.map((store) => (
            <StoreRow
              key={store.id}
              name={store.name}
              meta={t.avatar.storeMetaAi
                .replace('{km}', (store.distanceM / 1000).toFixed(1))
                .replace('{n}', String(store.tryonCount))}
              selected={selectedId === store.id}
              onPress={() => onSelect(store.id, store.name)}
            />
          ))}
        </>
      ) : null}

      {others.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>
            {nearbyList.length > 0 ? t.avatar.otherStores : t.avatar.allStores}
          </Text>
          {others.map((store) => (
            <StoreRow
              key={store.id}
              name={store.name}
              meta={`${(store.distanceM / 1000).toFixed(0)} km`}
              selected={selectedId === store.id}
              onPress={() => onSelect(store.id, store.name)}
            />
          ))}
        </>
      ) : null}

      {!loading && nearbyList.length === 0 && others.length === 0 ? (
        <Text style={styles.cardHint}>{t.avatar.noStores}</Text>
      ) : null}

      <Button title={t.avatar.continue} onPress={onNext} />
    </View>
  );
}

/**
 * Yakuniy qadam — avatar yasaladi.
 *
 * ⚠️ ISH SHU YERDA BOSHLANADI, yuz skanerida emas. Skaner faqat suratni
 * saqlaydi; generatsiya esa kredit sarflaydi va u foydalanuvchi barcha
 * qadamlarni tugatganidan keyingina boshlanishi kerak. Aks holda oqimni
 * yarmida tashlab ketgan odam uchun ham to'lardik.
 *
 * ⚠️ TAYYOR AVATAR QAYTA YASALMAYDI: server manba hashini solishtiradi.
 * Shuning uchun bu ekranga qayta kirish xavfsiz.
 */
/**
 * Xabarnoma ruxsati bormi.
 *
 * ⚠️ KUTISH EKRANI MATNI SHUNGA BOG'LIQ. Ruxsat yo'q bo'lsa «tayyor
 * bo'lganda xabar yuboramiz» deb yozib bo'lmaydi — xabar kelmaydi va
 * odam ilovani yopib, natijani kutib o'tiraveradi.
 *
 * SO'RALMAYDI, faqat o'qiladi: kutish ekrani ruxsat so'rash uchun
 * noto'g'ri joy.
 */
function usePushEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void Notifications.getPermissionsAsync()
      .then((permission) => {
        if (active) setEnabled(permission.status === 'granted');
      })
      .catch(() => {
        // O'qib bo'lmasa — yo'q deb hisoblaymiz, matn ehtiyotkor bo'ladi
      });
    return () => {
      active = false;
    };
  }, []);

  return enabled;
}

function DoneStep({
  onStart,
  onRescan,
}: {
  onStart: () => void;
  /** Yuz skaneri qadamiga qaytaradi — surat bo'lmasa yagona yo'l */
  onRescan: () => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const storeName = useAiFlowStore((state) => state.storeName);
  const occasion = useAiFlowStore((state) => state.occasion);
  const style = useAiFlowStore((state) => state.style);
  const storeId = useAiFlowStore((state) => state.storeId);

  const profile = useQuery({ queryKey: ['profile'], queryFn: getFullProfile });
  const queryClient = useQueryClient();
  const pushEnabled = usePushEnabled();

  const startAvatar = useMutation({
    // Tanlangan do'kon so'rov bilan ketadi — operator o'sha kiyimlarni kiydiradi
    mutationFn: () => requestAvatar(storeId),
    // Ish boshlangach holatni darhol so'raymiz — 3 soniya kutilmasin
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['avatar'] }),
  });

  /*
   * Holat kuzatuvi.
   *
   * `refetchInterval` faqat tugamagan ishda ishlaydi — tayyor bo'lgach
   * o'zi to'xtaydi va serverga keraksiz so'rov ketmaydi.
   */
  const avatar = useQuery({
    queryKey: ['avatar'],
    queryFn: getAvatar,
    /*
     * ⚠️ `none` HAM KUZATILADI. Ish endi boshlangan bo'lsa server hali
     * `none` qaytarishi mumkin — u payt so'rovni to'xtatsak, holat
     * `processing` ga o'tganini hech kim sezmay qolardi va ekran abadiy
     * kutib turardi.
     *
     * `ready` va `failed` da esa to'xtaydi: ular yakuniy holat.
     */
    refetchInterval: (query) => {
      const data = query.state.data as UserAvatar | undefined;
      if (data?.status === 'ready' || data?.status === 'failed') return false;

      /*
       * ⚠️ NAVBATDA SEKINROQ SO'RALADI. Operator yo'lida kutish daqiqalar
       * bilan o'lchanadi — 3 soniyalik takror besh daqiqada yuzta keraksiz
       * so'rov va batareya sarfi demak.
       */
      return data?.queue ? 10_000 : 3000;
    },
  });

  /*
   * Ekran ochilishi bilan yasash SO'RALADI.
   *
   * ⚠️ "TAYYOR" BO'LSA HAM SO'RALADI — bu ataylab. Ilgari bu yerda
   * `status === 'ready'` bo'lsa so'rov umuman yuborilmasdi va shu sababli
   * JIM XATO chiqqan edi: foydalanuvchi yuzini QAYTADAN skaner qildi,
   * lekin ilova eski avatarni ko'rsatib turaverdi. Avatar yangi yuz bilan
   * hech qachon qayta yasalmadi va odam "o'xshamadi" deb qoldi.
   *
   * Qaror serverda qabul qilinishi kerak, ilovada emas: server manba
   * hashini (yuz surati + o'lchovlardan tuzilgan tavsif) solishtiradi.
   * Manba o'zgarmagan bo'lsa mavjud avatar qaytadi va KREDIT SARFLANMAYDI;
   * o'zgargan bo'lsa yangisi yasaladi. Ilova buni bilishi mumkin emas —
   * u hashni hisoblamaydi.
   *
   * ⚠️ REF BILAN QULFLANADI: mutatsiya obyekti har chizishda yangilanadi,
   * uni bog'liqliklarga qo'ysak effekt qayta ishlab ikkinchi so'rov ketardi.
   */
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    if (avatar.isLoading) return;

    // Ish allaqachon ketayotgan bo'lsa ikkinchisini boshlamaymiz
    if (avatar.data?.status === 'processing') return;

    requested.current = true;
    startAvatar.mutate();
  }, [avatar.isLoading, avatar.data?.status, startAvatar]);

  /*
   * ⚠️ HOLAT MANBAI — SO'ROV, MUTATSIYA EMAS.
   *
   * `startAvatar.data` — bu `POST /tryon/avatar` ning javobi va u har doim
   * `processing` bo'ladi. Mutatsiya natijasi MUZLAB QOLADI: u qayta
   * so'ralmaydi va o'zgarmaydi.
   *
   * Ilgari u birinchi o'rinda turardi va so'rovdan kelayotgan `ready`
   * holatini to'sib qo'yardi. Natijada avatar bazada tayyor bo'lsa ham
   * ekranda "deyarli tayyor" bo'lib abadiy qotib turardi — foydalanuvchi
   * esa buni nosozlik deb o'ylab qayta-qayta urinardi va HAR URINISH
   * KREDIT YERDI.
   *
   * `avatar` so'rovi esa har 3 soniyada yangilanadi va haqiqiy holatni
   * biladi. Shuning uchun u birinchi.
   */
  const status = avatar.data?.status ?? startAvatar.data?.status ?? 'none';

  /*
   * ⚠️ SO'ROVNING XATOSI ALOHIDA TEKSHIRILADI.
   *
   * Ilgari faqat `startAvatar.data` o'qilardi. So'rov RAD ETILGANDA esa
   * `data` bo'sh qoladi va holat `none` bo'lib turadi — quyidagi shart
   * uni «hali ishlayapti» deb tushunardi va ekran ABADIY aylanardi.
   *
   * Qurilmada ko'rildi: yuz skaneri o'tkazib yuborilgan, server
   * «Avval yuzingizni skaner qiling» deb rad etgan, foydalanuvchi esa
   * besh daqiqa aylanayotgan doiraga qarab o'tirgan. Chiqish yo'li ham
   * yo'q edi — bu sehrgarning OXIRGI qadami.
   */
  const startError = startAvatar.error;

  if (startError) {
    /*
     * Yuz surati yo'qligi — eng ko'p uchraydigan sabab va u tuzatiladi.
     * Shuning uchun bu holatda skanerga qaytish tugmasi ko'rsatiladi.
     */
    const needsFace = !profile.data?.faceTextureUrl;
    /*
     * ⚠️ XOM SERVER MATNI EMAS. Server xatosi o'zbekcha keladi; uni
     * `explainError` kod bo'yicha lokalga o'giradi. Yuz kerak bo'lsa
     * aniq ko'rsatma (`needFaceHint`) ko'rsatiladi — chunki u umumiy
     * `VALIDATION_ERROR` kodi bilan keladi va kod bo'yicha ajralmaydi.
     */
    const message = needsFace ? t.avatar.needFaceHint : explainError(startError, t);

    return (
      <View style={styles.card}>
        <View style={styles.doneIcon}>
          <Icon name="camera" size={32} color={colors.accent} />
        </View>
        <Text style={styles.cardTitle}>{needsFace ? t.avatar.needFace : t.avatar.avatarFailed}</Text>
        <Text style={styles.cardHint}>{message}</Text>
        {needsFace ? (
          <Button title={t.avatar.scanFace} onPress={onRescan} />
        ) : (
          <Button title={t.avatar.retry} onPress={() => startAvatar.mutate()} />
        )}
        <RealPhotoLink />
      </View>
    );
  }

  if (status === 'processing' || status === 'none') {
    /*
     * ⚠️ IKKI XIL KUTISH. `queue` bo'lsa ishni ODAM bajaradi (operator
     * navbati) — u yerda vaqt daqiqalar bilan o'lchanadi va ekran aniq
     * sanoq ko'rsatadi. Aks holda AI o'zi yasaydi: bosqichli ekran.
     */
    const queue = avatar.data?.queue ?? startAvatar.data?.queue ?? null;
    const faceUrl = profile.data?.faceTextureUrl ?? null;

    return queue ? (
      <AvatarQueued queue={queue} faceUrl={faceUrl} pushEnabled={pushEnabled} />
    ) : (
      <AvatarBuilding faceUrl={faceUrl} />
    );
  }

  if (status === 'failed') {
    /*
     * ⚠️ XOM SERVER XATOSI KO'RSATILMAYDI. `avatar.data.error` serverda
     * saqlangan matn (o'zbekcha, masalan OpenAI xatosi) — uni to'g'ridan-
     * to'g'ri chizsak boshqa tilli foydalanuvchi o'zbekcha ko'rardi.
     * O'rniga lokal, amaliy maslahat beriladi.
     */
    return (
      <View style={styles.card}>
        <View style={styles.doneIcon}>
          <Icon name="close" size={32} color={colors.danger} />
        </View>
        <Text style={styles.cardTitle}>{t.avatar.avatarFailed}</Text>
        <Text style={styles.cardHint}>{t.avatar.failedFallback}</Text>
        <Button title={t.avatar.retry} onPress={() => startAvatar.mutate()} />
        <RealPhotoLink />
      </View>
    );
  }

  const imageUrl = avatar.data?.imageUrl ?? startAvatar.data?.imageUrl ?? null;

  return (
    <View style={styles.card}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.avatarPreview} resizeMode="cover" />
      ) : null}

      <Text style={styles.cardTitle}>{t.avatar.avatarReady}</Text>
      <Text style={styles.cardHint}>
        {storeName ? `${storeName} · ` : ''}
        {occasion} · {style}
      </Text>
      <Text style={styles.cardHint}>{t.avatar.avatarReadyHint}</Text>
      <Button title={t.avatar.startFitting} onPress={onStart} />
      <RealPhotoLink />
    </View>
  );
}

/**
 * O'z haqiqiy suratiga o'tish yo'li.
 *
 * ⚠️ NEGA KERAK: yasalgan avatar — o'lchovlarga YAQINLASHTIRILGAN sintetik
 * tasvir. U yoqmasligi mumkin: yuz to'liq o'xshamasligi yoki gavda
 * boshqacha chiqishi mumkin. Bunday holatda foydalanuvchida chiqish yo'li
 * bo'lishi shart, aks holda u oqimda qamalib qoladi va ilovadan chiqib
 * ketadi.
 *
 * To'liq bo'yli surat esa haqiqiy natija beradi — u sintetik emas.
 * Shuning uchun bu yo'l yashirilmaydi, faqat ikkinchi o'rinda turadi.
 */
function RealPhotoLink(): JSX.Element {
  const t = useI18n((state) => state.t);
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/ai/photo')}
      hitSlop={8}
      style={styles.realPhoto}
    >
      <Text style={styles.realPhotoText}>{t.avatar.realPhoto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, marginBottom: spacing.md },
  chipsLabel: { ...text.label, color: colors.textDim, marginTop: spacing.xs },
  root: { flex: 1, backgroundColor: colors.bg },

  /*
   * Yasalgan avatar ko'rinishi — tik to'rtburchak, chunki `model-create`
   * 3:4 nisbatda qaytaradi va `cover` bilan kesilmasin.
   */
  realPhoto: { alignSelf: 'center', paddingVertical: spacing.sm },
  realPhotoText: { ...text.small, color: colors.accent, textAlign: 'center' },

  avatarPreview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    marginBottom: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { ...text.h2, color: colors.text },
  headerHint: { ...text.tiny, color: colors.textDim, letterSpacing: 1, marginTop: 2 },

  stepBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  // Yo'lak nuqtalarning markazi balandligida — chetki nuqtalar orasida
  stepTrack: {
    position: 'absolute',
    left: spacing.md + 22,
    right: spacing.md + 22,
    top: spacing.xs + 21,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.surface2,
  },
  stepTrackFill: {
    position: 'absolute',
    left: spacing.md + 22,
    top: spacing.xs + 21,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  // Faol nuqta atrofidagi nurli halqa
  stepHalo: {
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  stepDotDone: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  stepLabel: { ...text.tiny, color: colors.textDim, fontSize: 10 },
  stepLabelActive: { color: colors.accent, fontFamily: fonts.semibold },
  stepLabelDone: { color: colors.textMuted },

  body: { paddingHorizontal: spacing.md, gap: spacing.md },
  error: {
    ...text.small,
    color: colors.danger,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },

  /*
   * Karta foni ekran fonidan bir pog'ona yorug'roq. To'q interfeysda
   * qatlamlar aynan shu farq bilan ajraladi — chegara chizig'i o'zi yetarli
   * emas, u faqat yaqindan ko'rinadi.
   */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { ...text.h2, color: colors.text },
  cardHint: { ...text.body, color: colors.textMuted, lineHeight: 21 },

  genderRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  genderCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    borderRadius: radius.xl,
    // `overflow: hidden` — gradient burchaklardan chiqib ketmasin
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genderCardActive: {
    borderColor: colors.borderAccent,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  genderIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  genderIconActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  genderLabel: { ...text.h3, color: colors.textMuted },
  genderLabelActive: { color: colors.text },
  genderHint: { ...text.tiny, color: colors.textDim },
  // Tanlangan kartaning burchagidagi belgi — tanlov bir qarashda ko'rinadi
  genderCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  faceWrap: { gap: spacing.md },

  /*
   * Kamera vizyori — burchak qavslari bilan.
   *
   * Qavslar shunchaki bezak emas: ular ramkaning chegarasini ko'rsatadi va
   * "bu yerga qarang" degan ishorani beradi. To'liq chegara chizig'i esa
   * kameraning o'zini quti ichiga qamab qo'yardi.
   */
  viewfinder: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: colors.borderAccent,
  },
  corner_tl: {
    top: spacing.sm,
    left: spacing.sm,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: radius.md,
  },
  corner_tr: {
    top: spacing.sm,
    right: spacing.sm,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: radius.md,
  },
  corner_bl: {
    bottom: spacing.sm,
    left: spacing.sm,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: radius.md,
  },
  corner_br: {
    bottom: spacing.sm,
    right: spacing.sm,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: radius.md,
  },

  faceTitle: { ...text.h2, color: colors.text },
  faceSubtitle: { ...text.small, color: colors.textDim, textAlign: 'center' },

  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  guides: { gap: spacing.lg, width: 62 },
  guide: { alignItems: 'center', gap: spacing.xs },
  guideIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideText: { ...text.tiny, color: colors.textDim, textAlign: 'center', fontSize: 9 },

  ovalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /*
   * ⚠️ RAMKA YUZ EMAS, YUZ + YELKA UCHUN.
   *
   * Ilgari 180x240 tor oval edi va foydalanuvchi yuzi bilan to'ldirib
   * turardi — kameraga faqat bosh tushardi. Kadr KESILMAYDI, ya'ni
   * muammo suratda emas, YO'RIQNOMADA edi.
   *
   * Avatar shu suratdan yasaladi: yelka va bo'yin ko'rinmasa model
   * gavdani o'zidan o'ylab topadi va odam o'zini tanimaydi.
   */
  oval: {
    width: 240,
    height: 270,
    borderRadius: 130,
    // `overflow: hidden` — kamera oval shaklga kesiladi
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  ovalRing: {
    position: 'absolute',
    width: 250,
    height: 280,
    borderRadius: 135,
    borderWidth: 2,
    borderColor: colors.accent,
    opacity: 0.8,
  },
  // Ichki punktir halqa — rasmdagi ikki qatlamli ramka
  ovalRingInner: {
    position: 'absolute',
    width: 228,
    height: 258,
    borderRadius: 124,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    opacity: 0.4,
  },

  facePill: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  facePillText: { ...text.tiny, color: colors.textMuted },

  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tipsTitle: { ...text.small, color: colors.text },
  tipsRow: { flexDirection: 'row', gap: spacing.xs },
  tip: { flex: 1, alignItems: 'center', gap: spacing.xs },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { ...text.tiny, color: colors.textDim, textAlign: 'center', fontSize: 9 },

  consentList: { gap: spacing.sm, marginVertical: spacing.md },
  consentRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  consentIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  consentText: { flex: 1 },
  consentTitle: { ...text.small, color: colors.text, fontWeight: '600' },
  consentHint: { ...text.tiny, color: colors.textMuted, marginTop: 2 },

  skip: { alignSelf: 'center', padding: spacing.sm },
  skipText: { ...text.small, color: colors.textDim, textDecorationLine: 'underline' },

  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeRowActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  storeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeText: { flex: 1 },
  sectionLabel: { ...text.tiny, color: colors.textDim, marginTop: spacing.xs },
  storeName: { ...text.bodyMed, color: colors.text },
  storeMeta: { ...text.tiny, color: colors.textDim },

  doneIcon: { alignSelf: 'center', marginBottom: spacing.xs },
});
