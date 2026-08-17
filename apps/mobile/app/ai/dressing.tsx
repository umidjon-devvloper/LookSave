import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Slot } from '@looksave/validation';
import type * as THREE from 'three';

import { api } from '../../src/api/client';
import { createLook, getFullProfile, type Measurements } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button, ErrorView, Loading } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/authStore';
import { SignInRequired } from '../../src/components/SignInRequired';
import { missingMeasurementFor, recommendSize } from '../../src/sizing';
import { useAiFlowStore } from '../../src/store/aiFlowStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { AvatarScene, type AvatarConfig } from '../../src/three/AvatarScene';
import { nextIndex, SlotState, type Quality, type TryonItem } from '../../src/three/core';
import {
  bakeForExpoGl,
  disposeObject,
  loadGarment,
  pinModel,
  purgeCache,
  tagSlot,
  unpinModel,
} from '../../src/three/loader';

/**
 * AI oqimining kiyintirish qismi — slot bo'yicha qadamma-qadam.
 *
 * NEGA `(tabs)/tryon.tsx` DAN ALOHIDA: Try-On erkin ekran — foydalanuvchi
 * xohlagan slotni bosadi va svayp qiladi. Bu yerda esa boshqarilgan yo'l:
 * ustki kiyim → pastki → oyoq → … → komplektni saqlash. Ikkalasini bitta
 * komponentga siqish har bir shartni ikki xil rejim uchun tekshirishga
 * olib kelardi. 3D mantiq (`SlotState`, `loadGarment`, `AvatarScene`)
 * ikkalasida bir xil — u `src/three/` da, takrorlanmaydi.
 *
 * ⚠️ Kiyim modellari (`glb_url`) hali bo'sh — ro'yxatlar bo'sh keladi va
 * har qadam "modeli yo'q" deb ko'rsatadi. Bu ekranning xatosi emas.
 */

interface DressStep {
  slot: Slot;
  title: string;
  hint: string;
  icon: IconName;
}

const DRESS_STEPS: DressStep[] = [
  { slot: 'top', title: 'Ustki kiyim', hint: 'Futbolka, ko‘ylak, sviter', icon: 'slotTop' },
  { slot: 'bottom', title: 'Pastki kiyim', hint: 'Shim, shorti, yubka', icon: 'slotBottom' },
  { slot: 'feet', title: 'Oyoq kiyimi', hint: 'Krossovka, botinka', icon: 'slotFeet' },
  { slot: 'outer', title: 'Ustki ust', hint: 'Kurtka, palto', icon: 'slotOuter' },
  { slot: 'head', title: 'Bosh kiyim', hint: 'Kepka, shapka', icon: 'slotHead' },
  { slot: 'wrist', title: 'Aksessuar', hint: 'Soat, bilaguzuk', icon: 'premium' },
];

/** Oxirgi indeks — yakuniy sahifa, u slotga tegishli emas */
const SUMMARY_INDEX = DRESS_STEPS.length;

function ControlButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
    >
      <Icon name={icon} size={16} color={colors.text} />
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

