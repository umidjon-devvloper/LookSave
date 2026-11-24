import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStore, getStoreProducts } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { Button, Empty, ErrorView, Loading, Screen } from '../../src/components/ui';
import { useLookToggle } from '../../src/hooks/useLookToggle';
import { useI18n } from '../../src/i18n';
import { goBack } from '../../src/navigation/back';
import { money } from '../../src/theme/format';
import { APP_MAX_WIDTH } from '../../src/theme/responsive';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Do'kon sahifasi — premium ko'rinish.
 *
 * ⚠️ ILGARI YASSI ZANJIR EDI: nom, status, manzil, mo'ljal, tugmalar va
 * yetkazib berish qatori — hammasi bir xil og'irlikdagi matn qatorlari
 * sifatida ketma-ket turardi va «ariza namunasi» tuyg'usi berardi.
 * Endi butun ma'lumot bitta ko'tarilgan karta ichida: chapda do'kon
 * tamg'asi (logo yoki initsial), o'ngda nom va status pili, pastroqda
 * ikonkali qatorlar, oxirida gradientli asosiy tugma va delivery chip.
 *
 * ⚠️ MAHSULOTLAR OXIRIGACHA YUKLANADI (2026-11-18). Ilgari bitta so'rov
 * (20 ta) bilan to'xtardi: 71 mahsulotli do'konda «Katalog 20» chiqardi va
 * qolgan 51 tasini ko'rishning iloji yo'q edi. Endi ro'yxat pastga
 * aylantirilganda keyingi sahifa so'raladi, sanagich esa do'kondagi
 * UMUMIY sonni ko'rsatadi.
 */

/** Tamg'a (logo/initsial) doirasining tashqi o'lchami */
const AVATAR_SIZE = 72;

