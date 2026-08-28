import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getStoreDashboard,
  getStoreOrders,
  storeOrderAction,
  type StoreOrder,
  type StoreOrderFilter,
} from '../../src/api/endpoints';
import { ApiError } from '../../src/api/client';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { SkeletonList } from '../../src/components/Skeleton';
import { Button, Empty, ErrorView, Screen } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Sotuvchi paneli — bosh ekran.
 *
 * Bu yerdan hammasi boshqariladi: buyurtmalar, mahsulotlar, sozlamalar.
 * Sotuvchi kompyuter oldiga o'tirmasdan do'konini to'liq yuritadi.
 *
 * Tartib ish chastotasiga qarab: buyurtmalar kunlik, mahsulot va
 * sozlamalar esa vaqti-vaqti bilan — shuning uchun ular yuqorida emas.
 *
 * ⚠️ VAQT CHEGARASI BOR. `new` holatdagi buyurtma muddati o'tsa avtomatik
 * `expired` bo'ladi va mijoz yo'qoladi. Shuning uchun qolgan daqiqalar
 * kartada eng ko'zga tashlanadigan joyda turadi.
 */

const FILTERS: Array<{ key: StoreOrderFilter; label: string }> = [
  { key: 'new', label: 'Yangi' },
  { key: 'active', label: 'Jarayonda' },
  { key: 'completed', label: 'Yakunlangan' },
];

/** Holat -> keyingi qadam. `null` — bu holatda tugma yo'q. */
const NEXT_ACTION: Record<
  string,
  { action: 'confirm' | 'ready' | 'complete'; label: string } | null
> = {
  new: { action: 'confirm', label: 'Tasdiqlash' },
  seen: { action: 'confirm', label: 'Tasdiqlash' },
  confirmed: { action: 'ready', label: 'Tayyor deb belgilash' },
  ready: { action: 'complete', label: 'Topshirildi' },
  completed: null,
  rejected: null,
  expired: null,
};