export default function Dressing(): JSX.Element {
  /*
   * ⚠️ ENG BIRINCHI TEKSHIRUV. Ilova endi kirish so'ramasdan ochiladi, lekin
   * bu ekran shaxsiy ma'lumotga tayanadi. Tekshiruv boshqa hook'lardan
   * keyin turmasligi kerak — quyida shartli `return` lar bor va hook'lar
   * ular ortida qolib ketsa React qoidasi buziladi.
   */
  const authStatus = useAuthStore((state) => state.status);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const storeId = useAiFlowStore((state) => state.storeId);
  const storeName = useAiFlowStore((state) => state.storeName);
  const occasion = useAiFlowStore((state) => state.occasion);
  const styleName = useAiFlowStore((state) => state.style);

  const [stepIndex, setStepIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [quality, setQuality] = useState<Quality>('medium');
  const [bodyReady, setBodyReady] = useState(false);
  const [placeholder, setPlaceholder] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** GL holati — sahna bo'sh bo'lganda sababni ekranda ko'rsatish uchun */
  const [glInfo, setGlInfo] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  /** Slot mantiqi `core.ts` da testlangan — bu yerda faqat ishlatiladi */
  const slots = useMemo(() => new SlotState(), []);

  /*
   * `AvatarScene` ga beriladigan chaqiruvlar BARQAROR bo'lishi kerak.
   * Inline funksiya har renderda yangi bo'ladi va sahnani qayta qurishga
   * majbur qiladi — bir marta cheksiz qayta yuklashga olib kelgan.
   */
  const handleBodyReady = useCallback(() => setBodyReady(true), []);
  const handlePlaceholder = useCallback(() => setPlaceholder(true), []);
  const models = useRef(new Map<string, THREE.Group | null>()).current;

  const step = DRESS_STEPS[stepIndex];
  const isSummary = stepIndex >= SUMMARY_INDEX;

  const config = useQuery({
    queryKey: ['avatar', 'config'],
    queryFn: () => api<AvatarConfig & { qualityHint: Quality }>('/avatar/config'),
    // Kirmagan holatda 401 keladi — so'rov umuman yuborilmaydi
    enabled: authStatus === 'signedIn',
  });

  const profile = useQuery({ queryKey: ['profile', 'full'], queryFn: getFullProfile });

  const items = useQuery({
    queryKey: ['tryon', 'slot', step?.slot],
    queryFn: () => api<TryonItem[]>(`/tryon/slot/${step?.slot ?? 'top'}?limit=50`),
    enabled: Boolean(step),
  });

  useEffect(() => {
    if (config.data?.qualityHint) setQuality(config.data.qualityHint);
  }, [config.data?.qualityHint]);

  // Ekrandan chiqilganda butun sahna tozalanadi — bu bo'lmasa GPU xotirasi
  // sizib ketadi (05-mobile §7.6)
  useEffect(
    () => () => {
      for (const model of models.values()) {
        if (model) disposeObject(model);
      }
      models.clear();
      slots.clear();
      purgeCache();
    },
    [models, slots],
  );

  /**
   * Tanlangan do'kon bo'yicha filtr. Foydalanuvchi qaysi do'kondan
   * buyurtma qilishini oldingi qadamda aytgan — boshqa do'kon mahsulotini
   * ko'rsatish uni chalg'itadi va savatda ikki do'kon aralashib ketadi.
   */
  const list = useMemo(() => {
    const all = items.data ?? [];
    if (!storeId) return all;
    const filtered = all.filter((item) => item.storeId === storeId);
    // Tanlangan do'konda bu slot bo'yicha hech narsa bo'lmasa, bo'sh ro'yxat
    // ko'rsatgandan ko'ra boshqa do'konlarnikini ko'rsatgan foydaliroq
    return filtered.length > 0 ? filtered : all;
  }, [items.data, storeId]);

  const measurements: Measurements = profile.data?.measurements ?? {};
  const suggestedSize = step ? recommendSize(step.slot, measurements) : null;
  const missingFor = step ? missingMeasurementFor(step.slot) : null;

  const equip = useCallback(
    async (item: TryonItem, slot: Slot): Promise<void> => {
      setEquipping(true);
      setNotice(null);

      try {
        const model = await loadGarment(item, quality);
        if (!model) {
          setNotice('Bu mahsulotning 3D modeli hali tayyor emas');
          // Model bo'lmasa ham tanlovni eslab qolamiz: komplekt saqlanganda
          // mahsulot ro'yxatga tushishi kerak
          slots.equip(slot, item);
          forceRender((value) => value + 1);
          return;
        }

        tagSlot(model, slot);
        /*
         * Kiyimga ham singdiriladi: u tana bilan bir xil shape key'larga ega
         * va ular ham float tekstura talab qiladi (`loader.ts` izohi).
         */
        if (config.data) bakeForExpoGl(model, config.data.morphTargets);

        const previous = slots.equip(slot, item);
        const previousModel = models.get(slot);

        if (previous) unpinModel(previous.variantId, quality);
        if (previousModel) disposeObject(previousModel);

        models.set(slot, model);
        pinModel(item.variantId, quality);
        forceRender((value) => value + 1);

        void api('/tryon/event', { method: 'POST', body: { variantId: item.variantId } }).catch(
          () => undefined,
        );
      } catch (error) {
        // Sabab foydalanuvchiga emas, ishlab chiquvchiga kerak: "yuklanmadi"
        // deyish tarmoqmi, parse xatosimi yoki keshmi — ajratmaydi
        console.warn('[tryon] kiyim yuklanmadi', item.variantId, error);
        setNotice('Model yuklanmadi — eski variant joyida qoldi');
      } finally {
        setEquipping(false);
      }
    },
    [config.data, models, quality, slots],
  );

  /** Joriy slotdagi ro'yxat bo'ylab oldinga/orqaga siljiydi */
  const move = useCallback(
    (direction: 1 | -1): void => {
      if (!step || list.length === 0) return;

      const current = slots.get(step.slot);
      const index = current ? list.findIndex((item) => item.variantId === current.variantId) : -1;

      const next = nextIndex(index < 0 ? 0 : index, direction, list.length);
      const item = list[next];
      if (item) void equip(item, step.slot);
    },
    [equip, list, slots, step],
  );

  const remove = useCallback(
    (slot: Slot): void => {
      const model = models.get(slot);
      const current = slots.get(slot);

      if (current) unpinModel(current.variantId, quality);
      if (model) disposeObject(model);

      models.delete(slot);
      slots.unequip(slot);
      forceRender((value) => value + 1);
    },
    [models, quality, slots],
  );

  const saveLook = useMutation({
    mutationFn: () => {
      const chosen = DRESS_STEPS.map((item) => ({ slot: item.slot, value: slots.get(item.slot) }))
        .filter((entry): entry is { slot: Slot; value: TryonItem } => entry.value !== undefined)
        .map((entry) => ({ slot: entry.slot, variantId: entry.value.variantId }));

      if (chosen.length === 0) throw new Error('empty');
      return createLook({ name: `${occasion} · ${styleName}`, occasion, items: chosen });
    },
    onSuccess: () => {
      router.dismissAll();
      router.replace('/looks');
    },
    onError: () => setNotice('Komplekt saqlanmadi — kamida bitta kiyim tanlang'),
  });

  /**
   * Svayp — mahsulotni almashtirish, sekin surish — avatarni aylantirish.
   *
   * Ikkalasi ham gorizontal harakat, shuning uchun ular TEZLIK bilan
   * ajratiladi: keskin surish (300 dan tez) mahsulotni almashtiradi,
   * sekin surish avatarni aylantiradi. `activeOffsetX` esa vertikal
   * aralashuvni to'sadi — aks holda ro'yxatni aylantirganda avatar
   * ham qimirlab ketardi.
   */
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd((event) => {
      if (Math.abs(event.velocityX) < 300) return;
      move(event.velocityX < 0 ? 1 : -1);
    })
    .runOnJS(true);

  const rotate = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .onChange((event) => setRotation((value) => value + event.changeX * 0.01))
    .runOnJS(true);

  const pinch = Gesture.Pinch()
    .onChange((event) => setZoom((value) => Math.min(2.2, Math.max(0.7, value * event.scale))))
    .runOnJS(true);

  if (authStatus !== 'signedIn') {
    return (
      <SignInRequired
        title="Kiyintirish"
        hint="Komplekt sizning avataringizga kiydiriladi, shuning uchun kirish kerak."
      />
    );
  }

  if (config.isLoading || profile.isLoading) return <Loading />;
  if (config.isError || !config.data) {
    return <ErrorView message="Avatar yuklanmadi" onRetry={() => void config.refetch()} />;
  }

  const chosenCount = DRESS_STEPS.filter((item) => slots.get(item.slot)).length;

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Sarlavha */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          hitSlop={10}
          onPress={() => (stepIndex === 0 ? router.back() : setStepIndex(stepIndex - 1))}
          style={styles.headerButton}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{isSummary ? 'Komplekt' : step?.title}</Text>
          <Text style={styles.headerHint}>
            {isSummary ? `${chosenCount} ta kiyim tanlandi` : step?.hint}
          </Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/* Qadam ko'rsatkichi */}
      <View style={styles.progress}>
        {DRESS_STEPS.map((item, index) => (
          <View
            key={item.slot}
            style={[
              styles.progressBar,
              index <= stepIndex && styles.progressBarDone,
              slots.get(item.slot) ? styles.progressBarFilled : null,
            ]}
          />
        ))}
      </View>

      {/* 3D sahna */}
      <View style={styles.scene}>
        <GestureDetector gesture={Gesture.Race(swipe, Gesture.Simultaneous(rotate, pinch))}>
          <View style={StyleSheet.absoluteFill}>
            <AvatarScene
              config={config.data}
              equipped={models}
              hiddenParts={slots.hiddenBodyParts()}
              rotation={rotation}
              zoom={zoom}
              quality={quality}
              onQualityChange={setQuality}
              onBodyReady={handleBodyReady}
              onError={setNotice}
              onPlaceholder={handlePlaceholder}
              onDiagnostics={setGlInfo}
            />
          </View>
        </GestureDetector>

        {/* Chapdagi boshqaruv — mockupdagidek */}
        <View style={styles.controls}>
          <ControlButton
            icon="rotate"
            label="Aylantirish"
            onPress={() => setRotation((value) => value + Math.PI / 6)}
          />
          <ControlButton
            icon="zoom"
            label="Yaqinlashtirish"
            onPress={() => setZoom((value) => (value >= 2 ? 0.8 : value + 0.35))}
          />
          <ControlButton
            icon="reset"
            label="Qayta"
            onPress={() => {
              setRotation(0);
              setZoom(1);
            }}
          />
        </View>

        {/* O'ngda — yechish */}
        {!isSummary && step && slots.get(step.slot) ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => remove(step.slot)}
            style={styles.removeButton}
          >
            <Icon name="trash" size={16} color={colors.danger} />
            <Text style={styles.removeText}>Yechish</Text>
          </Pressable>
        ) : null}

        {placeholder && bodyReady ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Namuna avatar</Text>
          </View>
        ) : null}

        {/* GL tashxisi — sahna bo'sh bo'lsa sabab shu yerda ko'rinadi.
            Qator umuman chiqmasa: GL konteksti yaratilmagan. */}
        <View style={styles.glBadge} pointerEvents="none">
          <Text style={styles.glBadgeText}>{glInfo ?? 'GL: kontekst yaratilmadi'}</Text>
        </View>

        {!bodyReady ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.overlayText}>Avatar tayyorlanmoqda…</Text>
          </View>
        ) : null}

        {equipping ? (
          <View style={styles.spinner}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </View>

      {/* Pastki panel */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.sm }]}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {isSummary ? (
          <ScrollView style={styles.summary} showsVerticalScrollIndicator={false}>
            {DRESS_STEPS.map((item) => {
              const chosen = slots.get(item.slot);
              return (
                <View key={item.slot} style={styles.summaryRow}>
                  <Icon name={item.icon} size={16} color={colors.textDim} />
                  <Text style={styles.summarySlot}>{item.title}</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>
                    {chosen ? chosen.title : '—'}
                  </Text>
                  {chosen ? (
                    <Text style={styles.summaryPrice}>{money(chosen.price, chosen.currency)}</Text>
                  ) : null}
                </View>
              );
            })}
            {storeName ? <Text style={styles.summaryStore}>Do‘kon: {storeName}</Text> : null}
          </ScrollView>
        ) : (
          <>
            {/* O'lcham tavsiyasi */}
            {suggestedSize ? (
              <View style={styles.sizeRow}>
                <Text style={styles.sizeLabel}>Sizga mos o‘lcham</Text>
                <View style={styles.sizeChip}>
                  <Text style={styles.sizeChipText}>{suggestedSize}</Text>
                </View>
                <Text style={styles.sizeNote}>taxminiy</Text>
              </View>
            ) : missingFor ? (
              <Pressable
                onPress={() => router.push('/settings/measurements')}
                style={styles.sizeMissing}
              >
                <Icon name="limited" size={14} color={colors.warning} />
                <Text style={styles.sizeMissingText}>
                  {missingFor} o‘lchami kiritilmagan — mos razmerni ko‘rsatolmaymiz. Kiritish →
                </Text>
              </Pressable>
            ) : null}

            {/* Mahsulotlar */}
            {items.isLoading ? <Loading /> : null}

            {!items.isLoading && list.length === 0 ? (
              <Text style={styles.empty}>
                Bu bo‘limda hali 3D model yo‘q. Keyingi qadamga o‘tishingiz mumkin.
              </Text>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.itemRow}
            >
              {list.map((item) => {
                const active = slots.get(step?.slot ?? 'top')?.variantId === item.variantId;
                return (
                  <Pressable
                    key={item.variantId}
                    accessibilityRole="button"
                    onPress={() => step && void equip(item, step.slot)}
                    style={[styles.item, active && styles.itemActive]}
                  >
                    {item.thumbnail ? (
                      <Image source={{ uri: item.thumbnail }} style={styles.itemImage} />
                    ) : (
                      <View style={[styles.itemImage, styles.itemPlaceholder]}>
                        <Icon name={step?.icon ?? 'slotTop'} size={20} color={colors.textDim} />
                      </View>
                    )}
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemPrice}>{money(item.price, item.currency)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {isSummary ? (
          <Button
            title="Komplektni saqlash"
            onPress={() => saveLook.mutate()}
            loading={saveLook.isPending}
          />
        ) : (
          <Button
            title={stepIndex === DRESS_STEPS.length - 1 ? 'Komplektni ko‘rish' : 'Davom etish'}
            onPress={() => setStepIndex(stepIndex + 1)}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { ...text.h3, color: colors.text },
  headerHint: { ...text.tiny, color: colors.textDim },

  progress: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surface2 },
  progressBarDone: { backgroundColor: colors.primaryDark },
  progressBarFilled: { backgroundColor: colors.accent },

  scene: { flex: 1 },
  controls: { position: 'absolute', top: spacing.md, left: spacing.sm, gap: spacing.sm },
  control: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    width: 60,
  },
  controlPressed: { backgroundColor: colors.surface3 },
  controlLabel: { ...text.tiny, color: colors.textDim, fontSize: 9 },

  removeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.sm,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeText: { ...text.tiny, color: colors.danger, fontSize: 9 },

  badge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { ...text.tiny, color: colors.warning },
  glBadge: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glBadgeText: {
    ...text.tiny,
    color: colors.accent,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  overlayText: { ...text.small, color: colors.textDim },
  spinner: { position: 'absolute', top: spacing.md, right: spacing.md },

  panel: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  notice: { ...text.small, color: colors.warning },
  empty: { ...text.small, color: colors.textDim, textAlign: 'center', paddingVertical: spacing.md },

  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sizeLabel: { ...text.small, color: colors.textMuted },
  sizeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  sizeChipText: { ...text.bodyMed, color: colors.accent },
  sizeNote: { ...text.tiny, color: colors.textDim },

  sizeMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  sizeMissingText: { ...text.tiny, color: colors.warning, flex: 1 },

  itemRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  item: {
    width: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    gap: 2,
  },
  itemActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  itemImage: {
    width: '100%',
    height: 78,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  itemPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemTitle: { ...text.tiny, color: colors.text },
  itemPrice: { ...text.tiny, color: colors.textDim },

  summary: { maxHeight: 200 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summarySlot: { ...text.tiny, color: colors.textDim, width: 84 },
  summaryValue: { ...text.small, color: colors.text, flex: 1 },
  summaryPrice: { ...text.small, color: colors.accent },
  summaryStore: { ...text.tiny, color: colors.textDim, paddingTop: spacing.sm },
});
