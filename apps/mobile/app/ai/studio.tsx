import { Asset } from 'expo-asset';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type * as THREE from 'three';
import type { Slot } from '@looksave/validation';

import { Scene3D, type Scene3DHandle, type SceneContext } from '../../src/three/Scene3D';
import { SlotState } from '../../src/three/core';
import {
  DEMO_GARMENTS,
  SLOT_ORDER,
  SLOT_TITLE,
  type GarmentSpec,
} from '../../src/three/demoAssets';
import { mountGarment, unmountGarment } from '../../src/three/garment';
import { applyHiddenParts, bakeForExpoGl, disposeObject, loadModel } from '../../src/three/loader';
import { colors, radius, spacing } from '../../src/theme/tokens';

/**
 * 3D kiyintirish studiyasi — spetsifikatsiyaning 2-BOSQICHI:
 * "SKINNED bind ishlaydi, ATTACHED bone'ga o'tiradi, `hideBodyMask`
 * ishlaydi. Swipe bilan almashtirish."
 *
 * Backend yo'q: avatar ham, kiyimlar ham ilova ichida (§8). 3-bosqichda
 * ular CDN dan keladi — bu ekran o'zgarmaydi, faqat ma'lumot manbasi
 * almashadi.
 */

/** Namoyish avatari — 16 mesh, 22 suyak (Mixamo skeleti). */
const AVATAR_MODEL = require('../../assets/models/male-base-v1.glb') as number;
const AVATAR_BYTES = 3.2 * 1024 * 1024;

/** Kiyim GLB'lari 22–154 KB oralig'ida; kesh byudjeti uchun o'rtacha qiymat. */
const GARMENT_BYTES = 140 * 1024;