export default function Store(): JSX.Element {
  const t = useI18n((state) => state.t);
  const isRTL = useI18n((state) => state.isRTL);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const look = useLookToggle();
  /*
   * Karta kengligi aniq hisoblanadi, `flex: 1` emas: mahsulotlar soni toq
   * bo'lsa oxirgi qatordagi yakka karta butun qatorga cho'zilib, ulkan
   * bo'lib qolardi.
   *
   * ⚠️ iPad'da `Screen` kontenti 520pt da markazga cheklangan
   * (`src/theme/responsive.ts`), lekin `useWindowDimensions()` haqiqiy
   * oyna kengligini (iPad'da ~820pt) qaytaradi. `Math.min` bilan cheklamasak
   * karta kengligi 400pt chiqadi va ikki kartaning yarmi konteynerdan tashqariga
   * kesiladi.
   */
  const containerWidth = Math.min(width, APP_MAX_WIDTH);
  const cardWidth = Math.floor((containerWidth - spacing.md * 2 - spacing.sm) / 2);

  const store = useQuery({
    queryKey: ['store', id],
    queryFn: () => getStore(id),
    enabled: Boolean(id),
  });
  const products = useInfiniteQuery({
    queryKey: ['store', id, 'products'],
    queryFn: ({ pageParam }) => getStoreProducts(id, pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    enabled: Boolean(id),
  });

  if (store.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (store.isError || !store.data) {
    return (
      <Screen>
        <ErrorView message={t.common.notFound} onRetry={() => void store.refetch()} />
      </Screen>
    );
  }

  const data = store.data;
  const initial = (data.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const items = products.data?.pages.flatMap((page) => page.items) ?? [];
  /*
   * Sanagich — do'kondagi umumiy son, ekranga yuklanganlari emas. Server uni
   * alohida bermaydi, lekin toifalar bo'yicha sonlar bor — yig'indisi shu.
   * Hammasi yuklangach aniq son (yuklanganlar) ko'rsatiladi.
   */
  const categoryTotal = (data.categories ?? []).reduce((sum, item) => sum + (item.count ?? 0), 0);
  const totalCount = products.hasNextPage ? Math.max(categoryTotal, items.length) : items.length;

  const statusText = data.isOpen
    ? data.closesAt
      ? t.stores.openUntil.replace('{time}', data.closesAt)
      : t.stores.open
    : data.opensAt
      ? t.stores.closedOpensAt.replace('{time}', data.opensAt)
      : t.stores.closed;
  const statusColor = data.isOpen ? colors.success : colors.textDim;

  return (
    <Screen>
      {/* Suzuvchi orqaga tugmasi — karta ustida turadi, ekran chetiga yopishgan */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.back ?? 'Orqaga'}
        onPress={() => goBack('/stores')}
        hitSlop={10}
        style={[styles.backBtn, { top: insets.top + spacing.sm }]}
      >
        <Icon name="back" size={20} color={colors.text} />
      </Pressable>

      <FlatList
        data={items}
        // «Look» holati o'zgarganda kartalar qayta chizilsin (ro'yxatning o'zi o'zgarmaydi)
        extraData={look.items}
        keyExtractor={(product) => product.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 56 }]}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          // `isFetchingNextPage` shart: usiz bitta aylantirishda bir necha so'rov ketadi
          if (products.hasNextPage && !products.isFetchingNextPage) {
            void products.fetchNextPage();
          }
        }}
        ListFooterComponent={
          products.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
          ) : null
        }
        ListHeaderComponent={
          <View>
            {/*
              Hero karta — binafsha chekka va yumshoq ichki yorug'lik bilan
              «premium» hissi beradi. LinearGradient fonda tungi binafsha
              o'tishini chizadi, chekkaga esa accent chegara yopishgan.
            */}
            <View style={styles.heroCard}>
              <LinearGradient
                colors={[colors.primarySoft, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Yuqori qator: tamg'a + nom + handle + status pili */}
              <View style={styles.heroTop}>
                <StoreAvatar logoUrl={data.logoUrl} name={data.name} initial={initial} />

                <View style={styles.heroIdentity}>
                  <Text style={styles.name} numberOfLines={1}>
                    {data.name}
                  </Text>
                  {data.username ? (
                    <Text style={styles.handle} numberOfLines={1}>
                      @{data.username}
                    </Text>
                  ) : null}
                  <View style={[styles.statusPill, { borderColor: statusColor + '55' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                      {statusText}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Ikonkali meta qatorlar */}
              <View style={styles.metaBlock}>
                {data.address ? (
                  <View style={styles.metaRow}>
                    <View style={styles.metaIcon}>
                      <Icon name="stores" size={14} color={colors.accent} />
                    </View>
                    <Text style={styles.metaText} numberOfLines={2}>
                      {data.address}
                    </Text>
                  </View>
                ) : null}
                {data.landmark ? (
                  <View style={styles.metaRow}>
                    <View style={styles.metaIcon}>
                      <Icon name="location" size={14} color={colors.accent} />
                    </View>
                    <Text style={styles.metaText} numberOfLines={2}>
                      {t.stores.landmarkLine.replace('{x}', data.landmark)}
                    </Text>
                  </View>
                ) : null}
                {data.avgResponseMin !== null ? (
                  <View style={styles.metaRow}>
                    <View style={styles.metaIcon}>
                      <Icon name="clock" size={14} color={colors.accent} />
                    </View>
                    <Text style={styles.metaText} numberOfLines={1}>
                      {t.stores.respondsIn.replace('{n}', String(data.avgResponseMin))}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Asosiy amallar — chapda gradient primary, o'ngda ghost */}
              <View style={styles.actions}>
                <View style={styles.actionFlex}>
                  <Button
                    title={t.stores.call}
                    icon="phone"
                    onPress={() => void Linking.openURL(`tel:${data.phone}`)}
                  />
                </View>
                <View style={styles.actionFlex}>
                  <Button
                    title={t.stores.directions}
                    icon="location"
                    variant="ghost"
                    onPress={() =>
                      void Linking.openURL(
                        `https://maps.google.com/?q=${data.location.lat},${data.location.lng}`,
                      )
                    }
                  />
                </View>
              </View>

              {/* Yetkazib berish chip */}
              <View style={styles.deliveryChip}>
                <Icon
                  name="delivery"
                  size={14}
                  color={data.delivery.enabled ? colors.success : colors.textDim}
                />
                <Text style={styles.deliveryText}>
                  {data.delivery.enabled
                    ? `${t.stores.deliveryUpTo.replace('{km}', (data.delivery.radiusM / 1000).toFixed(0))} · ${
                        Number(data.delivery.fee) === 0
                          ? t.stores.deliveryFree
                          : money(data.delivery.fee, data.currency)
                      }${
                        data.delivery.freeFrom
                          ? ` · ${t.stores.freeFrom.replace('{x}', money(data.delivery.freeFrom, data.currency))}`
                          : ''
                      }`
                    : t.stores.pickupOnly}
                </Text>
              </View>
            </View>

            {/* Mahsulotlar sarlavhasi */}
            {items.length > 0 ? (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t.catalog.title.toUpperCase()}</Text>
                <Text style={styles.sectionCount}>{totalCount}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { width: cardWidth }]}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <View>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]} />
              )}
              {/*
                «Look» tugmasi — bosh sahifadagi kartalar bilan bir xil ko'rinish
                va qoida (`useLookToggle`): kiyimni kiyintirish savatiga qo'shadi.
                Egasining talabi (2026-11-18).
              */}
              <LookPill
                inLook={look.inLook(item.id)}
                isRTL={isRTL}
                onPress={() => look.toggle(item)}
              />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.price}>{money(item.price, item.currency)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          products.isLoading ? (
            <Loading />
          ) : products.isError ? (
            // Ilgari yuklash xatosi ham «mahsulot yo'q» bo'lib ko'rinardi
            <ErrorView error={products.error} onRetry={() => void products.refetch()} />
          ) : (
            <Empty title={t.stores.noProducts} />
          )
        }
      />
    </Screen>
  );
}

