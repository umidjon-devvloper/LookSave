import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ANGLE_LABEL,
  ANGLE_ORDER,
  addToCart,
  getAvatar,
  getFullProfile,
  getGarments,
  getRender,
  getRenders,
  requestAvatarAngle,
  requestRender,
  type AvatarAngle,
  type Garment,
  type TryonRender,
} from '../../src/api/endpoints';
import { ApiError } from '../../src/api/client';
import { AvatarStage } from '../../src/components/ai/AvatarStage';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button, Empty, Screen } from '../../src/components/ui';
import { recommendSize } from '../../src/sizing';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * AI kiyintirish — asosiy ekran.
 *
 * Tuzilishi mijoz bergan maketdan olingan: yuqorida avatar va uning
 * yonida boshqaruv, ostida kategoriya tablari, kiyim tasmasi, rang va
 * o'lcham tanlagichlari.
 *
 * ⚠️ SO'ROV FAQAT TUGMA BOSILGANDA YUBORILADI. Kiyimni tanlash bepul —
 * tasmani surish, rang va o'lcham tanlash hech narsa turmaydi. AI faqat
 * "Shuni kiyintir" bosilganda chaqiriladi va har chaqiruv PUL turadi.
 *
 * Avtomatik yasash qulayroq ko'rinardi, lekin foydalanuvchi tasmani bir
 * marta surganda o'nlab kredit yo'qolardi.
 */

/** Kategoriya tablari — faqat AI qo'llab-quvvatlaydigan slotlar. */
const TABS: Array<{ slot: string; label: string; icon: IconName }> = [
  { slot: 'top', label: 'Ustki', icon: 'slotTop' },
  { slot: 'outer', label: 'Kurtka', icon: 'slotOuter' },
  { slot: 'bottom', label: 'Pastki', icon: 'slotBottom' },
];

