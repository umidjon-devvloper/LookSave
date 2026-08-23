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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Slot } from '@looksave/validation';
import type * as THREE from 'three';

import { api } from '../../src/api/client';
import { addToCart, createLook, getFullProfile, type Measurements } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button, ErrorView, Loading } from '../../src/components/ui';
import { missingMeasurementFor, recommendSize } from '../../src/sizing';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { AvatarView, type AvatarConfig } from '../../src/three/AvatarView';
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
import type { Scene3DHandle } from '../../src/three/Scene3D';

/**
 * Try-On — erkin kiyintirish ekrani (05-mobile §6.10, deck 05-slayd).
 *
 * ⚠️ BU EKRAN QAYTA TIKLANDI. Ilgari shu yerda 3D sahna bor edi va u
 * qurilmada UMUMAN chizilmasdi — shuning uchun fayl `<Redirect href="/ai" />`
 * ga aylantirilgan edi va deckning eng ko'zga tashlanadigan xususiyati
 * (svayp bilan kiyim almashtirish) ilovadan butunlay yo'qolgan edi.
 *
 * Sabab sahnada emas, QOBIQDA edi: `@react-three/fiber` bu stackda
 * chizmaydi (o'lchov `Scene3D.tsx` sarlavhasida). Endi `AvatarView`
 * xom `WebGLRenderer` ustiga qurilgan.
 *
 * ⚠️ `ai/dressing.tsx` DAN FARQI: u boshqariladigan yo'l — ustki kiyim →
 * pastki → oyoq → komplekt saqlash, AI oqimining bir qismi. Bu ekran
 * esa erkin: foydalanuvchi xohlagan slotni bosadi, svayp qiladi,
 * yoqqanini savatga soladi. 3D mantiq ikkalasida bir xil (`src/three/`),
 * takrorlanmaydi.
 */

interface SlotTab {
  slot: Slot;
  label: string;
  icon: IconName;
}

/** Deckdagi tartib: bosh → ustki → tashqi → pastki → oyoq → aksessuar */
const SLOT_TABS: SlotTab[] = [
  { slot: 'head', label: 'Bosh', icon: 'slotHead' },
  { slot: 'top', label: 'Ustki', icon: 'slotTop' },
  { slot: 'outer', label: 'Kurtka', icon: 'slotOuter' },
  { slot: 'bottom', label: 'Pastki', icon: 'slotBottom' },
  { slot: 'feet', label: 'Oyoq', icon: 'slotFeet' },
  { slot: 'wrist', label: 'Aksessuar', icon: 'premium' },
];

