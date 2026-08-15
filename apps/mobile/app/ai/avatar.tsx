import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  getFullProfile,
  getNearbyStores,
  updateMeasurements,
  updateProfile,
  uploadAvatar,
  type Measurements,
} from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { distanceMeters } from '../../src/map/distance';
import { Button, ErrorView, Field, Loading } from '../../src/components/ui';
import { useAiFlowStore } from '../../src/store/aiFlowStore';
import { useLocationStore } from '../../src/store/locationStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

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

type StepKey = 'gender' | 'face' | 'body' | 'shoe' | 'store' | 'done';

const STEPS: Array<{ key: StepKey; label: string; icon: IconName }> = [
  { key: 'gender', label: 'Jins', icon: 'profile' },
  { key: 'face', label: 'Yuz', icon: 'camera' },
  { key: 'body', label: 'Tana', icon: 'slotTop' },
  { key: 'shoe', label: 'Oyoq', icon: 'slotFeet' },
  { key: 'store', label: "Do'kon", icon: 'stores' },
  { key: 'done', label: 'Tayyor', icon: 'authentic' },
];

/**
 * Faqat sonli o'lchamlar. `Measurements` da `shoeSizeSystem` (matn) ham bor —
 * uni bu ro'yxatga qo'shib bo'lmaydi, aks holda songa tayinlash tipni buzadi.
 */
type MeasureKey = 'height' | 'weight' | 'chest' | 'waist' | 'hips' | 'shoeSize';

/** `packages/validation/src/auth.ts` dagi chegaralar bilan bir xil */
const LIMITS: Record<MeasureKey, { min: number; max: number; label: string; hint: string }> = {
  height: { min: 120, max: 220, label: "Bo'y (sm)", hint: '120–220' },
  weight: { min: 30, max: 200, label: 'Vazn (kg)', hint: '30–200' },
  chest: { min: 50, max: 180, label: "Ko'krak (sm)", hint: 'eng keng joyi' },
  waist: { min: 40, max: 180, label: 'Bel (sm)', hint: 'eng ingichka joyi' },
  hips: { min: 50, max: 180, label: 'Son (sm)', hint: 'eng keng joyi' },
  shoeSize: { min: 30, max: 50, label: "Oyoq o'lchami (EU)", hint: '30–50' },
};

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