export default function SellerOrders(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';
  const role = useAuthStore((state) => state.user?.role);

  const [filter, setFilter] = useState<StoreOrderFilter>('new');

  const isSeller = role === 'store_owner' || role === 'admin';

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
      Alert.alert('Bajarilmadi', err instanceof ApiError ? err.message : 'Qaytadan urinib ko`ring');
    },
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint="Do`kon paneli akkauntingizga bog`langan." />
      </Screen>
    );
  }

  // Sotuvchi emas — ariza berishga taklif qilamiz
  if (!isSeller) {
    return (
      <Screen>
        <Empty
          icon="stores"
          title="Sizda do`kon yo`q"
          hint="Do`kon ochsangiz buyurtmalar shu yerga keladi va darhol javob bera olasiz."
          action={<Button title="Do`kon ochish" onPress={() => router.push('/seller/apply')} />}
        />
      </Screen>
    );
  }

  const stats = dashboard.data;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Icon name="back" size={20} color={colors.accent} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buyurtmalar"
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

        <Text style={styles.title}>Do`konim</Text>
        {stats ? (
          <Text style={styles.subtitle}>
            {stats.newOrders} yangi · {stats.inProgress} jarayonda
          </Text>
        ) : null}
      </View>

      {/* Oylik ko'rsatkichlar */}
      {stats ? (
        <View style={styles.stats}>
          <Stat icon="bag" value={String(stats.completedMonth)} label="Bu oy yakunlangan" />
          <Stat
            icon="premium"
            value={money(stats.revenueMonth, stats.currency)}
            label="Bu oy tushum"
          />
          <Stat icon="orders" value={String(stats.productCount)} label="Mahsulot" />
        </View>
      ) : null}

      {/*
        Boshqaruv yo'llari — buyurtmalardan YUQORIDA emas, pastida turadi.
        Buyurtmalar kunlik ish, mahsulot va sozlama esa vaqti-vaqti bilan.
        Yuqoriga qo'ysak, har kirganda ular ko'zni egallardi.
      */}
      <View style={styles.manage}>
        <ManageButton
          icon="slotTop"
          label="Mahsulotlar"
          onPress={() => router.push('/seller/products')}
        />
        <ManageButton
          icon="settings"
          label="Sozlamalar"
          onPress={() => router.push('/seller/settings')}
        />
      </View>

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
                <Text style={[styles.filterText, { color: colors.text }]}>{item.label}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.filter, styles.filterIdle]}>
                <Text style={styles.filterText}>{item.label}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {orders.isLoading ? <SkeletonList count={4} /> : null}
      {orders.isError ? (
        <ErrorView error={orders.error} onRetry={() => void orders.refetch()} />
      ) : null}

      {orders.data ? (
        <FlatList
          data={orders.data.items}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.list}
          refreshing={orders.isFetching}
          onRefresh={() => void orders.refetch()}
          removeClippedSubviews
          initialNumToRender={6}
          ListEmptyComponent={
            /*
              Uzuq chiziqli ramka — bu yer TO'LDIRILISHI kerakligini
              bildiradi. Tekis ramka «shunday bo'lishi kerak» degan
              taassurot berardi.
            */
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="orders" size={34} color={colors.accent} />
              </View>

              <Text style={styles.emptyTitle}>
                {filter === 'new' ? 'Yangi buyurtma yo`q' : 'Bu yerda hozircha bo`sh'}
              </Text>

              {filter === 'new' ? (
                <Text style={styles.emptyHint}>
                  Mijoz buyurtma yuborsa shu yerda darhol ko`rinadi.
                </Text>
              ) : null}

              {/*
                ⚠️ AMAL «MAHSULOT QO'SHISH», «buyurtma qo'shish» EMAS.
                Buyurtmani MIJOZ yaratadi — sotuvchi uni qo'la olmaydi.
                Bu yerda foydali yagona qadam: katalogni to'ldirish,
                shunda buyurtma keladigan bo'ladi.
              */}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/seller/product-new')}
                style={styles.emptyAction}
              >
                <View style={styles.emptyActionIcon}>
                  <Icon name="premium" size={14} color={colors.text} />
                </View>
                <Text style={styles.emptyActionText}>Mahsulot qo`shish</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              busy={act.isPending && act.variables?.id === item.id}
              onAction={(action, body) => act.mutate({ id: item.id, action, body })}
            />
          )}
        />
      ) : null}
    </Screen>
  );
}

function ManageButton({
  icon,
  label,
  onPress,
}: {
  icon: 'slotTop' | 'settings';
  label: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.manageButton}>
      <Icon name={icon} size={18} color={colors.accent} />
      <Text style={styles.manageText}>{label}</Text>
    </Pressable>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: IconName;
  value: string;
  label: string;
}): JSX.Element {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Icon name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      {/*
        ⚠️ IKKI QATOR. Bitta qatorda «Bu oy yakunlangan» uch ustunli
        kartaga sig'masdi va «Bu oy yakunlan…» bo'lib kesilardi.
      */}
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
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
  const next = NEXT_ACTION[order.status] ?? null;

  /*
   * Rad etish sababsiz yuborilmaydi — server `reason` talab qiladi.
   * To'liq ro'yxat o'rniga uchta eng ko'p uchraydigani beriladi: uzun
   * ro'yxat tez javob berishga xalaqit qiladi.
   */
  const reject = (): void => {
    Alert.alert('Buyurtmani rad etish', 'Sababini tanlang', [
      { text: 'Mahsulot tugagan', onPress: () => onAction('reject', { reason: 'out_of_stock' }) },
      { text: 'O`lcham yo`q', onPress: () => onAction('reject', { reason: 'size_unavailable' }) },
      { text: 'Boshqa sabab', onPress: () => onAction('reject', { reason: 'other' }) },
      { text: 'Bekor qilish', style: 'cancel' },
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
              {order.minutesLeft} daqiqa
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
          {order.deliveryType === 'pickup' ? 'Olib ketish' : 'Yetkazish'}
        </Text>
      </View>

      {order.address ? (
        <Text style={styles.address} numberOfLines={2}>
          {order.address}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Qo`ng`iroq"
          onPress={() => void Linking.openURL(`tel:${order.customer.phone}`)}
          style={styles.callButton}
        >
          <Icon name="stores" size={18} color={colors.accent} />
        </Pressable>

        {next ? (
          <View style={styles.actionMain}>
            <Button title={next.label} onPress={() => onAction(next.action)} loading={busy} />
          </View>
        ) : null}

        {order.status === 'new' || order.status === 'seen' ? (
          <View style={styles.actionSecondary}>
            <Button title="Rad etish" variant="danger" onPress={reject} disabled={busy} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xs },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
  },
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
  title: { ...text.h1, color: colors.text },
  subtitle: { ...text.small, color: colors.textMuted, marginTop: 2 },

  stats: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    gap: spacing.xs,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.xs,
  },
  statValue: { ...text.h3, color: colors.accent },
  statLabel: { ...text.tiny, color: colors.textDim },

  manage: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  manageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  manageText: { ...text.small, color: colors.text },

  filters: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  filterWrap: { flex: 1 },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  // Faol chip gradient bilan chiziladi, bu esa tanlanmagani
  filterIdle: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterText: { ...text.small, color: colors.textMuted, fontWeight: '600' },

  emptyBox: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    // Uzuq chiziq — bu yer to'ldirilishi kerakligini bildiradi
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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

  list: { padding: spacing.md, gap: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { ...text.bodyMed, color: colors.text },

  timer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMain: { flex: 1 },
  actionSecondary: { flex: 1 },
});