export default function TryOn(): JSX.Element {
  /*
   * ⚠️ ENG BIRINCHI TEKSHIRUV — quyida shartli `return` lar bor va
   * hook'lar ular ortida qolib ketsa React qoidasi buziladi.
   */
  const authStatus = useAuthStore((state) => state.status);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [slot, setSlot] = useState<Slot>('top');
  const [quality, setQuality] = useState<Quality>('medium');
  const [bodyReady, setBodyReady] = useState(false);
  const [placeholder, setPlaceholder] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [, forceRender] = useState(0);

  /** Slot mantiqi `core.ts` da testlangan — bu yerda faqat ishlatiladi */
  const slots = useMemo(() => new SlotState(), []);
  const models = useRef(new Map<string, THREE.Group | null>()).current;
  const stage = useRef<Scene3DHandle>(null);

  /*
   * `AvatarView` ga beriladigan chaqiruvlar BARQAROR bo'lishi kerak —
   * inline funksiya har renderda yangi bo'ladi va sahnani qayta qurishga
   * majbur qiladi.
   */
  const handleBodyReady = useCallback(() => setBodyReady(true), []);
  const handlePlaceholder = useCallback(() => setPlaceholder(true), []);

  const config = useQuery({
    queryKey: ['avatar', 'config'],
    queryFn: () => api<AvatarConfig & { qualityHint: Quality }>('/avatar/config'),
    enabled: authStatus === 'signedIn',
  });

  const profile = useQuery({
    queryKey: ['profile', 'full'],
    queryFn: getFullProfile,
    enabled: authStatus === 'signedIn',
  });

  const items = useQuery({
    queryKey: ['tryon', 'slot', slot],
    queryFn: () => api<TryonItem[]>(`/tryon/slot/${slot}?limit=50`),
    enabled: authStatus === 'signedIn',
  });

  useEffect(() => {
    if (config.data?.qualityHint) setQuality(config.data.qualityHint);
  }, [config.data?.qualityHint]);

  // Ekrandan chiqilganda butun sahna tozalanadi — busiz GPU xotirasi
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

  const list = items.data ?? [];
  const measurements: Measurements = profile.data?.measurements ?? {};
  const current = slots.get(slot);
  const suggestedSize = recommendSize(slot, measurements);
  const missingFor = missingMeasurementFor(slot);

  const equip = useCallback(
    async (item: TryonItem, target: Slot): Promise<void> => {
      setEquipping(true);
      setNotice(null);

      try {
        const model = await loadGarment(item, quality);
        if (!model) {
          setNotice('Bu mahsulotning 3D modeli hali tayyor emas');
          slots.equip(target, item);
          forceRender((value) => value + 1);
          return;
        }

        tagSlot(model, target);
        // Kiyimda ham tana bilan bir xil shape key'lar bor va ular ham
        // float tekstura talab qiladi (`loader.ts` izohi)
        if (config.data) bakeForExpoGl(model, config.data.morphTargets);

        const previous = slots.equip(target, item);
        const previousModel = models.get(target);

        if (previous) unpinModel(previous.variantId, quality);
        if (previousModel) disposeObject(previousModel);

        models.set(target, model);
        pinModel(item.variantId, quality);
        forceRender((value) => value + 1);

        void api('/tryon/event', { method: 'POST', body: { variantId: item.variantId } }).catch(
          () => undefined,
        );
      } catch (error) {
        // Sabab foydalanuvchiga emas, ishlab chiquvchiga kerak
        console.warn('[tryon] kiyim yuklanmadi', item.variantId, error);
        setNotice('Model yuklanmadi — eski variant joyida qoldi');
      } finally {
        setEquipping(false);
      }
    },
    [config.data, models, quality, slots],
  );

  /** Joriy slotdagi ro'yxat bo'ylab siljish — svayp shuni chaqiradi */
  const move = useCallback(
    (direction: 1 | -1): void => {
      if (list.length === 0) return;

      const chosen = slots.get(slot);
      const index = chosen ? list.findIndex((item) => item.variantId === chosen.variantId) : -1;

      const next = nextIndex(index < 0 ? 0 : index, direction, list.length);
      const item = list[next];
      if (item) void equip(item, slot);
    },
    [equip, list, slot, slots],
  );

  const remove = useCallback(
    (target: Slot): void => {
      const model = models.get(target);
      const chosen = slots.get(target);

      if (chosen) unpinModel(chosen.variantId, quality);
      if (model) disposeObject(model);

      models.delete(target);
      slots.unequip(target);
      forceRender((value) => value + 1);
    },
    [models, quality, slots],
  );

  const saveLook = useMutation({
    mutationFn: () => {
      const chosen = slots.list().map((entry) => ({
        slot: entry.slot,
        variantId: entry.item.variantId,
      }));
      if (chosen.length === 0) throw new Error('empty');
      return createLook({ name: 'Try-On', occasion: 'Kundalik', items: chosen });
    },
    onSuccess: () => router.push('/looks'),
    onError: () => setNotice('Komplekt saqlanmadi — kamida bitta kiyim tanlang'),
  });

  const cart = useMutation({
    mutationFn: () => {
      if (!current) throw new Error('empty');
      // O'lcham tavsiyasi bo'lmasa `M` — foydalanuvchi savatda o'zgartira oladi
      return addToCart(current.variantId, suggestedSize ?? 'M');
    },
    onSuccess: () => setNotice('Savatga qo‘shildi'),
    onError: () => setNotice('Savatga qo‘shilmadi'),
  });

  if (authStatus !== 'signedIn') {
    return (
      <SignInRequired
        title="Kiyib ko‘rish"
        hint="Kiyim sizning avataringizga kiydiriladi, shuning uchun kirish kerak."
      />
    );
  }

  if (config.isLoading) return <Loading />;
  if (config.isError || !config.data) {
    return <ErrorView message="Avatar yuklanmadi" onRetry={() => void config.refetch()} />;
  }

  return (
    <View style={styles.root}>
      {/* 3D sahna */}
      <View style={styles.scene}>
        <AvatarView
          ref={stage}
          config={config.data}
          equipped={models}
          hiddenParts={slots.hiddenBodyParts()}
          quality={quality}
          onQualityChange={setQuality}
          onBodyReady={handleBodyReady}
          onError={setNotice}
          onPlaceholder={handlePlaceholder}
          onSwipe={move}
          onFps={setFps}
        />

        {/* Chapdagi boshqaruv (§6.10 maketi) */}
        <View style={[styles.controls, { top: insets.top + spacing.xl }]}>
          <ControlButton
            icon="rotate"
            label="Aylantirish"
            onPress={() => stage.current?.rotateBy(Math.PI / 6)}
          />
          <ControlButton
            icon="zoom"
            label="Yaqinlashtirish"
            onPress={() => stage.current?.zoomBy(1.3)}
          />
          <ControlButton icon="reset" label="Qayta" onPress={() => stage.current?.reset()} />
        </View>

        {/* O'ngda — yechish */}
        {current ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => remove(slot)}
            style={[styles.removeButton, { top: insets.top + spacing.xl }]}
          >
            <Icon name="trash" size={16} color={colors.danger} />
            <Text style={styles.removeText}>Yechish</Text>
          </Pressable>
        ) : null}

        {/*
          AI oqimiga kirish (deck 03–06-slayd).

          ⚠️ NEGA SHU YERDA: markaziy tab tugmasi endi 3D ga kiradi
          (Q-1 qarori), ya'ni AI ga boshqa kirish nuqtasi qolmagan edi.
          Mantiqan ham to'g'ri joyi shu: foydalanuvchi 3D da bepul tanlab
          bo'lgach, yoqqanini AI da "menda qanday ko'rinadi" deb ko'radi.
        */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ai')}
          style={[styles.aiPill, { bottom: spacing.lg }]}
        >
          <Icon name="premium" size={14} color={colors.accent} />
          <Text style={styles.aiPillText}>AI bilan ko‘rish</Text>
        </Pressable>

        {placeholder && bodyReady ? (
          <View style={[styles.badge, { top: insets.top + spacing.sm }]}>
            <Text style={styles.badgeText}>Namuna avatar</Text>
          </View>
        ) : null}

        {/* FPS — faqat DEV'da. Qator umuman chiqmasa: sahna chizmayapti. */}
        {__DEV__ ? (
          <View style={[styles.fpsBadge, { top: insets.top + spacing.sm }]} pointerEvents="none">
            <Text style={styles.fpsText}>
              {fps === null ? 'FPS: —' : `${Math.round(fps)} FPS · ${quality}`}
            </Text>
          </View>
        ) : null}

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

        {bodyReady && list.length > 1 ? (
          <Text style={styles.swipeHint}>← svayp qiling: {slot} almashadi →</Text>
        ) : null}
      </View>

      {/* Slot tanlash */}
      <View style={styles.slotBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SLOT_TABS.map((tab) => {
            const active = tab.slot === slot;
            const filled = slots.get(tab.slot) !== null;
            return (
              <Pressable
                key={tab.slot}
                accessibilityRole="button"
                onPress={() => setSlot(tab.slot)}
                style={[styles.slotChip, active && styles.slotChipActive]}
              >
                <Icon
                  name={tab.icon}
                  size={16}
                  color={active ? colors.accent : filled ? colors.primary : colors.textDim}
                />
                <Text style={[styles.slotText, active && styles.slotTextActive]}>{tab.label}</Text>
                {filled ? <View style={styles.slotDot} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Pastki panel */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.sm }]}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

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

        {items.isLoading ? <Loading /> : null}

        {!items.isLoading && list.length === 0 ? (
          <Text style={styles.empty}>Bu bo‘limda hali 3D model yo‘q.</Text>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.itemRow}
        >
          {list.map((item) => {
            const active = current?.variantId === item.variantId;
            return (
              <Pressable
                key={item.variantId}
                accessibilityRole="button"
                onPress={() => void equip(item, slot)}
                style={[styles.item, active && styles.itemActive]}
              >
                {item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={styles.itemImage} />
                ) : (
                  <View style={[styles.itemImage, styles.itemPlaceholder]}>
                    <Icon
                      name={SLOT_TABS.find((tab) => tab.slot === slot)?.icon ?? 'slotTop'}
                      size={20}
                      color={colors.textDim}
                    />
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

        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              title="Saqlash"
              variant="ghost"
              onPress={() => saveLook.mutate()}
              loading={saveLook.isPending}
            />
          </View>
          <View style={styles.action}>
            <Button
              title="Savatga"
              onPress={() => cart.mutate()}
              loading={cart.isPending}
              disabled={!current}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scene: { flex: 1, position: 'relative' },

  controls: { position: 'absolute', left: spacing.md, gap: spacing.sm },
  control: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,18,28,0.8)',
  },
  controlPressed: { borderColor: colors.accent, backgroundColor: colors.surface2 },

  removeButton: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,18,28,0.8)',
  },
  removeText: { ...text.tiny, color: colors.danger },

  badge: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245,197,24,0.16)',
  },
  badgeText: { ...text.tiny, color: colors.limited },

  aiPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySoft,
  },
  aiPillText: { ...text.small, color: colors.accent, fontWeight: '600' },

  fpsBadge: {
    position: 'absolute',
    right: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fpsText: { ...text.tiny, color: colors.textMuted },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  overlayText: { ...text.small, color: colors.textMuted },
  spinner: { position: 'absolute', bottom: spacing.md, alignSelf: 'center' },
  swipeHint: {
    ...text.tiny,
    color: colors.textDim,
    position: 'absolute',
    // AI tugmasi ustida — ular ustma-ust tushmasligi kerak
    bottom: spacing.lg + 36,
    alignSelf: 'center',
  },

  slotBar: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotChipActive: { borderColor: colors.accent, backgroundColor: colors.primarySoft },
  slotText: { ...text.tiny, color: colors.textMuted },
  slotTextActive: { color: colors.accent, fontWeight: '600' },
  slotDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },

  panel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  notice: { ...text.tiny, color: colors.warning, marginBottom: spacing.xs },
  empty: { ...text.small, color: colors.textDim, paddingVertical: spacing.md },

  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sizeLabel: { ...text.small, color: colors.textMuted },
  sizeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  sizeChipText: { ...text.small, color: colors.accent, fontWeight: '700' },
  sizeNote: { ...text.tiny, color: colors.textDim },
  sizeMissing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sizeMissingText: { ...text.tiny, color: colors.warning, flex: 1 },

  itemRow: { paddingVertical: spacing.sm, gap: spacing.sm },
  item: {
    width: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    backgroundColor: colors.surface2,
  },
  itemActive: { borderColor: colors.accent, backgroundColor: colors.primarySoft },
  itemImage: { width: '100%', height: 64, borderRadius: radius.sm, marginBottom: spacing.xs },
  itemPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface3,
  },
  itemTitle: { ...text.tiny, color: colors.text },
  itemPrice: { ...text.tiny, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
});
