import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Slot } from '@looksave/validation';
import type * as THREE from 'three';

import { api } from '../../src/api/client';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button, ErrorView, Loading } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/authStore';
import { SignInRequired } from '../../src/components/SignInRequired';
import { useI18n } from '../../src/i18n';
import { AvatarScene, type AvatarConfig } from '../../src/three/AvatarScene';
import {
  SlotState,
  nextIndex,
  prefetchTargets,
  type Quality,
  type TryonItem,
} from '../../src/three/core';
import {
  bakeForExpoGl,
  disposeObject,
  loadGarment,
  pinModel,
  prefetch,
  purgeCache,
  setCacheQuality,
  tagSlot,
  unpinModel,
} from '../../src/three/loader';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Kiyib ko'rish ekrani (05-mobile §7).
 *
 * ⚠️ QURILMADA SOZLANADI:
 * - `activeOffsetX` va tezlik chegarasi — svayp va aylantirishni ajratadi
 * - kamera masofasi va avatar o'lchami
 * - yuklash vaqti (maqsad 2.5 s)
 *
 * Hujjat ham shuni aytadi: "Bu real qurilmada sozlanadi" (§7.4).
 */

const SLOTS: Array<{ value: Slot; label: string; icon: IconName }> = [
  { value: 'top', label: 'Ustki', icon: 'slotTop' },
  { value: 'bottom', label: 'Pastki', icon: 'slotBottom' },
  { value: 'feet', label: 'Oyoq', icon: 'slotFeet' },
  { value: 'outer', label: 'Kurtka', icon: 'slotOuter' },
  { value: 'head', label: 'Bosh', icon: 'slotHead' },
];

interface SlotCount {
  slot: string;
  label: string;
  count: number;
}

