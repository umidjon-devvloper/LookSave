import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getStoreDashboard,
  getStoreOrders,
  getStoreProfile,
  storeOrderAction,
  type StoreOrder,
  type StoreOrderFilter,
} from '../../src/api/endpoints';
import { explainError } from '../../src/api/explainError';
import { Icon } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { SkeletonList } from '../../src/components/Skeleton';
import { Button, Empty, ErrorView, Screen } from '../../src/components/ui';
import { translations, useI18n, type Dictionary } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * Sotuvchi paneli — bosh ekran.
 *
 * Bu yerdan hammasi boshqariladi: buyurtmalar, mahsulotlar, sozlamalar.
 * Sotuvchi kompyuter oldiga o'tirmasdan do'konini to'liq yuritadi.
 *
 * PREMIUM TUZILISH: sarlavha + tushum kartasi + boshqaruv + filtrlar hammasi
 * ro'yxat bilan BIRGA suriladi (`ListHeaderComponent`). Ilgari ular qotib
 * turardi va buyurtmalarga tor oyna qolardi.
 *
 * ⚠️ VAQT CHEGARASI BOR. `new` holatdagi buyurtma muddati o'tsa avtomatik
 * `expired` bo'ladi va mijoz yo'qoladi. Shuning uchun qolgan daqiqalar
 * kartada eng ko'zga tashlanadigan joyda turadi.
 */

const FILTERS: Array<{ key: StoreOrderFilter; labelKey: keyof Dictionary['seller'] }> = [
  { key: 'new', labelKey: 'filterNew' },
  { key: 'active', labelKey: 'filterInProgress' },
  { key: 'completed', labelKey: 'filterCompleted' },
];

/** Holat -> keyingi qadam. `null` — bu holatda tugma yo'q. Yorlig'i i18n'dan. */
const NEXT_ACTION: Record<
  string,
  { action: 'confirm' | 'ready' | 'complete'; labelKey: keyof Dictionary['seller'] } | null
> = {
  new: { action: 'confirm', labelKey: 'actConfirm' },
  seen: { action: 'confirm', labelKey: 'actConfirm' },
  confirmed: { action: 'ready', labelKey: 'actReady' },
  ready: { action: 'complete', labelKey: 'actComplete' },
  completed: null,
  rejected: null,
  expired: null,
};

/**
 * Manzil matni — SATR yoki {text,lat,lng} OBYEKT bo'lishi mumkin.
 *
 * ⚠️ HIMOYA: eski API manzilni obyekt qaytarardi va uni to'g'ridan-to'g'ri
 * `<Text>` da chizsak «Objects are not valid as a React child» bilan ekran
 * qulardi. Endi ikkalasidan ham xavfsiz matn olinadi.
 */
function addressText(address: unknown): string {
  if (typeof address === 'string') return address;
  if (address && typeof address === 'object') {
    const value = (address as { text?: unknown }).text;
    if (typeof value === 'string') return value;
  }
  return '';
}

/** Mijoz tanlagan nuqta {lat,lng}, yo'q bo'lsa null — xarita tugmasi uchun. */
function addressCoords(address: unknown): { lat: number; lng: number } | null {
  if (!address || typeof address !== 'object') return null;
  const { lat, lng } = address as { lat?: unknown; lng?: unknown };
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  return null;
}

/**
 * Yangi buyurtma kelganda ovoz + banner.
 *
 * ⚠️ NEGA LOKAL BILDIRISHNOMA: server push faqat haqiqiy qurilmada va
 * EXPO_ACCESS_TOKEN sozlanganda ishlaydi. Panel ochiq turganda esa sotuvchi
 * darhol sezishi kerak — shuning uchun navbat kuzatiladi va yangi buyurtma
 * aniqlanganda darhol lokal bildirishnoma chiqariladi (ovoz + banner). Ovoz
 * va ko'rinish `usePush` dagi global handler orqali oldinda ham ishlaydi.
 */