export default function Studio(): JSX.Element {
  const insets = useSafeAreaInsets();
  const stage = useRef<Scene3DHandle>(null);

  const [activeSlot, setActiveSlot] = useState<Slot>('top');
  const [equipped, setEquipped] = useState<Partial<Record<Slot, string>>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  /*
   * 3D tomonidagi holat React holatidan ALOHIDA yashaydi: sahna obyektlari
   * har qayta chizishda qayta yaratilmasligi kerak. React faqat "nima
   * kiyilgan" ni biladi, sahnani esa quyidagi effekt shunga moslaydi.
   */
  const world = useRef<{ context: SceneContext; avatar: THREE.Object3D } | null>(null);
  const mounted = useRef(new Map<Slot, { key: string; object: THREE.Object3D }>());
  const slots = useRef(new SlotState<GarmentSpec>());

  /** Har sinxronizatsiyaga raqam beriladi — eskisi kech kelsa e'tiborsiz qoladi. */
  const syncToken = useRef(0);

  const onReady = useCallback(async (context: SceneContext) => {
    const asset = Asset.fromModule(AVATAR_MODEL);
    await asset.downloadAsync();

    const { scene: avatar } = await loadModel(
      'demo-avatar',
      asset.localUri ?? asset.uri,
      AVATAR_BYTES,
    );
    bakeForExpoGl(avatar, {});

    context.scene.add(avatar);
    world.current = { context, avatar };
    setStatus('ready');

    return () => {
      for (const entry of mounted.current.values()) {
        unmountGarment(entry.object);
        disposeObject(entry.object);
      }
      mounted.current.clear();
      context.scene.remove(avatar);
      disposeObject(avatar);
      world.current = null;
    };
  }, []);

  // Sahnani `equipped` holatiga moslash
  useEffect(() => {
    const scene = world.current;
    if (!scene) return;

    const token = ++syncToken.current;
    let cancelled = false;

    const sync = async (): Promise<void> => {
      setBusy(true);

      // 1. Olib tashlangan kiyimlar
      for (const [slot, entry] of [...mounted.current.entries()]) {
        if (equipped[slot] === entry.key) continue;

        unmountGarment(entry.object);
        disposeObject(entry.object);
        mounted.current.delete(slot);
        slots.current.unequip(slot);
      }

      // 2. Yangi kiyimlar
      for (const slot of SLOT_ORDER) {
        const key = equipped[slot];
        if (!key || mounted.current.get(slot)?.key === key) continue;

        const spec = DEMO_GARMENTS.find((garment) => garment.key === key);
        if (!spec) continue;

        const asset = Asset.fromModule(spec.module);
        await asset.downloadAsync();

        const { scene: object } = await loadModel(
          `garment-${spec.key}`,
          asset.localUri ?? asset.uri,
          GARMENT_BYTES,
        );

        /*
         * Yuklash paytida foydalanuvchi boshqa kiyimni tanlagan bo'lishi
         * mumkin. Eskirgan natija sahnaga qo'shilsa, ikkita kiyim ustma-ust
         * tushadi — shuning uchun darhol tozalanadi.
         */
        if (cancelled || token !== syncToken.current) {
          disposeObject(object);
          return;
        }

        bakeForExpoGl(object, {});
        mountGarment(scene.avatar, object);

        mounted.current.set(slot, { key: spec.key, object });
        slots.current.equip(slot, spec);
      }

      // 3. Kiyim ostidagi tana qismlarini yashirish (§4.3)
      applyHiddenParts(scene.avatar, slots.current.hiddenBodyParts());
      setBusy(false);
    };

    sync().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : String(error));
      setStatus('error');
      setBusy(false);
    });

    return () => {
      cancelled = true;
    };
  }, [equipped, status]);

  const toggle = useCallback((garment: GarmentSpec) => {
    setEquipped((current) => {
      const next = { ...current };
      // Qayta bosish — yechish. Bir slotda faqat bitta buyum turadi.
      if (next[garment.slot] === garment.key) delete next[garment.slot];
      else next[garment.slot] = garment.key;
      return next;
    });
  }, []);

  const onError = useCallback((error: Error) => {
    setStatus('error');
    setMessage(error.message);
  }, []);

  const visible = DEMO_GARMENTS.filter((garment) => garment.slot === activeSlot);

  return (
    <View style={styles.root}>
      <Scene3D ref={stage} onReady={onReady} onError={onError}>
        {status === 'loading' ? (
          <View style={styles.center} pointerEvents="none">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.hint}>avatar yuklanmoqda…</Text>
          </View>
        ) : null}

        {status === 'error' ? (
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.error}>{message}</Text>
          </View>
        ) : null}
      </Scene3D>

      {/* Slot tanlash — maketdagi yuqori qator */}
      <View style={[styles.tabs, { top: insets.top + spacing.sm }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SLOT_ORDER.map((slot) => {
            const active = slot === activeSlot;
            return (
              <Pressable
                key={slot}
                onPress={() => setActiveSlot(slot)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {SLOT_TITLE[slot] ?? slot}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Kiyim tasmasi — maketdagi past qator */}
      <View style={[styles.strip, { bottom: insets.bottom + spacing.md }]}>
        <View style={styles.stripHead}>
          <Text style={styles.stripTitle}>{SLOT_TITLE[activeSlot] ?? activeSlot}</Text>
          {busy ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          <Pressable onPress={() => stage.current?.reset()} hitSlop={8}>
            <Text style={styles.reset}>Kamerani tiklash</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {visible.map((garment) => {
            const active = equipped[garment.slot] === garment.key;
            return (
              <Pressable
                key={garment.key}
                onPress={() => toggle(garment)}
                style={[styles.card, active && styles.cardActive]}
              >
                <View style={[styles.swatch, { backgroundColor: garment.colorHex }]} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {garment.title}
                </Text>
                <Text style={styles.cardColor} numberOfLines={1}>
                  {garment.colorName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 10 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  tabs: { position: 'absolute', left: 0, right: 0, paddingHorizontal: spacing.md },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: 'rgba(20,18,28,0.75)',
  },
  tabActive: { borderColor: colors.accent, backgroundColor: 'rgba(192,132,252,0.16)' },
  tabText: { color: colors.textMuted, fontSize: 13 },
  tabTextActive: { color: colors.accent, fontWeight: '600' },

  strip: { position: 'absolute', left: 0, right: 0, paddingHorizontal: spacing.md },
  stripHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stripTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  reset: { color: colors.accent, fontSize: 12 },

  card: {
    width: 92,
    padding: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,18,28,0.9)',
  },
  cardActive: { borderColor: colors.accent, backgroundColor: 'rgba(192,132,252,0.14)' },
  swatch: { height: 40, borderRadius: radius.sm, marginBottom: spacing.xs },
  cardTitle: { color: colors.text, fontSize: 12 },
  cardColor: { color: colors.textMuted, fontSize: 11 },
});