export default function TryOn(): JSX.Element {
  /*
   * ⚠️ ENG BIRINCHI TEKSHIRUV. Ilova endi kirish so'ramasdan ochiladi, lekin
   * bu ekran shaxsiy ma'lumotga tayanadi. Tekshiruv boshqa hook'lardan
   * keyin turmasligi kerak — quyida shartli `return` lar bor va hook'lar
   * ular ortida qolib ketsa React qoidasi buziladi.
   */
  const authStatus = useAuthStore((state) => state.status);
  const router = useRouter();
  const t = useI18n((state) => state.t);

  const [activeSlot, setActiveSlot] = useState<Slot>('top');
  const [index, setIndex] = useState(0);
  const [quality, setQuality] = useState<Quality>('medium');
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [bodyReady, setBodyReady] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Haqiqiy GLB o'rniga namuna shakl ko'rsatilyaptimi (`placeholder.ts`) */
  const [placeholder, setPlaceholder] = useState(false);
  const [, forceRender] = useState(0);

  /** Kiyilganlar — `SlotState` mantiqi `core.ts` da testlangan. */
  const slots = useMemo(() => new SlotState(), []);

  // Barqaror chaqiruvlar — inline funksiya sahnani qayta qurishga majbur qiladi
  const handleBodyReady = useCallback(() => setBodyReady(true), []);
  const handlePlaceholder = useCallback(() => setPlaceholder(true), []);
  const models = useRef(new Map<string, THREE.Group | null>()).current;

  const config = useQuery({
    queryKey: ['avatar', 'config'],
    queryFn: () => api<AvatarConfig & { qualityHint: Quality }>('/avatar/config'),
    // Kirmagan holatda 401 keladi — so'rov umuman yuborilmaydi
    enabled: authStatus === 'signedIn',
  });

  const slotCounts = useQuery({
    queryKey: ['tryon', 'slots'],
    queryFn: () => api<SlotCount[]>('/tryon/slots'),
    // Kirmagan holatda 401 keladi — so'rov umuman yuborilmaydi
    enabled: authStatus === 'signedIn',
  });

  const items = useQuery({
    queryKey: ['tryon', 'slot', activeSlot],
    queryFn: () => api<TryonItem[]>(`/tryon/slot/${activeSlot}?limit=50`),
    // Kirmagan holatda 401 keladi — so'rov umuman yuborilmaydi
    enabled: authStatus === 'signedIn',
  });

  // Server tavsiya qilgan sifatdan boshlanadi, keyin FPS bo'yicha tuzatiladi
  useEffect(() => {
    if (config.data?.qualityHint) setQuality(config.data.qualityHint);
  }, [config.data?.qualityHint]);

  useEffect(() => {
    setCacheQuality(quality);
  }, [quality]);

  // Ekrandan chiqilganda butun sahna tozalanadi — bu bo'lmasa xotira
  // sizib ketadi va 20-30 svaypdan keyin ilova qulaydi (§7.6)
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

  const list = items.data ?? [];
  const current = list[index];

  const equip = useCallback(
    async (item: TryonItem, slot: Slot): Promise<void> => {
      setEquipping(true);
      setNotice(null);

      try {
        const model = await loadGarment(item, quality);
        if (!model) {
          setNotice('Bu mahsulotning 3D modeli yo`q');
          return;
        }

        tagSlot(model, slot);
        // Kiyim tana bilan bir xil shape key'larga ega bo'lishi kerak,
        // aks holda o'lcham mos kelmaydi
        // Kiyimga ham singdiriladi — izohi `loader.ts` da
        if (config.data) bakeForExpoGl(model, config.data.morphTargets);

        const previous = slots.equip(slot, item);
        const previousModel = models.get(slot);

        if (previous) unpinModel(previous.variantId, quality);
        if (previousModel) disposeObject(previousModel);

        models.set(slot, model);
        pinModel(item.variantId, quality);
        forceRender((value) => value + 1);

        // Analitika — javob kutilmaydi
        void api('/tryon/event', { method: 'POST', body: { variantId: item.variantId } }).catch(
          () => undefined,
        );
      } catch {
        // Eski model joyida qoladi (§7.5)
        setNotice('Model yuklanmadi');
      } finally {
        setEquipping(false);
      }
    },
    [config.data, models, quality, slots],
  );

  // Ro'yxat kelganda birinchi mahsulot kiydiriladi
  useEffect(() => {
    if (!bodyReady || list.length === 0) return;

    const item = list[0];
    if (item && slots.get(activeSlot)?.variantId !== item.variantId) {
      setIndex(0);
      void equip(item, activeSlot);
    }
  }, [bodyReady, list, activeSlot, equip, slots]);

  // Prefetch: joriy elementdan ±2 (§7.2)
  useEffect(() => {
    if (list.length === 0) return;
    for (const item of prefetchTargets(list, index)) {
      void prefetch(item, quality);
    }
  }, [list, index, quality]);

  const move = useCallback(
    (direction: 1 | -1): void => {
      if (list.length === 0) return;

      const next = nextIndex(index, direction, list.length);
      const item = list[next];
      if (!item) return;

      setIndex(next);
      void equip(item, activeSlot);
    },
    [activeSlot, equip, index, list],
  );

  /**
   * Svayp — mahsulot almashtirish, sekin harakat — avatarni aylantirish.
   * `activeOffsetX` va tezlik chegarasi shu ikkisini ajratadi.
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

  const gestures = Gesture.Race(swipe, Gesture.Simultaneous(rotate, pinch));

  const cart = useMutation({
    mutationFn: () => {
      if (!current) throw new Error('Mahsulot tanlanmagan');
      // O'lcham tanlash mahsulot sahifasida — bu yerda faqat ko'rish
      return Promise.resolve(current.productId);
    },
    onSuccess: (productId) => router.push(`/product/${productId}`),
  });

  if (authStatus !== 'signedIn') {
    return (
      <SignInRequired
        title="Kiyib ko‘rish"
        hint="Avatar sizning o‘lchamlaringizga quriladi, shuning uchun kirish kerak."
      />
    );
  }

  if (config.isLoading || slotCounts.isLoading) return <Loading />;
  if (config.isError || !config.data) {
    return <ErrorView message={t.errors.generic} onRetry={() => void config.refetch()} />;
  }

  const available = (slotCounts.data ?? []).filter((slot) => slot.count > 0);

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={gestures}>
        <View style={styles.scene}>
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
          />

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

          {/* Namuna ekanini yashirmaymiz: aks holda "3D shu ekan" degan
              noto'g'ri taassurot qoladi */}
          {placeholder && bodyReady ? (
            <View style={styles.placeholderBadge}>
              <Text style={styles.placeholderText}>Namuna avatar</Text>
              <Text style={styles.placeholderHint}>3D modellar hali tayyorlanmoqda</Text>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      <View style={styles.panel}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.slots}>
          {SLOTS.filter((slot) => available.some((item) => item.slot === slot.value)).map(
            (slot) => (
              <Pressable
                key={slot.value}
                onPress={() => {
                  setActiveSlot(slot.value);
                  setIndex(0);
                }}
                style={[styles.slotChip, activeSlot === slot.value && styles.slotChipActive]}
              >
                <Icon
                  name={slot.icon}
                  size={18}
                  color={activeSlot === slot.value ? colors.text : colors.textMuted}
                />
                <Text
                  style={[styles.slotText, activeSlot === slot.value && { color: colors.text }]}
                >
                  {slot.label}
                </Text>
              </Pressable>
            ),
          )}
        </View>

        {items.isLoading ? <Text style={styles.hint}>Modellar yuklanmoqda…</Text> : null}

        {!items.isLoading && list.length === 0 ? (
          <Text style={styles.hint}>Bu turkumda hali 3D model yo'q. Boshqa turkumni tanlang.</Text>
        ) : null}

        {current ? (
          <>
            <View style={styles.info}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {current.title}
                </Text>
                <Text style={styles.store} numberOfLines={1}>
                  {current.storeName}
                  {current.colorName ? ` · ${current.colorName}` : ''}
                </Text>
              </View>
              <Text style={styles.price}>{money(current.price, current.currency)}</Text>
            </View>

            <Text style={styles.counter}>
              {index + 1} / {list.length} · chapga suring
            </Text>

            <Button title={t.product.addToCart} onPress={() => cart.mutate()} />
          </>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scene: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  overlayText: { ...text.small, color: colors.textDim },
  spinner: { position: 'absolute', top: spacing.md, right: spacing.md },
  placeholderBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: { ...text.tiny, color: colors.warning },
  placeholderHint: { ...text.tiny, color: colors.textDim },
  panel: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotChipActive: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  slotText: { ...text.small, color: colors.textMuted },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...text.bodyMed, color: colors.text },
  store: { ...text.small, color: colors.textDim },
  price: { ...text.bodyMed, color: colors.text },
  counter: { ...text.tiny, color: colors.textDim },
  hint: { ...text.small, color: colors.textDim },
  notice: { ...text.small, color: colors.warning },
});