async function playNewOrderAlert(count: number): Promise<void> {
  const s = translations().seller;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: count > 1 ? s.notifyMultiTitle.replace('{n}', String(count)) : s.notifyTitle,
        body: s.notifyBody,
        sound: 'default',
        data: { type: 'store_order' },
      },
      trigger: null, // darhol
    });
  } catch {
    // Ruxsat yo'q yoki qo'llab-quvvatlanmaydi — jim o'tkaziladi
  }
}

export default function SellerOrders(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';
  const role = useAuthStore((state) => state.user?.role);

  const [filter, setFilter] = useState<StoreOrderFilter>('new');

  const isSeller = role === 'store_owner' || role === 'admin';

  const profile = useQuery({
    queryKey: ['store', 'profile'],
    queryFn: getStoreProfile,
    enabled: signedIn && isSeller,
    staleTime: 5 * 60_000,
  });

  const dashboard = useQuery({
    queryKey: ['store', 'dashboard'],
    queryFn: getStoreDashboard,
    enabled: signedIn && isSeller,
  });

  const orders = useQuery({
    queryKey: ['store', 'orders', filter],
    queryFn: () => getStoreOrders(filter),
    enabled: signedIn && isSeller,
    /*
     * Yangi buyurtmalar ro'yxati o'zi yangilanadi: sotuvchi ekranni ochiq
     * qoldirishi mumkin va qo'lda tortib yangilashni kutib bo'lmaydi.
     * Faqat `new` filtrida — qolganlari shoshilinch emas.
     */
    refetchInterval: filter === 'new' ? 30_000 : false,
  });

  /*
   * Yangi buyurtma kelganini kuzatish: `new` navbati soni OSHGANDA ovoz +
   * banner. Birinchi yuklanishda jim (oldingi son yo'q). Boshqa filtrga
   * o'tilsa hisob tiklanadi — qaytilganda eski buyurtmalarga ovoz chiqmaydi.
   */
  const prevNewCount = useRef<number | null>(null);
  useEffect(() => {
    if (filter !== 'new') {
      prevNewCount.current = null;
      return;
    }
    const count = orders.data?.items.length;
    if (count === undefined) return;

    if (prevNewCount.current !== null && count > prevNewCount.current) {
      void playNewOrderAlert(count - prevNewCount.current);
    }
    prevNewCount.current = count;
  }, [orders.data, filter]);

  const act = useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: 'confirm' | 'ready' | 'complete' | 'reject';
      body?: Record<string, unknown>;
    }) => storeOrderAction(id, action, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store'] });
    },
    onError: (err) => {
      Alert.alert(t.seller.actionFailed, explainError(err, t));
    },
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint={t.seller.panelSignInHint} />
      </Screen>
    );
  }

  // Sotuvchi emas — ariza berishga taklif qilamiz
  if (!isSeller) {
    return (
      <Screen>
        <Empty
          icon="stores"
          title={t.seller.noStoreTitle}
          hint={t.seller.noStoreHint}
          action={
            <Button title={t.seller.applyTitle} onPress={() => router.push('/seller/apply')} />
          }
        />
      </Screen>
    );
  }

  const stats = dashboard.data;
  const store = profile.data;

  const header = (
    <View>
      <LinearGradient
        colors={['#1D1636', '#120E1C', colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            onPress={() => goBack('/profile')}
            style={styles.iconButton}
          >
            <Icon name="back" size={20} color={colors.accent} />
          </Pressable>

          <Text style={styles.eyebrow}>
            LOOK<Text style={styles.eyebrowAccent}>SAVE</Text> · SELLER
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yangi buyurtmalar"
            onPress={() => setFilter('new')}
            style={styles.iconButton}
          >
            <Icon name="bell" size={20} color={colors.accent} />
            {stats && stats.newOrders > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {stats.newOrders > 9 ? '9+' : stats.newOrders}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Do'kon o'ziga xosligi — real nom, logo va ish holati */}
        <View style={styles.identity}>
          <View style={styles.logoTile}>
            {store?.logoUrl ? (
              <Image source={{ uri: store.logoUrl }} style={styles.logoImg} resizeMode="cover" />
            ) : (
              <Icon name="shop" size={26} color={colors.text} />
            )}
          </View>

          <View style={styles.identityText}>
            <Text style={styles.storeName} numberOfLines={1}>
              {store?.name ?? t.profile.myStore}
            </Text>

            {store ? (
              <View
                style={[styles.statusPill, store.isOpen ? styles.statusOpen : styles.statusClosed]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: store.isOpen ? colors.success : colors.textDim },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: store.isOpen ? colors.success : colors.textMuted },
                  ]}
                >
                  {store.isOpen
                    ? store.closesAt
                      ? t.stores.openUntil.replace('{time}', store.closesAt)
                      : t.stores.open
                    : store.opensAt
                      ? t.stores.closedOpensAt.replace('{time}', store.opensAt)
                      : t.stores.closed}
                </Text>
              </View>
            ) : (
              <Text style={styles.subtitle}>{t.seller.adminPanel}</Text>
            )}
          </View>
        </View>

        {stats ? (
          <Text style={styles.subtitle}>
            <Text style={styles.subtitleStrong}>{stats.newOrders}</Text> {t.seller.statNew} ·{' '}
            <Text style={styles.subtitleStrong}>{stats.inProgress}</Text> {t.seller.statInProgress}
          </Text>
        ) : null}
      </LinearGradient>

      {/* Hero: oylik tushum — sotuvchi uchun eng muhim raqam */}
      {stats ? (
        <LinearGradient
          colors={['#271B47', '#17121F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>{t.seller.revenueLabel}</Text>
            <View style={styles.heroBadge}>
              <Icon name="premium" size={16} color={colors.accent} />
            </View>
          </View>

          <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
            {money(stats.revenueMonth, stats.currency)}
          </Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Icon name="authentic" size={14} color={colors.success} />
              <Text style={styles.heroStatText}>
                {stats.completedMonth} {t.seller.completedWord}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Icon name="orders" size={14} color={colors.accent} />
              <Text style={styles.heroStatText}>
                {stats.productCount} {t.seller.productWord}
              </Text>
            </View>
          </View>
        </LinearGradient>
      ) : null}

      {/*
        Boshqaruv — 2 ustunli plitalar. Buyurtmalar kunlik ish, mahsulot va
        sozlama esa vaqti-vaqti bilan, shuning uchun ular pastda.
      */}
      <View style={styles.manage}>
        <ManageTile
          icon="slotTop"
          label={t.seller.productsTitle}
          hint={
            stats ? t.seller.inCatalog.replace('{n}', String(stats.productCount)) : t.seller.catalogWord
          }
          onPress={() => router.push('/seller/products')}
        />
        <ManageTile
          icon="settings"
          label={t.seller.settingsTitle}
          hint={t.seller.storeProfileHint}
          onPress={() => router.push('/seller/settings')}
        />
      </View>

      {/* Buyurtma filtrlari */}
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item.key }}
            onPress={() => setFilter(item.key)}
            style={styles.filterWrap}
          >
            {filter === item.key ? (
              <LinearGradient
                colors={[colors.accent, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.filter}
              >
                <Text style={[styles.filterText, { color: colors.text }]}>
                  {t.seller[item.labelKey]}
                </Text>
              </LinearGradient>
            ) : (
              <View style={[styles.filter, styles.filterIdle]}>
                <Text style={styles.filterText}>{t.seller[item.labelKey]}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {orders.isLoading ? (
        <View style={styles.statePad}>
          <SkeletonList count={4} />
        </View>
      ) : null}
      {orders.isError ? (
        <View style={styles.statePad}>
          <ErrorView error={orders.error} onRetry={() => void orders.refetch()} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={orders.data?.items ?? []}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.scroll}
        refreshing={orders.isFetching}
        onRefresh={() => void orders.refetch()}
        removeClippedSubviews
        initialNumToRender={6}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          // Yuklanayotganda skelet sarlavhada ko'rsatiladi — bu yerda emas
          orders.data && !orders.isError ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="orders" size={34} color={colors.accent} />
              </View>

              <Text style={styles.emptyTitle}>
                {filter === 'new' ? t.seller.emptyNewTitle : t.seller.emptyOtherTitle}
              </Text>

              {filter === 'new' ? (
                <Text style={styles.emptyHint}>{t.seller.emptyNewHint}</Text>
              ) : null}

              {/*
                ⚠️ AMAL «MAHSULOT QO'SHISH», «buyurtma qo'shish» EMAS.
                Buyurtmani MIJOZ yaratadi — sotuvchi uni qo'la olmaydi.
              */}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/seller/product-new')}
                style={styles.emptyAction}
              >
                <View style={styles.emptyActionIcon}>
                  <Icon name="premium" size={14} color={colors.text} />
                </View>
                <Text style={styles.emptyActionText}>{t.seller.addProduct}</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <OrderCard
              order={item}
              busy={act.isPending && act.variables?.id === item.id}
              onAction={(action, body) => act.mutate({ id: item.id, action, body })}
            />
          </View>
        )}
      />
    </Screen>
  );
}