function StepBar({ current }: { current: StepKey }): JSX.Element {
  const activeIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <View style={styles.stepBar}>
      {STEPS.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;

        return (
          <View key={step.key} style={styles.stepItem}>
            <View
              style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}
            >
              <Icon
                name={done ? 'authentic' : step.icon}
                size={14}
                color={active || done ? colors.textOnPrimary : colors.textDim}
              />
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AvatarFlow(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const coords = useLocationStore((state) => state.coords);
  const setStore = useAiFlowStore((state) => state.setStore);
  const storeId = useAiFlowStore((state) => state.storeId);

  const [step, setStep] = useState<StepKey>('gender');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const profile = useQuery({ queryKey: ['profile', 'full'], queryFn: getFullProfile });

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

  if (profile.isLoading) return <Loading />;
  if (profile.isError) {
    return <ErrorView message="Profil yuklanmadi" onRetry={() => void profile.refetch()} />;
  }

  const goBack = (): void => {
    const index = STEPS.findIndex((item) => item.key === step);
    setError(null);
    if (index <= 0) {
      router.back();
      return;
    }
    setStep(STEPS[index - 1]?.key ?? 'gender');
  };

  const goNext = (): void => {
    const index = STEPS.findIndex((item) => item.key === step);
    setError(null);
    setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]?.key ?? 'done');
  };

  /** Kiritilgan o'lchamlarni tekshirib serverga yozadi */
  const submitMeasurements = async (keys: MeasureKey[]): Promise<boolean> => {
    const input: Measurements = {};
    const missing: string[] = [];

    for (const key of keys) {
      const parsed = parseField(values[key] ?? '', key);
      if (parsed === 'invalid') {
        setError(`${LIMITS[key]?.label}: ${LIMITS[key]?.hint} oralig'ida bo'lishi kerak`);
        return false;
      }
      if (parsed === null) missing.push(LIMITS[key]?.label ?? key);
      else input[key] = parsed;
    }

    // Bo'y va vazn — avatar shakli shulardan hisoblanadi, ularsiz kiyim
    // o'lchami ma'nosiz bo'lib qoladi
    const required = keys.filter(
      (key) => key === 'height' || key === 'weight' || key === 'shoeSize',
    );
    const blocking = required.filter((key) => parseField(values[key] ?? '', key) === null);

    if (blocking.length > 0) {
      setError(
        `${blocking.map((key) => LIMITS[key]?.label).join(', ')} kiritilishi shart — ularsiz o'lchamga mos kiyim tanlab bo'lmaydi`,
      );
      return false;
    }

    if (missing.length > 0 && Object.keys(input).length === 0) return false;

    setBusy(true);
    try {
      await saveMeasurements.mutateAsync(input);
      return true;
    } catch (saveError) {
      console.warn('[ai-flow] o`lchamlarni saqlab bo`lmadi', saveError);
      setError('Saqlanmadi — internetni tekshiring');
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
          <Text style={styles.headerTitle}>Avataringizni yarating</Text>
          <Text style={styles.headerHint}>AI uchun aniq · shaxsiy</Text>
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
                setError('Saqlanmadi — internetni tekshiring');
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}

        {step === 'face' ? <FaceStep onDone={goNext} onError={setError} /> : null}

        {step === 'body' ? (
          <MeasureStep
            title="Tana o'lchamlari"
            hint="Bo'y va vazn shart — avatar shakli va kiyim o'lchami shulardan hisoblanadi."
            keys={['height', 'weight', 'chest', 'waist', 'hips']}
            values={values}
            busy={busy}
            onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
            onNext={async () => {
              if (await submitMeasurements(['height', 'weight', 'chest', 'waist', 'hips']))
                goNext();
            }}
          />
        ) : null}

        {step === 'shoe' ? (
          <MeasureStep
            title="Oyoq o'lchami"
            hint="Krossovka va poyabzalni to'g'ri o'lchamda ko'rsatish uchun."
            keys={['shoeSize']}
            values={values}
            busy={busy}
            onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
            onNext={async () => {
              if (await submitMeasurements(['shoeSize'])) goNext();
            }}
          />
        ) : null}

        {step === 'store' ? (
          <StoreStep
            lat={coords.lat}
            lng={coords.lng}
            selectedId={storeId}
            onSelect={(id, name) => setStore(id, name)}
            onNext={() => {
              if (!storeId) {
                setError("Do'kon tanlang — kiyimlar shu do'kondan olinadi");
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
            onStart={() => router.replace('/ai/dressing')}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Qadamlar ──

function GenderStep({
  value,
  busy,
  onSelect,
}: {
  value: 'male' | 'female' | null;
  busy: boolean;
  onSelect: (value: 'male' | 'female') => void;
}): JSX.Element {
  const options: Array<{ key: 'male' | 'female'; label: string; icon: IconName }> = [
    { key: 'male', label: 'Erkak', icon: 'slotTop' },
    { key: 'female', label: 'Ayol', icon: 'dress' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Avatar turini tanlang</Text>
      <Text style={styles.cardHint}>
        Tana modeli va kiyim kesimi shunga qarab tanlanadi. Keyinroq profildan o‘zgartirsa bo‘ladi.
      </Text>

      <View style={styles.genderRow}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onSelect(option.key)}
            style={[styles.genderCard, value === option.key && styles.genderCardActive]}
          >
            <View style={styles.genderIcon}>
              <Icon name={option.icon} size={28} color={colors.accent} />
            </View>
            <Text style={styles.genderLabel}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      {busy ? <ActivityIndicator color={colors.primary} /> : null}
    </View>
  );
}

const FACE_TIPS: Array<{ icon: IconName; label: string }> = [
  { icon: 'limited', label: "Yorug'lik yetarli" },
  { icon: 'profile', label: 'Yuz markazda' },
  { icon: 'reset', label: 'Boshni egmang' },
];

function FaceStep({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (message: string) => void;
}): JSX.Element {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const camera = useRef<CameraView>(null);

  if (!permission) return <Loading />;

  if (!permission.granted) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Yuz skaneri</Text>
        <Text style={styles.cardHint}>
          Avatarga yuzingizni qo‘shish uchun kameraga ruxsat kerak. Rasm faqat sizning profilingizga
          saqlanadi.
        </Text>
        <Button title="Kameraga ruxsat berish" onPress={() => void requestPermission()} />
        <Pressable onPress={onDone} style={styles.skip}>
          <Text style={styles.skipText}>Hozircha o‘tkazib yuborish</Text>
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
      const photo = await camera.current?.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error('takePictureAsync rasm qaytarmadi');

      stage = 'yuklash';
      const url = await uploadAvatar(photo.uri);

      stage = 'profilni saqlash';
      await updateProfile({ avatarUrl: url });
      onDone();
    } catch (error) {
      console.warn(`[face-scan] "${stage}" bosqichida yiqildi`, error);
      onError(`Skanerlash bajarilmadi (${stage}) — qayta urinib ko‘ring`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Yuz skaneri</Text>
      <Text style={styles.cardHint}>Yuzingizni ramka ichiga joylang</Text>

      <View style={styles.scanRow}>
        <View style={styles.tips}>
          {FACE_TIPS.map((tip) => (
            <View key={tip.label} style={styles.tip}>
              <View style={styles.tipIcon}>
                <Icon name={tip.icon} size={14} color={colors.accent} />
              </View>
              <Text style={styles.tipText}>{tip.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ovalWrap}>
          <View style={styles.oval}>
            <CameraView ref={camera} facing="front" style={StyleSheet.absoluteFill} />
          </View>
          <View pointerEvents="none" style={styles.ovalRing} />
        </View>
      </View>

      <Text style={styles.scanHint}>To‘g‘ridan-to‘g‘ri kameraga qarang</Text>

      <Button
        title={scanning ? 'Skanerlanmoqda…' : 'Skanerlashni boshlash'}
        onPress={() => void scan()}
        loading={scanning}
      />

      <Pressable onPress={onDone} style={styles.skip}>
        <Text style={styles.skipText}>Hozircha o‘tkazib yuborish</Text>
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
}: {
  title: string;
  hint: string;
  keys: MeasureKey[];
  values: Record<string, string>;
  busy: boolean;
  onChange: (key: MeasureKey, value: string) => void;
  onNext: () => void;
}): JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardHint}>{hint}</Text>

      {keys.map((key) => (
        <Field
          key={key}
          label={LIMITS[key]?.label ?? key}
          placeholder={LIMITS[key]?.hint}
          value={values[key] ?? ''}
          onChangeText={(value) => onChange(key, value)}
          keyboardType="numeric"
        />
      ))}

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
      <Text style={styles.cardTitle}>Qaysi do‘kondan kiyinasiz?</Text>
      <Text style={styles.cardHint}>
        Kiyimlar va buyurtma shu do‘kondan bo‘ladi. Keyinroq almashtirsa bo‘ladi.
      </Text>

      {loading ? <Loading /> : null}

      {/* Ikkala so'rov ham yiqilgandagina xato ko'rsatamiz — bittasi ishlasa
          ro'yxat baribir to'ladi */}
      {nearby.isError && all.isError ? (
        <ErrorView
          message="Do‘konlar yuklanmadi"
          onRetry={() => {
            void nearby.refetch();
            void all.refetch();
          }}
        />
      ) : null}

      {nearbyList.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Yaqin atrofda</Text>
          {nearbyList.map((store) => (
            <StoreRow
              key={store.id}
              name={store.name}
              meta={`${(store.distanceM / 1000).toFixed(1)} km · ${store.product3dCount} ta 3D model`}
              selected={selectedId === store.id}
              onPress={() => onSelect(store.id, store.name)}
            />
          ))}
        </>
      ) : null}

      {others.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>
            {nearbyList.length > 0 ? 'Boshqa do‘konlar' : 'Barcha do‘konlar'}
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
        <Text style={styles.cardHint}>Hozircha birorta faol do‘kon yo‘q.</Text>
      ) : null}

      <Button title="Davom etish" onPress={onNext} />
    </View>
  );
}

function DoneStep({ onStart }: { onStart: () => void }): JSX.Element {
  const storeName = useAiFlowStore((state) => state.storeName);
  const occasion = useAiFlowStore((state) => state.occasion);
  const style = useAiFlowStore((state) => state.style);

  return (
    <View style={styles.card}>
      <View style={styles.doneIcon}>
        <Icon name="authentic" size={36} color={colors.success} />
      </View>
      <Text style={styles.cardTitle}>Avataringiz tayyor</Text>
      <Text style={styles.cardHint}>
        {storeName ? `${storeName} · ` : ''}
        {occasion} · {style}
      </Text>
      <Text style={styles.cardHint}>
        Endi kiyimlarni kiyib ko‘rish mumkin. O‘lchamlaringizga mos variantlar birinchi bo‘lib
        ko‘rsatiladi.
      </Text>
      <Button title="Kiyintirishni boshlash" onPress={onStart} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { ...text.h3, color: colors.text },
  headerHint: { ...text.tiny, color: colors.textDim },

  stepBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    gap: 2,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.accent },
  stepDotDone: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  stepLabel: { ...text.tiny, color: colors.textDim, fontSize: 10 },
  stepLabelActive: { color: colors.accent },

  body: { paddingHorizontal: spacing.md, gap: spacing.md },
  error: {
    ...text.small,
    color: colors.danger,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { ...text.h3, color: colors.text },
  cardHint: { ...text.small, color: colors.textMuted },

  genderRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  genderCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genderCardActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  genderIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderLabel: { ...text.bodyMed, color: colors.text },

  scanRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tips: { gap: spacing.md, width: 76 },
  tip: { alignItems: 'center', gap: 4 },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { ...text.tiny, color: colors.textDim, textAlign: 'center', fontSize: 10 },

  ovalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  oval: {
    width: 180,
    height: 240,
    borderRadius: 120,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
  },
  ovalRing: {
    position: 'absolute',
    width: 190,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: colors.accent,
    opacity: 0.7,
  },
  scanHint: { ...text.tiny, color: colors.textDim, textAlign: 'center' },

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