export default function FittingScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const [tab, setTab] = useState('top');
  const [chosen, setChosen] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [angle, setAngle] = useState<AvatarAngle>('front');
  const [notice, setNotice] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ['profile'], queryFn: getFullProfile, enabled: signedIn });
  const avatar = useQuery({
    queryKey: ['avatar'],
    queryFn: getAvatar,
    enabled: signedIn,
    // Burchak yasalayotgan bo'lsa kuzatamiz, aks holda so'rov yubormaymiz
    refetchInterval: (query) =>
      (query.state.data as { anglePending?: string | null } | undefined)?.anglePending
        ? 3000
        : false,
  });

  /*
   * Aylantirish.
   *
   * ⚠️ HAR BURCHAK ALOHIDA KREDIT. Shuning uchun tugma bosilganda avval
   * KESHGA qaraladi: burchak allaqachon yasalgan bo'lsa shunchaki
   * ko'rsatiladi va hech narsa to'lanmaydi. Faqat yo'q bo'lsa so'raladi.
   */
  const rotate = useMutation({
    mutationFn: requestAvatarAngle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatar'] }),
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Aylantirib bo`lmadi'),
  });

  const garments = useQuery({ queryKey: ['garments', tab], queryFn: () => getGarments(tab) });

  const items = useMemo(() => garments.data ?? [], [garments.data]);
  const current: Garment | undefined = items.find((item) => item.variantId === chosen) ?? items[0];

  // Tab almashganda tanlov tozalanadi — eski kiyim yangi ro'yxatda yo'q
  useEffect(() => {
    setChosen(null);
    setSize(null);
    setNotice(null);
  }, [tab]);

  /*
   * Tayyor natijalar bir so'rovda olinadi. Har kiyim uchun alohida so'rov
   * yuborilsa tarmoq bo'g'ilardi va keshdagi natija kech ko'rinardi.
   */
  const renders = useQuery({
    // ⚠️ Burchak kalitda: aks holda yon ko'rinish keshi old ko'rinishniki bilan aralashardi
    queryKey: ['renders', angle, items.map((item) => item.variantId).join(',')],
    queryFn: () =>
      getRenders(
        items.map((item) => item.variantId),
        angle,
      ),
    enabled: signedIn && items.length > 0,
  });

  const byVariant = useMemo(() => {
    const map = new Map<string, TryonRender>();
    for (const render of renders.data ?? []) map.set(render.variantId, render);
    return map;
  }, [renders.data]);

  const active = current ? byVariant.get(current.variantId) : undefined;

  const tracked = useQuery({
    queryKey: ['render', active?.id],
    queryFn: () => getRender(active?.id ?? ''),
    enabled: Boolean(active?.id) && active?.status !== 'ready' && active?.status !== 'failed',
    refetchInterval: (query) => {
      const data = query.state.data as TryonRender | undefined;
      return data?.status === 'ready' || data?.status === 'failed' ? false : 2500;
    },
  });

  const shown = tracked.data?.variantId === current?.variantId ? tracked.data : active;

  const start = useMutation({
    mutationFn: (input: { variantId: string; angle: AvatarAngle }) =>
      requestRender(input.variantId, input.angle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders'] }),
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Kiyintirib bo`lmadi'),
  });

  const cart = useMutation({
    mutationFn: (input: { variantId: string; chosenSize: string }) =>
      addToCart(input.variantId, input.chosenSize),
    onSuccess: () => setNotice('Savatga qo`shildi'),
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Qo`shilmadi'),
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint="Kiyintirish avataringizga bog`langan." />
      </Screen>
    );
  }

  const hasAvatar = avatar.data?.status === 'ready' || Boolean(profile.data?.bodyPhotoUrl);

  if (profile.isSuccess && avatar.isSuccess && !hasAvatar) {
    return (
      <Screen>
        {/*
          Ikkala yo'l ham ko'rsatiladi. Yasalgan avatar tez va qulay, lekin
          sintetik; haqiqiy surat esa aniq natija beradi. Faqat bittasini
          qoldirsak, biri yoqmagan foydalanuvchi oqimda qamalib qolardi.
        */}
        <Empty
          icon="profile"
          title="Avval avatar kerak"
          hint="Yuzingizni skaner qiling — AI gavdani o`lchovlaringizdan yasaydi. Yoki o`z to`liq bo`yli suratingizni yuklang."
          action={
            <View style={styles.emptyActions}>
              <Button title="Yuzni skaner qilish" onPress={() => router.replace('/ai/avatar')} />
              <Button
                title="O`z suratimni yuklash"
                variant="ghost"
                onPress={() => router.replace('/ai/photo')}
              />
            </View>
          }
        />
      </Screen>
    );
  }

  /*
   * Kiyintirilgan natija HAR BURCHAKDA ko'rinadi.
   *
   * Sinovda tasdiqlandi: kiyintirish modeli yon ko'rinishda ham pozani
   * tanidi va kiyimni to'g'ri joyladi. Shuning uchun aylantirilganda
   * o'sha burchakdagi kiyingan natija ko'rsatiladi.
   *
   * ⚠️ HAR BURCHAK ALOHIDA TO'LANADI: bitta kiyimni uch burchakda ko'rish
   * uch kredit turadi. Shuning uchun ular oldindan yasalmaydi.
   */
  const angles = avatar.data?.angles ?? {};
  const baseImage = angles[angle] ?? avatar.data?.imageUrl ?? profile.data?.bodyPhotoUrl ?? null;
  const resultImage = shown?.status === 'ready' ? shown.imageUrl : null;

  /*
   * Kesimlar — sahna uchun. Ular bo'lmasligi mumkin (serverda yasashda
   * nosozlik), shunda oddiy surat ishlatiladi va ekran buzilmaydi.
   *
   * ⚠️ Burchak old ko'rinishdan boshqa bo'lsa avatar kesimi ishlatilmaydi:
   * u faqat old ko'rinish uchun yasalgan.
   */
  const baseCutout = angle === 'front' ? (avatar.data?.cutoutUrl ?? null) : null;
  const resultCutout = shown?.status === 'ready' ? shown.cutoutUrl : null;
  const working = shown?.status === 'pending' || shown?.status === 'processing' || start.isPending;

  /*
   * ⚠️ O'LCHAM TAVSIYASI SURATDAN EMAS, HAQIQIY O'LCHOVLARDAN.
   * Yasalgan avatar taxminiy, o'lchovlar esa foydalanuvchi kiritgan aniq
   * raqamlar — shuning uchun tavsiya aniqligi avatar sifatiga bog'liq emas.
   */
  const recommended =
    current && profile.data ? recommendSize(current.slot, profile.data.measurements) : null;
  const sizes = current?.sizes ?? [];
  const picked =
    size ?? (recommended && sizes.includes(recommended) ? recommended : sizes[0]) ?? null;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Kiyintirish</Text>
          <Text style={styles.headerHint}>Kiyimni tanlang</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Avatarni almashtirish"
          hitSlop={10}
          onPress={() => router.push('/ai/avatar')}
          style={styles.headerButton}
        >
          <Icon name="camera" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* ── Avatar maydoni ── */}
      <View style={styles.stage}>
        {/*
          Maketdagi sahna: qorong'i fon, to'r, neon halqalar va o'lchovlar.
          Odam kesim sifatida qo'yiladi — oddiy surat och kulrang foni bilan
          kelsa, qora ekranda to'rtburchak bo'lib ko'rinardi.
        */}
        <AvatarStage
          imageUrl={resultImage ?? baseImage}
          cutoutUrl={resultCutout ?? baseCutout}
          measurements={profile.data?.measurements}
          dimmed={!resultImage && working}
          // Kiyintirilgan natijada halqalar chalg'itadi — kiyim ko'rinsin
          showRings={!resultImage}
        />

        {/* Boshqaruv — sahna ostida yotiq qator */}
        <View style={styles.controls}>
          <View style={styles.controlGroup}>
            <Control
              icon="zoom"
              label={zoomed ? 'Kichraytir' : 'Yaqinlashtir'}
              onPress={() => setZoomed((value) => !value)}
            />
            <Control
              icon="rotate"
              label={ANGLE_LABEL[angle]}
              busy={Boolean(avatar.data?.anglePending) || rotate.isPending}
              onPress={() => {
                const next =
                  ANGLE_ORDER[(ANGLE_ORDER.indexOf(angle) + 1) % ANGLE_ORDER.length] ?? 'front';
                setAngle(next);
                setNotice(null);

                // Keshda bo'lmasa yasaymiz — bo'lsa bepul ko'rsatiladi
                if (!angles[next]) rotate.mutate(next);
              }}
            />
            <Control
              icon="reset"
              label="Qayta"
              onPress={() => {
                setZoomed(false);
                setChosen(null);
                setSize(null);
                setNotice(null);
                setAngle('front');
              }}
            />
          </View>

          {/* Kiyimni yechish — faqat natija bo'lsa */}
          {resultImage ? (
            <Control icon="close" label="Yechish" onPress={() => setChosen(null)} danger />
          ) : null}
        </View>

        {working ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.overlayText}>AI kiyintirmoqda…</Text>
            <Text style={styles.overlayHint}>10–20 soniya</Text>
          </View>
        ) : null}

        {shown?.status === 'failed' ? (
          <View style={styles.overlay}>
            <Icon name="close" size={26} color={colors.danger} />
            <Text style={styles.overlayText}>Kiyintirib bo`lmadi</Text>
            <Text style={styles.overlayHint} numberOfLines={2}>
              {shown.error ?? 'Boshqa kiyim bilan urinib ko`ring'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Kategoriya tablari ── */}
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item.slot}
            accessibilityRole="button"
            onPress={() => setTab(item.slot)}
            style={[styles.tab, tab === item.slot && styles.tabActive]}
          >
            <Icon
              name={item.icon}
              size={18}
              color={tab === item.slot ? colors.accent : colors.textDim}
            />
            <Text style={[styles.tabText, tab === item.slot && { color: colors.text }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.bottom} showsVerticalScrollIndicator={false}>
        {/* ── Kiyim tasmasi ── */}
        {garments.isLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.stripLoader} />
        ) : items.length === 0 ? (
          <Text style={styles.emptyStrip}>Bu turkumda hozircha kiyim yo`q</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.variantId}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            removeClippedSubviews
            renderItem={({ item }) => {
              const selected = item.variantId === current?.variantId;
              const ready = byVariant.get(item.variantId)?.status === 'ready';

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPress={() => {
                    setChosen(item.variantId);
                    setSize(null);
                    setNotice(null);
                  }}
                  style={[styles.thumbWrap, selected && styles.thumbSelected]}
                >
                  <Image source={{ uri: item.image }} style={styles.thumb} resizeMode="cover" />

                  {/*
                    Tayyor natija belgilanadi — foydalanuvchi bu kiyim uchun
                    qayta to'lov ketmasligini ko'rib tursin.
                  */}
                  {ready ? (
                    <View style={styles.readyBadge}>
                      <Icon name="authentic" size={10} color={colors.bg} />
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}

        {current ? (
          <View style={styles.details}>
            <Text style={styles.title} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={styles.store} numberOfLines={1}>
              {current.store.name}
            </Text>

            {current.colorHex ? (
              <>
                <Text style={styles.label}>Rang</Text>
                <View style={styles.colors}>
                  <View style={[styles.color, { backgroundColor: current.colorHex }]} />
                </View>
              </>
            ) : null}

            {sizes.length > 0 ? (
              <>
                <Text style={styles.label}>
                  O`lcham
                  {recommended ? (
                    <Text style={styles.recommend}> · sizga {recommended}</Text>
                  ) : null}
                </Text>
                <View style={styles.sizes}>
                  {sizes.map((item) => (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      onPress={() => setSize(item)}
                      style={[styles.size, picked === item && styles.sizeActive]}
                    >
                      <Text style={[styles.sizeText, picked === item && { color: colors.text }]}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.soldOut}>Bu mahsulot omborda tugagan</Text>
            )}

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <View style={styles.actions}>
              {resultImage ? (
                <Button
                  title={
                    picked
                      ? `Savatga · ${money(current.price, current.currency)}`
                      : 'O`lcham tanlang'
                  }
                  disabled={!picked || cart.isPending}
                  loading={cart.isPending}
                  onPress={() =>
                    picked && cart.mutate({ variantId: current.variantId, chosenSize: picked })
                  }
                />
              ) : (
                <Button
                  title="Shuni kiyintir"
                  loading={working}
                  onPress={() => {
                    setNotice(null);
                    start.mutate({ variantId: current.variantId, angle });
                  }}
                />
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Avatar yonidagi dumaloq tugma — maketdagi uslubda. */
function Control({
  icon,
  label,
  onPress,
  danger = false,
  busy = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  /** Ish ketayotganda tugma bloklanadi — takroriy bosish kredit yeydi */
  busy?: boolean;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      style={styles.control}
    >
      <View
        style={[styles.controlIcon, danger && styles.controlDanger, busy && styles.controlBusy]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Icon name={icon} size={16} color={danger ? colors.danger : colors.text} />
        )}
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { ...text.h3, color: colors.text },
  headerHint: { ...text.tiny, color: colors.textDim },

  /*
   * ⚠️ BALANDLIK NISBAT BILAN, `flex: 1` BILAN EMAS.
   *
   * `flex: 1` da sahna pastdagi ro'yxat bilan bo'sh joyni bo'lishardi va
   * kontent ko'paygan sari kichrayib borardi — skrinshotda odam kichkina
   * bo'lib, atrofida katta qora chekka qolgan edi.
   *
   * 3:4 — avatar suratining o'z nisbati, ya'ni rasm ramkani to'liq
   * to'ldiradi va chekka qolmaydi.
   */
  stage: {
    aspectRatio: 3 / 4,
    margin: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { flex: 1 },
  // Kutish paytida asl surat xiralashadi — natija bilan chalkashmasin
  dimmed: { opacity: 0.35 },

  /*
   * ⚠️ TIK EMAS, YOTIQ QATOR. Ilgari tugmalar ustma-ust turardi va
   * uchinchisi ramkadan chiqib ketib kesilardi. Pastda yotiq qator esa
   * sahna balandligiga bog'liq emas.
   */
  controls: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  controlGroup: { flexDirection: 'row', gap: spacing.md },
  control: { alignItems: 'center', gap: 2 },
  controlIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 10, 15, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDanger: { borderColor: colors.danger },
  controlBusy: { borderColor: colors.borderAccent },
  controlLabel: { ...text.tiny, color: colors.textMuted },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  overlayText: { ...text.bodyMed, color: colors.text, textAlign: 'center' },
  overlayHint: { ...text.tiny, color: colors.textDim, textAlign: 'center' },

  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  tabText: { ...text.tiny, color: colors.textDim },

  bottom: { paddingBottom: spacing.xl },
  stripLoader: { marginVertical: spacing.lg },
  emptyStrip: { ...text.small, color: colors.textDim, textAlign: 'center', padding: spacing.lg },

  strip: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  thumbWrap: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbSelected: { borderColor: colors.accent },
  thumb: { width: 72, height: 92, backgroundColor: colors.surface2 },
  readyBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyActions: { alignSelf: 'stretch', gap: spacing.sm },

  details: { paddingHorizontal: spacing.md, gap: spacing.xs },
  title: { ...text.h3, color: colors.text },
  store: { ...text.tiny, color: colors.textDim },

  label: { ...text.label, color: colors.textDim, marginTop: spacing.md },
  recommend: { ...text.tiny, color: colors.accent },

  colors: { flexDirection: 'row', gap: spacing.sm },
  color: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },

  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  size: {
    minWidth: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sizeActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  sizeText: { ...text.bodyMed, color: colors.textMuted },

  soldOut: { ...text.small, color: colors.warning, marginTop: spacing.sm },
  notice: { ...text.small, color: colors.accent, marginTop: spacing.sm },
  actions: { marginTop: spacing.md },
});