function ManageTile({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: 'slotTop' | 'settings';
  label: string;
  hint: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.manageTile, pressed && styles.manageTilePressed]}
    >
      <View style={styles.manageIcon}>
        <Icon name={icon} size={20} color={colors.accent} />
      </View>
      <Text style={styles.manageLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.manageHint} numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
  );
}

function OrderCard({
  order,
  busy,
  onAction,
}: {
  order: StoreOrder;
  busy: boolean;
  onAction: (
    action: 'confirm' | 'ready' | 'complete' | 'reject',
    body?: Record<string, unknown>,
  ) => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const next = NEXT_ACTION[order.status] ?? null;

  /*
   * Rad etish sababsiz yuborilmaydi — server `reason` talab qiladi.
   * To'liq ro'yxat o'rniga uchta eng ko'p uchraydigani beriladi: uzun
   * ro'yxat tez javob berishga xalaqit qiladi.
   */
  const reject = (): void => {
    Alert.alert(t.seller.rejectTitle, t.seller.rejectPrompt, [
      { text: t.seller.rejectOutOfStock, onPress: () => onAction('reject', { reason: 'out_of_stock' }) },
      { text: t.seller.rejectNoSize, onPress: () => onAction('reject', { reason: 'size_unavailable' }) },
      { text: t.seller.rejectOther, onPress: () => onAction('reject', { reason: 'other' }) },
      { text: t.common.cancel, style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>

        {/*
          Qolgan vaqt — eng muhim raqam. Muddati o'tsa buyurtma avtomatik
          bekor bo'ladi va mijoz boshqa do'konga ketadi.
        */}
        {order.minutesLeft !== null ? (
          <View style={[styles.timer, order.minutesLeft <= 5 && styles.timerUrgent]}>
            <Text style={[styles.timerText, order.minutesLeft <= 5 && { color: colors.danger }]}>
              {order.minutesLeft} {t.seller.minutesWord}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.customer}>{order.customer.name}</Text>

      {order.items.map((item, index) => (
        <Text key={index} style={styles.item} numberOfLines={1}>
          {item.qty}× {item.title}
          {item.size ? ` · ${item.size}` : ''}
        </Text>
      ))}

      <View style={styles.cardBottom}>
        <Text style={styles.total}>{money(order.total, order.currency)}</Text>
        <Text style={styles.delivery}>
          {order.deliveryType === 'pickup' ? t.seller.pickupShort : t.seller.deliveryShort}
          {order.deliveryWhen ? ` · ${order.deliveryWhen}` : ''}
        </Text>
      </View>

      {addressText(order.address) ? (
        <Text style={styles.address} numberOfLines={2}>
          {addressText(order.address)}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mijozga qo`ng`iroq"
          onPress={() => void Linking.openURL(`tel:${order.customer.phone}`)}
          style={styles.callButton}
        >
          <Icon name="phone" size={18} color={colors.accent} />
        </Pressable>

        {addressCoords(order.address) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manzilni xaritada ochish"
            onPress={() => {
              const c = addressCoords(order.address)!;
              // Universal `geo:` link iOS'da ishlamaydi — Google Maps web
              // havolasi ikkala tizim ham ochadi (iOS tanlov beradi).
              void Linking.openURL(`https://maps.google.com/?q=${c.lat},${c.lng}`);
            }}
            style={styles.callButton}
          >
            <Icon name="location" size={18} color={colors.accent} />
          </Pressable>
        ) : null}

        {next ? (
          <View style={styles.actionMain}>
            <Button
              title={t.seller[next.labelKey]}
              onPress={() => onAction(next.action)}
              loading={busy}
            />
          </View>
        ) : null}

        {order.status === 'new' || order.status === 'seen' ? (
          <View style={styles.actionSecondary}>
            <Button title={t.seller.reject} variant="danger" onPress={reject} disabled={busy} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },

  // ── Sarlavha ──
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(20, 18, 28, 0.74)',
  },
  eyebrow: { ...text.wordmark, fontSize: 11, letterSpacing: 2.5, color: colors.textMuted },
  eyebrowAccent: { color: colors.accent },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  bellBadgeText: { ...text.tiny, color: colors.text, fontWeight: '700' },

  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoTile: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  logoImg: { width: '100%', height: '100%' },
  identityText: { flex: 1, gap: spacing.xs },
  storeName: { ...text.h1, color: colors.text },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusOpen: { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.1)' },
  statusClosed: { borderColor: colors.border, backgroundColor: colors.surface2 },
  statusDot: { width: 7, height: 7, borderRadius: radius.pill },
  statusText: { ...text.tiny },
  subtitle: { ...text.body, color: colors.textMuted },
  subtitleStrong: { color: colors.text, fontWeight: '700' },

  // ── Hero: oylik tushum ──
  hero: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { ...text.label, color: colors.accent },
  heroBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  heroValue: { ...text.hero, color: colors.text, marginTop: spacing.xs },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  heroStatText: { ...text.small, color: colors.textMuted },
  heroDivider: { width: 1, height: 14, backgroundColor: colors.borderStrong },

  // ── Boshqaruv plitalari ──
  manage: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  manageTile: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  manageTilePressed: { borderColor: colors.accent, backgroundColor: colors.surface2 },
  manageIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  manageLabel: { ...text.bodyMed, color: colors.text, marginTop: spacing.xs },
  manageHint: { ...text.tiny, color: colors.textDim },

  // ── Filtrlar ──
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(15, 13, 22, 0.92)',
  },
  filterWrap: { flex: 1 },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  filterIdle: { borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent' },
  filterText: { ...text.small, color: colors.textMuted, fontWeight: '600' },

  statePad: { paddingHorizontal: spacing.md, marginTop: spacing.md },

  // ── Bo'sh holat ──
  emptyBox: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(20, 18, 28, 0.55)',
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.xs,
  },
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  emptyHint: { ...text.small, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.xs + 2,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyActionIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  emptyActionText: { ...text.small, color: colors.text, fontWeight: '600' },

  // ── Buyurtma kartasi ──
  cardWrap: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  card: {
    backgroundColor: 'rgba(20, 18, 28, 0.95)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { ...text.bodyMed, color: colors.text },

  timer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  timerUrgent: { backgroundColor: 'rgba(239, 68, 68, 0.14)' },
  timerText: { ...text.tiny, color: colors.textMuted },

  customer: { ...text.small, color: colors.textMuted },
  item: { ...text.small, color: colors.text },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  total: { ...text.h3, color: colors.text },
  delivery: { ...text.tiny, color: colors.textDim },
  address: { ...text.tiny, color: colors.textDim },

  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  callButton: {
    width: 48,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  actionMain: { flex: 1 },
  actionSecondary: { flex: 1 },
});