/** Rasmning pastki burchagidagi «Look» pili — bosilganda kartaning o'zi ochilmaydi. */
function LookPill({
  inLook,
  isRTL,
  onPress,
}: {
  inLook: boolean;
  isRTL: boolean;
  onPress: () => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={inLook ? t.tryon.removeFromLook : t.tryon.addToLook}
      accessibilityState={{ selected: inLook }}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      hitSlop={6}
      style={[
        styles.lookBtn,
        inLook && styles.lookBtnOn,
        isRTL ? { right: spacing.sm, left: undefined } : null,
      ]}
    >
      <Icon
        name={inLook ? 'check' : 'looks'}
        size={13}
        color={inLook ? colors.textOnPrimary : colors.primary}
      />
      <Text style={[styles.lookBtnText, inLook && { color: colors.textOnPrimary }]}>
        {/* «Look» — brend atamasi, har tilda bir xil; qo'shilgan holati tarjima qilinadi */}
        {inLook ? t.tryon.inLook : 'Look'}
      </Text>
    </Pressable>
  );
}

/**
 * Do'kon tamg'asi: logo bo'lsa — doira ichida, bo'lmasa — bosh harf.
 *
 * ⚠️ ILGARI BU YERDA LOGO UMUMAN CHIQMASDI: sotuvchi logo yuklagan bo'lsa
 * ham sahifa doim bosh harfni chizardi (2026-11-18, egasining talabi).
 *
 * Logo `cover` bilan to'ldiriladi: sotuvchi uni kvadrat qilib kesib yuklaydi
 * (`seller/settings.tsx`, `aspect: [1, 1]`), doira faqat burchaklarini oladi.
 * Atrofida ingichka gradient halqa va oq oraliq — logo fon rangidan qat'i
 * nazar kartadan ajralib turadi. Rasm yuklanmasa bosh harfga qaytadi.
 */
function StoreAvatar({
  logoUrl,
  name,
  initial,
}: {
  logoUrl: string | null;
  name: string;
  initial: string;
}): JSX.Element {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <View style={styles.avatarShadow}>
        <LinearGradient
          colors={[colors.accent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <View style={styles.avatarGap}>
            <Image
              source={{ uri: logoUrl }}
              style={styles.avatarImage}
              resizeMode="cover"
              accessibilityLabel={name}
              onError={() => setFailed(true)}
            />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.avatarShadow}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatar}
      >
        <Text style={styles.avatarInitial}>{initial}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },

  // ── Suzuvchi orqaga tugmasi — premium oq doira binafsha glow bilan ──
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // ── Hero karta — premium: soft purple gradient fon + binafsha glow shadow ──
  heroCard: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.28)',
    backgroundColor: '#FBF7FF',
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  heroTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  /*
   * Soya ALOHIDA o'ramda: rasm doiraga `overflow: 'hidden'` bilan kesiladi,
   * iOS'da esa kesilgan ko'rinishning o'z soyasi ham kesilib ketadi.
   */
  avatarShadow: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    shadowColor: '#A855F7',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // Logo: gradient halqa → oq oraliq → doira rasm
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    padding: 2.5,
  },
  avatarGap: {
    flex: 1,
    borderRadius: AVATAR_SIZE / 2,
    padding: 2.5,
    backgroundColor: '#FFFFFF',
  },
  avatarImage: {
    flex: 1,
    width: '100%',
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface2,
  },
  // Logo yo'q: bosh harf gradient doirada
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  avatarInitial: {
    ...text.h2,
    color: colors.textOnPrimary,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  heroIdentity: { flex: 1, minWidth: 0, gap: 3 },
  name: { ...text.h2, color: colors.text, letterSpacing: -0.4 },
  handle: { ...text.small, color: colors.accent, marginBottom: spacing.xs },

  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusText: { ...text.tiny, letterSpacing: 0.3 },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },

  // ── Meta qatorlar ──
  metaBlock: { gap: spacing.sm + 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  metaIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    marginTop: 1,
  },
  metaText: { ...text.body, color: colors.text, flex: 1, fontWeight: '500' },

  // ── Amallar ──
  actions: { flexDirection: 'row', gap: spacing.sm + 2 },
  actionFlex: { flex: 1 },

  // ── Delivery chip ── (premium: yashil soft fon + yoqimli border)
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
  },
  deliveryText: { ...text.small, color: colors.text, flex: 1, fontWeight: '500' },

  // ── Mahsulotlar sarlavhasi — premium: katta title + binafsha pill count ──
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: { ...text.h2, color: colors.text, letterSpacing: -0.3 },
  sectionCount: {
    ...text.small,
    color: colors.textOnPrimary,
    fontWeight: '800',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },

  // ── Mahsulot kartasi — premium: oq karta + binafsha soft shadow ──
  footerLoader: { paddingVertical: spacing.lg },
  // Kenglik komponentda hisoblanadi (`cardWidth`) — `flex: 1` toq sonda oxirgi kartani cho'zardi
  card: {
    gap: 2,
    marginBottom: spacing.md,
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#15131E',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  imagePlaceholder: { borderWidth: 1, borderColor: colors.border },
  // «Look» pili — bosh sahifadagi karta bilan bir xil (`app/(tabs)/index.tsx`)
  lookBtn: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  lookBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lookBtnText: { ...text.tiny, color: colors.text, letterSpacing: 0.3 },
  cardTitle: {
    ...text.small,
    color: colors.text,
    marginTop: spacing.sm,
    paddingHorizontal: 4,
  },
  price: {
    ...text.price,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
});
